import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { redirect } from "next/navigation";
import { ADMIN_SESSION_COOKIE, ADMIN_SESSION_TTL_SECONDS, createAdminSession, verifyAdminSession } from "@/lib/admin-session";

export async function isAdminAuthenticated(): Promise<boolean> {
  const cookieStore = await cookies();
  return verifyAdminSession(cookieStore.get(ADMIN_SESSION_COOKIE)?.value);
}

export async function requireAdminSession(): Promise<void> {
  if (!(await isAdminAuthenticated())) redirect("/admin");
}

export async function setAdminSession(response: NextResponse): Promise<NextResponse> {
  response.cookies.set(ADMIN_SESSION_COOKIE, await createAdminSession(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: ADMIN_SESSION_TTL_SECONDS
  });
  return response;
}

export function clearAdminSession(response: NextResponse): NextResponse {
  response.cookies.delete(ADMIN_SESSION_COOKIE);
  return response;
}
