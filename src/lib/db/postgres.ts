import { getDatabase } from "@netlify/database";
import {
  CATEGORY_LIST,
  type AppSettings,
  type AssetCategory,
  type AssetRecord,
  type DividendRecord,
  type DividendType,
  type FixedIncomeIndexer,
  type FixedIncomeType,
  type MacroRates,
  type MonthlyPricePoint,
  type QuoteData,
  type TransactionRecord,
  type TransactionType,
  type Wallet,
} from "@/types/portfolio";
import type { UpsertAssetInput } from "./types";

function getDbClient() {
  return getDatabase();
}

function mapAssetRow(row: Record<string, unknown>): AssetRecord {
  const fixedType = (row.fixed_income_type as FixedIncomeType | null) ?? null;
  const defaultExempt =
    fixedType === "LCI" || fixedType === "LCA" || fixedType === "CRI_CRA";
  return {
    id: Number(row.id),
    walletId: Number(row.wallet_id),
    ticker: String(row.ticker),
    name: String(row.name),
    category: row.category as AssetCategory,
    currency: (row.currency as "BRL" | "USD") || "BRL",
    logoUrl: row.logo_url ? String(row.logo_url) : null,
    rating: Number(row.rating ?? 10),
    fixedIncomeType: fixedType,
    indexer: (row.indexer as FixedIncomeIndexer | null) ?? null,
    rate: row.rate !== null && row.rate !== undefined ? Number(row.rate) : null,
    maturityDate: row.maturity_date ? String(row.maturity_date) : null,
    issuer: row.issuer ? String(row.issuer) : null,
    irExempt:
      row.ir_exempt !== undefined && row.ir_exempt !== null
        ? Boolean(row.ir_exempt)
        : defaultExempt,
    iofExempt:
      row.iof_exempt !== undefined && row.iof_exempt !== null
        ? Boolean(row.iof_exempt)
        : defaultExempt,
    createdAt: String(row.created_at),
  };
}

async function ensureDefaultWallet(): Promise<void> {
  const db = getDbClient();
  const rows = await db.sql<{ cnt: string | number }>`
    SELECT COUNT(*) AS cnt FROM wallets
  `;
  const count = Number(rows[0]?.cnt ?? 0);
  if (count === 0) {
    const inserted = await db.sql<{ id: number }>`
      INSERT INTO wallets (name) VALUES (${"Investimentos"}) RETURNING id
    `;
    const walletId = Number(inserted[0].id);
    for (const cat of CATEGORY_LIST) {
      await db.sql`
        INSERT INTO category_targets (wallet_id, category, target_pct)
        VALUES (${walletId}, ${cat.id}, ${cat.defaultTargetPct})
        ON CONFLICT (wallet_id, category) DO NOTHING
      `;
    }
  }
}

export async function listWallets(): Promise<Wallet[]> {
  await ensureDefaultWallet();
  const db = getDbClient();
  const rows = await db.sql<{ id: number; name: string; created_at: string }>`
    SELECT id, name, created_at FROM wallets ORDER BY id ASC
  `;
  return rows.map((r) => ({
    id: Number(r.id),
    name: String(r.name),
    createdAt: String(r.created_at),
  }));
}

export async function getWalletById(walletId?: number): Promise<Wallet> {
  await ensureDefaultWallet();
  const db = getDbClient();
  if (walletId) {
    const rows = await db.sql<{ id: number; name: string; created_at: string }>`
      SELECT id, name, created_at FROM wallets WHERE id = ${walletId} LIMIT 1
    `;
    if (rows[0]) {
      return {
        id: Number(rows[0].id),
        name: String(rows[0].name),
        createdAt: String(rows[0].created_at),
      };
    }
  }
  const first = await db.sql<{ id: number; name: string; created_at: string }>`
    SELECT id, name, created_at FROM wallets ORDER BY id ASC LIMIT 1
  `;
  return {
    id: Number(first[0].id),
    name: String(first[0].name),
    createdAt: String(first[0].created_at),
  };
}

