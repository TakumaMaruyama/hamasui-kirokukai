import { Prisma, Program } from "@prisma/client";
import { z } from "zod";
import { WEEKDAY_VALUES, type MeetWeekday } from "./meet-context";

const YEAR_MIN = 2000;
const YEAR_MAX = 2100;

const intField = (label: string, min: number, max: number) =>
  z.preprocess(
    (value) => {
      if (value === undefined || value === null || value === "") {
        return undefined;
      }

      if (typeof value === "number") {
        return value;
      }

      if (typeof value === "string") {
        const normalized = value.trim();
        if (!normalized) {
          return undefined;
        }
        return Number(normalized);
      }

      return value;
    },
    z
      .number({
        invalid_type_error: `${label}は数値で入力してください`
      })
      .int(`${label}は整数で入力してください`)
      .min(min, `${label}は${min}以上で入力してください`)
      .max(max, `${label}は${max}以下で入力してください`)
      .optional()
  );

const filterSchema = z.object({
  year: intField("年", YEAR_MIN, YEAR_MAX),
  month: intField("月", 1, 12),
  weekday: z.enum(WEEKDAY_VALUES).optional(),
  fullName: z
    .preprocess((value) => (typeof value === "string" ? value.trim() : value), z.string().min(1).max(80).optional())
    .optional()
});

function normalizeFullName(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export type DocsFilter = {
  year?: number;
  month?: number;
  weekday?: MeetWeekday;
  fullName?: string;
  hasMonthFilter: boolean;
  monthStart?: Date;
  monthEnd?: Date;
};

export function parseDocsFilterInput(input: unknown): { ok: true; value: DocsFilter } | { ok: false; message: string } {
  const parsed = filterSchema.safeParse(input ?? {});

  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "出力条件が不正です" };
  }

  const { year, month, weekday, fullName } = parsed.data;
  const hasYear = year !== undefined;
  const hasMonth = month !== undefined;

  if (hasYear !== hasMonth) {
    return { ok: false, message: "年月は両方指定してください" };
  }

  if (weekday && !hasYear) {
    return { ok: false, message: "曜日を指定する場合は年月を指定してください" };
  }

  if (fullName && !hasYear) {
    return { ok: false, message: "氏名を指定する場合は年月を指定してください" };
  }

  let monthStart: Date | undefined;
  let monthEnd: Date | undefined;

  if (hasYear && hasMonth && year !== undefined && month !== undefined) {
    monthStart = new Date(Date.UTC(year, month - 1, 1));
    monthEnd = new Date(Date.UTC(year, month, 1));
  }

  return {
    ok: true,
    value: {
      year,
      month,
      weekday,
      fullName: fullName ? normalizeFullName(fullName) : undefined,
      hasMonthFilter: hasYear && hasMonth,
      monthStart,
      monthEnd
    }
  };
}

export function buildMeetWhere(program: Program, filter: DocsFilter): Prisma.MeetWhereInput {
  const where: Prisma.MeetWhereInput = { program };

  if (filter.hasMonthFilter && filter.monthStart && filter.monthEnd) {
    where.heldOn = {
      gte: filter.monthStart,
      lt: filter.monthEnd
    };
  }

  if (filter.weekday) {
    where.title = {
      contains: filter.weekday
    };
  }

  return where;
}
