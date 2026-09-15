import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  authenticated: true, rows: vi.fn(), meets: vi.fn(),
  createGeneratedDoc: vi.fn(), saveBuffer: vi.fn(),
  render: vi.fn(async (_input: unknown) => Buffer.from("%PDF-challenge"))
}));
vi.mock("@/lib/admin-auth", () => ({ isAdminAuthenticated: async () => state.authenticated }));
vi.mock("@/lib/prisma", () => ({ prisma: {
  result: { findMany: (...args: unknown[]) => state.rows(...args) },
  meet: { findMany: (...args: unknown[]) => state.meets(...args) },
  generatedDoc: { create: (...args: unknown[]) => state.createGeneratedDoc(...args) }
} }));
vi.mock("@/lib/storage", () => ({ saveBuffer: (...args: unknown[]) => state.saveBuffer(...args) }));
vi.mock("@/lib/pdf", () => ({ renderChallengeRankingPdf: state.render }));

import { GET as months } from "../app/api/admin/docs/challenge/months/route";
import { POST as preview } from "../app/api/admin/docs/challenge/preview/route";
import { POST as rankings } from "../app/api/admin/docs/challenge/rankings/route";
import type { ChallengeRankingPreview } from "../lib/challenge-docs-types";

function request(body: unknown) {
  return new Request("http://localhost/api/admin/docs/challenge/preview", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body)
  });
}
const filter = { year: 2026, month: 9 };
function row(id: string, options: { name?: string; time?: number; grade?: number; gender?: "male" | "female" | "other"; title?: string; style?: string } = {}) {
  const timeMs = options.time ?? 18000;
  return {
    id, timeMs, timeText: (timeMs / 1000).toFixed(2),
    athlete: { fullName: options.name ?? `参加者 ${id}`, fullNameKana: `さんかしゃ ${id}` },
    event: { id: `event-${id}`, title: options.title ?? "15mクロール", style: options.style ?? "free", distanceM: 15, grade: options.grade ?? 5, gender: options.gender ?? "male" },
    meet: { heldOn: new Date("2026-09-02T00:00:00Z") }
  };
}
async function getPreview(): Promise<ChallengeRankingPreview> {
  const response = await preview(request(filter));
  expect(response.status).toBe(200);
  expect(response.headers.get("Cache-Control")).toBe("no-store");
  return response.json();
}

