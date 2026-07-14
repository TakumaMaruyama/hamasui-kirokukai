import { beforeEach, describe, expect, it, vi } from "vitest";

const mockState = vi.hoisted(() => ({
  findLatestMeet: vi.fn<(...args: unknown[]) => Promise<unknown>>(),
  findMany: vi.fn<(...args: unknown[]) => Promise<unknown>>(),
  createGeneratedDoc: vi.fn<(...args: unknown[]) => Promise<unknown>>(),
  renderSchoolPdfs: vi.fn<(...args: unknown[]) => Promise<Buffer>>(async () => Buffer.from("mock-pdf")),
  saveBuffer: vi.fn<(...args: unknown[]) => Promise<string>>(async (...args) => String(args[0])),
  zipBuffers: vi.fn<(...args: unknown[]) => Promise<Buffer>>(async () => Buffer.from("mock-zip"))
}));

vi.mock("@/lib/admin-auth", () => ({
  isAdminAuthenticated: () => true
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    meet: {
      findFirst: (...args: unknown[]) => mockState.findLatestMeet(...args)
    },
    result: {
      findMany: (...args: unknown[]) => mockState.findMany(...args)
    },
    generatedDoc: {
      create: (...args: unknown[]) => mockState.createGeneratedDoc(...args)
    }
  }
}));

vi.mock("@/lib/pdf", () => ({
  renderSchoolRecordCertificatesPdf: (...args: unknown[]) => mockState.renderSchoolPdfs(...args)
}));

vi.mock("@/lib/storage", () => ({
  saveBuffer: (...args: unknown[]) => mockState.saveBuffer(...args)
}));

vi.mock("@/lib/zip", () => ({
  zipBuffers: (...args: unknown[]) => mockState.zipBuffers(...args)
}));

import { POST } from "../app/api/admin/docs/school/records/route";

function buildRequest(body: unknown): Request {
  return new Request("http://localhost/api/admin/docs/school/records", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
}

function buildRow(input: {
  athleteId?: string;
  eventId?: string;
  fullName?: string;
  fullNameKana?: string;
  eventTitle?: string;
  schoolName?: string;
  timeText: string;
  timeMs: number;
}) {
  return {
    athleteId: input.athleteId ?? "athlete-1",
    eventId: input.eventId ?? "event-1",
    athlete: {
      id: input.athleteId ?? "athlete-1",
      fullName: input.fullName ?? "欠席 太郎",
      fullNameKana: input.fullNameKana ?? "けっせき たろう",
      grade: 5,
      gender: "male"
    },
    event: {
      id: input.eventId ?? "event-1",
      title: input.eventTitle ?? "けのびチャレンジ"
    },
    meet: {
      id: `meet-${input.schoolName ?? "浜田小学校"}`,
      title: input.schoolName ?? "浜田小学校"
    },
    timeText: input.timeText,
    timeMs: input.timeMs
  };
}

describe("POST /api/admin/docs/school/records", () => {
  beforeEach(() => {
    mockState.findLatestMeet.mockReset();
    mockState.findMany.mockReset();
    mockState.createGeneratedDoc.mockReset();
    mockState.renderSchoolPdfs.mockClear();
    mockState.saveBuffer.mockClear();
    mockState.zipBuffers.mockClear();
  });

  it("keeps an a row so an absentee receives a certificate", async () => {
    mockState.findMany.mockResolvedValue([
      buildRow({ timeText: "a", timeMs: -1 })
    ]);

    const response = await POST(buildRequest({ year: 2026, month: 7 }));

    expect(response.status).toBe(200);
    expect(mockState.renderSchoolPdfs).toHaveBeenCalledTimes(1);
    expect(mockState.renderSchoolPdfs).toHaveBeenCalledWith([
      {
        athlete: expect.objectContaining({
          fullName: "欠席 太郎",
          fullNameKana: "けっせき たろう"
        }),
        entries: [{ eventTitle: "けのびチャレンジ", timeText: "a", timeMs: -1 }],
        issueLabel: "2026年7月"
      }
    ]);
  });

  it("prefers a recorded time over an absence for the same event and month", async () => {
    mockState.findMany.mockResolvedValue([
      buildRow({ timeText: "a", timeMs: -1 }),
      buildRow({ eventId: "event-with-different-internal-classification", timeText: "42.18", timeMs: 42_180 })
    ]);

    const response = await POST(buildRequest({ year: 2026, month: 7 }));

    expect(response.status).toBe(200);
    const input = mockState.renderSchoolPdfs.mock.calls[0]?.[0] as Array<{
      entries: Array<{ timeText: string; timeMs: number }>;
    }>;
    expect(input[0]?.entries).toEqual([
      expect.objectContaining({ timeText: "42.18", timeMs: 42_180 })
    ]);
  });

  it("falls back when an older database has no fullNameKana column", async () => {
    mockState.findMany
      .mockRejectedValueOnce(new Error('The column "Athlete.fullNameKana" does not exist'))
      .mockResolvedValueOnce([
        buildRow({ timeText: "a", timeMs: -1 })
      ]);

    const response = await POST(buildRequest({ year: 2026, month: 7 }));

    expect(response.status).toBe(200);
    expect(mockState.findMany).toHaveBeenCalledTimes(2);
    expect(mockState.renderSchoolPdfs).toHaveBeenCalledWith([
      expect.objectContaining({
        athlete: expect.objectContaining({ fullNameKana: null })
      })
    ]);
  });

  it("creates one PDF per school and sanitizes school names", async () => {
    mockState.findMany.mockResolvedValue([
      buildRow({ athleteId: "athlete-1", fullName: "児童 一", schoolName: "浜田/小学校", timeText: "40.00", timeMs: 40_000 }),
      buildRow({ athleteId: "athlete-2", fullName: "児童 二", schoolName: "石見小学校", timeText: "41.00", timeMs: 41_000 })
    ]);

    const response = await POST(buildRequest({ year: 2026, month: 7 }));

    expect(response.status).toBe(200);
    expect(mockState.renderSchoolPdfs).toHaveBeenCalledTimes(2);
    const files = mockState.zipBuffers.mock.calls[0]?.[0] as Array<{ name: string }>;
    expect(files.map((file) => file.name)).toEqual([
      "浜田_小学校_2026年7月_records.pdf",
      "石見小学校_2026年7月_records.pdf"
    ]);
  });

  it("hides the private blank-event sentinel before PDF rendering", async () => {
    mockState.findMany.mockResolvedValue([
      buildRow({ eventTitle: "__school_absence__", timeText: "a", timeMs: -1 })
    ]);

    const response = await POST(buildRequest({ year: 2026, month: 7 }));

    expect(response.status).toBe(200);
    const certificates = mockState.renderSchoolPdfs.mock.calls[0]?.[0] as Array<{
      entries: Array<{ eventTitle: string }>;
    }>;
    expect(certificates[0]?.entries[0]?.eventTitle).toBe("");
  });
});
