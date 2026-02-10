import { describe, expect, it } from "vitest";
import { buildMeetRankingGroups } from "../lib/ranking-report";

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
