import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { listSwimmingDocumentMonths } from "@/lib/swimming-docs";
import { swimmingDocsErrorResponse } from "@/lib/swimming-docs-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await isAdminAuthenticated())) return NextResponse.json({ message: "再度ログインしてください。" }, { status: 401 });
  try {
    return NextResponse.json({ months: await listSwimmingDocumentMonths() }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return swimmingDocsErrorResponse(error);
  }
}
