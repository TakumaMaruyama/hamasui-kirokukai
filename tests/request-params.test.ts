import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  athlete: vi.fn(),
  athletes: vi.fn(),
  publishWindow: vi.fn()
}));

vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("NOT_FOUND"); } }));
vi.mock("@/lib/prisma", () => ({ prisma: {
  athlete: { findUnique: state.athlete, findMany: state.athletes },
  publishWindow: { findUnique: state.publishWindow }
} }));

import { GET } from "../app/api/athletes/[id]/route";
import AthletePage from "../app/athletes/[id]/page";
import AthleteHistoryPage from "../app/athletes/history/page";

describe("async route and page request parameters", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.athlete.mockResolvedValue(null);
    state.athletes.mockResolvedValue([]);
    state.publishWindow.mockResolvedValue(null);
  });

  it("looks up the resolved athlete ID in the API and preserves missing-athlete handling", async () => {
    const response = await GET(new Request("https://example.com/api/athletes/athlete-1"), { params: Promise.resolve({ id: "athlete-1" }) });
    expect(response.status).toBe(404);
    expect(state.athlete).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "athlete-1" } }));
  });

  it("looks up the resolved athlete ID on the individual results page", async () => {
    await expect(AthletePage({ params: Promise.resolve({ id: "athlete-2" }) })).rejects.toThrow("NOT_FOUND");
    expect(state.athlete).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "athlete-2" } }));
  });

  it("uses resolved name and gender queries on the history page", async () => {
    await expect(AthleteHistoryPage({ searchParams: Promise.resolve({ fullName: "水泳太郎", gender: "male" }) })).rejects.toThrow("NOT_FOUND");
    expect(state.athletes).toHaveBeenNthCalledWith(1, expect.objectContaining({ where: expect.objectContaining({ fullName: "水泳太郎", gender: "male" }) }));
  });

  it("rejects invalid resolved history queries before accessing the database", async () => {
    await expect(AthleteHistoryPage({ searchParams: Promise.resolve({ fullName: "水泳太郎", gender: "invalid" }) })).rejects.toThrow("NOT_FOUND");
    expect(state.athletes).not.toHaveBeenCalled();
    expect(state.publishWindow).not.toHaveBeenCalled();
  });
});
