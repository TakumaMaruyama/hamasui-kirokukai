import { assignDenseRanks } from "./rank";
import type { Gender } from "@prisma/client";

export type MonthlyRankSource = {
  id: string;
  heldOn: Date;
  timeMs: number;
  athleteName?: string;
  event: {
    title: string;
    distanceM: number;
    style: string;
    grade: number;
    gender: Gender;
  };
};

export type RankStat = {
  rank: number;
  total: number;
  topPercent: number;
};

function toMonthKey(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function toEventBaseKey(source: MonthlyRankSource): string {
  const { title, distanceM, style } = source.event;
  return [title, distanceM, style].join(":");
}

function toEventClassKey(source: MonthlyRankSource): string {
  const { grade, gender } = source.event;
  return `${toEventBaseKey(source)}:${grade}:${gender}`;
}

function toEventBaseGenderKey(source: MonthlyRankSource): string {
  return `${toEventBaseKey(source)}:${source.event.gender}`;
}

function normalizeAthleteName(value: string | undefined): string | null {
  const normalized = value?.replace(/\s+/g, " ").trim();
  return normalized ? normalized : null;
}

function toRankTargets(
  entries: MonthlyRankSource[],
  options?: { dedupeByAthleteName?: boolean }
): Array<{ id: string; timeMs: number }> {
  if (!options?.dedupeByAthleteName) {
    return entries.map((entry) => ({ id: entry.id, timeMs: entry.timeMs }));
  }

  const bestByAthlete = new Map<string, { id: string; timeMs: number }>();
  const unnamedEntries: Array<{ id: string; timeMs: number }> = [];

  for (const entry of entries) {
    const athleteName = normalizeAthleteName(entry.athleteName);
    if (!athleteName) {
      unnamedEntries.push({ id: entry.id, timeMs: entry.timeMs });
      continue;
    }

    const currentBest = bestByAthlete.get(athleteName);
    if (
      !currentBest ||
      entry.timeMs < currentBest.timeMs ||
      (entry.timeMs === currentBest.timeMs && entry.id.localeCompare(currentBest.id, "en") < 0)
    ) {
      bestByAthlete.set(athleteName, { id: entry.id, timeMs: entry.timeMs });
    }
  }

  return [...bestByAthlete.values(), ...unnamedEntries];
}

function assignGroupedRanks(
  results: MonthlyRankSource[],
  toGroupKey: (source: MonthlyRankSource) => string,
  options?: { dedupeByAthleteName?: boolean }
): Map<string, number> {
  const rankStats = assignGroupedRankStats(results, toGroupKey, options);
  const ranks = new Map<string, number>();
  for (const [id, stat] of rankStats.entries()) {
    ranks.set(id, stat.rank);
  }
  return ranks;
}

function assignGroupedRankStats(
  results: MonthlyRankSource[],
  toGroupKey: (source: MonthlyRankSource) => string,
  options?: { dedupeByAthleteName?: boolean }
): Map<string, RankStat> {
  const grouped = new Map<string, MonthlyRankSource[]>();

  for (const result of results) {
    const key = toGroupKey(result);
    if (!grouped.has(key)) {
      grouped.set(key, []);
    }

    grouped.get(key)!.push(result);
  }

  const rankStats = new Map<string, RankStat>();
  for (const groupedEntries of grouped.values()) {
    const rankTargets = toRankTargets(groupedEntries, options);
    const total = rankTargets.length;
    if (total === 0) {
      continue;
    }
    const groupRanks = assignDenseRanks(rankTargets);
    for (const [id, rank] of groupRanks.entries()) {
      rankStats.set(id, {
        rank,
        total,
        topPercent: Math.ceil((rank / total) * 100)
      });
    }
  }

  return rankStats;
}

export function assignMonthlyRanks(results: MonthlyRankSource[]): Map<string, number> {
  return assignGroupedRanks(
    results,
    (result) => `${toMonthKey(result.heldOn)}:${toEventClassKey(result)}`,
    { dedupeByAthleteName: true }
  );
}

export function assignMonthlyOverallRanks(results: MonthlyRankSource[]): Map<string, number> {
  return assignGroupedRanks(
    results,
    (result) => `${toMonthKey(result.heldOn)}:${toEventBaseGenderKey(result)}`,
    { dedupeByAthleteName: true }
  );
}

export function assignAllTimeClassRanks(results: MonthlyRankSource[]): Map<string, number> {
  return assignGroupedRanks(results, toEventClassKey);
}

export function assignMonthlyRankStats(results: MonthlyRankSource[]): Map<string, RankStat> {
  return assignGroupedRankStats(
    results,
    (result) => `${toMonthKey(result.heldOn)}:${toEventClassKey(result)}`,
    { dedupeByAthleteName: true }
  );
}

export function assignMonthlyOverallRankStats(results: MonthlyRankSource[]): Map<string, RankStat> {
  return assignGroupedRankStats(
    results,
    (result) => `${toMonthKey(result.heldOn)}:${toEventBaseGenderKey(result)}`,
    { dedupeByAthleteName: true }
  );
}

export function assignAllTimeClassRankStats(results: MonthlyRankSource[]): Map<string, RankStat> {
  return assignGroupedRankStats(results, toEventClassKey);
}
