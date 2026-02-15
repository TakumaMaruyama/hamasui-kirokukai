import { assignDenseRanks } from "./rank";
import type { Gender } from "@prisma/client";

export type MonthlyRankSource = {
  id: string;
  heldOn: Date;
  timeMs: number;
  event: {
    title: string;
    distanceM: number;
    style: string;
    grade: number;
    gender: Gender;
  };
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

function assignGroupedRanks(
  results: MonthlyRankSource[],
  toGroupKey: (source: MonthlyRankSource) => string
): Map<string, number> {
  const grouped = new Map<string, Array<{ id: string; timeMs: number }>>();

  for (const result of results) {
    const key = toGroupKey(result);
    if (!grouped.has(key)) {
      grouped.set(key, []);
    }

    grouped.get(key)!.push({ id: result.id, timeMs: result.timeMs });
  }

  const ranks = new Map<string, number>();
  for (const entries of grouped.values()) {
    const groupRanks = assignDenseRanks(entries);
    for (const [id, rank] of groupRanks.entries()) {
      ranks.set(id, rank);
    }
  }

  return ranks;
}

export function assignMonthlyRanks(results: MonthlyRankSource[]): Map<string, number> {
  return assignGroupedRanks(results, (result) => `${toMonthKey(result.heldOn)}:${toEventClassKey(result)}`);
}

export function assignMonthlyOverallRanks(results: MonthlyRankSource[]): Map<string, number> {
  return assignGroupedRanks(results, (result) => `${toMonthKey(result.heldOn)}:${toEventBaseGenderKey(result)}`);
}

export function assignAllTimeClassRanks(results: MonthlyRankSource[]): Map<string, number> {
  return assignGroupedRanks(results, toEventClassKey);
}