export async function createWallet(name: string): Promise<Wallet> {
  const db = getDbClient();
  const inserted = await db.sql<{ id: number }>`
    INSERT INTO wallets (name) VALUES (${name.trim()}) RETURNING id
  `;
  const id = Number(inserted[0].id);
  for (const cat of CATEGORY_LIST) {
    await db.sql`
      INSERT INTO category_targets (wallet_id, category, target_pct)
      VALUES (${id}, ${cat.id}, ${cat.defaultTargetPct})
      ON CONFLICT (wallet_id, category) DO NOTHING
    `;
  }
  return getWalletById(id);
}

export async function renameWallet(id: number, name: string): Promise<Wallet | null> {
  const db = getDbClient();
  const rows = await db.sql<{ id: number }>`
    UPDATE wallets SET name = ${name.trim()} WHERE id = ${id} RETURNING id
  `;
  if (!rows[0]) return null;
  return getWalletById(id);
}

export async function deleteWallet(id: number): Promise<boolean> {
  const db = getDbClient();
  const cntRows = await db.sql<{ cnt: string | number }>`
    SELECT COUNT(*) AS cnt FROM wallets
  `;
  if (Number(cntRows[0]?.cnt ?? 0) <= 1) return false;
  const deleted = await db.sql<{ id: number }>`
    DELETE FROM wallets WHERE id = ${id} RETURNING id
  `;
  return deleted.length > 0;
}

export async function getCategoryTargets(
  walletId: number
): Promise<Record<AssetCategory, number>> {
  const db = getDbClient();
  const rows = await db.sql<{ category: AssetCategory; target_pct: number }>`
    SELECT category, target_pct FROM category_targets WHERE wallet_id = ${walletId}
  `;
  const result = {} as Record<AssetCategory, number>;
  for (const cat of CATEGORY_LIST) {
    result[cat.id] = cat.defaultTargetPct;
  }
  for (const row of rows) {
    result[row.category] = Number(row.target_pct);
  }
  return result;
}

export async function updateCategoryTargets(
  walletId: number,
  targets: Partial<Record<AssetCategory, number>>
): Promise<Record<AssetCategory, number>> {
  const db = getDbClient();
  for (const [category, pct] of Object.entries(targets)) {
    if (typeof pct === "number" && Number.isFinite(pct) && pct >= 0 && pct <= 100) {
      await db.sql`
        INSERT INTO category_targets (wallet_id, category, target_pct)
        VALUES (${walletId}, ${category}, ${pct})
        ON CONFLICT (wallet_id, category)
        DO UPDATE SET target_pct = EXCLUDED.target_pct
      `;
    }
  }
  return getCategoryTargets(walletId);
}

export async function listAssetsByWallet(walletId: number): Promise<AssetRecord[]> {
  const db = getDbClient();
  const rows = await db.sql<Record<string, unknown>>`
    SELECT * FROM assets WHERE wallet_id = ${walletId} ORDER BY id ASC
  `;
  return rows.map(mapAssetRow);
}

export async function getAssetById(assetId: number): Promise<AssetRecord | null> {
  const db = getDbClient();
  const rows = await db.sql<Record<string, unknown>>`
    SELECT * FROM assets WHERE id = ${assetId} LIMIT 1
  `;
  return rows[0] ? mapAssetRow(rows[0]) : null;
}

