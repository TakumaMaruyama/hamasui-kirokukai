import { NextResponse } from "next/server";
import { z } from "zod";
import { parseCsv, readCsvText } from "@/lib/csv";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { WEEKDAY_VALUES } from "@/lib/meet-context";
import { CHALLENGE_GRADE_MAX, CHALLENGE_GRADE_MIN, filterChallengeGradeRows } from "@/lib/challenge-grade";

const contextSchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
  month: z.coerce.number().int().min(1).max(12),
  weekday: z.preprocess(
    (value) => {
      if (value === null || typeof value === "undefined") {
        return undefined;
      }

      if (typeof value === "string") {
        const normalized = value.trim();
        if (!normalized || normalized === "指定なし") {
          return undefined;
        }

        return normalized;
      }

      return value;
    },
    z.enum(WEEKDAY_VALUES).optional()
  )
});

function skippedMessage(skippedCount: number): string {
  return `学年範囲外の${skippedCount}行を除外しました（対象: 年少〜高校3年生 / ${CHALLENGE_GRADE_MIN}〜${CHALLENGE_GRADE_MAX}）`;
}

export async function POST(request: Request) {
  if (!isAdminAuthenticated()) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const files = formData
    .getAll("files")
    .filter((entry): entry is File => entry instanceof File && entry.size > 0);
  if (files.length === 0) {
    const legacyFile = formData.get("file");
    if (legacyFile instanceof File && legacyFile.size > 0) {
      files.push(legacyFile);
    }
  }
  const context = contextSchema.safeParse({
    year: formData.get("year"),
    month: formData.get("month"),
    weekday: formData.get("weekday")
  });

  if (files.length === 0) {
    return NextResponse.json({ message: "CSVファイルが必要です" }, { status: 400 });
  }

  if (!context.success) {
    return NextResponse.json({ message: "年・月を正しく指定してください" }, { status: 400 });
  }

  try {
    const rows: ReturnType<typeof parseCsv> = [];
    for (const file of files) {
      const content = await readCsvText(file);
      rows.push(...parseCsv(content, { fileName: file.name, meetContext: context.data }));
    }
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
