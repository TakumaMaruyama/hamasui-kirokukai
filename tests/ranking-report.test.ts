import { describe, expect, it } from "vitest";
import {
  buildChallengeEventRankingGroups,
  buildHistoricalFirstChallengeGroups,
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

describe("buildHistoricalFirstChallengeGroups", () => {
  it("groups historical first records by event and splits male/female columns", () => {
    const groups = buildHistoricalFirstChallengeGroups(
      [
        {
          timeMs: 39000,
          timeText: "00:39.00",
          athlete: { id: "a1", fullName: "男子1位" },
          event: { title: "15mクロール", distanceM: 15, style: "クロール", grade: 3, gender: "male" },
          meet: { heldOn: new Date("2025-08-10T00:00:00.000Z") }
        },
        {
          timeMs: 41000,
          timeText: "00:41.00",
          athlete: { id: "b1", fullName: "女子1位" },
          event: { title: "15mクロール", distanceM: 15, style: "クロール", grade: 3, gender: "female" },
          meet: { heldOn: new Date("2025-07-10T00:00:00.000Z") }
        }
      ],
      {
        targetMonthStart: new Date("2025-09-01T00:00:00.000Z"),
        targetMonthEnd: new Date("2025-10-01T00:00:00.000Z")
      }
    );

    expect(groups).toHaveLength(1);
    expect(groups[0]?.eventTitle).toBe("15mクロール");
    expect(groups[0]?.gradeGroups[0]?.maleEntries.map((entry) => entry.fullName)).toEqual(["男子1位"]);
    expect(groups[0]?.gradeGroups[0]?.femaleEntries.map((entry) => entry.fullName)).toEqual(["女子1位"]);
  });

  it("keeps empty right column data when only one gender has records", () => {
    const groups = buildHistoricalFirstChallengeGroups([
      {
        timeMs: 39000,
        timeText: "00:39.00",
        athlete: { id: "a1", fullName: "男子のみ" },
        event: { title: "15mクロール", distanceM: 15, style: "クロール", grade: 3, gender: "male" },
        meet: { heldOn: new Date("2025-08-10T00:00:00.000Z") }
      }
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0]?.gradeGroups[0]?.maleEntries.map((entry) => entry.fullName)).toEqual(["男子のみ"]);
    expect(groups[0]?.gradeGroups[0]?.femaleEntries).toEqual([]);
  });

  it("marks swimmers who newly became all-time first in the target month", () => {
    const groups = buildHistoricalFirstChallengeGroups(
      [
        {
          timeMs: 39000,
          timeText: "00:39.00",
          athlete: { id: "old", fullName: "旧記録者" },
          event: { title: "25mクロール", distanceM: 25, style: "クロール", grade: 5, gender: "male" },
          meet: { heldOn: new Date("2025-08-10T00:00:00.000Z") }
        },
        {
          timeMs: 38000,
          timeText: "00:38.00",
          athlete: { id: "new", fullName: "新記録者" },
          event: { title: "25mクロール", distanceM: 25, style: "クロール", grade: 5, gender: "male" },
          meet: { heldOn: new Date("2025-09-10T00:00:00.000Z") }
        },
        {
          timeMs: 38000,
          timeText: "00:38.00",
          athlete: { id: "tie", fullName: "同タイ記録者" },
          event: { title: "25mクロール", distanceM: 25, style: "クロール", grade: 5, gender: "male" },
          meet: { heldOn: new Date("2025-09-20T00:00:00.000Z") }
        }
      ],
      {
        targetMonthStart: new Date("2025-09-01T00:00:00.000Z"),
        targetMonthEnd: new Date("2025-10-01T00:00:00.000Z")
      }
    );

    expect(groups).toHaveLength(1);
    const maleEntries = groups[0]?.gradeGroups[0]?.maleEntries ?? [];
    expect(maleEntries.map((entry) => entry.fullName)).toEqual(["新記録者", "同タイ記録者"]);
    expect(maleEntries.every((entry) => entry.isNewRecordInTargetMonth)).toBe(true);
  });

  it("includes held year-month in historical first entries", () => {
    const groups = buildHistoricalFirstChallengeGroups([
      {
        timeMs: 38000,
        timeText: "00:38.00",
        athlete: { id: "new", fullName: "新記録者" },
        event: { title: "25mクロール", distanceM: 25, style: "クロール", grade: 5, gender: "male" },
        meet: { heldOn: new Date("2025-09-10T00:00:00.000Z") }
      }
    ]);

    const entry = groups[0]?.gradeGroups[0]?.maleEntries[0];
    expect(entry?.recordMonthLabel).toBe("2025年9月");
  });

  it("uses existing grade groups for historical output and does not fill missing grades", () => {
    const groups = buildHistoricalFirstChallengeGroups([
      {
        timeMs: 25000,
        timeText: "00:25.00",
        athlete: { id: "g1", fullName: "年少1位" },
        event: { title: "15m板キック", distanceM: 15, style: "板キック", grade: 1, gender: "male" },
        meet: { heldOn: new Date("2025-08-10T00:00:00.000Z") }
      },
      {
        timeMs: 24000,
        timeText: "00:24.00",
        athlete: { id: "g3", fullName: "年長1位" },
        event: { title: "15m板キック", distanceM: 15, style: "板キック", grade: 3, gender: "female" },
        meet: { heldOn: new Date("2025-08-10T00:00:00.000Z") }
      }
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0]?.gradeGroups.map((group) => group.grade)).toEqual([1, 3]);
  });

  it("normalizes historical event class keys so title variants do not create duplicate first rows", () => {
    const groups = buildHistoricalFirstChallengeGroups([
      {
        timeMs: 18000,
        timeText: "00:18.00",
        athlete: { id: "fast", fullName: "最速選手" },
        event: { title: "15m クロール", distanceM: 15, style: "クロール", grade: 5, gender: "male" },
        meet: { heldOn: new Date("2025-08-10T00:00:00.000Z") }
      },
      {
        timeMs: 20000,
        timeText: "00:20.00",
        athlete: { id: "slow", fullName: "遅い選手" },
        event: { title: "15ｍクロール", distanceM: 15, style: "クロール", grade: 5, gender: "male" },
        meet: { heldOn: new Date("2025-08-20T00:00:00.000Z") }
      }
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0]?.gradeGroups[0]?.maleEntries.map((entry) => entry.fullName)).toEqual(["最速選手"]);
  });

  it("does not mark repeated top records in target month when the same swimmer already held the top before month", () => {
    const groups = buildHistoricalFirstChallengeGroups(
      [
        {
          timeMs: 18000,
          timeText: "00:18.00",
          athlete: { id: "a", fullName: "既存トップ保持者" },
          event: { title: "30mクロール", distanceM: 30, style: "クロール", grade: 4, gender: "male" },
          meet: { heldOn: new Date("2025-08-10T00:00:00.000Z") }
        },
        {
          timeMs: 18000,
          timeText: "00:18.00",
          athlete: { id: "a", fullName: "既存トップ保持者" },
          event: { title: "30mクロール", distanceM: 30, style: "クロール", grade: 4, gender: "male" },
          meet: { heldOn: new Date("2025-09-05T00:00:00.000Z") }
        },
        {
          timeMs: 18000,
          timeText: "00:18.00",
          athlete: { id: "b", fullName: "新規同タイ到達者" },
          event: { title: "30mクロール", distanceM: 30, style: "クロール", grade: 4, gender: "male" },
          meet: { heldOn: new Date("2025-09-20T00:00:00.000Z") }
        }
      ],
      {
        targetMonthStart: new Date("2025-09-01T00:00:00.000Z"),
        targetMonthEnd: new Date("2025-10-01T00:00:00.000Z")
      }
    );

    const maleEntries = groups[0]?.gradeGroups[0]?.maleEntries ?? [];
    expect(maleEntries.map((entry) => entry.fullName)).toEqual(["既存トップ保持者", "既存トップ保持者", "新規同タイ到達者"]);
    expect(maleEntries.map((entry) => Boolean(entry.isNewRecordInTargetMonth))).toEqual([false, false, true]);
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

  it("sorts event groups by the fixed swimming event order first", () => {
    const groups = buildChallengeEventRankingGroups([
      {
        rank: 1,
        timeText: "20.00",
        athlete: { fullName: "平泳ぎ30" },
        event: { id: "e6", title: "30m平泳ぎ", distanceM: 30, style: "平泳ぎ", grade: 3, gender: "male" }
      },
      {
        rank: 1,
        timeText: "20.00",
        athlete: { fullName: "板キック15" },
        event: { id: "e1", title: "15m板キック", distanceM: 15, style: "キック", grade: 3, gender: "male" }
      },
      {
        rank: 1,
        timeText: "20.00",
        athlete: { fullName: "板クロール15" },
        event: { id: "e2", title: "15m板クロール", distanceM: 15, style: "クロール", grade: 3, gender: "male" }
      },
      {
        rank: 1,
        timeText: "20.00",
        athlete: { fullName: "クロール30" },
        event: { id: "e4", title: "30mクロール", distanceM: 30, style: "クロール", grade: 3, gender: "male" }
      },
      {
        rank: 1,
        timeText: "20.00",
        athlete: { fullName: "クロール15" },
        event: { id: "e3", title: "15mクロール", distanceM: 15, style: "クロール", grade: 3, gender: "male" }
      },
      {
        rank: 1,
        timeText: "20.00",
        athlete: { fullName: "平泳ぎ15" },
        event: { id: "e5", title: "15m平泳ぎ", distanceM: 15, style: "平泳ぎ", grade: 3, gender: "male" }
      }
    ]);

    expect(groups.map((group) => group.eventTitle)).toEqual([
      "15m板キック",
      "15m板クロール",
      "15mクロール",
      "30mクロール",
      "15m平泳ぎ",
      "30m平泳ぎ"
    ]);
  });

  it("places non-fixed events after the fixed event list", () => {
    const groups = buildChallengeEventRankingGroups([
      {
        rank: 1,
        timeText: "20.00",
        athlete: { fullName: "固定種目" },
        event: { id: "e1", title: "15m板キック", distanceM: 15, style: "キック", grade: 3, gender: "male" }
      },
      {
        rank: 1,
        timeText: "20.00",
        athlete: { fullName: "対象外種目" },
        event: { id: "e2", title: "10mテスト", distanceM: 10, style: "other", grade: 3, gender: "male" }
      }
    ]);

    expect(groups.map((group) => group.eventTitle)).toEqual(["15m板キック", "10mテスト"]);
  });

  it("keeps fixed ordering even when titles use full-width and spacing variants", () => {
    const groups = buildChallengeEventRankingGroups([
      {
        rank: 1,
        timeText: "20.00",
        athlete: { fullName: "板キック" },
        event: { id: "e1", title: "15ｍ  板キック", distanceM: 15, style: "キック", grade: 3, gender: "male" }
      },
      {
        rank: 1,
        timeText: "20.00",
        athlete: { fullName: "板クロール" },
        event: { id: "e2", title: "15M 板クロール", distanceM: 15, style: "クロール", grade: 3, gender: "male" }
      }
    ]);

    expect(groups.map((group) => group.eventTitle)).toEqual(["15ｍ 板キック", "15M 板クロール"]);
  });

  it("merges challenge rows with title variants into one event group", () => {
    const groups = buildChallengeEventRankingGroups([
      {
        rank: 1,
        timeText: "18.00",
        athlete: { fullName: "1位" },
        event: { id: "e1", title: "25m クロール", distanceM: 25, style: "free", grade: 5, gender: "male" }
      },
      {
        rank: 2,
        timeText: "19.00",
        athlete: { fullName: "2位" },
        event: { id: "e2", title: "25ｍ  クロール", distanceM: 25, style: "free", grade: 5, gender: "male" }
      },
      {
        rank: 3,
        timeText: "20.00",
        athlete: { fullName: "3位" },
        event: { id: "e3", title: "25M　クロール", distanceM: 25, style: "free", grade: 5, gender: "male" }
      }
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0]?.eventTitle).toBe("25m クロール");
    expect(groups[0]?.gradeGroups[0]?.maleEntries.map((entry) => entry.rank)).toEqual([1, 2, 3]);
    expect(groups[0]?.gradeGroups[0]?.maleEntries.map((entry) => entry.fullName)).toEqual(["1位", "2位", "3位"]);
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
