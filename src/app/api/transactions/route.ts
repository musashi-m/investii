import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requirePinAuth } from "@/lib/auth/pin";
import {
  createTransaction,
  deleteTransaction,
  findOrCreateAsset,
  getWalletById,
} from "@/lib/db";
import { fetchLiveQuote } from "@/lib/market/providers";

export const dynamic = "force-dynamic";

const createTransactionSchema = z.object({
  walletId: z.number().int().positive(),
  category: z.enum([
    "ACOES",
    "FIIS",
    "RENDA_FIXA",
    "ETFS",
    "BDRS",
    "CRIPTOS",
    "STOCKS",
  ]),
  ticker: z.string().trim().min(1, "Código/Nome obrigatório").max(40),
  name: z.string().trim().max(120).optional(),
  currency: z.enum(["BRL", "USD"]).optional(),
  type: z.enum(["BUY", "SELL"]),
  quantity: z.number().positive("Quantidade deve ser maior que zero"),
  unitPrice: z.number().nonnegative("Preço deve ser positivo"),
  fees: z.number().nonnegative().optional().default(0),
  executedAt: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida (use AAAA-MM-DD)"),
  notes: z.string().trim().max(300).optional().nullable(),
  rating: z.number().int().min(0).max(10).optional(),
  fixedIncomeType: z
    .enum(["CDB", "LCI", "LCA", "TESOURO", "CRI_CRA", "DEBENTURE", "OUTROS"])
    .optional()
    .nullable(),
  indexer: z.enum(["CDI", "IPCA", "PRE", "SELIC"]).optional().nullable(),
  rate: z.number().nonnegative().max(500).optional().nullable(),
  maturityDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .nullable(),
  issuer: z.string().trim().max(80).optional().nullable(),
  irExempt: z.boolean().optional(),
  iofExempt: z.boolean().optional(),
});

export async function POST(request: NextRequest) {
  const denied = requirePinAuth(request);
  if (denied) return denied;

  try {
    const body = await request.json();
    const parsed = createTransactionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Dados de lançamento inválidos.",
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const data = parsed.data;
    const wallet = await getWalletById(data.walletId);

    let resolvedName = data.name?.trim() || data.ticker.trim().toUpperCase();
    let resolvedCurrency: "BRL" | "USD" =
      data.currency ?? (data.category === "STOCKS" ? "USD" : "BRL");
    let resolvedLogo: string | null = null;

    if (data.category !== "RENDA_FIXA") {
      const liveQuote = await fetchLiveQuote(data.ticker, data.category, false);
      if (liveQuote) {
        if (!data.name?.trim() && liveQuote.name) {
          resolvedName = liveQuote.name;
        }
        resolvedCurrency = liveQuote.currency;
        resolvedLogo = liveQuote.logoUrl;
      }
    }

    const asset = await findOrCreateAsset({
      walletId: wallet.id,
      ticker: data.ticker.trim().toUpperCase(),
      name: resolvedName,
      category: data.category,
      currency: resolvedCurrency,
      logoUrl: resolvedLogo,
      rating: data.rating ?? 10,
      fixedIncomeType: data.category === "RENDA_FIXA" ? data.fixedIncomeType ?? "CDB" : null,
      indexer: data.category === "RENDA_FIXA" ? data.indexer ?? "CDI" : null,
      rate: data.category === "RENDA_FIXA" ? data.rate ?? 100 : null,
      maturityDate: data.category === "RENDA_FIXA" ? data.maturityDate ?? null : null,
      issuer: data.category === "RENDA_FIXA" ? data.issuer ?? null : null,
      irExempt: data.category === "RENDA_FIXA" ? data.irExempt : false,
      iofExempt: data.category === "RENDA_FIXA" ? data.iofExempt : false,
    });

    const transaction = await createTransaction({
      assetId: asset.id,
      type: data.type,
      quantity: data.quantity,
      unitPrice: data.unitPrice,
      fees: data.fees,
      executedAt: data.executedAt,
      notes: data.notes ?? null,
    });

    return NextResponse.json({ asset, transaction }, { status: 201 });
  } catch (err) {
    console.error("POST /api/transactions error:", err);
    return NextResponse.json(
      { error: "Erro ao registrar lançamento." },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  const denied = requirePinAuth(request);
  if (denied) return denied;

  const { searchParams } = new URL(request.url);
  const idRaw = searchParams.get("id");
  if (!idRaw || !/^\d+$/.test(idRaw)) {
    return NextResponse.json({ error: "ID de lançamento inválido." }, { status: 400 });
  }
  const ok = await deleteTransaction(Number(idRaw));
  if (!ok) {
    return NextResponse.json(
      { error: "Lançamento não encontrado." },
      { status: 404 }
    );
  }
  return NextResponse.json({ ok: true });
}
