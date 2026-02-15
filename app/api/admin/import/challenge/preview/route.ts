import { NextResponse } from "next/server";
import { z } from "zod";
import { parseCsv, readCsvText } from "@/lib/csv";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { WEEKDAY_VALUES } from "@/lib/meet-context";
import { CHALLENGE_GRADE_MAX, CHALLENGE_GRADE_MIN, filterChallengeGradeRows } from "@/lib/challenge-grade";

const contextSchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
  month: z.coerce.number().int().min(1).max(12),
  weekday: z.enum(WEEKDAY_VALUES)
});

function skippedMessage(skippedCount: number): string {
  return `学年範囲外の${skippedCount}行を除外しました（対象: 年少〜高校3年生 / ${CHALLENGE_GRADE_MIN}〜${CHALLENGE_GRADE_MAX}）`;
}

export async function POST(request: Request) {
  if (!isAdminAuthenticated()) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  const context = contextSchema.safeParse({
    year: formData.get("year"),
    month: formData.get("month"),
    weekday: formData.get("weekday")
  });

  if (!(file instanceof File)) {
    return NextResponse.json({ message: "ファイルが必要です" }, { status: 400 });
  }

  if (!context.success) {
    return NextResponse.json({ message: "年・月・曜日を正しく指定してください" }, { status: 400 });
  }

  try {
    const content = await readCsvText(file);
    const rows = parseCsv(content, { fileName: file.name, meetContext: context.data });
    const { acceptedRows, skippedCount } = filterChallengeGradeRows(rows);

    if (acceptedRows.length === 0) {
      return NextResponse.json(
        {
          message: `有効な行がありません。学年は年少〜高校3年生（${CHALLENGE_GRADE_MIN}〜${CHALLENGE_GRADE_MAX}）で入力してください。`
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      rows: acceptedRows,
      ...(skippedCount > 0 ? { message: skippedMessage(skippedCount) } : {})
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "CSV解析に失敗しました";
    return NextResponse.json({ message }, { status: 400 });
  }
}
