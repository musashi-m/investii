import { NextRequest, NextResponse } from "next/server";
import { isSecureRequest, PIN_COOKIE_NAME } from "@/lib/auth/pin";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const response = NextResponse.json({ ok: true });
  response.cookies.set({
    name: PIN_COOKIE_NAME,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: isSecureRequest(request),
    path: "/",
    maxAge: 0,
  });
  return response;
}
