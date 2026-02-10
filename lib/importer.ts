import { Prisma, Program } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { parseTimeToMs } from "@/lib/time";
import { assignDenseRanks } from "@/lib/rank";

export type ImportRow = {
  meet_title: string;
  held_on: string;
  full_name: string;
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

export async function importRows(program: Program, rows: ImportRow[]) {
  const rankTargets = new Set<string>();

  for (const [index, row] of rows.entries()) {
    try {
      const meetTitle = parseRequiredText(row.meet_title, "meet_title");
      const heldOn = parseDate(row.held_on, "held_on");
      const fullName = normalizeFullName(parseRequiredText(row.full_name, "full_name"));
      const grade = parseRequiredInt(row.grade, "grade");
      const gender = parseGender(row.gender);
      const eventTitle = parseRequiredText(row.event_title, "event_title");
      const style = parseRequiredText(row.style, "style");
      const distanceM = parseRequiredInt(row.distance_m, "distance_m");
      const lane = parseOptionalInt(row.lane, "lane");
      const timeText = parseRequiredText(row.time_text, "time_text");
      const timeMs = parseTimeToMs(timeText);

      const existingAthlete = await prisma.athlete.findFirst({
        where: {
          fullName,
          grade,
          gender
        }
      });

      const athlete =
        existingAthlete ??
        (await prisma.athlete.create({
          data: {
            fullName,
            grade,
            gender
          }
        }));

      const meet = await prisma.meet.upsert({
        where: {
          program_heldOn_title: {
            program,
            heldOn,
            title: meetTitle
          }
        },
        create: {
          program,
          heldOn,
          title: meetTitle
        },
        update: {}
      });

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
          timeMs
        }
      });

      rankTargets.add(`${meet.id}:${event.id}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "不明なエラー";
      throw new Error(`${index + 2}行目: ${message}`);
    }
  }

  for (const target of rankTargets) {
    const [meetId, eventId] = target.split(":");
    const results = await prisma.result.findMany({
      where: { meetId, eventId },
      select: { id: true, timeMs: true }
    });

    const ranks = assignDenseRanks(results);
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
