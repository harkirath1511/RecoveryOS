import { NextResponse } from "next/server";
import { sessionCookieName } from "@/lib/auth/session";
export async function POST(request: Request) {
  const response = NextResponse.redirect(new URL("/login", request.url), 303);
  response.cookies.set(sessionCookieName, "", { httpOnly: true, path: "/", maxAge: 0 });
  return response;
}
