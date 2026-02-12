import { describe, expect, it } from "vitest";
import { assignMonthlyRanks } from "../lib/monthly-rank";

describe("assignMonthlyRanks", () => {
  it("assigns ranks by month and event class (title/distance/style/grade/gender)", () => {
    const ranks = assignMonthlyRanks([
      {
        id: "a",
        heldOn: new Date("2025-09-01T00:00:00.000Z"),
        timeMs: 40000,
        event: { title: "15mクロール", distanceM: 15, style: "クロール", grade: 3, gender: "male" }
      },
      {
        id: "b",
        heldOn: new Date("2025-09-10T00:00:00.000Z"),
        timeMs: 39000,
        event: { title: "15mクロール", distanceM: 15, style: "クロール", grade: 3, gender: "male" }
      },
      {
        id: "c",
        heldOn: new Date("2025-10-01T00:00:00.000Z"),
        timeMs: 38000,
        event: { title: "15mクロール", distanceM: 15, style: "クロール", grade: 3, gender: "male" }
      },
      {
        id: "d",
        heldOn: new Date("2025-09-01T00:00:00.000Z"),
        timeMs: 30000,
        event: { title: "15mクロール", distanceM: 15, style: "クロール", grade: 4, gender: "male" }
      },
      {
        id: "e",
        heldOn: new Date("2025-09-01T00:00:00.000Z"),
        timeMs: 31000,
        event: { title: "15mクロール", distanceM: 15, style: "クロール", grade: 3, gender: "female" }
      },
      {
        id: "f",
        heldOn: new Date("2025-09-01T00:00:00.000Z"),
        timeMs: 32000,
        event: { title: "15m平泳ぎ", distanceM: 15, style: "平泳ぎ", grade: 3, gender: "male" }
      }
    ]);

    expect(ranks.get("a")).toBe(2);
    expect(ranks.get("b")).toBe(1);
    expect(ranks.get("c")).toBe(1);
    expect(ranks.get("d")).toBe(1);
    expect(ranks.get("e")).toBe(1);
    expect(ranks.get("f")).toBe(1);
  });
});
