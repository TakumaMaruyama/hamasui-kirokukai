import { describe, expect, it } from "vitest";
import { buildHistoricalFirstRankingGroups, buildMeetRankingGroups } from "../lib/ranking-report";

describe("buildMeetRankingGroups", () => {
  it("groups by event and sorts groups/entries", () => {
    const groups = buildMeetRankingGroups([
      {
        rank: 2,
        timeText: "00:40.00",
        athlete: { fullName: "山田 太郎" },
        event: { id: "e2", title: "25m自由形", grade: 2, gender: "male" }
      },
      {
        rank: 1,
        timeText: "00:35.00",
        athlete: { fullName: "佐藤 花子" },
        event: { id: "e1", title: "15mキック", grade: 1, gender: "female" }
      },
      {
        rank: 1,
        timeText: "00:38.00",
        athlete: { fullName: "青木 一郎" },
        event: { id: "e2", title: "25m自由形", grade: 2, gender: "male" }
      }
    ]);

    expect(groups).toHaveLength(2);
    expect(groups[0].eventId).toBe("e1");
    expect(groups[1].eventId).toBe("e2");
    expect(groups[1].entries.map((entry) => entry.fullName)).toEqual(["青木 一郎", "山田 太郎"]);
  });
});

describe("buildHistoricalFirstRankingGroups", () => {
  it("selects all-time first records per event class and keeps ties", () => {
    const groups = buildHistoricalFirstRankingGroups([
      {
        timeMs: 40000,
        timeText: "00:40.00",
        athlete: { fullName: "山田 太郎" },
        event: { title: "15mクロール", distanceM: 15, style: "クロール", grade: 3, gender: "male" },
        meet: { heldOn: new Date("2025-01-10T00:00:00.000Z") }
      },
      {
        timeMs: 39000,
        timeText: "00:39.00",
        athlete: { fullName: "佐藤 花子" },
        event: { title: "15mクロール", distanceM: 15, style: "クロール", grade: 3, gender: "male" },
        meet: { heldOn: new Date("2025-03-10T00:00:00.000Z") }
      },
      {
        timeMs: 39000,
        timeText: "00:39.00",
        athlete: { fullName: "青木 一郎" },
        event: { title: "15mクロール", distanceM: 15, style: "クロール", grade: 3, gender: "male" },
        meet: { heldOn: new Date("2025-04-10T00:00:00.000Z") }
      },
      {
        timeMs: 38000,
        timeText: "00:38.00",
        athlete: { fullName: "鈴木 次郎" },
        event: { title: "15mクロール", distanceM: 15, style: "クロール", grade: 4, gender: "male" },
        meet: { heldOn: new Date("2025-04-10T00:00:00.000Z") }
      }
    ]);

    expect(groups).toHaveLength(2);
    expect(groups[0].grade).toBe(3);
    expect(groups[0].entries.map((entry) => entry.fullName)).toEqual(["佐藤 花子", "青木 一郎"]);
    expect(groups[1].grade).toBe(4);
    expect(groups[1].entries).toHaveLength(1);
    expect(groups[1].entries[0]?.fullName).toBe("鈴木 次郎");
  });
});
