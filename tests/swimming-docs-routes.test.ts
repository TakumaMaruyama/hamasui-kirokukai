import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RecordCertificatePdfInput, FirstPrizeAwardPdfInput } from "../lib/pdf";

const state = vi.hoisted(() => ({
  authenticated: true,
  rows: vi.fn(), meets: vi.fn(), latestMeet: vi.fn(),
  createGeneratedDoc: vi.fn(), saveBuffer: vi.fn(),
  records: vi.fn(async (_inputs: RecordCertificatePdfInput[]) => Buffer.from("%PDF-records")),
  awards: vi.fn(async (_inputs: FirstPrizeAwardPdfInput[]) => Buffer.from("%PDF-awards")),
  historical: vi.fn(async (_input: unknown) => Buffer.from("%PDF-historical"))
}));
vi.mock("@/lib/admin-auth", () => ({ isAdminAuthenticated: async () => state.authenticated }));
vi.mock("@/lib/prisma", () => ({ prisma: {
  result: { findMany: (...args: unknown[]) => state.rows(...args) },
  meet: { findMany: (...args: unknown[]) => state.meets(...args), findFirst: (...args: unknown[]) => state.latestMeet(...args) },
  generatedDoc: { create: (...args: unknown[]) => state.createGeneratedDoc(...args) }
} }));
vi.mock("@/lib/storage", () => ({ saveBuffer: (...args: unknown[]) => state.saveBuffer(...args) }));
vi.mock("@/lib/pdf", () => ({ renderRecordCertificatesPdf: state.records, renderFirstPrizeAwardsPdf: state.awards, renderChallengeRankingPdf: state.historical }));

import { GET as months } from "../app/api/admin/docs/swimming/months/route";
import { POST as preview } from "../app/api/admin/docs/swimming/preview/route";
import { POST as records } from "../app/api/admin/docs/swimming/records/route";
import { POST as certificates } from "../app/api/admin/docs/swimming/certificates/route";
import { POST as historical } from "../app/api/admin/docs/swimming/historical-firsts/route";

