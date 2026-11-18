import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requirePinAuth } from "@/lib/auth/pin";
import { createDividend, deleteDividend, getAssetById } from "@/lib/db";

export const dynamic = "force-dynamic";

const createDividendSchema = z.object({
  assetId: z.number().int().positive(),
  type: z.enum(["DIVIDEND", "JCP", "YIELD", "INTEREST"]),
  amount: z.number().positive("Valor deve ser maior que zero"),
  paidAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida"),
  notes: z.string().trim().max(250).optional().nullable(),
});

export async function POST(request: NextRequest) {
  const denied = requirePinAuth(request);
  if (denied) return denied;

  try {
    const body = await request.json();
    const parsed = createDividendSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Dados de provento inválidos." },
        { status: 400 }
      );
    }

    const asset = await getAssetById(parsed.data.assetId);
    if (!asset) {
      return NextResponse.json(
        { error: "Ativo não encontrado." },
        { status: 404 }
      );
    }

    const dividend = await createDividend(parsed.data);
    return NextResponse.json({ dividend }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Erro ao lançar provento." },
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
    return NextResponse.json({ error: "ID inválido." }, { status: 400 });
  }
  const ok = await deleteDividend(Number(idRaw));
  if (!ok) {
    return NextResponse.json(
      { error: "Provento não encontrado." },
      { status: 404 }
    );
  }
  return NextResponse.json({ ok: true });
}
