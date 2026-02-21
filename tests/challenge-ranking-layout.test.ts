import { describe, expect, it } from "vitest";
import { buildChallengeRankingTableRows } from "../lib/challenge-ranking-layout";

describe("buildChallengeRankingTableRows", () => {
  it("returns empty rank slots for 1st to 3rd when no entries exist", () => {
    const rows = buildChallengeRankingTableRows([]);

    expect(rows).toEqual([
      { rankLabel: "1位", entry: null },
      { rankLabel: "2位", entry: null },
      { rankLabel: "3位", entry: null }
    ]);
  });

  it("keeps empty slots for missing ranks", () => {
    const rows = buildChallengeRankingTableRows([
      {
        rank: 1,
        fullName: "山田 太郎",
        displayName: "やまだ たろう",
        timeText: "20.00"
      }
    ]);

    expect(rows[0]?.rankLabel).toBe("1位");
    expect(rows[0]?.entry?.fullName).toBe("山田 太郎");
    expect(rows[1]).toEqual({ rankLabel: "2位", entry: null });
    expect(rows[2]).toEqual({ rankLabel: "3位", entry: null });
  });

  it("expands rows when tied athletes share the same rank", () => {
    const rows = buildChallengeRankingTableRows([
      {
        rank: 1,
        fullName: "1位選手",
        displayName: "1位選手",
        timeText: "18.00"
      },
      {
        rank: 3,
        fullName: "3位A",
        displayName: "3位A",
        timeText: "20.00"
      },
      {
        rank: 3,
        fullName: "3位B",
        displayName: "3位B",
        timeText: "20.00"
      }
    ]);

    expect(rows.map((row) => row.rankLabel)).toEqual(["1位", "2位", "3位", "3位"]);
    expect(rows[1]?.entry).toBeNull();
    expect(rows[2]?.entry?.fullName).toBe("3位A");
    expect(rows[3]?.entry?.fullName).toBe("3位B");
  });

  it("supports limiting rows to first place only", () => {
    const rows = buildChallengeRankingTableRows(
      [
        {
          rank: 1,
          fullName: "1位選手",
          displayName: "1位選手",
          timeText: "18.00"
        },
        {
          rank: 2,
          fullName: "2位選手",
          displayName: "2位選手",
          timeText: "19.00"
        }
      ],
      { minRank: 1, maxRank: 1 }
    );

    expect(rows).toEqual([
      {
        rankLabel: "1位",
        entry: {
          rank: 1,
          fullName: "1位選手",
          displayName: "1位選手",
          timeText: "18.00"
        }
      }
    ]);
  });

  it("keeps all tied first-place rows when limited to first place only", () => {
    const rows = buildChallengeRankingTableRows(
      [
        {
          rank: 1,
          fullName: "1位A",
          displayName: "1位A",
          timeText: "18.00"
        },
        {
          rank: 1,
          fullName: "1位B",
          displayName: "1位B",
          timeText: "18.00"
        },
        {
          rank: 2,
          fullName: "2位",
          displayName: "2位",
          timeText: "19.00"
        }
      ],
      { minRank: 1, maxRank: 1 }
    );

    expect(rows.map((row) => row.rankLabel)).toEqual(["1位", "1位"]);
    expect(rows.map((row) => row.entry?.fullName ?? "")).toEqual(["1位A", "1位B"]);
  });
});
