import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { recordTemplate } from "@/lib/templates";
import { renderPdfFromHtml } from "@/lib/pdf";
import { saveBuffer } from "@/lib/storage";
import { zipBuffers } from "@/lib/zip";

export async function POST() {
  if (!isAdminAuthenticated()) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const meet = await prisma.meet.findFirst({
    where: { program: "school" },
    orderBy: { heldOn: "desc" }
  });

  if (!meet) {
    return NextResponse.json({ message: "記録会がありません" }, { status: 400 });
  }

  const athletes = await prisma.athlete.findMany({
    where: {
      results: {
        some: {
          meetId: meet.id
        }
      }
    }
  });

  const files = [] as { name: string; buffer: Buffer }[];

  for (const athlete of athletes) {
    const results = await prisma.result.findMany({
      where: { athleteId: athlete.id, meetId: meet.id },
      include: { event: true }
    });

    const html = recordTemplate({ athlete, meet, results });
    const buffer = await renderPdfFromHtml(html);
    const name = `${athlete.fullName}_${meet.title}_record.pdf`;
    const storageKey = await saveBuffer(`school/records/${name}`, buffer);

    await prisma.generatedDoc.create({
      data: {
        program: "school",
        kind: "record",
        storageKey
      }
    });

    files.push({ name, buffer });
  }

  const zip = await zipBuffers(files);

  return new NextResponse(zip, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": "attachment; filename=school_records.zip"
    }
  });
}
