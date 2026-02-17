import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { renderFirstPrizeAwardPdf } from "@/lib/pdf";
import { saveBuffer } from "@/lib/storage";
import { zipBuffers } from "@/lib/zip";
import { buildMeetWhere, parseDocsFilterInput } from "@/lib/docs-filter";
import { buildFirstPrizeAwards, type FirstPrizeSourceRow } from "@/lib/first-prize";
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
    ...(options.fullName ? { athlete: { fullName: options.fullName } } : {})
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

    const files = [] as { name: string; buffer: Buffer }[];
    for (const award of awards) {
      const buffer = await renderFirstPrizeAwardPdf({
        athlete: award.athlete,
        eventTitle: award.eventTitle,
        timeText: award.timeText,
        timeMs: award.timeMs,
        issueLabel: award.issueLabel
      });
      const name = award.fileName;
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
