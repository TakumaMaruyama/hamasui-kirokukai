import { beforeEach, describe, expect, it, vi } from "vitest";

const mockState = vi.hoisted(() => ({
  findMany: vi.fn(),
  createGeneratedDoc: vi.fn(),
  renderPdf: vi.fn(async () => Buffer.from("mock-pdf")),
  saveBuffer: vi.fn(async () => "storage/key")
}));

vi.mock("@/lib/admin-auth", () => ({
  isAdminAuthenticated: () => true
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    result: {
      findMany: (...args: unknown[]) => mockState.findMany(...args)
    },
    generatedDoc: {
      create: (...args: unknown[]) => mockState.createGeneratedDoc(...args)
    }
  }
}));

vi.mock("@/lib/pdf", () => ({
  renderFirstPrizeAwardsPdf: (...args: unknown[]) => mockState.renderPdf(...args)
}));

vi.mock("@/lib/storage", () => ({
  saveBuffer: (...args: unknown[]) => mockState.saveBuffer(...args)
}));

import { POST } from "../app/api/admin/docs/swimming/certificates/route";

function buildRequest(body: unknown): Request {
  return new Request("http://localhost/api/admin/docs/swimming/certificates", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
}

function buildResultRow(input: {
  id: string;
  fullName: string;
  fullNameKana?: string | null;
  athleteGrade: number;
  athleteGender: "male" | "female";
  eventTitle: string;
  distanceM: number;
  style: string;
  eventGrade: number;
  eventGender: "male" | "female";
  timeText: string;
  timeMs: number;
  heldOn: string;
}) {
  return {
    id: input.id,
    timeText: input.timeText,
    timeMs: input.timeMs,
    athlete: {
      fullName: input.fullName,
      fullNameKana: input.fullNameKana ?? null,
      grade: input.athleteGrade,
      gender: input.athleteGender
    },
    event: {
      title: input.eventTitle,
      distanceM: input.distanceM,
      style: input.style,
      grade: input.eventGrade,
      gender: input.eventGender
    },
    meet: {
      heldOn: new Date(input.heldOn)
    }
  };
}

describe("POST /api/admin/docs/swimming/certificates", () => {
  beforeEach(() => {
    mockState.findMany.mockReset();
    mockState.createGeneratedDoc.mockReset();
    mockState.renderPdf.mockClear();
    mockState.saveBuffer.mockClear();
  });

  it("requires year and month", async () => {
    const response = await POST(buildRequest({}));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ message: "1位賞状の出力には年・月の指定が必要です" });
  });

  it("rejects weekday filtering", async () => {
    const response = await POST(buildRequest({ year: 2025, month: 9, weekday: "水曜" }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ message: "1位賞状では曜日指定はできません" });
  });

  it("recalculates monthly first place across the whole month and keeps ties", async () => {
    mockState.findMany.mockResolvedValue([
      buildResultRow({
        id: "a-slow",
        fullName: "最速 太郎",
        athleteGrade: 5,
        athleteGender: "male",
        eventTitle: "25mクロール",
        distanceM: 25,
        style: "free",
        eventGrade: 5,
        eventGender: "male",
        timeText: "21.00",
        timeMs: 21_000,
        heldOn: "2025-09-01T00:00:00.000Z"
      }),
      buildResultRow({
        id: "a-fast",
        fullName: "最速 太郎",
        athleteGrade: 5,
        athleteGender: "male",
        eventTitle: "25mクロール",
        distanceM: 25,
        style: "free",
        eventGrade: 5,
        eventGender: "male",
        timeText: "20.00",
        timeMs: 20_000,
        heldOn: "2025-09-20T00:00:00.000Z"
      }),
      buildResultRow({
        id: "b-second",
        fullName: "次点 太郎",
        athleteGrade: 5,
        athleteGender: "male",
        eventTitle: "25mクロール",
        distanceM: 25,
        style: "free",
        eventGrade: 5,
        eventGender: "male",
        timeText: "20.50",
        timeMs: 20_500,
        heldOn: "2025-09-08T00:00:00.000Z"
      }),
      buildResultRow({
        id: "c-tie",
        fullName: "同タイ 花男",
        athleteGrade: 5,
        athleteGender: "male",
        eventTitle: "25mクロール",
        distanceM: 25,
        style: "free",
        eventGrade: 5,
        eventGender: "male",
        timeText: "20.00",
        timeMs: 20_000,
        heldOn: "2025-09-25T00:00:00.000Z"
      }),
      buildResultRow({
        id: "female-win",
        fullName: "最速 花子",
        athleteGrade: 5,
        athleteGender: "female",
        eventTitle: "25mクロール",
        distanceM: 25,
        style: "free",
        eventGrade: 5,
        eventGender: "female",
        timeText: "19.50",
        timeMs: 19_500,
        heldOn: "2025-09-10T00:00:00.000Z"
      }),
      buildResultRow({
        id: "grade6-win",
        fullName: "六年 一郎",
        athleteGrade: 6,
        athleteGender: "male",
        eventTitle: "25mクロール",
        distanceM: 25,
        style: "free",
        eventGrade: 6,
        eventGender: "male",
        timeText: "18.80",
        timeMs: 18_800,
        heldOn: "2025-09-12T00:00:00.000Z"
      })
    ]);

    const response = await POST(buildRequest({ year: 2025, month: 9 }));

    expect(response.status).toBe(200);
    expect(mockState.renderPdf).toHaveBeenCalledTimes(1);

    const awardInputs = mockState.renderPdf.mock.calls[0]?.[0] as Array<{ athlete: { fullName: string }; timeText: string }>;
    expect(awardInputs.map((award) => award.athlete.fullName).sort()).toEqual(
      ["六年 一郎", "同タイ 花男", "最速 太郎", "最速 花子"].sort()
    );
    expect(awardInputs.find((award) => award.athlete.fullName === "最速 太郎")?.timeText).toBe("20.00");
    expect(awardInputs.some((award) => award.athlete.fullName === "次点 太郎")).toBe(false);
    expect(response.headers.get("Content-Type")).toBe("application/pdf");
  });

  it("keeps fullName filtering when building monthly first prizes", async () => {
    mockState.findMany.mockResolvedValue([
      buildResultRow({
        id: "self-best",
        fullName: "指定 太郎",
        athleteGrade: 5,
        athleteGender: "male",
        eventTitle: "25mクロール",
        distanceM: 25,
        style: "free",
        eventGrade: 5,
        eventGender: "male",
        timeText: "19.80",
        timeMs: 19_800,
        heldOn: "2025-09-10T00:00:00.000Z"
      })
    ]);

    const response = await POST(buildRequest({ year: 2025, month: 9, fullName: "指定 太郎" }));

    expect(response.status).toBe(200);
    expect(mockState.findMany).toHaveBeenCalledTimes(1);
    expect(mockState.renderPdf.mock.calls[0]?.[0]).toHaveLength(1);
    expect(mockState.saveBuffer.mock.calls[0]?.[0]).toContain("指定 太郎");
  });
});
