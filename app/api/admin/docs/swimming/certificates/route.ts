import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { certificateTemplate } from "@/lib/templates";
import { renderPdfFromHtml } from "@/lib/pdf";
import { saveBuffer } from "@/lib/storage";
import { zipBuffers } from "@/lib/zip";
import { buildMeetWhere, parseDocsFilterInput } from "@/lib/docs-filter";

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
      const topResults = await prisma.result.findMany({
        where: {
          meetId: meet.id,
          rank: 1,
          ...(filter.fullName ? { athlete: { fullName: filter.fullName } } : {})
        },
        include: {
          athlete: true,
          event: true
        }
      });

      for (const result of topResults) {
        const html = certificateTemplate({
          athlete: result.athlete,
          meet,
          result
        });
        const buffer = await renderPdfFromHtml(html);
        const name = `${meet.title}_${result.event.title}_${result.athlete.fullName}.pdf`;
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
