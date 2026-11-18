import crypto from "node:crypto";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export const PIN_COOKIE_NAME = "inv_pin_session";
const SESSION_TTL_SEC = 60 * 60 * 24 * 30; // 30 days

// In-memory sliding-window brute-force limiter per client IP
const MAX_FAILED_ATTEMPTS = 5;
const LOCK_WINDOW_MS = 5 * 60 * 1000; // 5 minutes
const attemptStore = new Map<string, { count: number; resetAt: number }>();

function getExpectedPin(): string {
  const fromEnv = process.env.ACCESS_PIN?.trim();
  if (fromEnv && /^\d{4,8}$/.test(fromEnv)) {
    return fromEnv;
  }
  return "6734";
}

function getSigningKey(): Buffer {
  const base =
    process.env.AUTH_SECRET ||
    process.env.NETLIFY_DB_URL ||
    "investidor-local-pin-key";
  return crypto
    .createHash("sha256")
    .update(`${base}:${getExpectedPin()}:v1`)
    .digest();
}

function timingSafeEqualStr(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) {
    // Compare against dummy to keep constant timing profile
    crypto.timingSafeEqual(bufA, bufA);
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

export function verifyPinCode(candidate: string): boolean {
  const clean = candidate.trim();
  if (!/^\d{4,8}$/.test(clean)) return false;
  return timingSafeEqualStr(clean, getExpectedPin());
}

export function createSessionToken(): string {
  const exp = Math.floor(Date.now() / 1000) + SESSION_TTL_SEC;
  const nonce = crypto.randomBytes(12).toString("base64url");
  const payload = `${exp}.${nonce}`;
  const sig = crypto
    .createHmac("sha256", getSigningKey())
    .update(payload)
    .digest("base64url");
  return `${payload}.${sig}`;
}

export function verifySessionToken(token: string | undefined | null): boolean {
  if (!token || typeof token !== "string") return false;
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [expStr, nonce, sig] = parts;
  if (!/^\d+$/.test(expStr) || !nonce || !sig) return false;

  const exp = Number(expStr);
  if (!Number.isSafeInteger(exp) || exp < Math.floor(Date.now() / 1000)) {
    return false;
  }

  const expectedSig = crypto
    .createHmac("sha256", getSigningKey())
    .update(`${expStr}.${nonce}`)
    .digest("base64url");

  return timingSafeEqualStr(sig, expectedSig);
}

export async function isAuthenticatedServer(): Promise<boolean> {
  const store = await cookies();
  const token = store.get(PIN_COOKIE_NAME)?.value;
  return verifySessionToken(token);
}

export function requirePinAuth(request: NextRequest): NextResponse | null {
  const token = request.cookies.get(PIN_COOKIE_NAME)?.value;
  if (!verifySessionToken(token)) {
    return NextResponse.json(
      { error: "Acesso bloqueado. Informe o PIN para continuar." },
      { status: 401 }
    );
  }
  return null;
}

export function getClientIp(request: NextRequest): string {
  const netlifyIp = request.headers.get("x-nf-client-connection-ip");
  if (netlifyIp) return netlifyIp.trim();
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return "local";
}

export function checkPinRateLimit(ip: string): {
  allowed: boolean;
  retryAfterSec: number;
} {
  const now = Date.now();
  const entry = attemptStore.get(ip);
  if (!entry || entry.resetAt <= now) {
    attemptStore.delete(ip);
    return { allowed: true, retryAfterSec: 0 };
  }
  if (entry.count >= MAX_FAILED_ATTEMPTS) {
    return {
      allowed: false,
      retryAfterSec: Math.max(1, Math.ceil((entry.resetAt - now) / 1000)),
    };
  }
  return { allowed: true, retryAfterSec: 0 };
}

export function recordFailedPinAttempt(ip: string): number {
  const now = Date.now();
  const entry = attemptStore.get(ip);
  if (!entry || entry.resetAt <= now) {
    attemptStore.set(ip, { count: 1, resetAt: now + LOCK_WINDOW_MS });
    return MAX_FAILED_ATTEMPTS - 1;
  }
  entry.count += 1;
  attemptStore.set(ip, entry);
  return Math.max(0, MAX_FAILED_ATTEMPTS - entry.count);
}

export function clearPinAttempts(ip: string): void {
  attemptStore.delete(ip);
}

export function isSecureRequest(request: NextRequest): boolean {
  const proto = request.headers.get("x-forwarded-proto");
  if (proto) return proto.split(",")[0].trim() === "https";
  return request.nextUrl.protocol === "https:";
}

export function buildSessionCookieOptions(request: NextRequest) {
  return {
    name: PIN_COOKIE_NAME,
    httpOnly: true,
    sameSite: "lax" as const,
    secure: isSecureRequest(request),
    path: "/",
    maxAge: SESSION_TTL_SEC,
  };
}
