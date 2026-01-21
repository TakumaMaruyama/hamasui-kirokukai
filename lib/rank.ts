export type RankedResult = { id: string; timeMs: number };

export function assignDenseRanks(results: RankedResult[]): Map<string, number> {
  const sorted = [...results].sort((a, b) => a.timeMs - b.timeMs);
  const ranks = new Map<string, number>();
  let currentRank = 0;
  let lastTime: number | null = null;

  for (const result of sorted) {
    if (lastTime === null || result.timeMs !== lastTime) {
      currentRank += 1;
      lastTime = result.timeMs;
    }
    ranks.set(result.id, currentRank);
  }

  return ranks;
}
