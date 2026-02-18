import { NextResponse } from "next/server";
import { z } from "zod";
import { parseCsv, readCsvText } from "@/lib/csv";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { WEEKDAY_VALUES } from "@/lib/meet-context";

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
    return NextResponse.json({ rows });
  } catch (error) {
    const message = error instanceof Error ? error.message : "CSV解析に失敗しました";
    return NextResponse.json({ message }, { status: 400 });
  }
}
