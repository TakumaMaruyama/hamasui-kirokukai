import { NextResponse } from "next/server";
import { parseCsv } from "@/lib/csv";
import { isAdminAuthenticated } from "@/lib/admin-auth";

export async function POST(request: Request) {
  if (!isAdminAuthenticated()) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ message: "ファイルが必要です" }, { status: 400 });
  }

  const content = await file.text();
  const rows = parseCsv(content);

  return NextResponse.json({ rows });
}
