import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { nameSearchKey, parseSearchRequestInput } from "@/lib/search-request";
import { isMissingSearchLogConsentVersionColumnError } from "@/lib/search-log";
import { groupAthletesByChild } from "@/lib/child-history";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = parseSearchRequestInput(body);

  if (!parsed.ok) {
    return NextResponse.json({ message: parsed.message }, { status: 400 });
  }

  const ipAddress =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown";

  const allowed = checkRateLimit(ipAddress, 10, 60_000);
  if (!allowed) {
    return NextResponse.json({ message: "アクセスが集中しています" }, { status: 429 });
  }

  const normalizedFullName = parsed.value.fullName;

  try {
    await prisma.searchLog.create({
      data: {
        fullName: normalizedFullName,
        ipAddress,
        userAgent: request.headers.get("user-agent") ?? "",
        consentVersion: parsed.value.consentVersion
      }
    });
  } catch (error) {
    if (!isMissingSearchLogConsentVersionColumnError(error)) {
      throw error;
    }

    await prisma.searchLog.create({
      data: {
        fullName: normalizedFullName,
        ipAddress,
        userAgent: request.headers.get("user-agent") ?? ""
      }
    });
  }

  const athletes = await prisma.athlete.findMany({
    where: {
      results: { some: { meet: { program: "swimming" } } }
    },
    select: {
      fullName: true,
      grade: true,
      gender: true
    }
  });

  const key = nameSearchKey(normalizedFullName);
  const matchedAthletes = athletes.filter((athlete) => nameSearchKey(athlete.fullName) === key);
  const results = groupAthletesByChild(matchedAthletes);

  return NextResponse.json({ results });
}
