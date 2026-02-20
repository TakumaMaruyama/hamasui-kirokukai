import type { RankingEntry } from "./ranking-report";

export type ChallengeRankingTableRow = {
  rankLabel: string;
  entry: RankingEntry | null;
};

export type ChallengeRankingTableRowOptions = {
  minRank?: number;
  maxRank?: number;
};

const DEFAULT_MIN_RANK = 1;
const DEFAULT_MAX_RANK = 3;

export function buildChallengeRankingTableRows(
  entries: RankingEntry[],
  options: ChallengeRankingTableRowOptions = {}
): ChallengeRankingTableRow[] {
  const minRank = options.minRank ?? DEFAULT_MIN_RANK;
  const maxRank = options.maxRank ?? DEFAULT_MAX_RANK;
  const rows: ChallengeRankingTableRow[] = [];

  for (let rank = minRank; rank <= maxRank; rank += 1) {
    const matched = entries.filter((entry) => entry.rank === rank);
    if (matched.length === 0) {
      rows.push({ rankLabel: `${rank}位`, entry: null });
      continue;
    }

    for (const entry of matched) {
      rows.push({ rankLabel: `${rank}位`, entry });
    }
  }

  return rows;
}
