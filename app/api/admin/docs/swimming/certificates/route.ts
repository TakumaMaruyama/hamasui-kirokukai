import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { renderFirstPrizeAwardsPdf } from "@/lib/pdf";
import { saveBuffer } from "@/lib/storage";
import { buildMeetWhere, parseDocsFilterInput } from "@/lib/docs-filter";
import { buildFirstPrizeAwards, type FirstPrizeSourceRow } from "@/lib/first-prize";
import { buildAttachmentContentDisposition } from "@/lib/content-disposition";
export const runtime = "nodejs";

function isMissingFullNameKanaColumnError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : "";
  return /Athlete\.fullNameKana|column .*fullNameKana.* does not exist/i.test(message);
}

async function findFirstPrizeRows(options: {
  meetWhere: ReturnType<typeof buildMeetWhere> | { id: string };
  fullName?: string;
}): Promise<FirstPrizeSourceRow[]> {
  const where = {
    meet: options.meetWhere,
    rank: 1,
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
            fullName: true,
            fullNameKana: true,
            grade: true,
            gender: true
          }
        },
        event: {
          select: {
            title: true
          }
        },
        meet: {
          select: {
            heldOn: true
          }
        }
      },
      orderBy
    });

    return rows.map((row) => ({
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
          fullName: true,
          grade: true,
          gender: true
        }
      },
      event: {
        select: {
          title: true
        }
      },
      meet: {
        select: {
          heldOn: true
        }
      }
    },
    orderBy
  });

  return rows.map((row) => ({
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
      heldOn: row.meet.heldOn
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

function buildCombinedCertificatePdfName(options: {
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
    "first_prize"
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

    const rankOneRows = await findFirstPrizeRows({
      meetWhere,
      fullName: filter.fullName
    });
    if (rankOneRows.length === 0) {
      return NextResponse.json({ message: "条件に一致する賞状対象がありません" }, { status: 400 });
    }

    const awards = buildFirstPrizeAwards(
      rankOneRows,
      filter.hasMonthFilter && typeof filter.year === "number" && typeof filter.month === "number"
        ? { year: filter.year, month: filter.month }
        : undefined
    );

    if (awards.length === 0) {
      return NextResponse.json({ message: "条件に一致する賞状対象がありません" }, { status: 400 });
    }

    const buffer = await renderFirstPrizeAwardsPdf(
      awards.map((award) => ({
        athlete: award.athlete,
        eventTitle: award.eventTitle,
        timeText: award.timeText,
        timeMs: award.timeMs,
        issueLabel: award.issueLabel
      }))
    );
    const name = buildCombinedCertificatePdfName({
      latestMeetTitle: latestMeet?.title,
      year: filter.year,
      month: filter.month,
      weekday: filter.weekday,
      fullName: filter.fullName
    });
    const storageKey = await saveBuffer(`swimming/certificates/${name}`, buffer);

    await prisma.generatedDoc.create({
      data: {
        program: "swimming",
        kind: "certificate",
        storageKey
      }
    });

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": buildAttachmentContentDisposition(name, "swimming_certificates.pdf")
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "PDF生成中にエラーが発生しました";
    return NextResponse.json({ message }, { status: 500 });
  }
}
