import * as pgDb from "./postgres";
import type {
  AppSettings,
  AssetCategory,
  AssetRecord,
  DividendRecord,
  DividendType,
  FixedIncomeIndexer,
  MacroRates,
  MonthlyPricePoint,
  QuoteData,
  TransactionRecord,
  TransactionType,
  Wallet,
} from "@/types/portfolio";
import type { UpsertAssetInput } from "./types";

export type { UpsertAssetInput };

/**
 * Automatically selects Netlify Database (managed Postgres via @netlify/database)
 * whenever running on Netlify (Production, Deploy Preview, or `netlify dev`),
 * and falls back seamlessly to local SQLite only for standalone `npm run dev` on localhost.
 */
function useNetlifyPostgres(): boolean {
  return Boolean(
    process.env.NETLIFY_DB_URL ||
      process.env.NETLIFY === "true" ||
      process.env.CONTEXT
  );
}

async function getDriver() {
  if (useNetlifyPostgres()) {
    return pgDb;
  }
  return await import("./sqlite");
}

export async function listWallets(): Promise<Wallet[]> {
  return (await getDriver()).listWallets();
}

export async function getWalletById(walletId?: number): Promise<Wallet> {
  return (await getDriver()).getWalletById(walletId);
}

export async function createWallet(name: string): Promise<Wallet> {
  return (await getDriver()).createWallet(name);
}

export async function renameWallet(id: number, name: string): Promise<Wallet | null> {
  return (await getDriver()).renameWallet(id, name);
}

export async function deleteWallet(id: number): Promise<boolean> {
  return (await getDriver()).deleteWallet(id);
}

export async function getCategoryTargets(
  walletId: number
): Promise<Record<AssetCategory, number>> {
  return (await getDriver()).getCategoryTargets(walletId);
}

export async function updateCategoryTargets(
  walletId: number,
  targets: Partial<Record<AssetCategory, number>>
): Promise<Record<AssetCategory, number>> {
  return (await getDriver()).updateCategoryTargets(walletId, targets);
}

export async function listAssetsByWallet(walletId: number): Promise<AssetRecord[]> {
  return (await getDriver()).listAssetsByWallet(walletId);
}

export async function getAssetById(assetId: number): Promise<AssetRecord | null> {
  return (await getDriver()).getAssetById(assetId);
}

export async function findOrCreateAsset(input: UpsertAssetInput): Promise<AssetRecord> {
  return (await getDriver()).findOrCreateAsset(input);
}

export async function updateAsset(
  assetId: number,
  patch: {
    rating?: number;
    name?: string;
    logoUrl?: string | null;
    rate?: number | null;
    indexer?: FixedIncomeIndexer | null;
    maturityDate?: string | null;
    issuer?: string | null;
    irExempt?: boolean;
    iofExempt?: boolean;
  }
): Promise<AssetRecord | null> {
  return (await getDriver()).updateAsset(assetId, patch);
}

export async function deleteAsset(assetId: number): Promise<boolean> {
  return (await getDriver()).deleteAsset(assetId);
}

export async function listTransactionsByWallet(
  walletId: number
): Promise<TransactionRecord[]> {
  return (await getDriver()).listTransactionsByWallet(walletId);
}

export async function createTransaction(input: {
  assetId: number;
  type: TransactionType;
  quantity: number;
  unitPrice: number;
  fees?: number;
  executedAt: string;
  notes?: string | null;
}): Promise<TransactionRecord> {
  return (await getDriver()).createTransaction(input);
}

export async function deleteTransaction(transactionId: number): Promise<boolean> {
  return (await getDriver()).deleteTransaction(transactionId);
}

export async function listDividendsByWallet(
  walletId: number
): Promise<DividendRecord[]> {
  return (await getDriver()).listDividendsByWallet(walletId);
}

export async function createDividend(input: {
  assetId: number;
  type: DividendType;
  amount: number;
  paidAt: string;
  notes?: string | null;
}): Promise<DividendRecord> {
  return (await getDriver()).createDividend(input);
}

export async function deleteDividend(dividendId: number): Promise<boolean> {
  return (await getDriver()).deleteDividend(dividendId);
}

export async function getCachedQuote(symbol: string): Promise<QuoteData | null> {
  return (await getDriver()).getCachedQuote(symbol);
}

export async function saveCachedQuote(quote: QuoteData): Promise<void> {
  return (await getDriver()).saveCachedQuote(quote);
}

export async function getCachedHistory(
  symbol: string
): Promise<{ points: MonthlyPricePoint[]; fetchedAt: string } | null> {
  return (await getDriver()).getCachedHistory(symbol);
}

export async function saveCachedHistory(
  symbol: string,
  points: MonthlyPricePoint[],
  fetchedAt: string
): Promise<void> {
  return (await getDriver()).saveCachedHistory(symbol, points, fetchedAt);
}

export async function getSettings(): Promise<AppSettings> {
  return (await getDriver()).getSettings();
}

export async function saveSettings(patch: Partial<AppSettings>): Promise<AppSettings> {
  return (await getDriver()).saveSettings(patch);
}

export async function getCachedMacro(): Promise<MacroRates | null> {
  return (await getDriver()).getCachedMacro();
}

export async function saveCachedMacro(macro: MacroRates): Promise<void> {
  return (await getDriver()).saveCachedMacro(macro);
}
