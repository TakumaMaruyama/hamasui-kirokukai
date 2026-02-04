import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";

const schema = z.object({
  fullName: z.string().min(1)
});

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ message: "入力が不正です" }, { status: 400 });
  }

  const ipAddress =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown";

  const allowed = checkRateLimit(ipAddress, 10, 60_000);
  if (!allowed) {
    return NextResponse.json({ message: "アクセスが集中しています" }, { status: 429 });
  }

  await prisma.searchLog.create({
    data: {
      fullName: parsed.data.fullName,
      ipAddress,
      userAgent: request.headers.get("user-agent") ?? ""
    }
  });

  const athletes = await prisma.athlete.findMany({
    where: {
      fullName: parsed.data.fullName,
      results: { some: { meet: { program: "swimming" } } }
    },
    select: {
      id: true,
      fullName: true,
      grade: true,
      gender: true
    }
  });

  return NextResponse.json({ results: athletes });
}
