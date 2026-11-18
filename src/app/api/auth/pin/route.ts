import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  buildSessionCookieOptions,
  checkPinRateLimit,
  clearPinAttempts,
  createSessionToken,
  getClientIp,
  recordFailedPinAttempt,
  verifyPinCode,
} from "@/lib/auth/pin";

export const dynamic = "force-dynamic";

const pinSchema = z.object({
  pin: z.string().trim().regex(/^\d{4,8}$/, "PIN deve conter apenas números"),
});

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    const rate = checkPinRateLimit(ip);
    if (!rate.allowed) {
      return NextResponse.json(
        {
          error: `Muitas tentativas incorretas. Aguarde ${rate.retryAfterSec}s.`,
          retryAfterSec: rate.retryAfterSec,
        },
        {
          status: 429,
          headers: { "Retry-After": String(rate.retryAfterSec) },
        }
      );
    }

    const body = await request.json();
    const parsed = pinSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Informe um PIN de 4 dígitos." }, { status: 400 });
    }

    if (!verifyPinCode(parsed.data.pin)) {
      const remaining = recordFailedPinAttempt(ip);
      return NextResponse.json(
        {
          error:
            remaining > 0
              ? `PIN incorreto. Restam ${remaining} tentativa(s).`
              : "PIN incorreto. Acesso bloqueado temporariamente por 5 minutos.",
        },
        { status: 401 }
      );
    }

    clearPinAttempts(ip);
    const token = createSessionToken();
    const response = NextResponse.json({ ok: true }, { status: 200 });
    response.cookies.set({
      ...buildSessionCookieOptions(request),
      value: token,
    });
    return response;
  } catch {
    return NextResponse.json(
      { error: "Erro ao validar PIN." },
      { status: 500 }
    );
  }
}
