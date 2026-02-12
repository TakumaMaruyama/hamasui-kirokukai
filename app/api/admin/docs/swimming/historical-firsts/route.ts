import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { renderRankingPdf } from "@/lib/pdf";
import { saveBuffer } from "@/lib/storage";
import { zipBuffers } from "@/lib/zip";
import { buildHistoricalFirstRankingGroups } from "@/lib/ranking-report";

export const runtime = "nodejs";

export async function POST() {
  if (!isAdminAuthenticated()) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    const rows = await prisma.result.findMany({
      where: {
        meet: {
          program: "swimming"
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
          select: {
            heldOn: true
          }
        }
      }
    });

    if (rows.length === 0) {
      return NextResponse.json({ message: "ランキング対象データがありません" }, { status: 400 });
    }

    const groups = buildHistoricalFirstRankingGroups(
      rows.map((row) => ({
        timeMs: row.timeMs,
        timeText: row.timeText,
        athlete: {
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
      }))
    );

    if (groups.length === 0) {
      return NextResponse.json({ message: "ランキング対象データがありません" }, { status: 400 });
    }

    const periodLabel = "歴代1位記録一覧";
    const buffer = await renderRankingPdf({ periodLabel, groups });
    const name = "swimming_historical_firsts.pdf";
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
