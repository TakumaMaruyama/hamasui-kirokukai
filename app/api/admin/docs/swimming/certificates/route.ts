import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { renderCertificatePdf } from "@/lib/pdf";
import { saveBuffer } from "@/lib/storage";
import { zipBuffers } from "@/lib/zip";
import { buildMeetWhere, parseDocsFilterInput } from "@/lib/docs-filter";

type BestEntry = { eventTitle: string; timeText: string; timeMs: number };
export const runtime = "nodejs";

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
          where: { program: "swimming" },
          orderBy: { heldOn: "desc" }
        });

    if (!filter.hasMonthFilter && !latestMeet) {
      return NextResponse.json({ message: "条件に一致する記録会がありません" }, { status: 400 });
    }

    const meetWhere = filter.hasMonthFilter
      ? buildMeetWhere("swimming", filter)
      : { id: latestMeet!.id };
    const periodLabel = filter.hasMonthFilter && filter.year && filter.month
      ? `${filter.year}年${filter.month}月`
      : latestMeet!.title;

    const rows = await prisma.result.findMany({
      where: {
        meet: meetWhere,
        rank: 1,
        ...(filter.fullName ? { athlete: { fullName: filter.fullName } } : {})
      },
      include: {
        athlete: {
          select: {
            id: true,
            fullName: true,
            grade: true,
            gender: true
          }
        },
        event: true
      },
      orderBy: [{ athlete: { fullName: "asc" } }, { event: { title: "asc" } }, { timeMs: "asc" }]
    });

    if (rows.length === 0) {
      return NextResponse.json({ message: "条件に一致する賞状対象がありません" }, { status: 400 });
    }

    const files = [] as { name: string; buffer: Buffer }[];
    const grouped = new Map<string, { athlete: (typeof rows)[number]["athlete"]; bestByEvent: Map<string, BestEntry> }>();

    for (const row of rows) {
      if (!grouped.has(row.athleteId)) {
        grouped.set(row.athleteId, {
          athlete: row.athlete,
          bestByEvent: new Map<string, BestEntry>()
        });
      }

      const athleteGroup = grouped.get(row.athleteId)!;
      const current = athleteGroup.bestByEvent.get(row.eventId);
      if (!current || row.timeMs < current.timeMs) {
        athleteGroup.bestByEvent.set(row.eventId, {
          eventTitle: row.event.title,
          timeText: row.timeText,
          timeMs: row.timeMs
        });
      }
    }

    for (const { athlete, bestByEvent } of grouped.values()) {
      const entries = Array.from(bestByEvent.values())
        .sort((a, b) => a.eventTitle.localeCompare(b.eventTitle, "ja"))
        .map((entry) => ({ eventTitle: entry.eventTitle, timeText: entry.timeText, timeMs: entry.timeMs }));

      if (entries.length === 0) {
        continue;
      }

      const buffer = await renderCertificatePdf({ athlete, entries });
      const name = `${athlete.fullName}_${periodLabel}_first_prize.pdf`;
      const storageKey = await saveBuffer(`swimming/certificates/${name}`, buffer);

      await prisma.generatedDoc.create({
        data: {
          program: "swimming",
          kind: "certificate",
          storageKey
        }
      });

      files.push({ name, buffer });
    }

    if (files.length === 0) {
      return NextResponse.json({ message: "条件に一致する賞状対象がありません" }, { status: 400 });
    }

    const zip = await zipBuffers(files);

    return new NextResponse(zip, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": "attachment; filename=swimming_certificates.zip"
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "PDF生成中にエラーが発生しました";
    return NextResponse.json({ message }, { status: 500 });
  }
}
