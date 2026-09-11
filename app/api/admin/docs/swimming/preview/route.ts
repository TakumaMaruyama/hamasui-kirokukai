import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { parseDocsFilterInput } from "@/lib/docs-filter";
import { prepareSwimmingDocument } from "@/lib/swimming-docs";
import { swimmingDocsErrorResponse } from "@/lib/swimming-docs-response";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!(await isAdminAuthenticated())) return NextResponse.json({ message: "再度ログインしてください。" }, { status: 401 });
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || !["records", "certificates", "historical-firsts"].includes(body.kind)) {
    return NextResponse.json({ message: "書類の種類を指定してください。" }, { status: 400 });
  }
  const parsed = parseDocsFilterInput(body);
  if (!parsed.ok) return NextResponse.json({ message: parsed.message }, { status: 400 });
  try {
    const document = await prepareSwimmingDocument(body.kind, parsed.value, { preview: true });
    return NextResponse.json(document.preview, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return swimmingDocsErrorResponse(error);
  }
}
