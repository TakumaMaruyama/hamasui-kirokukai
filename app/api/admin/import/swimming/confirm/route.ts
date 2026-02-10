import { NextResponse } from "next/server";
import { z } from "zod";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { importRows } from "@/lib/importer";

const schema = z.object({
  rows: z.array(z.record(z.string(), z.string()))
});

function getImportErrorMessage(error: unknown): string {
  if (!(error instanceof Error)) {
    return "取り込みに失敗しました";
  }

  if (error.message.includes("Environment variable not found: DATABASE_URL")) {
    return "DATABASE_URL が未設定です。.env.local を確認してください。";
  }

  if (error.message.includes("Can't reach database server")) {
    return "データベースに接続できません。PostgreSQL が起動しているか確認してください。";
  }

  return error.message;
}

export async function POST(request: Request) {
  if (!isAdminAuthenticated()) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ message: "入力が不正です" }, { status: 400 });
  }

  try {
    await importRows("swimming", parsed.data.rows as any);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = getImportErrorMessage(error);
    return NextResponse.json({ message }, { status: 400 });
  }
}