export async function findOrCreateAsset(input: UpsertAssetInput): Promise<AssetRecord> {
  const db = getDbClient();
  const normalizedTicker = input.ticker.trim().toUpperCase();

  const existing = await db.sql<Record<string, unknown>>`
    SELECT * FROM assets
    WHERE wallet_id = ${input.walletId}
      AND ticker = ${normalizedTicker}
      AND category = ${input.category}
    LIMIT 1
  `;

  if (existing[0]) {
    if (input.logoUrl && !existing[0].logo_url) {
      await db.sql`
        UPDATE assets SET logo_url = ${input.logoUrl} WHERE id = ${Number(existing[0].id)}
      `;
      existing[0].logo_url = input.logoUrl;
    }
    return mapAssetRow(existing[0]);
  }

  const defaultExempt =
    input.fixedIncomeType === "LCI" ||
    input.fixedIncomeType === "LCA" ||
    input.fixedIncomeType === "CRI_CRA";

  const inserted = await db.sql<Record<string, unknown>>`
    INSERT INTO assets (
      wallet_id, ticker, name, category, currency, logo_url, rating,
      fixed_income_type, indexer, rate, maturity_date, issuer, ir_exempt, iof_exempt
    ) VALUES (
      ${input.walletId},
      ${normalizedTicker},
      ${input.name.trim() || normalizedTicker},
      ${input.category},
      ${input.currency ?? "BRL"},
      ${input.logoUrl ?? null},
      ${input.rating ?? 10},
      ${input.fixedIncomeType ?? null},
      ${input.indexer ?? null},
      ${input.rate ?? null},
      ${input.maturityDate ?? null},
      ${input.issuer ?? null},
      ${input.irExempt ?? defaultExempt},
      ${input.iofExempt ?? defaultExempt}
    )
    RETURNING *
  `;

  return mapAssetRow(inserted[0]);
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
  const existing = await getAssetById(assetId);
  if (!existing) return null;

  const db = getDbClient();
  const rows = await db.sql<Record<string, unknown>>`
    UPDATE assets
    SET
      rating = ${patch.rating !== undefined ? patch.rating : existing.rating},
      name = ${patch.name !== undefined ? patch.name : existing.name},
      logo_url = ${patch.logoUrl !== undefined ? patch.logoUrl : existing.logoUrl},
      rate = ${patch.rate !== undefined ? patch.rate : existing.rate},
      indexer = ${patch.indexer !== undefined ? patch.indexer : existing.indexer},
      maturity_date = ${patch.maturityDate !== undefined ? patch.maturityDate : existing.maturityDate},
      issuer = ${patch.issuer !== undefined ? patch.issuer : existing.issuer},
      ir_exempt = ${patch.irExempt !== undefined ? patch.irExempt : existing.irExempt},
      iof_exempt = ${patch.iofExempt !== undefined ? patch.iofExempt : existing.iofExempt}
    WHERE id = ${assetId}
    RETURNING *
  `;
  return rows[0] ? mapAssetRow(rows[0]) : null;
}

export async function deleteAsset(assetId: number): Promise<boolean> {
  const db = getDbClient();
  const rows = await db.sql<{ id: number }>`
    DELETE FROM assets WHERE id = ${assetId} RETURNING id
  `;
  return rows.length > 0;
}

export async function listTransactionsByWallet(
  walletId: number
): Promise<TransactionRecord[]> {
  const db = getDbClient();
  const rows = await db.sql<Record<string, unknown>>`
    SELECT t.*
    FROM transactions t
    INNER JOIN assets a ON a.id = t.asset_id
    WHERE a.wallet_id = ${walletId}
    ORDER BY t.executed_at ASC, t.id ASC
  `;
  return rows.map((r) => ({
    id: Number(r.id),
    assetId: Number(r.asset_id),
    type: r.type as TransactionType,
    quantity: Number(r.quantity),
    unitPrice: Number(r.unit_price),
    fees: Number(r.fees ?? 0),
    executedAt: String(r.executed_at),
    notes: r.notes ? String(r.notes) : null,
    createdAt: String(r.created_at),
  }));
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
  const db = getDbClient();
  const rows = await db.sql<Record<string, unknown>>`
    INSERT INTO transactions (asset_id, type, quantity, unit_price, fees, executed_at, notes)
    VALUES (
      ${input.assetId},
      ${input.type},
      ${input.quantity},
      ${input.unitPrice},
      ${input.fees ?? 0},
      ${input.executedAt},
      ${input.notes ?? null}
    )
    RETURNING *
  `;
  const r = rows[0];
  return {
    id: Number(r.id),
    assetId: Number(r.asset_id),
    type: r.type as TransactionType,
    quantity: Number(r.quantity),
    unitPrice: Number(r.unit_price),
    fees: Number(r.fees ?? 0),
    executedAt: String(r.executed_at),
    notes: r.notes ? String(r.notes) : null,
    createdAt: String(r.created_at),
  };
}

