import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { certificateTemplate } from "@/lib/templates";
import { renderPdfFromHtml } from "@/lib/pdf";
import { saveBuffer } from "@/lib/storage";
import { zipBuffers } from "@/lib/zip";

export async function POST() {
  if (!isAdminAuthenticated()) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const meet = await prisma.meet.findFirst({
    where: { program: "swimming" },
    orderBy: { heldOn: "desc" }
  });

  if (!meet) {
    return NextResponse.json({ message: "記録会がありません" }, { status: 400 });
  }

  const topResults = await prisma.result.findMany({
    where: {
      meetId: meet.id,
      rank: 1
    },
    include: {
      athlete: true,
      event: true
    }
  });

  const files = [] as { name: string; buffer: Buffer }[];

  for (const result of topResults) {
    const html = certificateTemplate({
      athlete: result.athlete,
      meet,
      result
    });
    const buffer = await renderPdfFromHtml(html);
    const name = `${result.event.title}_${result.athlete.fullName}.pdf`;
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

  const zip = await zipBuffers(files);

  return new NextResponse(zip, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": "attachment; filename=swimming_certificates.zip"
    }
  });
}
