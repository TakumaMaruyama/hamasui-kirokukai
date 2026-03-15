import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { renderRecordCertificatesPdf } from "@/lib/pdf";
import { saveBuffer } from "@/lib/storage";
import { buildMeetWhere, parseDocsFilterInput } from "@/lib/docs-filter";
import { type RecordCertificateSourceRow } from "@/lib/record-certificate";
import { buildSwimmingRecordOutputs } from "@/lib/swimming-record-output";

export const runtime = "nodejs";

function isMissingFullNameKanaColumnError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : "";
  return /Athlete\.fullNameKana|column .*fullNameKana.* does not exist/i.test(message);
}

async function findRecordCertificateRows(options: {
  meetWhere: ReturnType<typeof buildMeetWhere> | { id: string };
  fullName?: string;
}): Promise<RecordCertificateSourceRow[]> {
  const where = {
    meet: options.meetWhere,
    ...(options.fullName ? { athlete: { is: { fullName: options.fullName } } } : {})
  } as const;

  const orderBy = [
    { athlete: { fullName: "asc" as const } },
    { event: { title: "asc" as const } },
    { timeMs: "asc" as const },
    { meet: { heldOn: "asc" as const } }
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
        },
        meet: {
          select: {
            heldOn: true,
            title: true
          }
        }
      },
      orderBy
    });

    return rows.map((row) => ({
      athleteId: row.athleteId,
      eventId: row.eventId,
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
        heldOn: row.meet.heldOn,
        title: row.meet.title
      }
    }));
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
      },
      meet: {
        select: {
          heldOn: true,
          title: true
        }
      }
    },
    orderBy
  });

  return rows.map((row) => ({
    athleteId: row.athleteId,
    eventId: row.eventId,
    athlete: {
      fullName: row.athlete.fullName,
      fullNameKana: null,
      grade: row.athlete.grade,
      gender: row.athlete.gender
    },
    event: {
      title: row.event.title
    },
    timeText: row.timeText,
    timeMs: row.timeMs,
    meet: {
      heldOn: row.meet.heldOn,
      title: row.meet.title
    }
  }));
}

function sanitizeFileNamePart(value: string): string {
  const cleaned = value
    .replace(/[\\/:*?"<>|\r\n\t]+/g, "_")
    .replace(/\s+/g, " ")
    .trim();

  return cleaned || "unknown";
}

function buildCombinedRecordPdfName(options: {
  latestMeetTitle?: string;
  year?: number;
  month?: number;
  weekday?: string;
  fullName?: string;
}): string {
  const periodLabel = typeof options.year === "number" && typeof options.month === "number"
    ? `${options.year}年${options.month}月${options.weekday ?? ""}`
    : (options.latestMeetTitle ?? "swimming");

  return [
    sanitizeFileNamePart(periodLabel),
    ...(options.fullName ? [sanitizeFileNamePart(options.fullName)] : []),
    "record"
  ].join("_") + ".pdf";
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
          where: { program: "swimming" },
          orderBy: { heldOn: "desc" }
        });

    if (!filter.hasMonthFilter && !latestMeet) {
      return NextResponse.json({ message: "条件に一致する記録会がありません" }, { status: 400 });
    }

    const meetWhere = filter.hasMonthFilter
      ? buildMeetWhere("swimming", filter)
      : { id: latestMeet!.id };
    const rows = await findRecordCertificateRows({
      meetWhere,
      fullName: filter.fullName
    });

    if (rows.length === 0) {
      return NextResponse.json({ message: "条件に一致する記録がありません" }, { status: 400 });
    }

    const outputs = buildSwimmingRecordOutputs(
      rows,
      filter.hasMonthFilter && typeof filter.year === "number" && typeof filter.month === "number"
        ? {
            year: filter.year,
            month: filter.month,
            groupByWeekdayFolders: !filter.weekday
          }
        : undefined
    );

    if (outputs.length === 0) {
      return NextResponse.json({ message: "条件に一致する記録がありません" }, { status: 400 });
    }

    const buffer = await renderRecordCertificatesPdf(
      outputs.map((output) => ({
        athlete: output.athlete,
        entries: output.entries,
        issueLabel: output.issueLabel
      }))
    );
    const name = buildCombinedRecordPdfName({
      latestMeetTitle: latestMeet?.title,
      year: filter.year,
      month: filter.month,
      weekday: filter.weekday,
      fullName: filter.fullName
    });
    const storageKey = await saveBuffer(`swimming/records/${name}`, buffer);

    await prisma.generatedDoc.create({
      data: {
        program: "swimming",
        kind: "record",
        storageKey
      }
    });

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${name}"`
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "PDF生成中にエラーが発生しました";
    return NextResponse.json({ message }, { status: 500 });
  }
}
