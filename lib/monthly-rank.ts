import { assignDenseRanks } from "./rank";

export type MonthlyRankSource = {
  id: string;
  eventId: string;
  heldOn: Date;
  timeMs: number;
};

function toMonthKey(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function assignMonthlyRanks(results: MonthlyRankSource[]): Map<string, number> {
  const grouped = new Map<string, Array<{ id: string; timeMs: number }>>();

  for (const result of results) {
    const key = `${toMonthKey(result.heldOn)}:${result.eventId}`;
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
