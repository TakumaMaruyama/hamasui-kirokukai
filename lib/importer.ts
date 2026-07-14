import { Prisma, Program } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { parseTimeToMs } from "@/lib/time";
import { assignDenseRanks } from "@/lib/rank";
import {
  isSchoolAbsenceResult,
  isSchoolAbsenceTimeText,
  normalizeSchoolTimeText,
  SCHOOL_ABSENCE_EVENT_TITLE,
  SCHOOL_ABSENCE_TIME_MS
} from "@/lib/school-attendance";

export type ImportRow = {
  meet_title: string;
  held_on: string;
  full_name: string;
  full_name_kana?: string;
  grade: string;
  gender: string;
  event_title: string;
  style: string;
  distance_m: string;
  lane?: string;
  time_text: string;
};

const DATE_PATTERN = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/;

const GENDER_MAP: Record<string, Prisma.AthleteUncheckedCreateInput["gender"]> = {
  male: "male",
  "男子": "male",
  "男": "male",
  female: "female",
  "女子": "female",
  "女": "female",
  other: "other",
  "その他": "other"
};

const MAX_MEET_TITLE_ATTEMPTS = 200;

type ParsedImportRow = {
  sourceIndex: number;
  meetTitle: string;
  heldOn: Date;
  fullName: string;
  fullNameKana?: string;
  grade: number;
  gender: Prisma.AthleteUncheckedCreateInput["gender"];
  eventTitle: string;
  style: string;
  distanceM: number;
  lane: number | null;
  timeText: string;
  timeMs: number;
};

function parseRequiredText(value: string | undefined, fieldName: string): string {
  const normalized = value?.trim();

  if (!normalized) {
    throw new Error(`${fieldName} が空です`);
  }

  return normalized;
}

function normalizeFullName(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeOptionalFullNameKana(value: string | undefined): string | undefined {
  const normalized = value?.replace(/\s+/g, " ").trim();
  return normalized ? normalized : undefined;
}

function isMissingFullNameKanaColumnError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : "";
  return /Athlete\.fullNameKana|column .*fullNameKana.* does not exist/i.test(message);
}

function parseRequiredInt(value: string | undefined, fieldName: string): number {
  const normalized = parseRequiredText(value, fieldName);
  const parsed = Number(normalized);

  if (!Number.isInteger(parsed)) {
    throw new Error(`${fieldName} は整数で入力してください`);
  }

  return parsed;
}

function parseOptionalInt(value: string | undefined, fieldName: string): number | null {
  if (!value?.trim()) {
    return null;
  }

  return parseRequiredInt(value, fieldName);
}

function parseGender(value: string): Prisma.AthleteUncheckedCreateInput["gender"] {
  const normalized = value.trim();
  const mapped = GENDER_MAP[normalized.toLowerCase()] ?? GENDER_MAP[normalized];

  if (!mapped) {
    throw new Error(`gender の値が不正です: ${value}`);
  }

  return mapped;
}

function parseDate(value: string, fieldName: string): Date {
  const normalized = parseRequiredText(value, fieldName);
  const match = normalized.match(DATE_PATTERN);

  if (!match) {
    throw new Error(`${fieldName} は YYYY-MM-DD 形式で入力してください`);
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(Date.UTC(year, month - 1, day));

  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    throw new Error(`${fieldName} の日付が不正です: ${value}`);
  }

  return parsed;
}

function parseImportRow(program: Program, row: ImportRow, sourceIndex: number): ParsedImportRow {
  const rawTimeText = parseRequiredText(row.time_text, "time_text");
  const isAbsent = program === "school" && isSchoolAbsenceTimeText(rawTimeText);
  const timeText = isAbsent ? normalizeSchoolTimeText(rawTimeText) : rawTimeText;
  const rawEventTitle = row.event_title?.trim() ?? "";
  const eventTitle = isAbsent && !rawEventTitle
    ? SCHOOL_ABSENCE_EVENT_TITLE
    : parseRequiredText(row.event_title, "event_title");

  return {
    sourceIndex,
    meetTitle: parseRequiredText(row.meet_title, "meet_title"),
    heldOn: parseDate(row.held_on, "held_on"),
    fullName: normalizeFullName(parseRequiredText(row.full_name, "full_name")),
    fullNameKana: normalizeOptionalFullNameKana(row.full_name_kana),
    grade: parseRequiredInt(row.grade, "grade"),
    gender: parseGender(row.gender),
    eventTitle,
    style: parseRequiredText(row.style, "style"),
    distanceM: parseRequiredInt(row.distance_m, "distance_m"),
    lane: parseOptionalInt(row.lane, "lane"),
    timeText,
    timeMs: isAbsent ? SCHOOL_ABSENCE_TIME_MS : parseTimeToMs(timeText)
  };
}

