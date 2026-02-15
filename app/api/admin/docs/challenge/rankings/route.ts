import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { renderRankingPdf } from "@/lib/pdf";
import { saveBuffer } from "@/lib/storage";
import { zipBuffers } from "@/lib/zip";
import { parseDocsFilterInput } from "@/lib/docs-filter";
import { buildMeetRankingGroups } from "@/lib/ranking-report";
import { assignMonthlyRanks } from "@/lib/monthly-rank";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!isAdminAuthenticated()) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const rawBody = await request.json().catch(() => ({}));
  const parsedFilter = parseDocsFilterInput(rawBody);

  if (!parsedFilter.ok) {
    return NextResponse.json({ message: parsedFilter.message }, { status: 400 });
  }

  try {
    const filter = parsedFilter.value;
    if (!filter.hasMonthFilter || !filter.monthStart || !filter.monthEnd || !filter.year || !filter.month) {
      return NextResponse.json({ message: "ランキング出力には年・月の指定が必要です" }, { status: 400 });
    }

    const rows = await prisma.result.findMany({
      where: {
        meet: {
          program: "challenge",
          heldOn: {
            gte: filter.monthStart,
            lt: filter.monthEnd
          }
        }
      },
      include: {
        athlete: {
          select: {
            fullName: true
          }
        },
        event: true,
        meet: {
          select: { heldOn: true }
        }
      }
    });

    if (rows.length === 0) {
      return NextResponse.json({ message: "条件に一致するランキングデータがありません" }, { status: 400 });
    }

    const monthlyRanks = assignMonthlyRanks(
      rows.map((row) => ({
        id: row.id,
        heldOn: row.meet.heldOn,
        timeMs: row.timeMs,
        event: {
          title: row.event.title,
          distanceM: row.event.distanceM,
          style: row.event.style,
          grade: row.event.grade,
          gender: row.event.gender
        }
      }))
    );

    const rankedRows = rows
      .map((row) => ({
        ...row,
        rank: monthlyRanks.get(row.id) ?? 0
      }))
      .filter((row) => row.rank > 0);

    const groups = buildMeetRankingGroups(rankedRows);
    if (groups.length === 0) {
      return NextResponse.json({ message: "条件に一致するランキングデータがありません" }, { status: 400 });
    }

    const periodLabel = `${filter.year}年${filter.month}月 チャレンジコース`;
    const buffer = await renderRankingPdf({ periodLabel, groups });
    const name = `${filter.year}年${filter.month}月_challenge_ranking.pdf`;
    const storageKey = await saveBuffer(`challenge/rankings/${name}`, buffer);

    await prisma.generatedDoc.create({
      data: {
        program: "challenge",
        kind: "ranking",
        storageKey
      }
    });

    const zip = await zipBuffers([{ name, buffer }]);

    return new NextResponse(zip, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": "attachment; filename=challenge_rankings.zip"
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "PDF生成中にエラーが発生しました";
    return NextResponse.json({ message }, { status: 500 });
  }
}
