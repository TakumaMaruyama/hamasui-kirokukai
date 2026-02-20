import { describe, expect, it } from "vitest";
import {
  buildChallengeEventRankingGroups,
  buildHistoricalFirstRankingGroups,
  buildMeetRankingGroups
} from "../lib/ranking-report";

describe("buildMeetRankingGroups", () => {
  it("groups by event and sorts groups/entries", () => {
    const groups = buildMeetRankingGroups([
      {
        rank: 2,
        timeText: "00:40.00",
        athlete: { fullName: "山田 太郎", fullNameKana: "やまだ たろう" },
        event: { id: "e2", title: "25m自由形", grade: 2, gender: "male" }
      },
      {
        rank: 1,
        timeText: "00:35.00",
        athlete: { fullName: "佐藤 花子", fullNameKana: "さとう はなこ" },
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
    expect(groups[1].entries.map((entry) => entry.displayName)).toEqual(["青木 一郎", "山田 太郎"]);
  });

  it("shows kana only for preschool grades and keeps full-name sort order", () => {
    const groups = buildMeetRankingGroups(
      [
        {
          rank: 1,
          timeText: "00:33.00",
          athlete: { fullName: "B太郎", fullNameKana: "あたろう" },
          event: { id: "e1", title: "15mキック", grade: 3, gender: "male" }
        },
        {
          rank: 1,
          timeText: "00:34.00",
          athlete: { fullName: "A太郎", fullNameKana: "んたろう" },
          event: { id: "e1", title: "15mキック", grade: 3, gender: "male" }
        },
        {
          rank: 2,
          timeText: "00:40.00",
          athlete: { fullName: "C花子" },
          event: { id: "e1", title: "15mキック", grade: 3, gender: "male" }
        },
        {
          rank: 1,
          timeText: "00:30.00",
          athlete: { fullName: "D次郎", fullNameKana: "でぃじろう" },
          event: { id: "e2", title: "25mクロール", grade: 4, gender: "male" }
        }
      ],
      {
        preschoolNameMode: "kanaOnly",
        preschoolMaxGrade: 3
      }
    );

    expect(groups[0]?.entries.map((entry) => entry.fullName)).toEqual(["A太郎", "B太郎", "C花子"]);
    expect(groups[0]?.entries.map((entry) => entry.displayName)).toEqual(["んたろう", "あたろう", "C花子"]);
    expect(groups[1]?.entries[0]?.displayName).toBe("D次郎");
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
    expect(groups[0].entries.map((entry) => entry.displayName)).toEqual(["佐藤 花子", "青木 一郎"]);
    expect(groups[1].grade).toBe(4);
    expect(groups[1].entries).toHaveLength(1);
    expect(groups[1].entries[0]?.fullName).toBe("鈴木 次郎");
    expect(groups[1].entries[0]?.displayName).toBe("鈴木 次郎");
  });
});

describe("buildChallengeEventRankingGroups", () => {
  it("groups by event title and grade, splitting male/female columns", () => {
    const groups = buildChallengeEventRankingGroups([
      {
        rank: 2,
        timeText: "24.25",
        athlete: { fullName: "おおすぎ あいな" },
        event: { id: "e-15-f-1", title: "15mクロール", grade: 1, gender: "female" }
      },
      {
        rank: 1,
        timeText: "46.97",
        athlete: { fullName: "ひらいし たいが" },
        event: { id: "e-15-m-1", title: "15mクロール", grade: 1, gender: "male" }
      },
      {
        rank: 1,
        timeText: "14.57",
        athlete: { fullName: "増山 連人" },
        event: { id: "e-15-m-5", title: "15mクロール", grade: 5, gender: "male" }
      },
      {
        rank: 1,
        timeText: "15.51",
        athlete: { fullName: "上原 梨菜" },
        event: { id: "e-15-f-5", title: "15mクロール", grade: 5, gender: "female" }
      },
      {
        rank: 1,
        timeText: "12.00",
        athlete: { fullName: "青木 一郎" },
        event: { id: "e-25-m-5", title: "25mクロール", grade: 5, gender: "male" }
      }
    ]);

    expect(groups).toHaveLength(2);
    expect(groups[0]?.eventTitle).toBe("15mクロール");
    expect(groups[0]?.gradeGroups).toHaveLength(2);
    expect(groups[0]?.gradeGroups[0]?.grade).toBe(1);
    expect(groups[0]?.gradeGroups[0]?.maleEntries.map((entry) => entry.fullName)).toEqual(["ひらいし たいが"]);
    expect(groups[0]?.gradeGroups[0]?.femaleEntries.map((entry) => entry.fullName)).toEqual(["おおすぎ あいな"]);
    expect(groups[0]?.gradeGroups[0]?.maleEntries.map((entry) => entry.displayName)).toEqual(["ひらいし たいが"]);
    expect(groups[0]?.gradeGroups[0]?.femaleEntries.map((entry) => entry.displayName)).toEqual(["おおすぎ あいな"]);
    expect(groups[0]?.gradeGroups[1]?.grade).toBe(5);
    expect(groups[0]?.gradeGroups[1]?.maleEntries[0]?.fullName).toBe("増山 連人");
    expect(groups[0]?.gradeGroups[1]?.femaleEntries[0]?.fullName).toBe("上原 梨菜");
    expect(groups[1]?.eventTitle).toBe("25mクロール");
  });

  it("keeps right column for non-male gender data", () => {
    const groups = buildChallengeEventRankingGroups([
      {
        rank: 1,
        timeText: "20.00",
        athlete: { fullName: "テスト 太郎" },
        event: { id: "e1", title: "15mキック", grade: 2, gender: "other" }
      }
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0]?.gradeGroups[0]?.maleEntries).toHaveLength(0);
    expect(groups[0]?.gradeGroups[0]?.femaleEntries.map((entry) => entry.fullName)).toEqual(["テスト 太郎"]);
  });

  it("shows kana only for preschool rows and falls back to full name when kana is empty", () => {
    const groups = buildChallengeEventRankingGroups(
      [
        {
          rank: 1,
          timeText: "24.00",
          athlete: { fullName: "田中 太郎", fullNameKana: "たなか たろう" },
          event: { id: "e1", title: "15mクロール", grade: 2, gender: "male" }
        },
        {
          rank: 1,
          timeText: "25.00",
          athlete: { fullName: "鈴木 花子", fullNameKana: " " },
          event: { id: "e2", title: "15mクロール", grade: 2, gender: "female" }
        },
        {
          rank: 1,
          timeText: "26.00",
          athlete: { fullName: "高橋 次郎", fullNameKana: "たかはし じろう" },
          event: { id: "e3", title: "15mクロール", grade: 4, gender: "male" }
        }
      ],
      {
        preschoolNameMode: "kanaOnly",
        preschoolMaxGrade: 3
      }
    );

    expect(groups[0]?.gradeGroups[0]?.maleEntries[0]?.displayName).toBe("たなか たろう");
    expect(groups[0]?.gradeGroups[0]?.femaleEntries[0]?.displayName).toBe("鈴木 花子");
    expect(groups[0]?.gradeGroups[1]?.maleEntries[0]?.displayName).toBe("高橋 次郎");
  });

  it("filters challenge entries by rank range and excludes other gender when configured", () => {
    const groups = buildChallengeEventRankingGroups(
      [
        {
          rank: 1,
          timeText: "20.00",
          athlete: { fullName: "男子1位" },
          event: { id: "e1", title: "15mキック", grade: 2, gender: "male" }
        },
        {
          rank: 2,
          timeText: "21.00",
          athlete: { fullName: "女子2位" },
          event: { id: "e2", title: "15mキック", grade: 2, gender: "female" }
        },
        {
          rank: 3,
          timeText: "22.00",
          athlete: { fullName: "女子3位" },
          event: { id: "e3", title: "15mキック", grade: 2, gender: "female" }
        },
        {
          rank: 4,
          timeText: "23.00",
          athlete: { fullName: "男子4位" },
          event: { id: "e4", title: "15mキック", grade: 2, gender: "male" }
        },
        {
          rank: 2,
          timeText: "21.50",
          athlete: { fullName: "その他2位" },
          event: { id: "e5", title: "15mキック", grade: 2, gender: "other" }
        }
      ],
      {
        minRank: 1,
        maxRank: 3,
        excludeOtherGender: true
      }
    );

    expect(groups).toHaveLength(1);
    expect(groups[0]?.gradeGroups[0]?.maleEntries.map((entry) => entry.fullName)).toEqual(["男子1位"]);
    expect(groups[0]?.gradeGroups[0]?.femaleEntries.map((entry) => entry.fullName)).toEqual(["女子2位", "女子3位"]);
  });

  it("fills missing grades continuously when gradeRangeMode is minToMax", () => {
    const groups = buildChallengeEventRankingGroups(
      [
        {
          rank: 1,
          timeText: "20.00",
          athlete: { fullName: "年少" },
          event: { id: "e1", title: "15mキック", grade: 1, gender: "male" }
        },
        {
          rank: 1,
          timeText: "21.00",
          athlete: { fullName: "年長" },
          event: { id: "e2", title: "15mキック", grade: 3, gender: "female" }
        }
      ],
      {
        gradeRangeMode: "minToMax"
      }
    );

    expect(groups).toHaveLength(1);
    expect(groups[0]?.gradeGroups.map((group) => group.grade)).toEqual([1, 2, 3]);
    expect(groups[0]?.gradeGroups[1]?.maleEntries).toHaveLength(0);
    expect(groups[0]?.gradeGroups[1]?.femaleEntries).toHaveLength(0);
  });
});
