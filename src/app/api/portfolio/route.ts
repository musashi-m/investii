import { NextRequest, NextResponse } from "next/server";
import { requirePinAuth } from "@/lib/auth/pin";
import {
  getCategoryTargets,
  getWalletById,
  listAssetsByWallet,
  listDividendsByWallet,
  listTransactionsByWallet,
  listWallets,
  updateAsset,
} from "@/lib/db";
import { buildPortfolioDashboard } from "@/lib/finance/calculator";
import { hydrateMarketDataForAssets } from "@/lib/market/providers";
import type { AssetCategory } from "@/types/portfolio";

export const dynamic = "force-dynamic";

const VALID_CATEGORIES = new Set<string>([
  "ALL",
  "ACOES",
  "FIIS",
  "RENDA_FIXA",
  "ETFS",
  "BDRS",
  "CRIPTOS",
  "STOCKS",
]);

export async function GET(request: NextRequest) {
  const denied = requirePinAuth(request);
  if (denied) return denied;

  try {
    const { searchParams } = new URL(request.url);
    const walletIdRaw = searchParams.get("walletId");
    const periodRaw = searchParams.get("periodMonths");
    const categoryRaw = (searchParams.get("category") ?? "ALL").toUpperCase();
    const forceRefresh = searchParams.get("refresh") === "true";

    const walletId =
      walletIdRaw && /^\d+$/.test(walletIdRaw) ? Number(walletIdRaw) : undefined;
    const periodMonths =
      periodRaw && /^\d+$/.test(periodRaw) ? Number(periodRaw) : 12;
    const categoryFilter = (
      VALID_CATEGORIES.has(categoryRaw) ? categoryRaw : "ALL"
    ) as AssetCategory | "ALL";

    const [wallet, wallets] = await Promise.all([
      getWalletById(walletId),
      listWallets(),
    ]);

    const [assets, transactions, dividends, categoryTargets] = await Promise.all([
      listAssetsByWallet(wallet.id),
      listTransactionsByWallet(wallet.id),
      listDividendsByWallet(wallet.id),
      getCategoryTargets(wallet.id),
    ]);

    const { quotes, histories, macro } = await hydrateMarketDataForAssets(
      assets,
      forceRefresh
    );

    // Enrich missing logoUrl from live quotes passively
    const logoUpdates: Array<Promise<unknown>> = [];
    for (const asset of assets) {
      const q = quotes[asset.ticker.toUpperCase()];
      if (q && q.logoUrl && !asset.logoUrl) {
        asset.logoUrl = q.logoUrl;
        logoUpdates.push(updateAsset(asset.id, { logoUrl: q.logoUrl }));
      }
    }
    if (logoUpdates.length > 0) {
      await Promise.all(logoUpdates);
    }

    const dashboard = buildPortfolioDashboard({
      wallet,
      wallets,
      assets,
      transactions,
      dividends,
      categoryTargets,
      quotes,
      histories,
      macro,
      periodMonths,
      categoryFilter,
    });

    return NextResponse.json(dashboard, { status: 200 });
  } catch (err) {
    console.error("GET /api/portfolio error:", err);
    return NextResponse.json(
      { error: "Erro ao carregar os dados da carteira." },
      { status: 500 }
    );
  }
}
