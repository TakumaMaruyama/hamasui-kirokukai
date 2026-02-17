import type { Gender } from "@prisma/client";

export type RecordCertificateSourceRow = {
  athleteId: string;
  eventId: string;
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

export type RecordCertificateEntry = {
  eventTitle: string;
  timeText: string;
  timeMs?: number;
};

export type RecordCertificate = {
  athlete: {
    fullName: string;
    fullNameKana: string;
    grade: number;
    gender: Gender;
  };
  entries: RecordCertificateEntry[];
  issueLabel: string;
  fileName: string;
};

const INVALID_FILENAME_CHARS = /[\\/:*?"<>|\r\n\t]+/g;
const MULTIPLE_SPACES = /\s+/g;
const MAX_FILENAME_PART_LENGTH = 80;
const MAX_RECORD_ENTRIES = 6;

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
  issueLabel: string;
}): string {
  return [
    sanitizeFileNamePart(options.fullName),
    sanitizeFileNamePart(options.issueLabel),
    "record"
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

  throw new Error("記録証のファイル名が重複しすぎています");
}

export function toRecordCertificateDisplayEntries(entries: RecordCertificateEntry[]): RecordCertificateEntry[] {
  if (entries.length <= MAX_RECORD_ENTRIES) {
    return entries;
  }

  return [
    ...entries.slice(0, MAX_RECORD_ENTRIES),
    { eventTitle: "...", timeText: "...", timeMs: undefined }
  ];
}

export function buildRecordCertificates(
  rows: RecordCertificateSourceRow[],
  options?: {
    year?: number;
    month?: number;
  }
): RecordCertificate[] {
  const fixedIssueLabel =
    typeof options?.year === "number" && typeof options?.month === "number"
      ? `${options.year}年${options.month}月`
      : null;
  const usedNames = new Set<string>();

  const grouped = new Map<
    string,
    {
      athlete: RecordCertificateSourceRow["athlete"];
      heldOn: Date;
      bestByEvent: Map<string, RecordCertificateEntry & { timeMs: number }>;
    }
  >();

  for (const row of rows) {
    if (!grouped.has(row.athleteId)) {
      grouped.set(row.athleteId, {
        athlete: row.athlete,
        heldOn: row.meet.heldOn,
        bestByEvent: new Map()
      });
    }

    const group = grouped.get(row.athleteId)!;
    const current = group.bestByEvent.get(row.eventId);
    if (!current || row.timeMs < current.timeMs) {
      group.bestByEvent.set(row.eventId, {
        eventTitle: row.event.title,
        timeText: row.timeText,
        timeMs: row.timeMs
      });
    }
  }

  return Array.from(grouped.values())
    .map((group) => {
      const issueLabel = fixedIssueLabel ?? toIssueLabelFromDate(group.heldOn);
      const entries = Array.from(group.bestByEvent.values())
        .sort((a, b) => a.eventTitle.localeCompare(b.eventTitle, "ja"))
        .map((entry) => ({
          eventTitle: entry.eventTitle,
          timeText: entry.timeText,
          timeMs: entry.timeMs
        }));

      const fileName = ensureUniqueFileName(
        makeBaseFileName({
          fullName: group.athlete.fullName,
          issueLabel
        }),
        usedNames
      );

      return {
        athlete: {
          fullName: group.athlete.fullName,
          fullNameKana: normalizeKana(group.athlete.fullName, group.athlete.fullNameKana),
          grade: group.athlete.grade,
          gender: group.athlete.gender
        },
        entries: toRecordCertificateDisplayEntries(entries),
        issueLabel,
        fileName
      };
    })
    .sort((a, b) => {
      const nameOrder = a.athlete.fullName.localeCompare(b.athlete.fullName, "ja");
      if (nameOrder !== 0) {
        return nameOrder;
      }

      const gradeOrder = a.athlete.grade - b.athlete.grade;
      if (gradeOrder !== 0) {
        return gradeOrder;
      }

      return a.issueLabel.localeCompare(b.issueLabel, "ja");
    });
}
