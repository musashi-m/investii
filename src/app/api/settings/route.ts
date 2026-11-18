import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requirePinAuth } from "@/lib/auth/pin";
import { getSettings, saveSettings } from "@/lib/db";

export const dynamic = "force-dynamic";

const settingsSchema = z.object({
  refreshIntervalSec: z.number().int().min(15).max(3600).optional(),
  brapiToken: z.string().max(200).optional(),
});

export async function GET(request: NextRequest) {
  const denied = requirePinAuth(request);
  if (denied) return denied;
  return NextResponse.json(await getSettings());
}

export async function PATCH(request: NextRequest) {
  const denied = requirePinAuth(request);
  if (denied) return denied;

  try {
    const body = await request.json();
    const parsed = settingsSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Configurações inválidas." },
        { status: 400 }
      );
    }
    const updated = await saveSettings(parsed.data);
    return NextResponse.json(updated);
  } catch {
    return NextResponse.json(
      { error: "Erro ao salvar configurações." },
      { status: 500 }
    );
  }
}