function request(body: unknown) {
  return new Request("http://localhost/api/admin/docs/swimming/preview", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
}

function row(options: { id?: string; name?: string; athleteId?: string; eventId?: string; title?: string; time?: number; date?: string; weekday?: string; grade?: number; style?: string } = {}) {
  const timeMs = options.time ?? 18000;
  return {
    id: options.id ?? "result-1", athleteId: options.athleteId ?? "athlete-1", eventId: options.eventId ?? "event-1", timeMs, timeText: (timeMs / 1000).toFixed(2),
    athlete: { id: options.athleteId ?? "athlete-1", fullName: options.name ?? "確認 太郎", fullNameKana: "かくにん たろう", grade: options.grade ?? 5, gender: "male" as const },
    event: { title: options.title ?? "15mクロール", distanceM: 15, style: options.style ?? "free", grade: options.grade ?? 5, gender: "male" as const },
    meet: { heldOn: new Date(options.date ?? "2026-09-02T00:00:00Z"), title: `2026年9月${options.weekday ?? "水曜"}` }
  };
}

describe("swimming document preparation and downloads", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.authenticated = true;
    state.rows.mockReset().mockResolvedValue([row()]);
    state.meets.mockReset().mockResolvedValue([]);
    state.latestMeet.mockReset().mockResolvedValue({ id: "latest-meet", title: "2026年9月水曜" });
  });
  afterEach(() => {
    expect(state.createGeneratedDoc).not.toHaveBeenCalled();
    expect(state.saveBuffer).not.toHaveBeenCalled();
  });

  it("awaits authentication before every document API can read data", async () => {
    state.authenticated = false;
    expect((await months()).status).toBe(401);
    for (const endpoint of [preview, records, certificates, historical]) {
      expect((await endpoint(request({ kind: "records", year: 2026, month: 9 }))).status).toBe(401);
    }
    for (const read of [state.rows, state.meets, state.latestMeet]) expect(read).not.toHaveBeenCalled();
  });

  it("lists distinct registered UTC year-months newest first without loading results", async () => {
    state.meets.mockResolvedValue([
      { heldOn: new Date("2025-09-03T00:00:00Z") }, { heldOn: new Date("2026-09-02T00:00:00Z") },
      { heldOn: new Date("2026-09-09T00:00:00Z") }, { heldOn: new Date("2026-01-01T00:00:00Z") }
    ]);
    const response = await months();
    expect(await response.json()).toEqual({ months: [{ year: 2026, month: 9 }, { year: 2026, month: 1 }, { year: 2025, month: 9 }] });
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(state.meets).toHaveBeenCalledWith(expect.objectContaining({ where: { program: "swimming" }, select: { heldOn: true } }));
    expect(state.rows).not.toHaveBeenCalled();
  });

  it("previews exactly the four printed entries with the same weekday and person grouping", async () => {
    state.rows.mockResolvedValue([
      ...Array.from({ length: 5 }, (_, i) => row({ id: `r${i}`, eventId: `e${i}`, title: `${i + 1}種目`, weekday: "水曜" })),
      row({ id: "monday", weekday: "月曜" })
    ]);
    const response = await preview(request({ kind: "records", year: 2026, month: 9 }));
    const body = await response.json();
    expect(body.counts).toEqual({ people: 1, pages: 2, records: 5 });
    expect(body.items.map((item: { weekday: string }) => item.weekday)).toEqual(["月曜", "水曜"]);
    expect(body.items[1].entries).toHaveLength(4);
    expect(body.items[1].entries.map((entry: { eventTitle: string }) => entry.eventTitle)).not.toContain("5種目");
    expect(state.records).not.toHaveBeenCalled();
    const pdf = await records(request({ year: 2026, month: 9 }));
    expect(pdf.status).toBe(200);
    expect(state.records.mock.calls[0][0].map((input) => input.entries.slice(0, 4).map((entry) => entry.eventTitle))).toEqual(body.items.map((item: { entries: { eventTitle: string }[] }) => item.entries.map((entry) => entry.eventTitle)));
    expect(pdf.headers.get("Content-Disposition")).toContain(encodeURIComponent(body.filename));
  });

  it("keeps no-filter latest-meet record generation compatible and applies name and weekday when requested", async () => {
    expect((await records(request({}))).status).toBe(200);
    expect(state.rows.mock.calls[0][0].where.meet).toEqual({ id: "latest-meet" });
    state.rows.mockClear();
    await records(request({ year: 2026, month: 9, weekday: "水曜", fullName: "確認 太郎" }));
    expect(state.rows.mock.calls[0][0].where).toEqual({
      meet: { program: "swimming", heldOn: { gte: new Date("2026-09-01Z"), lt: new Date("2026-10-01Z") }, title: { contains: "水曜" } },
      athlete: { is: { fullName: "確認 太郎" } }
    });
  });

  it("does not award a selected second-place swimmer; the ranking query includes the entire month", async () => {
    state.rows.mockResolvedValue([
      row({ id: "winner", name: "1位 太郎", time: 18000 }),
      row({ id: "second", name: "2位 太郎", athleteId: "athlete-2", time: 20000 })
    ]);
    const filter = { year: 2026, month: 9, fullName: "2位 太郎" };
    const summary = await preview(request({ kind: "certificates", ...filter }));
    expect((await summary.json()).counts).toEqual({ people: 0, pages: 0, records: 0 });
    const pdf = await certificates(request(filter));
    expect(pdf.status).toBe(400);
    expect(state.awards).not.toHaveBeenCalled();
    expect(state.rows.mock.calls.every(([query]) => !query.where.athlete)).toBe(true);
  });

  it("filters the selected winner after resolving ties and uses fresh data at download time", async () => {
    const winner = row({ id: "winner", name: "1位 太郎", time: 18000 });
    const tie = row({ id: "tie", name: "同タイ 太郎", athleteId: "athlete-2", time: 18000 });
    state.rows.mockResolvedValue([winner, tie]);
    expect((await (await preview(request({ kind: "certificates", year: 2026, month: 9 }))).json()).counts).toEqual({ people: 2, pages: 2, records: 2 });
    const filter = { year: 2026, month: 9, fullName: "同タイ 太郎" };
    expect((await certificates(request(filter))).status).toBe(200);
    expect(state.awards.mock.calls[0][0].map((input) => input.athlete.fullName)).toEqual(["同タイ 太郎"]);
    state.rows.mockResolvedValue([winner, { ...tie, timeMs: 19000, timeText: "19.00" }]);
    expect((await certificates(request(filter))).status).toBe(400);
    expect(state.awards).toHaveBeenCalledTimes(1);
  });

  it("uses one canonical historical class, preserves month and NEW, and directly returns a PDF", async () => {
    state.rows.mockResolvedValue([
      row({ id: "fast", name: "最速 太郎", time: 18000, date: "2026-09-10Z" }),
      row({ id: "slow", name: "遅い 太郎", athleteId: "b", time: 20000, style: "クロール", title: "15ｍ自由形", date: "2026-08-10Z" })
    ]);
    const filter = { year: 2026, month: 9 };
    const body = await (await preview(request({ kind: "historical-firsts", ...filter }))).json();
    expect(body.counts).toEqual({ records: 1, events: 1 });
    expect(body.items[0].name).toBe("最速 太郎");
    expect(body.items[0].entries[0]).toMatchObject({ timeText: "18秒00", recordMonthLabel: "2026年9月", isNewRecordInTargetMonth: true });
    expect(state.historical).not.toHaveBeenCalled();
    const pdf = await historical(request(filter));
    expect(pdf.status).toBe(200);
    expect(pdf.headers.get("Content-Type")).toBe("application/pdf");
    expect(await pdf.text()).toBe("%PDF-historical");
    expect(pdf.headers.get("Content-Disposition")).toContain(encodeURIComponent(body.filename));
    expect(state.rows.mock.calls[0][0]).toMatchObject({ where: { meet: { program: "swimming", heldOn: { lt: new Date("2026-10-01Z") } } } });
    expect(state.rows.mock.calls[0][0].select.event).not.toBe(true);
  });

  it("reports an empty preview without trying to render any PDF", async () => {
    state.rows.mockResolvedValue([]);
    for (const kind of ["records", "certificates", "historical-firsts"]) {
      const response = await preview(request({ kind, year: 2026, month: 9 }));
      expect(response.status).toBe(200);
      expect((await response.json()).items).toEqual([]);
    }
    for (const render of [state.records, state.awards, state.historical]) expect(render).not.toHaveBeenCalled();
  });

  it("validates preview kind, month, and unsupported filters before any data access", async () => {
    for (const body of [null, {}, { kind: "unknown" }, { kind: "records" }, { kind: "records", year: 2026, month: 13 }, { kind: "certificates", year: 2026, month: 9, weekday: "月曜" }, { kind: "historical-firsts", year: 2026, month: 9, fullName: "確認 太郎" }]) {
      expect((await preview(request(body))).status).toBe(400);
    }
    expect(state.rows).not.toHaveBeenCalled();
  });

  it("retains compatibility when kana has not yet been added to an older database", async () => {
    state.rows.mockRejectedValueOnce(new Error('column Athlete.fullNameKana does not exist')).mockResolvedValue([row()]);
    const result = await preview(request({ kind: "records", year: 2026, month: 9 }));
    expect(result.status).toBe(200);
    expect(state.rows).toHaveBeenCalledTimes(2);
    expect(state.rows.mock.calls[1][0].select.athlete.select).not.toHaveProperty("fullNameKana");
  });
});
