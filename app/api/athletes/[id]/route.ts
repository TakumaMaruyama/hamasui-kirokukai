import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const athlete = await prisma.athlete.findUnique({
    where: { id: params.id },
    include: {
      results: {
        where: { meet: { program: "swimming" } },
        include: { meet: true, event: true }
      }
    }
  });

  if (!athlete || !athlete.publishConsent) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }

  if (athlete.publishUntil && athlete.publishUntil < new Date()) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ athlete });
}
