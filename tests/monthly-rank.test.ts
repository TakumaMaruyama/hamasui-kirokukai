import { describe, expect, it } from "vitest";
import { assignAllTimeClassRanks, assignMonthlyOverallRanks, assignMonthlyRanks } from "../lib/monthly-rank";

const sampleRows = [
  {
    id: "a",
    heldOn: new Date("2025-09-01T00:00:00.000Z"),
    timeMs: 40000,
    event: { title: "15mクロール", distanceM: 15, style: "クロール", grade: 3, gender: "male" as const }
  },
  {
    id: "b",
    heldOn: new Date("2025-09-10T00:00:00.000Z"),
    timeMs: 39000,
    event: { title: "15mクロール", distanceM: 15, style: "クロール", grade: 3, gender: "male" as const }
  },
  {
    id: "c",
    heldOn: new Date("2025-10-01T00:00:00.000Z"),
    timeMs: 38000,
    event: { title: "15mクロール", distanceM: 15, style: "クロール", grade: 3, gender: "male" as const }
  },
  {
    id: "d",
    heldOn: new Date("2025-09-01T00:00:00.000Z"),
    timeMs: 30000,
    event: { title: "15mクロール", distanceM: 15, style: "クロール", grade: 4, gender: "male" as const }
  },
  {
    id: "e",
    heldOn: new Date("2025-09-01T00:00:00.000Z"),
    timeMs: 31000,
    event: { title: "15mクロール", distanceM: 15, style: "クロール", grade: 3, gender: "female" as const }
  },
  {
    id: "f",
    heldOn: new Date("2025-09-01T00:00:00.000Z"),
    timeMs: 32000,
    event: { title: "15m平泳ぎ", distanceM: 15, style: "平泳ぎ", grade: 3, gender: "male" as const }
  }
];

describe("assignMonthlyRanks", () => {
  it("assigns ranks by month and event class (title/distance/style/grade/gender)", () => {
    const ranks = assignMonthlyRanks(sampleRows);

    expect(ranks.get("a")).toBe(2);
    expect(ranks.get("b")).toBe(1);
    expect(ranks.get("c")).toBe(1);
    expect(ranks.get("d")).toBe(1);
    expect(ranks.get("e")).toBe(1);
    expect(ranks.get("f")).toBe(1);
  });

  it("assigns monthly overall ranks by month, event base, and gender", () => {
    const ranks = assignMonthlyOverallRanks(sampleRows);

    expect(ranks.get("d")).toBe(1);
    expect(ranks.get("b")).toBe(2);
    expect(ranks.get("a")).toBe(3);
    expect(ranks.get("e")).toBe(1);
    expect(ranks.get("c")).toBe(1);
    expect(ranks.get("f")).toBe(1);
  });

  it("assigns all-time class ranks across all months", () => {
    const ranks = assignAllTimeClassRanks(sampleRows);

    expect(ranks.get("a")).toBe(3);
    expect(ranks.get("b")).toBe(2);
    expect(ranks.get("c")).toBe(1);
    expect(ranks.get("d")).toBe(1);
    expect(ranks.get("e")).toBe(1);
    expect(ranks.get("f")).toBe(1);
  });

  it("keeps dense ranks for ties", () => {
    const ranks = assignMonthlyOverallRanks([
      ...sampleRows,
      {
        id: "g",
        heldOn: new Date("2025-09-12T00:00:00.000Z"),
        timeMs: 39000,
        event: { title: "15mクロール", distanceM: 15, style: "クロール", grade: 6, gender: "other" as const }
      }
    ]);

    expect(ranks.get("b")).toBe(2);
    expect(ranks.get("g")).toBe(1);
    expect(ranks.get("a")).toBe(3);
  });
});
