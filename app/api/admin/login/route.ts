import { NextResponse } from "next/server";
import { z } from "zod";
import { setAdminSession } from "@/lib/admin-auth";

const schema = z.object({ password: z.string().min(1) });

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ message: "入力が不正です" }, { status: 400 });
  }

  if (parsed.data.password !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ message: "パスワードが違います" }, { status: 401 });
  }

  return setAdminSession(NextResponse.json({ ok: true }));
}
