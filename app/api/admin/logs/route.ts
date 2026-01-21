import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminAuthenticated } from "@/lib/admin-auth";

export async function GET() {
  if (!isAdminAuthenticated()) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const logs = await prisma.searchLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 200
  });

  return NextResponse.json({ logs });
}
