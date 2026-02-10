import { describe, expect, it } from "vitest";
import { assignDenseRanks } from "../lib/rank";

describe("assignDenseRanks", () => {
  it("assigns dense ranks", () => {
    const ranks = assignDenseRanks([
      { id: "a", timeMs: 1000 },
      { id: "b", timeMs: 1000 },
      { id: "c", timeMs: 1200 }
    ]);

    expect(ranks.get("a")).toBe(1);
    expect(ranks.get("b")).toBe(1);
    expect(ranks.get("c")).toBe(2);
  });
});
