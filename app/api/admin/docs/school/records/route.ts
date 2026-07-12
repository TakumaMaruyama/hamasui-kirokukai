import { NextResponse } from "next/server";
import type { Gender, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { renderRecordPdf } from "@/lib/pdf";
import { saveBuffer } from "@/lib/storage";
import { zipBuffers } from "@/lib/zip";
import { buildMeetWhere, parseDocsFilterInput } from "@/lib/docs-filter";
import { isSchoolAbsenceResult } from "@/lib/school-attendance";

type BestEntry = { eventTitle: string; timeText: string; timeMs: number };
type SchoolRecordRow = {
  athleteId: string;
  eventId: string;
  timeText: string;
  timeMs: number;
  athlete: {
    id: string;
    fullName: string;
    fullNameKana: string | null;
    grade: number;
    gender: Gender;
  };
  event: {
    id: string;
    title: string;
  };
};
export const runtime = "nodejs";

function isMissingFullNameKanaColumnError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : "";
  return /Athlete\.fullNameKana|column .*fullNameKana.* does not exist/i.test(message);
}

async function findSchoolRecordRows(where: Prisma.ResultWhereInput): Promise<SchoolRecordRow[]> {
  const orderBy = [
    { athlete: { fullName: "asc" as const } },
    { event: { title: "asc" as const } },
    { timeMs: "asc" as const }
  ];

  try {
    const rows = await prisma.result.findMany({
      where,
      include: {
        athlete: {
          select: {
            id: true,
            fullName: true,
            fullNameKana: true,
            grade: true,
            gender: true
          }
        },
        event: {
          select: {
            id: true,
            title: true
          }
        }
      },
      orderBy
    });

    return rows;
  } catch (error) {
    if (!isMissingFullNameKanaColumnError(error)) {
      throw error;
    }
  }

  const rows = await prisma.result.findMany({
    where,
    include: {
      athlete: {
        select: {
          id: true,
          fullName: true,
          grade: true,
          gender: true
        }
      },
      event: {
        select: {
          id: true,
          title: true
        }
      }
    },
    orderBy
  });

  return rows.map((row) => ({
    ...row,
    athlete: {
      ...row.athlete,
      fullNameKana: null
    }
  }));
}

function shouldUseEntry(current: BestEntry | undefined, candidate: BestEntry): boolean {
  if (!current) {
    return true;
  }

  const currentIsAbsent = isSchoolAbsenceResult(current);
  const candidateIsAbsent = isSchoolAbsenceResult(candidate);

  if (currentIsAbsent !== candidateIsAbsent) {
    return currentIsAbsent && !candidateIsAbsent;
  }

  return !candidateIsAbsent && candidate.timeMs < current.timeMs;
}

function sanitizeFileNamePart(value: string): string {
  const normalized = value
    .replace(/[\\/:*?"<>|\r\n\t]+/g, "_")
    .replace(/\s+/g, " ")
    .trim();

  return normalized || "unknown";
}

function ensureUniqueFileName(baseName: string, usedNames: Set<string>): string {
  if (!usedNames.has(baseName)) {
    usedNames.add(baseName);
    return baseName;
  }

  const stem = baseName.endsWith(".pdf") ? baseName.slice(0, -4) : baseName;
  let sequence = 2;
  while (usedNames.has(`${stem}_${sequence}.pdf`)) {
    sequence += 1;
  }

  const uniqueName = `${stem}_${sequence}.pdf`;
  usedNames.add(uniqueName);
  return uniqueName;
}

export async function POST(request: Request) {
  if (!isAdminAuthenticated()) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const rawBody = await request
    .json()
    .catch(() => ({}));
  const parsedFilter = parseDocsFilterInput(rawBody);

  if (!parsedFilter.ok) {
    return NextResponse.json({ message: parsedFilter.message }, { status: 400 });
  }

  try {
    const filter = parsedFilter.value;
    const latestMeet = filter.hasMonthFilter
      ? null
        : await prisma.meet.findFirst({
          where: { program: "school" },
          orderBy: [{ heldOn: "desc" }, { createdAt: "desc" }, { id: "desc" }]
        });

    if (!filter.hasMonthFilter && !latestMeet) {
      return NextResponse.json({ message: "条件に一致する記録会がありません" }, { status: 400 });
    }

    const meetWhere = filter.hasMonthFilter
      ? buildMeetWhere("school", filter)
      : { id: latestMeet!.id };
    const periodLabel = filter.hasMonthFilter && filter.year && filter.month
      ? `${filter.year}年${filter.month}月`
      : latestMeet!.title;
    const issueLabel = filter.hasMonthFilter && filter.year && filter.month
      ? `${filter.year}年${filter.month}月`
      : `${latestMeet!.heldOn.getUTCFullYear()}年${latestMeet!.heldOn.getUTCMonth() + 1}月`;

    const rows = await findSchoolRecordRows({
      meet: meetWhere,
      ...(filter.fullName ? { athlete: { is: { fullName: filter.fullName } } } : {})
    });

    if (rows.length === 0) {
      return NextResponse.json({ message: "条件に一致する記録がありません" }, { status: 400 });
    }

    const files = [] as { name: string; buffer: Buffer }[];
    const usedFileNames = new Set<string>();
    const grouped = new Map<string, { athlete: (typeof rows)[number]["athlete"]; bestByEvent: Map<string, BestEntry> }>();

    for (const row of rows) {
      if (!grouped.has(row.athleteId)) {
        grouped.set(row.athleteId, {
          athlete: row.athlete,
          bestByEvent: new Map<string, BestEntry>()
        });
      }

      const athleteGroup = grouped.get(row.athleteId)!;
      // For school certificates, the entered title is the event identity shown
      // to users. Internal distance/style classifications must not create
      // duplicate rows with the same displayed event name.
      const eventKey = row.event.title;
      const current = athleteGroup.bestByEvent.get(eventKey);
      const candidate = {
        eventTitle: row.event.title,
        timeText: row.timeText,
        timeMs: row.timeMs
      };
      if (shouldUseEntry(current, candidate)) {
        athleteGroup.bestByEvent.set(eventKey, candidate);
      }
    }

    for (const { athlete, bestByEvent } of grouped.values()) {
      const entries = Array.from(bestByEvent.values())
        .sort((a, b) => a.eventTitle.localeCompare(b.eventTitle, "ja"))
        .map((entry) => ({ eventTitle: entry.eventTitle, timeText: entry.timeText, timeMs: entry.timeMs }));

      if (entries.length === 0) {
        continue;
      }

      const buffer = await renderRecordPdf({ athlete, entries, issueLabel });
      const name = ensureUniqueFileName(
        `${sanitizeFileNamePart(athlete.fullName)}_${sanitizeFileNamePart(periodLabel)}_record.pdf`,
        usedFileNames
      );
      const storageKey = await saveBuffer(`school/records/${name}`, buffer);

      await prisma.generatedDoc.create({
        data: {
          program: "school",
          kind: "record",
          storageKey
        }
      });

      files.push({ name, buffer });
    }

    if (files.length === 0) {
      return NextResponse.json({ message: "条件に一致する記録がありません" }, { status: 400 });
    }

    const zip = await zipBuffers(files);

    return new NextResponse(zip, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": "attachment; filename=school_records.zip"
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "PDF生成中にエラーが発生しました";
    return NextResponse.json({ message }, { status: 500 });
  }
}
