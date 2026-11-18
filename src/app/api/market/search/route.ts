import { NextRequest, NextResponse } from "next/server";
import { requirePinAuth } from "@/lib/auth/pin";
import { searchLiveTicker } from "@/lib/market/providers";
import type { AssetCategory } from "@/types/portfolio";

export const dynamic = "force-dynamic";

const VALID_CATS = new Set<string>([
  "ACOES",
  "FIIS",
  "ETFS",
  "BDRS",
  "CRIPTOS",
  "STOCKS",
]);

export async function GET(request: NextRequest) {
  const denied = requirePinAuth(request);
  if (denied) return denied;

  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") ?? "").trim();
  const catRaw = (searchParams.get("category") ?? "").toUpperCase();

  if (q.length < 2) {
    return NextResponse.json({ results: [] });
  }

  const preferredCategory = VALID_CATS.has(catRaw)
    ? (catRaw as AssetCategory)
    : undefined;

  const results = await searchLiveTicker(q, preferredCategory);
  return NextResponse.json({ results });
}
