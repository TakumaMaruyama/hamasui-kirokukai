import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { isMissingSearchLogConsentVersionColumnError } from "@/lib/search-log";

export async function GET() {
  if (!isAdminAuthenticated()) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    const logs = await prisma.searchLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 200,
      select: {
        id: true,
        createdAt: true,
        fullName: true,
        ipAddress: true,
        userAgent: true,
        consentVersion: true
      }
    });

    return NextResponse.json({ logs });
  } catch (error) {
    if (!isMissingSearchLogConsentVersionColumnError(error)) {
      throw error;
    }

    const fallbackLogs = await prisma.searchLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 200,
      select: {
        id: true,
        createdAt: true,
        fullName: true,
        ipAddress: true,
        userAgent: true
      }
    });

    return NextResponse.json({
      logs: fallbackLogs.map((log) => ({ ...log, consentVersion: null }))
    });
  }
}
