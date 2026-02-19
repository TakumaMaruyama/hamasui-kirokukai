import { describe, expect, it } from "vitest";
import { pickBestTimesByEventBase } from "../lib/history-best-time";

describe("history best time aggregation", () => {
  it("keeps only the fastest record per normalized title + distance", () => {
    const best = pickBestTimesByEventBase([
      {
        id: "slow",
        timeMs: 21000,
        meet: { heldOn: new Date("2025-03-01T00:00:00.000Z") },
        event: { title: "15m クロール", distanceM: 15 }
      },
      {
        id: "fast",
        timeMs: 17780,
        meet: { heldOn: new Date("2025-09-01T00:00:00.000Z") },
        event: { title: "15ｍクロール", distanceM: 15 }
      },
      {
        id: "kick",
        timeMs: 20850,
        meet: { heldOn: new Date("2025-09-01T00:00:00.000Z") },
        event: { title: "15m板キック", distanceM: 15 }
      }
    ]);

    expect(best.map((row) => row.id)).toEqual(["fast", "kick"]);
  });

  it("uses newer heldOn as tie-break when time is equal", () => {
    const best = pickBestTimesByEventBase([
      {
        id: "old",
        timeMs: 17800,
        meet: { heldOn: new Date("2024-09-01T00:00:00.000Z") },
        event: { title: "15mクロール", distanceM: 15 }
      },
      {
        id: "new",
        timeMs: 17800,
        meet: { heldOn: new Date("2025-09-01T00:00:00.000Z") },
        event: { title: "15mクロール", distanceM: 15 }
      }
    ]);

    expect(best).toHaveLength(1);
    expect(best[0].id).toBe("new");
  });

  it("does not merge records with different distances", () => {
    const best = pickBestTimesByEventBase([
      {
        id: "d15",
        timeMs: 17800,
        meet: { heldOn: new Date("2025-09-01T00:00:00.000Z") },
        event: { title: "クロール", distanceM: 15 }
      },
      {
        id: "d25",
        timeMs: 27800,
        meet: { heldOn: new Date("2025-09-01T00:00:00.000Z") },
        event: { title: "クロール", distanceM: 25 }
      }
    ]);

    expect(best.map((row) => row.id)).toEqual(["d15", "d25"]);
  });
});
