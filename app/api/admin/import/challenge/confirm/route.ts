import { NextResponse } from "next/server";
import { z } from "zod";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { importRows } from "@/lib/importer";
import { CHALLENGE_GRADE_MAX, CHALLENGE_GRADE_MIN, filterChallengeGradeRows } from "@/lib/challenge-grade";

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
    const { acceptedRows, skippedCount } = filterChallengeGradeRows(parsed.data.rows as any[]);

    if (acceptedRows.length === 0) {
      return NextResponse.json(
        {
          message: `有効な行がありません。学年は年少〜高校3年生（${CHALLENGE_GRADE_MIN}〜${CHALLENGE_GRADE_MAX}）で入力してください。`
        },
        { status: 400 }
      );
    }

    await importRows("challenge", acceptedRows as any);

    const message =
      skippedCount > 0
        ? `取り込みが完了しました（取り込み: ${acceptedRows.length}件 / 除外: ${skippedCount}件）`
        : `取り込みが完了しました（取り込み: ${acceptedRows.length}件）`;

    return NextResponse.json({ ok: true, message });
  } catch (error) {
    const message = getImportErrorMessage(error);
    return NextResponse.json({ message }, { status: 400 });
  }
}
