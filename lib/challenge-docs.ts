import { prisma } from "./prisma";
import type { DocsFilter } from "./docs-filter";
import { assignMonthlyRanks } from "./monthly-rank";
import { buildChallengeEventRankingGroups } from "./ranking-report";
import type { ChallengeDocumentMonth, ChallengeRankingPreview } from "./challenge-docs-types";

export class ChallengeDocsInputError extends Error {}

export async function listChallengeDocumentMonths(): Promise<ChallengeDocumentMonth[]> {
  const meets = await prisma.meet.findMany({
    where: { program: "challenge" }, select: { heldOn: true },
    orderBy: { heldOn: "desc" }, distinct: ["heldOn"]
  });
  const months = new Map<string, ChallengeDocumentMonth>();
  for (const { heldOn } of meets) {
    const year = heldOn.getUTCFullYear();
    const month = heldOn.getUTCMonth() + 1;
    months.set(`${year}-${month}`, { year, month });
  }
  return Array.from(months.values()).sort((a, b) => b.year - a.year || b.month - a.month);
}

// Preview and PDF share the monthly representatives and unrestricted rankings.
export async function prepareChallengeRanking(filter: DocsFilter): Promise<{
  periodLabel: string;
  preview: ChallengeRankingPreview;
}> {
  if (!filter.hasMonthFilter || !filter.year || !filter.month || !filter.monthStart || !filter.monthEnd) {
    throw new ChallengeDocsInputError("ランキング出力には年・月の指定が必要です");
  }
  if (filter.weekday || filter.fullName) {
    throw new ChallengeDocsInputError("ランキングでは曜日・氏名を指定できません");
  }
  const rows = await prisma.result.findMany({
    where: { meet: { program: "challenge", heldOn: { gte: filter.monthStart, lt: filter.monthEnd } } },
    include: {
      athlete: { select: { fullName: true, fullNameKana: true } },
      event: true,
      meet: { select: { heldOn: true } }
    }
  });
  const monthlyRanks = assignMonthlyRanks(rows.map((row) => ({
    id: row.id, heldOn: row.meet.heldOn, timeMs: row.timeMs,
    athleteName: row.athlete.fullName, event: row.event
  })));
  const rankedRows = rows.map((row) => ({ ...row, rank: monthlyRanks.get(row.id) ?? 0 }))
    .filter((row) => row.rank > 0);
  const groups = buildChallengeEventRankingGroups(rankedRows, {
    preschoolNameMode: "kanaOnly", preschoolMaxGrade: 3, minRank: 1,
    gradeRangeMode: "minToMax", excludeOtherGender: true
  });
  return {
    periodLabel: `${filter.year}年${filter.month}月 チャレンジコース`,
    preview: {
      filename: `${filter.year}年${filter.month}月_challenge_ranking.pdf`,
      counts: {
        records: groups.reduce((sum, group) => sum + group.gradeGroups.reduce(
          (subtotal, grade) => subtotal + grade.maleEntries.length + grade.femaleEntries.length, 0
        ), 0),
        events: groups.length
      },
      groups
    }
  };
}
