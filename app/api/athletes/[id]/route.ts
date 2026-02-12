import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const athlete = await prisma.athlete.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      fullName: true,
      grade: true,
      gender: true,
      createdAt: true,
      updatedAt: true,
      results: {
        where: { meet: { program: "swimming" } },
        include: { meet: true, event: true }
      }
    }
  });

  if (!athlete) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ athlete });
}
