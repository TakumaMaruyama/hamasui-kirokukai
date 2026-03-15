import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { renderFirstPrizeAwardsPdf } from "@/lib/pdf";
import { saveBuffer } from "@/lib/storage";
import { buildMeetWhere, parseDocsFilterInput } from "@/lib/docs-filter";
import {
  buildFirstPrizeAwards,
  selectMonthlyFirstPrizeRows,
  type MonthlyFirstPrizeSourceRow
} from "@/lib/first-prize";
import { buildAttachmentContentDisposition } from "@/lib/content-disposition";

export const runtime = "nodejs";

function isMissingFullNameKanaColumnError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : "";
  return /Athlete\.fullNameKana|column .*fullNameKana.* does not exist/i.test(message);
}

async function findMonthlyFirstPrizeRows(options: {
  meetWhere: ReturnType<typeof buildMeetWhere>;
  fullName?: string;
}): Promise<MonthlyFirstPrizeSourceRow[]> {
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
            fullName: true,
            fullNameKana: true,
            grade: true,
            gender: true
          }
        },
        event: {
          select: {
            title: true,
            distanceM: true,
            style: true,
            grade: true,
            gender: true
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
      id: row.id,
      athlete: {
        fullName: row.athlete.fullName,
        fullNameKana: row.athlete.fullNameKana,
        grade: row.athlete.grade,
        gender: row.athlete.gender
      },
      event: {
        title: row.event.title,
        distanceM: row.event.distanceM,
        style: row.event.style,
        grade: row.event.grade,
        gender: row.event.gender
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
          title: true,
          distanceM: true,
          style: true,
          grade: true,
          gender: true
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
    id: row.id,
    athlete: {
      fullName: row.athlete.fullName,
      fullNameKana: null,
      grade: row.athlete.grade,
      gender: row.athlete.gender
    },
    event: {
      title: row.event.title,
      distanceM: row.event.distanceM,
      style: row.event.style,
      grade: row.event.grade,
      gender: row.event.gender
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
  year: number;
  month: number;
  fullName?: string;
}): string {
  const periodLabel = `${options.year}年${options.month}月`;

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
    if (!filter.hasMonthFilter || !filter.year || !filter.month || !filter.monthStart || !filter.monthEnd) {
      return NextResponse.json({ message: "1位賞状の出力には年・月の指定が必要です" }, { status: 400 });
    }

    if (filter.weekday) {
      return NextResponse.json({ message: "1位賞状では曜日指定はできません" }, { status: 400 });
    }

    const monthlyRows = await findMonthlyFirstPrizeRows({
      meetWhere: buildMeetWhere("swimming", filter),
      fullName: filter.fullName
    });

    if (monthlyRows.length === 0) {
      return NextResponse.json({ message: "条件に一致する賞状対象がありません" }, { status: 400 });
    }

    const rankOneRows = selectMonthlyFirstPrizeRows(monthlyRows);
    if (rankOneRows.length === 0) {
      return NextResponse.json({ message: "条件に一致する賞状対象がありません" }, { status: 400 });
    }

    const awards = buildFirstPrizeAwards(rankOneRows, {
      year: filter.year,
      month: filter.month
    });

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
      year: filter.year,
      month: filter.month,
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
