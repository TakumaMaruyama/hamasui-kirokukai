import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { rankingTemplate } from "@/lib/templates";
import { renderPdfFromHtml } from "@/lib/pdf";
import { saveBuffer } from "@/lib/storage";
import { zipBuffers } from "@/lib/zip";
import { buildMeetWhere, parseDocsFilterInput } from "@/lib/docs-filter";
import { buildMeetRankingGroups } from "@/lib/ranking-report";

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
    const meets = filter.hasMonthFilter
      ? await prisma.meet.findMany({
          where: buildMeetWhere("swimming", filter),
          orderBy: [{ heldOn: "asc" }, { title: "asc" }]
        })
      : await prisma.meet
          .findFirst({
            where: { program: "swimming" },
            orderBy: { heldOn: "desc" }
          })
          .then((meet) => (meet ? [meet] : []));

    if (meets.length === 0) {
      return NextResponse.json({ message: "条件に一致する記録会がありません" }, { status: 400 });
    }

    const files = [] as { name: string; buffer: Buffer }[];

    for (const meet of meets) {
      const results = await prisma.result.findMany({
        where: {
          meetId: meet.id,
          rank: { lte: 3 }
        },
        include: {
          athlete: true,
          event: true
        }
      });

      const groups = buildMeetRankingGroups(results);
      if (groups.length === 0) {
        continue;
      }

      const html = rankingTemplate({ meet, groups });
      const buffer = await renderPdfFromHtml(html);
      const name = `${meet.title}_ranking.pdf`;
      const storageKey = await saveBuffer(`swimming/rankings/${name}`, buffer);

      await prisma.generatedDoc.create({
        data: {
          program: "swimming",
          kind: "ranking",
          storageKey
        }
      });

      files.push({ name, buffer });
    }

    if (files.length === 0) {
      return NextResponse.json({ message: "条件に一致するランキングデータがありません" }, { status: 400 });
    }

    const zip = await zipBuffers(files);

    return new NextResponse(zip, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": "attachment; filename=swimming_rankings.zip"
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "PDF生成中にエラーが発生しました";
    return NextResponse.json({ message }, { status: 500 });
  }
}