describe("challenge ranking preview and PDF", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.authenticated = true;
    state.rows.mockReset().mockResolvedValue([row("1")]);
    state.meets.mockReset().mockResolvedValue([]);
  });
  afterEach(() => {
    expect(state.createGeneratedDoc).not.toHaveBeenCalled();
    expect(state.saveBuffer).not.toHaveBeenCalled();
    vi.restoreAllMocks();
  });

  it("requires authentication before reading data or rendering", async () => {
    state.authenticated = false;
    expect((await months()).status).toBe(401);
    for (const endpoint of [preview, rankings]) expect((await endpoint(request(filter))).status).toBe(401);
    for (const action of [state.rows, state.meets, state.render]) expect(action).not.toHaveBeenCalled();
  });

  it("lists only challenge months, unique and latest first", async () => {
    state.meets.mockResolvedValue([
      { heldOn: new Date("2025-09-03Z") }, { heldOn: new Date("2026-09-02Z") },
      { heldOn: new Date("2026-09-09Z") }, { heldOn: new Date("2026-03-01Z") }
    ]);
    const response = await months();
    expect(await response.json()).toEqual({ months: [{ year: 2026, month: 9 }, { year: 2026, month: 3 }, { year: 2025, month: 9 }] });
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(state.meets).toHaveBeenCalledWith(expect.objectContaining({ where: { program: "challenge" }, select: { heldOn: true } }));
    expect(state.rows).not.toHaveBeenCalled();
  });

  it("prints all five participants per gender using exactly the preview groups", async () => {
    state.rows.mockResolvedValue(["male", "female"].flatMap((gender) => Array.from({ length: 5 }, (_, i) =>
      row(`${gender}-${i}`, { gender: gender as "male" | "female", time: 18000 + i * 1000 })
    )));
    const body = await getPreview();
    expect(body.counts).toEqual({ records: 10, events: 1 });
    const grade = body.groups[0].gradeGroups[0];
    expect(grade.maleEntries.map((entry) => entry.rank)).toEqual([1, 2, 3, 4, 5]);
    expect(grade.femaleEntries.map((entry) => entry.rank)).toEqual([1, 2, 3, 4, 5]);
    expect(state.render).not.toHaveBeenCalled();
    const response = await rankings(request(filter));
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/pdf");
    expect(response.headers.get("Content-Disposition")).toContain(encodeURIComponent(body.filename));
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.text()).toBe("%PDF-challenge");
    expect(state.render).toHaveBeenCalledWith({ periodLabel: "2026年9月 チャレンジコース", groups: body.groups, rankRange: "all" });
    expect(state.rows.mock.calls[0][0].where).toEqual({ meet: {
      program: "challenge", heldOn: { gte: new Date("2026-09-01Z"), lt: new Date("2026-10-01Z") }
    } });
  });

  it("preserves ties beyond third place and one monthly best per swimmer across event aliases", async () => {
    state.rows.mockResolvedValue([
      ...Array.from({ length: 6 }, (_, i) => row(`r${i}`, { time: 18000 + Math.min(i, 4) * 1000 })),
      row("duplicate", { name: "参加者 r0", time: 25000, title: "15ｍ自由形", style: "クロール" })
    ]);
    const body = await getPreview();
    expect(body.counts).toEqual({ records: 6, events: 1 });
    expect(body.groups[0].gradeGroups[0].maleEntries.map((entry) => entry.rank)).toEqual([1, 2, 3, 4, 5, 5]);
    expect(body.groups[0].gradeGroups[0].maleEntries[0]).toMatchObject({ fullName: "参加者 r0", timeText: "18.00" });
  });

  it("keeps the complete grade range and preschool kana with empty genders", async () => {
    state.rows.mockResolvedValue([row("young", { grade: 0 }), row("older", { grade: 10, gender: "female" }), row("other", { gender: "other" })]);
    const body = await getPreview();
    expect(body.counts).toEqual({ records: 2, events: 1 });
    expect(body.groups[0].gradeGroups.map((grade) => grade.grade)).toEqual(Array.from({ length: 11 }, (_, i) => i));
    expect(body.groups[0].gradeGroups[0].maleEntries[0].displayName).toBe("さんかしゃ young");
    expect(body.groups[0].gradeGroups[1]).toEqual({ grade: 1, maleEntries: [], femaleEntries: [] });
    expect(body.groups[0].gradeGroups[10].femaleEntries[0].displayName).toBe("参加者 older");
  });

  it("checks fresh records at download time", async () => {
    await getPreview();
    state.rows.mockResolvedValue([row("1"), row("2", { time: 20000 })]);
    expect((await rankings(request(filter))).status).toBe(200);
    expect(state.render).toHaveBeenCalledWith(expect.objectContaining({ groups: [expect.objectContaining({ gradeGroups: [expect.objectContaining({ maleEntries: expect.arrayContaining([expect.objectContaining({ fullName: "参加者 2" })]) })] })] }));
  });

  it("returns an empty preview but rejects empty PDF downloads", async () => {
    state.rows.mockResolvedValue([]);
    expect(await getPreview()).toMatchObject({ counts: { records: 0, events: 0 }, groups: [] });
    expect((await rankings(request(filter))).status).toBe(400);
    expect(state.render).not.toHaveBeenCalled();
  });

  it("validates required month and unsupported filters before reading data", async () => {
    for (const body of [null, [], {}, { year: 2026 }, { ...filter, month: 13 }, { ...filter, year: 1999 }, { ...filter, weekday: "月曜" }, { ...filter, fullName: "参加者" }]) {
      for (const endpoint of [preview, rankings]) expect((await endpoint(request(body))).status).toBe(400);
    }
    const malformed = new Request("http://localhost/preview", { method: "POST", body: "{" });
    expect((await preview(malformed)).status).toBe(400);
    expect(state.rows).not.toHaveBeenCalled();
  });

  it("does not disclose internal errors in month, preview, or download responses", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    state.meets.mockRejectedValue(new Error("database-private-details"));
    state.rows.mockRejectedValue(new Error("database-private-details"));
    for (const response of [await months(), await preview(request(filter)), await rankings(request(filter))]) {
      expect(response.status).toBe(500);
      expect(await response.text()).not.toContain("database-private-details");
    }
  });
});
