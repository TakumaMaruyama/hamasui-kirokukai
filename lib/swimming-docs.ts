import type { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { buildMeetWhere, type DocsFilter } from "./docs-filter";
import { buildSwimmingRecordOutputs } from "./swimming-record-output";
import { buildFirstPrizeAwards, selectMonthlyFirstPrizeRows, formatFirstPrizeGenderLabel } from "./first-prize";
import { buildHistoricalFirstChallengeGroups, type ChallengeEventRankingGroup } from "./ranking-report";
import { formatGradeLabel, RANKING_OUTPUT_GRADE_SEQUENCE } from "./grade";
import { formatTimeForDocument } from "./display-time";
import { normalizePdfText } from "./pdf-text";
import type { FirstPrizeAwardPdfInput, RecordCertificatePdfInput } from "./pdf";
import type { SwimmingDocumentKind, SwimmingDocumentMonth, SwimmingDocumentPreview } from "./swimming-docs-types";

export class SwimmingDocsInputError extends Error {}

type PreparedDocumentBase = { filename: string; preview: SwimmingDocumentPreview };
export type PreparedSwimmingDocument = PreparedDocumentBase & (
  | { kind: "records"; inputs: RecordCertificatePdfInput[] }
  | { kind: "certificates"; inputs: FirstPrizeAwardPdfInput[] }
  | { kind: "historical-firsts"; groups: ChallengeEventRankingGroup[]; periodLabel: string }
);

function isMissingFullNameKanaColumnError(error: unknown): boolean {
  return error instanceof Error && /Athlete\.fullNameKana|column .*fullNameKana.* does not exist/i.test(error.message);
}

// One result shape is shared by the record and award previews and their PDFs.
async function findMonthlyRows(meet: Prisma.MeetWhereInput, fullName?: string) {
  const where: Prisma.ResultWhereInput = {
    meet,
    ...(fullName ? { athlete: { is: { fullName } } } : {})
  };
  const select = {
    id: true, athleteId: true, eventId: true, timeText: true, timeMs: true,
    event: { select: { title: true, distanceM: true, style: true, grade: true, gender: true } },
    meet: { select: { heldOn: true, title: true } }
  } as const;
  const athleteSelect = { fullName: true, grade: true, gender: true } as const;
  const orderBy = [
    { athlete: { fullName: "asc" } }, { event: { title: "asc" } },
    { timeMs: "asc" }, { meet: { heldOn: "asc" } }
  ] satisfies Prisma.ResultOrderByWithRelationInput[];
  try {
    return await prisma.result.findMany({
      where, orderBy,
      select: { ...select, athlete: { select: { ...athleteSelect, fullNameKana: true } } }
    });
  } catch (error) {
    if (!isMissingFullNameKanaColumnError(error)) throw error;
  }
  const rows = await prisma.result.findMany({
    where, orderBy, select: { ...select, athlete: { select: athleteSelect } }
  });
  return rows.map((row) => ({ ...row, athlete: { ...row.athlete, fullNameKana: null } }));
}

function filenamePart(value: string): string {
  return value.replace(/[\\/:*?"<>|\r\n\t]+/g, "_").replace(/\s+/g, " ").trim() || "unknown";
}

function requireMonth(kind: SwimmingDocumentKind, filter: DocsFilter) {
  if (!filter.hasMonthFilter || !filter.year || !filter.month || !filter.monthStart || !filter.monthEnd) {
    const label = kind === "certificates" ? "1位賞状の出力" : kind === "historical-firsts" ? "歴代1位出力" : "対象確認";
    throw new SwimmingDocsInputError(`${label}には年・月の指定が必要です`);
  }
  return { year: filter.year, month: filter.month, monthStart: filter.monthStart, monthEnd: filter.monthEnd };
}

function previewPerson(athlete: RecordCertificatePdfInput["athlete"]) {
  return {
    name: normalizePdfText(athlete.fullName),
    gradeLabel: formatGradeLabel(athlete.grade),
    genderLabel: formatFirstPrizeGenderLabel(athlete.gender)
  };
}

export async function listSwimmingDocumentMonths(): Promise<SwimmingDocumentMonth[]> {
  const meets = await prisma.meet.findMany({
    where: { program: "swimming" }, select: { heldOn: true },
    orderBy: { heldOn: "desc" }, distinct: ["heldOn"]
  });
  const months = new Map<string, SwimmingDocumentMonth>();
  for (const { heldOn } of meets) {
    const year = heldOn.getUTCFullYear();
    const month = heldOn.getUTCMonth() + 1;
    months.set(`${year}-${month}`, { year, month });
  }
  return Array.from(months.values()).sort((a, b) => b.year - a.year || b.month - a.month);
}

async function prepareRecords(filter: DocsFilter): Promise<PreparedSwimmingDocument> {
  const latestMeet = filter.hasMonthFilter ? null : await prisma.meet.findFirst({
    where: { program: "swimming" }, orderBy: { heldOn: "desc" }, select: { id: true, title: true }
  });
  if (!filter.hasMonthFilter && !latestMeet) throw new SwimmingDocsInputError("条件に一致する記録会がありません");
  const rows = await findMonthlyRows(filter.hasMonthFilter ? buildMeetWhere("swimming", filter) : { id: latestMeet!.id }, filter.fullName);
  const outputs = buildSwimmingRecordOutputs(rows, filter.hasMonthFilter ? {
    year: filter.year, month: filter.month, groupByWeekdayFolders: !filter.weekday
  } : undefined);
  const period = filter.hasMonthFilter ? `${filter.year}年${filter.month}月${filter.weekday ?? ""}` : latestMeet!.title;
  const filename = [filenamePart(period), ...(filter.fullName ? [filenamePart(filter.fullName)] : []), "record"].join("_") + ".pdf";
  const inputs = outputs.map(({ athlete, entries, issueLabel }) => ({ athlete, entries, issueLabel }));
  const items = outputs.map((output) => ({
    ...previewPerson(output.athlete),
    ...(filter.weekday ? { weekday: filter.weekday } : output.outputPath.includes("/") ? { weekday: output.outputPath.split("/")[0] } : {}),
    entries: output.entries.slice(0, 4).map((entry) => ({ eventTitle: entry.eventTitle, timeText: formatTimeForDocument(entry) }))
  }));
  return { kind: "records", filename, inputs, preview: {
    kind: "records", filename,
    counts: { people: new Set(rows.map((row) => row.athleteId)).size, pages: inputs.length, records: items.reduce((sum, item) => sum + item.entries.length, 0) },
    items
  } };
}

async function prepareCertificates(filter: DocsFilter): Promise<PreparedSwimmingDocument> {
  const { year, month } = requireMonth("certificates", filter);
  if (filter.weekday) throw new SwimmingDocsInputError("1位賞状では曜日指定はできません");
  // Rank the entire month first. A name is a printing filter, never a ranking filter.
  const rows = await findMonthlyRows(buildMeetWhere("swimming", filter));
  const winners = selectMonthlyFirstPrizeRows(rows).filter((row) => !filter.fullName || row.athlete.fullName === filter.fullName);
  const awards = buildFirstPrizeAwards(winners, { year, month });
  const filename = [filenamePart(`${year}年${month}月`), ...(filter.fullName ? [filenamePart(filter.fullName)] : []), "first_prize"].join("_") + ".pdf";
  const inputs = awards.map(({ athlete, eventTitle, timeText, timeMs, issueLabel }) => ({ athlete, eventTitle, timeText, timeMs, issueLabel }));
  const items = inputs.map((input) => ({ ...previewPerson(input.athlete), entries: [{ eventTitle: input.eventTitle, timeText: formatTimeForDocument(input) }] }));
  return { kind: "certificates", filename, inputs, preview: {
    kind: "certificates", filename,
    counts: { people: new Set(awards.map(({ athlete }) => JSON.stringify([athlete.fullName, athlete.grade, athlete.gender]))).size, pages: awards.length, records: awards.length },
    items
  } };
}

async function prepareHistoricalFirsts(filter: DocsFilter): Promise<PreparedSwimmingDocument> {
  const { year, month, monthStart, monthEnd } = requireMonth("historical-firsts", filter);
  if (filter.weekday || filter.fullName) throw new SwimmingDocsInputError("歴代1位では曜日・氏名を指定できません");
  const where: Prisma.ResultWhereInput = {
    meet: { program: "swimming", heldOn: { lt: monthEnd } },
    event: { grade: { in: [...RANKING_OUTPUT_GRADE_SEQUENCE] }, gender: { in: ["male", "female"] } }
  };
  const select = {
    timeMs: true, timeText: true,
    event: { select: { title: true, distanceM: true, style: true, grade: true, gender: true } },
    meet: { select: { heldOn: true } }
  } as const;
  const rows = await (async () => {
    try {
      return await prisma.result.findMany({ where, select: { ...select, athlete: { select: { id: true, fullName: true, fullNameKana: true } } } });
    } catch (error) {
      if (!isMissingFullNameKanaColumnError(error)) throw error;
    }
    return prisma.result.findMany({ where, select: { ...select, athlete: { select: { id: true, fullName: true } } } });
  })();
  const groups = buildHistoricalFirstChallengeGroups(rows, {
    targetMonthStart: monthStart, targetMonthEnd: monthEnd,
    gradeRangeMode: "existing", gradeSequence: [...RANKING_OUTPUT_GRADE_SEQUENCE], excludeOtherGender: true
  });
  const items = groups.flatMap((group) => group.gradeGroups.flatMap((grade) =>
    ([ ["男子", grade.maleEntries], ["女子", grade.femaleEntries] ] as const).flatMap(([genderLabel, entries]) =>
      entries.map((entry) => ({
        name: normalizePdfText(entry.displayName || entry.fullName), gradeLabel: formatGradeLabel(grade.grade), genderLabel,
        entries: [{ eventTitle: group.eventTitle, timeText: formatTimeForDocument(entry), recordMonthLabel: entry.recordMonthLabel, isNewRecordInTargetMonth: entry.isNewRecordInTargetMonth }]
      }))
    )
  ));
  const filename = `${year}年${month}月_swimming_historical_firsts.pdf`;
  return { kind: "historical-firsts", filename, groups, periodLabel: `${year}年${month}月 歴代1位記録一覧`, preview: {
    kind: "historical-firsts", filename, counts: { records: items.length, events: groups.length }, items
  } };
}

export async function prepareSwimmingDocument(kind: SwimmingDocumentKind, filter: DocsFilter, options?: { preview?: boolean }): Promise<PreparedSwimmingDocument> {
  if (options?.preview) requireMonth(kind, filter);
  switch (kind) {
    case "records": return prepareRecords(filter);
    case "certificates": return prepareCertificates(filter);
    case "historical-firsts": return prepareHistoricalFirsts(filter);
  }
}
