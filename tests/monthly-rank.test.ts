import { describe, expect, it } from "vitest";
import { assignMonthlyRanks } from "../lib/monthly-rank";

describe("assignMonthlyRanks", () => {
  it("assigns ranks by event and month", () => {
    const ranks = assignMonthlyRanks([
      { id: "a", eventId: "e1", heldOn: new Date("2025-09-01T00:00:00.000Z"), timeMs: 40000 },
      { id: "b", eventId: "e1", heldOn: new Date("2025-09-10T00:00:00.000Z"), timeMs: 39000 },
      { id: "c", eventId: "e1", heldOn: new Date("2025-10-01T00:00:00.000Z"), timeMs: 38000 },
      { id: "d", eventId: "e2", heldOn: new Date("2025-09-01T00:00:00.000Z"), timeMs: 30000 }
    ]);

    expect(ranks.get("a")).toBe(2);
    expect(ranks.get("b")).toBe(1);
    expect(ranks.get("c")).toBe(1);
    expect(ranks.get("d")).toBe(1);
  });
});
