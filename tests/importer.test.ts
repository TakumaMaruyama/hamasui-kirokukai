import { beforeEach, describe, expect, it, vi } from "vitest";

const mockState = vi.hoisted(() => ({
  athleteFindFirst: vi.fn(),
  athleteCreate: vi.fn(),
  athleteUpdate: vi.fn(),
  meetCreate: vi.fn(),
  eventFindFirst: vi.fn(),
  eventCreate: vi.fn(),
  resultUpsert: vi.fn(),
  resultFindMany: vi.fn(),
  resultUpdate: vi.fn(),
  transaction: vi.fn()
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    athlete: {
      findFirst: (...args: unknown[]) => mockState.athleteFindFirst(...args),
      create: (...args: unknown[]) => mockState.athleteCreate(...args),
      update: (...args: unknown[]) => mockState.athleteUpdate(...args)
    },
    meet: {
      create: (...args: unknown[]) => mockState.meetCreate(...args)
    },
    event: {
      findFirst: (...args: unknown[]) => mockState.eventFindFirst(...args),
      create: (...args: unknown[]) => mockState.eventCreate(...args)
    },
    result: {
      upsert: (...args: unknown[]) => mockState.resultUpsert(...args),
      findMany: (...args: unknown[]) => mockState.resultFindMany(...args),
      update: (...args: unknown[]) => mockState.resultUpdate(...args)
    },
    $transaction: (...args: unknown[]) => mockState.transaction(...args)
  }
}));

import { importRows, type ImportRow } from "../lib/importer";

function buildRow(overrides: Partial<ImportRow> = {}): ImportRow {
  return {
    meet_title: "2026年7月",
    held_on: "2026-07-01",
    full_name: "欠席 太郎",
    full_name_kana: "けっせき たろう",
    grade: "5",
    gender: "male",
    event_title: "けのびチャレンジ",
    style: "other",
    distance_m: "0",
    lane: "1",
    time_text: "a",
    ...overrides
  };
}

describe("importRows", () => {
  beforeEach(() => {
    for (const mock of Object.values(mockState)) {
      mock.mockReset();
    }

    mockState.athleteFindFirst.mockResolvedValue({ id: "athlete-1" });
    mockState.athleteUpdate.mockResolvedValue({ id: "athlete-1" });
    mockState.meetCreate.mockResolvedValue({ id: "meet-1" });
    mockState.eventFindFirst.mockResolvedValue({ id: "event-1" });
    mockState.resultUpsert.mockResolvedValue({ id: "result-1" });
    mockState.resultFindMany.mockResolvedValue([
      { id: "result-1", timeText: "a", timeMs: -1 }
    ]);
    mockState.resultUpdate.mockResolvedValue({ id: "result-1" });
    mockState.transaction.mockImplementation(async (operations: unknown[]) => Promise.all(operations));
  });

  it("stores a school absence without trying to parse it as a time", async () => {
    await importRows("school", [buildRow({ time_text: "Ａ" })]);

    expect(mockState.resultUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          timeText: "a",
          timeMs: -1,
          rank: 0
        }),
        update: expect.objectContaining({
          timeText: "a",
          timeMs: -1
        })
      })
    );
    expect(mockState.resultUpdate).toHaveBeenCalledWith({
      where: { id: "result-1" },
      data: { rank: 0 }
    });
  });

  it("keeps absences out of the event ranking", async () => {
    mockState.resultFindMany.mockResolvedValue([
      { id: "absent", timeText: "a", timeMs: -1 },
      { id: "recorded", timeText: "40.00", timeMs: 40_000 }
    ]);

    await importRows("school", [buildRow()]);

    expect(mockState.resultUpdate).toHaveBeenCalledWith({
      where: { id: "absent" },
      data: { rank: 0 }
    });
    expect(mockState.resultUpdate).toHaveBeenCalledWith({
      where: { id: "recorded" },
      data: { rank: 1 }
    });
  });

  it("validates all rows before performing any database writes", async () => {
    await expect(
      importRows("school", [
        buildRow({ time_text: "40.00" }),
        buildRow({ full_name: "不正 次郎", time_text: "not-a-time" })
      ])
    ).rejects.toThrow(/3行目: Invalid time format/);

    expect(mockState.athleteFindFirst).not.toHaveBeenCalled();
    expect(mockState.meetCreate).not.toHaveBeenCalled();
    expect(mockState.resultUpsert).not.toHaveBeenCalled();
  });

  it("does not accept the school-only absence marker for other programs", async () => {
    await expect(importRows("swimming", [buildRow()])).rejects.toThrow(/2行目: Invalid time format/);

    expect(mockState.athleteFindFirst).not.toHaveBeenCalled();
    expect(mockState.resultUpsert).not.toHaveBeenCalled();
  });
});
