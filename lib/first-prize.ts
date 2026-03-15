import type { Gender } from "@prisma/client";
import { formatGradeLabel } from "./grade";
import { assignMonthlyRanks } from "./monthly-rank";

export type FirstPrizeSourceRow = {
  athlete: {
    fullName: string;
    fullNameKana?: string | null;
    grade: number;
    gender: Gender;
  };
  event: {
    title: string;
  };
  timeText: string;
  timeMs: number;
  meet: {
    heldOn: Date;
  };
};

export type MonthlyFirstPrizeSourceRow = {
  id: string;
  athlete: {
    fullName: string;
    fullNameKana?: string | null;
    grade: number;
    gender: Gender;
  };
  event: {
    title: string;
    distanceM: number;
    style: string;
    grade: number;
    gender: Gender;
  };
  timeText: string;
  timeMs: number;
  meet: {
    heldOn: Date;
  };
};

export type FirstPrizeAward = {
  athlete: {
    fullName: string;
    fullNameKana: string;
    grade: number;
    gender: Gender;
  };
  eventTitle: string;
  timeText: string;
  timeMs: number;
  issueLabel: string;
  fileName: string;
};

const INVALID_FILENAME_CHARS = /[\\/:*?"<>|\r\n\t]+/g;
const MULTIPLE_SPACES = /\s+/g;
const MAX_FILENAME_PART_LENGTH = 80;

export function formatFirstPrizeGenderLabel(gender: Gender): string {
  if (gender === "male") {
    return "男子";
  }

  if (gender === "female") {
    return "女子";
  }

  return "その他";
}

function toIssueLabelFromDate(date: Date): string {
  return `${date.getUTCFullYear()}年${date.getUTCMonth() + 1}月`;
}

function normalizeKana(fullName: string, fullNameKana?: string | null): string {
  const normalized = fullNameKana?.replace(MULTIPLE_SPACES, " ").trim();
  return normalized || fullName;
}

function sanitizeFileNamePart(value: string): string {
  const cleaned = value
    .replace(INVALID_FILENAME_CHARS, "_")
    .replace(MULTIPLE_SPACES, " ")
    .trim();

  if (!cleaned) {
    return "unknown";
  }

  return cleaned.length > MAX_FILENAME_PART_LENGTH ? cleaned.slice(0, MAX_FILENAME_PART_LENGTH) : cleaned;
}

function makeBaseFileName(options: {
  fullName: string;
  eventTitle: string;
  grade: number;
  gender: Gender;
  issueLabel: string;
}): string {
  const { fullName, eventTitle, grade, gender, issueLabel } = options;
  const gradeLabel = formatGradeLabel(grade);
  const genderLabel = formatFirstPrizeGenderLabel(gender);

  return [
    sanitizeFileNamePart(fullName),
    sanitizeFileNamePart(eventTitle),
    sanitizeFileNamePart(gradeLabel),
    sanitizeFileNamePart(genderLabel),
    sanitizeFileNamePart(issueLabel),
    "first_prize"
  ].join("_") + ".pdf";
}

function ensureUniqueFileName(baseName: string, usedNames: Set<string>): string {
  if (!usedNames.has(baseName)) {
    usedNames.add(baseName);
    return baseName;
  }

  const suffixTarget = baseName.endsWith(".pdf") ? baseName.slice(0, -4) : baseName;
  let sequence = 2;

  while (sequence < 10_000) {
    const candidate = `${suffixTarget}_${sequence}.pdf`;
    if (!usedNames.has(candidate)) {
      usedNames.add(candidate);
      return candidate;
    }

    sequence += 1;
  }

  throw new Error("1位賞状のファイル名が重複しすぎています");
}

export function selectMonthlyFirstPrizeRows(rows: MonthlyFirstPrizeSourceRow[]): FirstPrizeSourceRow[] {
  const monthlyRanks = assignMonthlyRanks(
    rows.map((row) => ({
      id: row.id,
      heldOn: row.meet.heldOn,
      timeMs: row.timeMs,
      athleteName: row.athlete.fullName,
      event: {
        title: row.event.title,
        distanceM: row.event.distanceM,
        style: row.event.style,
        grade: row.event.grade,
        gender: row.event.gender
      }
    }))
  );

  return rows
    .filter((row) => monthlyRanks.get(row.id) === 1)
    .map((row) => ({
      athlete: {
        fullName: row.athlete.fullName,
        fullNameKana: row.athlete.fullNameKana,
        grade: row.athlete.grade,
        gender: row.athlete.gender
      },
      event: {
        title: row.event.title
      },
      timeText: row.timeText,
      timeMs: row.timeMs,
      meet: {
        heldOn: row.meet.heldOn
      }
    }));
}

export function buildFirstPrizeAwards(
  rows: FirstPrizeSourceRow[],
  options?: {
    year?: number;
    month?: number;
  }
): FirstPrizeAward[] {
  const fixedIssueLabel =
    typeof options?.year === "number" && typeof options?.month === "number"
      ? `${options.year}年${options.month}月`
      : null;
  const usedNames = new Set<string>();

  return rows.map((row) => {
    const issueLabel = fixedIssueLabel ?? toIssueLabelFromDate(row.meet.heldOn);
    const fileName = ensureUniqueFileName(
      makeBaseFileName({
        fullName: row.athlete.fullName,
        eventTitle: row.event.title,
        grade: row.athlete.grade,
        gender: row.athlete.gender,
        issueLabel
      }),
      usedNames
    );

    return {
      athlete: {
        fullName: row.athlete.fullName,
        fullNameKana: normalizeKana(row.athlete.fullName, row.athlete.fullNameKana),
        grade: row.athlete.grade,
        gender: row.athlete.gender
      },
      eventTitle: row.event.title,
      timeText: row.timeText,
      timeMs: row.timeMs,
      issueLabel,
      fileName
    };
  });
}
