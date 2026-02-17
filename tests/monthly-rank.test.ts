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

  it("dedupes same athlete within the same month and event class", () => {
    const ranks = assignMonthlyRanks([
      {
        id: "dup-slow",
        heldOn: new Date("2025-09-01T00:00:00.000Z"),
        timeMs: 42000,
        athleteName: "同名 太郎",
        event: { title: "15mクロール", distanceM: 15, style: "クロール", grade: 3, gender: "male" as const }
      },
      {
        id: "dup-fast",
        heldOn: new Date("2025-09-10T00:00:00.000Z"),
        timeMs: 41000,
        athleteName: "同名　太郎",
        event: { title: "15mクロール", distanceM: 15, style: "クロール", grade: 3, gender: "male" as const }
      },
      {
        id: "other",
        heldOn: new Date("2025-09-20T00:00:00.000Z"),
        timeMs: 43000,
        athleteName: "別人 次郎",
        event: { title: "15mクロール", distanceM: 15, style: "クロール", grade: 3, gender: "male" as const }
      },
      {
        id: "next-month",
        heldOn: new Date("2025-10-01T00:00:00.000Z"),
        timeMs: 40000,
        athleteName: "同名 太郎",
        event: { title: "15mクロール", distanceM: 15, style: "クロール", grade: 3, gender: "male" as const }
      }
    ]);

    expect(ranks.get("dup-slow")).toBeUndefined();
    expect(ranks.get("dup-fast")).toBe(1);
    expect(ranks.get("other")).toBe(2);
    expect(ranks.get("next-month")).toBe(1);
  });

  it("dedupes same athlete for monthly overall ranks across grades", () => {
    const ranks = assignMonthlyOverallRanks([
      {
        id: "overall-slow",
        heldOn: new Date("2025-09-01T00:00:00.000Z"),
        timeMs: 42000,
        athleteName: "同名 太郎",
        event: { title: "15mクロール", distanceM: 15, style: "クロール", grade: 3, gender: "male" as const }
      },
      {
        id: "overall-fast",
        heldOn: new Date("2025-09-10T00:00:00.000Z"),
        timeMs: 40000,
        athleteName: "同名 太郎",
        event: { title: "15mクロール", distanceM: 15, style: "クロール", grade: 5, gender: "male" as const }
      },
      {
        id: "overall-other",
        heldOn: new Date("2025-09-12T00:00:00.000Z"),
        timeMs: 41000,
        athleteName: "別人 次郎",
        event: { title: "15mクロール", distanceM: 15, style: "クロール", grade: 4, gender: "male" as const }
      }
    ]);

    expect(ranks.get("overall-slow")).toBeUndefined();
    expect(ranks.get("overall-fast")).toBe(1);
    expect(ranks.get("overall-other")).toBe(2);
  });

  it("does not dedupe all-time class ranks", () => {
    const ranks = assignAllTimeClassRanks([
      {
        id: "history-slow",
        heldOn: new Date("2025-09-01T00:00:00.000Z"),
        timeMs: 42000,
        athleteName: "同名 太郎",
        event: { title: "15mクロール", distanceM: 15, style: "クロール", grade: 3, gender: "male" as const }
      },
      {
        id: "history-fast",
        heldOn: new Date("2025-10-01T00:00:00.000Z"),
        timeMs: 40000,
        athleteName: "同名 太郎",
        event: { title: "15mクロール", distanceM: 15, style: "クロール", grade: 3, gender: "male" as const }
      },
      {
        id: "history-other",
        heldOn: new Date("2025-11-01T00:00:00.000Z"),
        timeMs: 41000,
        athleteName: "別人 次郎",
        event: { title: "15mクロール", distanceM: 15, style: "クロール", grade: 3, gender: "male" as const }
      }
    ]);

    expect(ranks.get("history-fast")).toBe(1);
    expect(ranks.get("history-other")).toBe(2);
    expect(ranks.get("history-slow")).toBe(3);
  });
});
