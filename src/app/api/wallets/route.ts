import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requirePinAuth } from "@/lib/auth/pin";
import {
  createWallet,
  deleteWallet,
  getCategoryTargets,
  listWallets,
  renameWallet,
  updateCategoryTargets,
} from "@/lib/db";
import type { AssetCategory } from "@/types/portfolio";

export const dynamic = "force-dynamic";

const createWalletSchema = z.object({
  name: z.string().trim().min(1, "Nome obrigatório").max(60),
});

const patchWalletSchema = z.object({
  id: z.number().int().positive(),
  name: z.string().trim().min(1).max(60).optional(),
  categoryTargets: z
    .record(
      z.enum(["ACOES", "FIIS", "RENDA_FIXA", "ETFS", "BDRS", "CRIPTOS", "STOCKS"]),
      z.number().min(0).max(100)
    )
    .optional(),
});

export async function GET(request: NextRequest) {
  const denied = requirePinAuth(request);
  if (denied) return denied;
  return NextResponse.json({ wallets: await listWallets() });
}

export async function POST(request: NextRequest) {
  const denied = requirePinAuth(request);
  if (denied) return denied;

  try {
    const body = await request.json();
    const parsed = createWalletSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Nome de carteira inválido." },
        { status: 400 }
      );
    }
    const wallet = await createWallet(parsed.data.name);
    const wallets = await listWallets();
    return NextResponse.json({ wallet, wallets }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Erro ao criar carteira." }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const denied = requirePinAuth(request);
  if (denied) return denied;

  try {
    const body = await request.json();
    const parsed = patchWalletSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Dados inválidos para atualizar carteira." },
        { status: 400 }
      );
    }
    if (parsed.data.name) {
      const updated = await renameWallet(parsed.data.id, parsed.data.name);
      if (!updated) {
        return NextResponse.json(
          { error: "Carteira não encontrada." },
          { status: 404 }
        );
      }
    }
    if (parsed.data.categoryTargets) {
      await updateCategoryTargets(
        parsed.data.id,
        parsed.data.categoryTargets as Partial<Record<AssetCategory, number>>
      );
    }
    const [wallets, categoryTargets] = await Promise.all([
      listWallets(),
      getCategoryTargets(parsed.data.id),
    ]);
    return NextResponse.json({ wallets, categoryTargets });
  } catch {
    return NextResponse.json(
      { error: "Erro ao atualizar carteira." },
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
  const deleted = await deleteWallet(Number(idRaw));
  if (!deleted) {
    return NextResponse.json(
      { error: "Não é possível remover a única carteira." },
      { status: 400 }
    );
  }
  return NextResponse.json({ ok: true, wallets: await listWallets() });
}
