import { NextResponse } from "next/server";
import { z } from "zod";
import { parseCsv, readCsvText } from "@/lib/csv";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { WEEKDAY_VALUES } from "@/lib/meet-context";

const contextSchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
  month: z.coerce.number().int().min(1).max(12),
  weekday: z.enum(WEEKDAY_VALUES)
});

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
    return NextResponse.json({ rows });
  } catch (error) {
    const message = error instanceof Error ? error.message : "CSV解析に失敗しました";
    return NextResponse.json({ message }, { status: 400 });
  }
}
