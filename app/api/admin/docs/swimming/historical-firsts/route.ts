import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { renderChallengeRankingPdf } from "@/lib/pdf";
import { saveBuffer } from "@/lib/storage";
import { zipBuffers } from "@/lib/zip";
import { parseDocsFilterInput } from "@/lib/docs-filter";
import { buildHistoricalFirstChallengeGroups } from "@/lib/ranking-report";

export const runtime = "nodejs";
const HISTORICAL_GRADE_SEQUENCE = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] as const;

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
    if (!filter.hasMonthFilter || !filter.monthStart || !filter.monthEnd || !filter.year || !filter.month) {
      return NextResponse.json({ message: "歴代1位出力には年・月の指定が必要です" }, { status: 400 });
    }

    const rows = await prisma.result.findMany({
      where: {
        meet: {
          program: "swimming",
          heldOn: {
            lt: filter.monthEnd
          }
        }
      },
      include: {
        athlete: {
          select: {
            id: true,
            fullName: true
          }
        },
        event: true,
        meet: {
          select: {
            heldOn: true
          }
        }
      }
    });

    if (rows.length === 0) {
      return NextResponse.json({ message: "ランキング対象データがありません" }, { status: 400 });
    }

    const groups = buildHistoricalFirstChallengeGroups(
      rows.map((row) => ({
        timeMs: row.timeMs,
        timeText: row.timeText,
        athlete: {
          id: row.athlete.id,
          fullName: row.athlete.fullName
        },
        event: {
          title: row.event.title,
          distanceM: row.event.distanceM,
          style: row.event.style,
          grade: row.event.grade,
          gender: row.event.gender
        },
        meet: {
          heldOn: row.meet.heldOn
        }
      })),
      {
        targetMonthStart: filter.monthStart,
        targetMonthEnd: filter.monthEnd,
        gradeRangeMode: "existing",
        gradeSequence: [...HISTORICAL_GRADE_SEQUENCE],
        excludeOtherGender: true
      }
    );

    if (groups.length === 0) {
      return NextResponse.json({ message: "ランキング対象データがありません" }, { status: 400 });
    }

    const periodLabel = `${filter.year}年${filter.month}月 歴代1位記録一覧`;
    const buffer = await renderChallengeRankingPdf({
      periodLabel,
      groups,
      highlightLegend: "NEW はこの月に新しく歴代1位になった記録",
      rankRange: { min: 1, max: 1 }
    });
    const name = `${filter.year}年${filter.month}月_swimming_historical_firsts.pdf`;
    const storageKey = await saveBuffer(`swimming/historical-firsts/${name}`, buffer);

    await prisma.generatedDoc.create({
      data: {
        program: "swimming",
        kind: "historical_first",
        storageKey
      }
    });

    const zip = await zipBuffers([{ name, buffer }]);

    return new NextResponse(zip, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": "attachment; filename=swimming_historical_firsts.zip"
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "PDF生成中にエラーが発生しました";
    return NextResponse.json({ message }, { status: 500 });
  }
}