export async function deleteTransaction(transactionId: number): Promise<boolean> {
  const db = getDbClient();
  const existing = await db.sql<{ asset_id: number }>`
    SELECT asset_id FROM transactions WHERE id = ${transactionId} LIMIT 1
  `;
  if (!existing[0]) return false;
  const assetId = Number(existing[0].asset_id);

  const deleted = await db.sql<{ id: number }>`
    DELETE FROM transactions WHERE id = ${transactionId} RETURNING id
  `;

  const remTx = await db.sql<{ cnt: string | number }>`
    SELECT COUNT(*) AS cnt FROM transactions WHERE asset_id = ${assetId}
  `;
  const remDiv = await db.sql<{ cnt: string | number }>`
    SELECT COUNT(*) AS cnt FROM dividends WHERE asset_id = ${assetId}
  `;
  if (Number(remTx[0]?.cnt ?? 0) === 0 && Number(remDiv[0]?.cnt ?? 0) === 0) {
    await db.sql`DELETE FROM assets WHERE id = ${assetId}`;
  }
  return deleted.length > 0;
}

export async function listDividendsByWallet(
  walletId: number
): Promise<DividendRecord[]> {
  const db = getDbClient();
  const rows = await db.sql<Record<string, unknown>>`
    SELECT d.*
    FROM dividends d
    INNER JOIN assets a ON a.id = d.asset_id
    WHERE a.wallet_id = ${walletId}
    ORDER BY d.paid_at DESC, d.id DESC
  `;
  return rows.map((r) => ({
    id: Number(r.id),
    assetId: Number(r.asset_id),
    type: r.type as DividendType,
    amount: Number(r.amount),
    paidAt: String(r.paid_at),
    notes: r.notes ? String(r.notes) : null,
    createdAt: String(r.created_at),
  }));
}

export async function createDividend(input: {
  assetId: number;
  type: DividendType;
  amount: number;
  paidAt: string;
  notes?: string | null;
}): Promise<DividendRecord> {
  const db = getDbClient();
  const rows = await db.sql<Record<string, unknown>>`
    INSERT INTO dividends (asset_id, type, amount, paid_at, notes)
    VALUES (${input.assetId}, ${input.type}, ${input.amount}, ${input.paidAt}, ${input.notes ?? null})
    RETURNING *
  `;
  const r = rows[0];
  return {
    id: Number(r.id),
    assetId: Number(r.asset_id),
    type: r.type as DividendType,
    amount: Number(r.amount),
    paidAt: String(r.paid_at),
    notes: r.notes ? String(r.notes) : null,
    createdAt: String(r.created_at),
  };
}

export async function deleteDividend(dividendId: number): Promise<boolean> {
  const db = getDbClient();
  const rows = await db.sql<{ id: number }>`
    DELETE FROM dividends WHERE id = ${dividendId} RETURNING id
  `;
  return rows.length > 0;
}

export async function getCachedQuote(symbol: string): Promise<QuoteData | null> {
  const db = getDbClient();
  const rows = await db.sql<Record<string, unknown>>`
    SELECT * FROM quote_cache WHERE symbol = ${symbol.toUpperCase()} LIMIT 1
  `;
  const row = rows[0];
  if (!row) return null;
  return {
    symbol: String(row.symbol),
    price: Number(row.price),
    previousClose:
      row.previous_close !== null && row.previous_close !== undefined
        ? Number(row.previous_close)
        : null,
    changePct:
      row.change_pct !== null && row.change_pct !== undefined
        ? Number(row.change_pct)
        : null,
    currency: (row.currency as "BRL" | "USD") || "BRL",
    name: row.name ? String(row.name) : null,
    logoUrl: row.logo_url ? String(row.logo_url) : null,
    source: String(row.source),
    fetchedAt: String(row.fetched_at),
  };
}

