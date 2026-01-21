import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const SESSION_COOKIE = "admin_session";

export function isAdminAuthenticated(): boolean {
  const cookie = cookies().get(SESSION_COOKIE);
  return Boolean(cookie?.value);
}

export function setAdminSession(response: NextResponse): NextResponse {
  response.cookies.set(SESSION_COOKIE, "1", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/"
  });
  return response;
}

export function clearAdminSession(response: NextResponse): NextResponse {
  response.cookies.delete(SESSION_COOKIE);
  return response;
}
