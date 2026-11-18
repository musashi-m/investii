import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requirePinAuth } from "@/lib/auth/pin";
import { deleteAsset, updateAsset } from "@/lib/db";

export const dynamic = "force-dynamic";

const patchAssetSchema = z.object({
  rating: z.number().int().min(0).max(10).optional(),
  name: z.string().trim().min(1).max(120).optional(),
  rate: z.number().nonnegative().max(500).optional().nullable(),
  indexer: z.enum(["CDI", "IPCA", "PRE", "SELIC"]).optional().nullable(),
  maturityDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .nullable(),
  issuer: z.string().trim().max(80).optional().nullable(),
  irExempt: z.boolean().optional(),
  iofExempt: z.boolean().optional(),
});

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const denied = requirePinAuth(request);
  if (denied) return denied;

  try {
    const { id } = await context.params;
    if (!/^\d+$/.test(id)) {
      return NextResponse.json({ error: "ID de ativo inválido." }, { status: 400 });
    }
    const body = await request.json();
    const parsed = patchAssetSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Dados inválidos para atualizar ativo." },
        { status: 400 }
      );
    }

    const updated = await updateAsset(Number(id), parsed.data);
    if (!updated) {
      return NextResponse.json({ error: "Ativo não encontrado." }, { status: 404 });
    }
    return NextResponse.json({ asset: updated });
  } catch {
    return NextResponse.json({ error: "Erro ao atualizar ativo." }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const denied = requirePinAuth(request);
  if (denied) return denied;

  const { id } = await context.params;
  if (!/^\d+$/.test(id)) {
    return NextResponse.json({ error: "ID de ativo inválido." }, { status: 400 });
  }
  const ok = await deleteAsset(Number(id));
  if (!ok) {
    return NextResponse.json({ error: "Ativo não encontrado." }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