export async function saveCachedQuote(quote: QuoteData): Promise<void> {
  const db = getDbClient();
  await db.sql`
    INSERT INTO quote_cache (symbol, price, previous_close, change_pct, currency, name, logo_url, source, fetched_at)
    VALUES (
      ${quote.symbol.toUpperCase()},
      ${quote.price},
      ${quote.previousClose},
      ${quote.changePct},
      ${quote.currency},
      ${quote.name},
      ${quote.logoUrl},
      ${quote.source},
      ${quote.fetchedAt}
    )
    ON CONFLICT (symbol) DO UPDATE SET
      price = EXCLUDED.price,
      previous_close = EXCLUDED.previous_close,
      change_pct = EXCLUDED.change_pct,
      currency = EXCLUDED.currency,
      name = COALESCE(EXCLUDED.name, quote_cache.name),
      logo_url = COALESCE(EXCLUDED.logo_url, quote_cache.logo_url),
      source = EXCLUDED.source,
      fetched_at = EXCLUDED.fetched_at
  `;
}

export async function getCachedHistory(
  symbol: string
): Promise<{ points: MonthlyPricePoint[]; fetchedAt: string } | null> {
  const db = getDbClient();
  const rows = await db.sql<{ points_json: string; fetched_at: string }>`
    SELECT points_json, fetched_at FROM history_cache WHERE symbol = ${symbol.toUpperCase()} LIMIT 1
  `;
  const row = rows[0];
  if (!row) return null;
  try {
    return {
      points: JSON.parse(row.points_json) as MonthlyPricePoint[],
      fetchedAt: String(row.fetched_at),
    };
  } catch {
    return null;
  }
}

export async function saveCachedHistory(
  symbol: string,
  points: MonthlyPricePoint[],
  fetchedAt: string
): Promise<void> {
  const db = getDbClient();
  await db.sql`
    INSERT INTO history_cache (symbol, points_json, fetched_at)
    VALUES (${symbol.toUpperCase()}, ${JSON.stringify(points)}, ${fetchedAt})
    ON CONFLICT (symbol) DO UPDATE SET
      points_json = EXCLUDED.points_json,
      fetched_at = EXCLUDED.fetched_at
  `;
}

export async function getSettings(): Promise<AppSettings> {
  const db = getDbClient();
  const rows = await db.sql<{ key: string; value: string }>`
    SELECT key, value FROM app_settings
  `;
  const map = new Map(rows.map((r) => [r.key, r.value]));
  const refreshIntervalSec = Number(map.get("refreshIntervalSec") ?? "60");
  return {
    refreshIntervalSec:
      Number.isFinite(refreshIntervalSec) && refreshIntervalSec >= 15
        ? refreshIntervalSec
        : 60,
    brapiToken: map.get("brapiToken") ?? "",
  };
}

export async function saveSettings(patch: Partial<AppSettings>): Promise<AppSettings> {
  const db = getDbClient();
  if (
    patch.refreshIntervalSec !== undefined &&
    Number.isFinite(patch.refreshIntervalSec)
  ) {
    const clamped = String(
      Math.max(15, Math.min(3600, Math.round(patch.refreshIntervalSec)))
    );
    await db.sql`
      INSERT INTO app_settings (key, value) VALUES (${"refreshIntervalSec"}, ${clamped})
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
    `;
  }
  if (patch.brapiToken !== undefined) {
    await db.sql`
      INSERT INTO app_settings (key, value) VALUES (${"brapiToken"}, ${patch.brapiToken.trim()})
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
    `;
  }
  return getSettings();
}

export async function getCachedMacro(): Promise<MacroRates | null> {
  const db = getDbClient();
  const rows = await db.sql<{ value: string }>`
    SELECT value FROM app_settings WHERE key = ${"macroCache"} LIMIT 1
  `;
  if (!rows[0]) return null;
  try {
    return JSON.parse(rows[0].value) as MacroRates;
  } catch {
    return null;
  }
}

export async function saveCachedMacro(macro: MacroRates): Promise<void> {
  const db = getDbClient();
  await db.sql`
    INSERT INTO app_settings (key, value) VALUES (${"macroCache"}, ${JSON.stringify(macro)})
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
  `;
}