function isMeetUniqueConstraintError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

function buildMeetTitleCandidate(baseTitle: string, sequence: number): string {
  if (sequence <= 1) {
    return baseTitle;
  }

  return `${baseTitle}（${sequence}）`;
}

async function createMeetWithUniqueTitle(program: Program, heldOn: Date, meetTitle: string) {
  for (let sequence = 1; sequence <= MAX_MEET_TITLE_ATTEMPTS; sequence += 1) {
    const candidateTitle = buildMeetTitleCandidate(meetTitle, sequence);

    try {
      return await prisma.meet.create({
        data: {
          program,
          heldOn,
          title: candidateTitle
        },
        select: {
          id: true
        }
      });
    } catch (error) {
      if (!isMeetUniqueConstraintError(error)) {
        throw error;
      }
    }
  }

  throw new Error(`同じ開催日の記録会が多すぎるため取り込めませんでした: ${meetTitle}`);
}

export async function importRows(program: Program, rows: ImportRow[]) {
  const rankTargets = new Set<string>();
  const importMeetCache = new Map<string, Promise<{ id: string }>>();

  // Validate every row before the first database write. This prevents a bad
  // row near the end of a CSV from leaving a partially imported meet behind.
  const parsedRows = rows.map((row, sourceIndex) => {
    try {
      return parseImportRow(program, row, sourceIndex);
    } catch (error) {
      const message = error instanceof Error ? error.message : "不明なエラー";
      throw new Error(`${sourceIndex + 2}行目: ${message}`);
    }
  });

  for (const row of parsedRows) {
    try {
      const {
        meetTitle,
        heldOn,
        fullName,
        fullNameKana,
        grade,
        gender,
        eventTitle,
        style,
        distanceM,
        lane,
        timeText,
        timeMs
      } = row;

      const existingAthlete = await prisma.athlete.findFirst({
        where: {
          fullName,
          grade,
          gender
        },
        select: {
          id: true
        }
      });

      const athlete = existingAthlete ?? await (async () => {
        try {
          return await prisma.athlete.create({
            data: {
              fullName,
              fullNameKana,
              grade,
              gender
            },
            select: {
              id: true
            }
          });
        } catch (error) {
          if (!fullNameKana || !isMissingFullNameKanaColumnError(error)) {
            throw error;
          }

          return prisma.athlete.create({
            data: {
              fullName,
              grade,
              gender
            },
            select: {
              id: true
            }
          });
        }
      })();

      if (existingAthlete && fullNameKana) {
        try {
          await prisma.athlete.update({
            where: { id: existingAthlete.id },
            data: { fullNameKana }
          });
        } catch (error) {
          if (!isMissingFullNameKanaColumnError(error)) {
            throw error;
          }
        }
      }

      const meetCacheKey = `${program}:${heldOn.toISOString()}:${meetTitle}`;
      const meetPromise =
        importMeetCache.get(meetCacheKey) ?? createMeetWithUniqueTitle(program, heldOn, meetTitle);
      importMeetCache.set(meetCacheKey, meetPromise);
      const meet = await meetPromise;

      const event =
        (await prisma.event.findFirst({
          where: {
            title: eventTitle,
            distanceM,
            style,
            grade,
            gender
          }
        })) ??
        (await prisma.event.create({
          data: {
            title: eventTitle,
            distanceM,
            style,
            grade,
            gender
          }
        }));

      await prisma.result.upsert({
        where: {
          athleteId_meetId_eventId: {
            athleteId: athlete.id,
            meetId: meet.id,
            eventId: event.id
          }
        },
        create: {
          athleteId: athlete.id,
          meetId: meet.id,
          eventId: event.id,
          lane,
          timeText,
          timeMs,
          rank: 0
        },
        update: {
          lane,
          timeText,
          timeMs,
          ...(program === "school" ? { rank: 0 } : {})
        }
      });

      if (program !== "school") {
        rankTargets.add(`${meet.id}:${event.id}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "不明なエラー";
      throw new Error(`${row.sourceIndex + 2}行目: ${message}`);
    }
  }

  for (const target of rankTargets) {
    const [meetId, eventId] = target.split(":");
    const results = await prisma.result.findMany({
      where: { meetId, eventId },
      select: { id: true, timeText: true, timeMs: true }
    });

    const recordedResults = results.filter((result) => !isSchoolAbsenceResult(result));
    const ranks = assignDenseRanks(recordedResults);
    await prisma.$transaction(
      results.map((result) =>
        prisma.result.update({
          where: { id: result.id },
          data: { rank: ranks.get(result.id) ?? 0 }
        })
      )
    );
  }
}
