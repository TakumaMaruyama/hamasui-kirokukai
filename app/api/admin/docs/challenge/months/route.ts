import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { listChallengeDocumentMonths } from "@/lib/challenge-docs";
import { challengeDocsErrorResponse } from "@/lib/challenge-docs-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await isAdminAuthenticated())) return NextResponse.json({ message: "再度ログインしてください。" }, { status: 401 });
  try {
    return NextResponse.json({ months: await listChallengeDocumentMonths() }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return challengeDocsErrorResponse(error);
  }
}
