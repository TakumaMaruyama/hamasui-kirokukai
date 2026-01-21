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
  publish_consent: string;
  publish_until?: string;
};

function parseBoolean(value: string): boolean {
  return value.trim().toLowerCase() === "true";
}

function parseDate(value: string): Date {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid date: ${value}`);
  }
  return parsed;
}

export async function importRows(program: Program, rows: ImportRow[]) {
  const rankTargets = new Set<string>();

  for (const row of rows) {
    const grade = Number(row.grade);
    const distanceM = Number(row.distance_m);
    const timeMs = parseTimeToMs(row.time_text);
    const heldOn = parseDate(row.held_on);
    const publishUntil = row.publish_until ? parseDate(row.publish_until) : null;

    if (Number.isNaN(grade) || Number.isNaN(distanceM)) {
      throw new Error("Invalid numeric values");
    }

    const existingAthlete = await prisma.athlete.findFirst({
      where: {
        fullName: row.full_name,
        grade,
        gender: row.gender as Prisma.AthleteUncheckedCreateInput["gender"]
      }
    });

    const athlete = existingAthlete
      ? await prisma.athlete.update({
          where: { id: existingAthlete.id },
          data: {
            publishConsent: parseBoolean(row.publish_consent),
            publishUntil
          }
        })
      : await prisma.athlete.create({
          data: {
            fullName: row.full_name,
            grade,
            gender: row.gender as Prisma.AthleteUncheckedCreateInput["gender"],
            publishConsent: parseBoolean(row.publish_consent),
            publishUntil
          }
        });

    const meet = await prisma.meet.upsert({
      where: {
        program_heldOn_title: {
          program,
          heldOn,
          title: row.meet_title
        }
      },
      create: {
        program,
        heldOn,
        title: row.meet_title
      },
      update: {}
    });

    const event =
      (await prisma.event.findFirst({
        where: {
          title: row.event_title,
          distanceM,
          style: row.style,
          grade,
          gender: row.gender as Prisma.AthleteUncheckedCreateInput["gender"]
        }
      })) ??
      (await prisma.event.create({
        data: {
          title: row.event_title,
          distanceM,
          style: row.style,
          grade,
          gender: row.gender as Prisma.AthleteUncheckedCreateInput["gender"]
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
        lane: row.lane ? Number(row.lane) : null,
        timeText: row.time_text,
        timeMs,
        rank: 0
      },
      update: {
        lane: row.lane ? Number(row.lane) : null,
        timeText: row.time_text,
        timeMs
      }
    });

    rankTargets.add(`${meet.id}:${event.id}`);
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
