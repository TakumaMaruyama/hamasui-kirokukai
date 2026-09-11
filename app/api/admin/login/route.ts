import { NextResponse } from "next/server";
import { z } from "zod";
import { setAdminSession } from "@/lib/admin-auth";
import { AdminSessionConfigurationError } from "@/lib/admin-session";

const schema = z.object({ password: z.string().min(1) });

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "入力が不正です" }, { status: 400 });
  }
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ message: "入力が不正です" }, { status: 400 });
  }

  if (parsed.data.password !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ message: "パスワードが違います" }, { status: 401 });
  }

  try {
    return await setAdminSession(NextResponse.json({ ok: true }));
  } catch (error) {
    if (error instanceof AdminSessionConfigurationError) {
      return NextResponse.json({ message: "管理者ログインの設定が完了していません" }, { status: 503 });
    }
    throw error;
  }
}
