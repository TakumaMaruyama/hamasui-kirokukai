export function buildSwimmingRankingDocumentMeta(year: number, month: number): {
  periodLabel: string;
  fileName: string;
} {
  const periodLabel = `${year}年${month}月 一般コース`;

  return {
    periodLabel,
    fileName: `${periodLabel}_ranking.pdf`
  };
}
