import fs from "node:fs";
import path from "node:path";
import type { DatabaseSync } from "node:sqlite";
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

const DB_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DB_DIR, "investidor.db");

declare global {
  var __investidorSqliteDb: DatabaseSync | undefined;
}

function initSchema(db: DatabaseSync) {
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS wallets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS category_targets (
      wallet_id INTEGER NOT NULL,
      category TEXT NOT NULL,
      target_pct REAL NOT NULL,
      PRIMARY KEY (wallet_id, category),
      FOREIGN KEY (wallet_id) REFERENCES wallets(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS assets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      wallet_id INTEGER NOT NULL,
      ticker TEXT NOT NULL,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      currency TEXT NOT NULL DEFAULT 'BRL',
      logo_url TEXT,
      rating INTEGER NOT NULL DEFAULT 10,
      fixed_income_type TEXT,
      indexer TEXT,
      rate REAL,
      maturity_date TEXT,
      issuer TEXT,
      ir_exempt INTEGER NOT NULL DEFAULT 0,
      iof_exempt INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE (wallet_id, ticker, category),
      FOREIGN KEY (wallet_id) REFERENCES wallets(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_assets_wallet ON assets(wallet_id);

    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      asset_id INTEGER NOT NULL,
      type TEXT NOT NULL CHECK (type IN ('BUY', 'SELL')),
      quantity REAL NOT NULL CHECK (quantity > 0),
      unit_price REAL NOT NULL CHECK (unit_price >= 0),
      fees REAL NOT NULL DEFAULT 0 CHECK (fees >= 0),
      executed_at TEXT NOT NULL,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_transactions_asset ON transactions(asset_id, executed_at);

    CREATE TABLE IF NOT EXISTS dividends (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      asset_id INTEGER NOT NULL,
      type TEXT NOT NULL CHECK (type IN ('DIVIDEND', 'JCP', 'YIELD', 'INTEREST')),
      amount REAL NOT NULL CHECK (amount > 0),
      paid_at TEXT NOT NULL,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_dividends_asset ON dividends(asset_id, paid_at);

    CREATE TABLE IF NOT EXISTS quote_cache (
      symbol TEXT PRIMARY KEY,
      price REAL NOT NULL,
      previous_close REAL,
      change_pct REAL,
      currency TEXT NOT NULL DEFAULT 'BRL',
      name TEXT,
      logo_url TEXT,
      source TEXT NOT NULL,
      fetched_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS history_cache (
      symbol TEXT PRIMARY KEY,
      points_json TEXT NOT NULL,
      fetched_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  const assetCols = db.prepare("PRAGMA table_info(assets)").all() as Array<{
    name: string;
  }>;
  const colNames = new Set(assetCols.map((c) => c.name));
  if (!colNames.has("ir_exempt")) {
    db.exec("ALTER TABLE assets ADD COLUMN ir_exempt INTEGER NOT NULL DEFAULT 0");
  }
  if (!colNames.has("iof_exempt")) {
    db.exec("ALTER TABLE assets ADD COLUMN iof_exempt INTEGER NOT NULL DEFAULT 0");
  }

  const countRow = db.prepare("SELECT COUNT(*) as cnt FROM wallets").get() as {
    cnt: number;
  };
  if (countRow.cnt === 0) {
    const res = db
      .prepare("INSERT INTO wallets (name) VALUES (?)")
      .run("Investimentos");
    const walletId = Number(res.lastInsertRowid);
    const insertTarget = db.prepare(
      "INSERT OR IGNORE INTO category_targets (wallet_id, category, target_pct) VALUES (?, ?, ?)"
    );
    for (const cat of CATEGORY_LIST) {
      insertTarget.run(walletId, cat.id, cat.defaultTargetPct);
    }
  }

  db.prepare(
    "INSERT OR IGNORE INTO app_settings (key, value) VALUES ('refreshIntervalSec', '60')"
  ).run();
  db.prepare(
    "INSERT OR IGNORE INTO app_settings (key, value) VALUES ('brapiToken', '')"
  ).run();
}

async function getDb(): Promise<DatabaseSync> {
  if (!global.__investidorSqliteDb) {
    if (!fs.existsSync(DB_DIR)) {
      fs.mkdirSync(DB_DIR, { recursive: true });
    }
    const { DatabaseSync } = await import("node:sqlite");
    const db = new DatabaseSync(DB_PATH);
    initSchema(db);
    global.__investidorSqliteDb = db;
  }
  return global.__investidorSqliteDb;
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
        ? Boolean(Number(row.ir_exempt))
        : defaultExempt,
    iofExempt:
      row.iof_exempt !== undefined && row.iof_exempt !== null
        ? Boolean(Number(row.iof_exempt))
        : defaultExempt,
    createdAt: String(row.created_at),
  };
}

export async function listWallets(): Promise<Wallet[]> {
  const db = await getDb();
  const rows = db
    .prepare("SELECT id, name, created_at FROM wallets ORDER BY id ASC")
    .all() as Array<{ id: number; name: string; created_at: string }>;
  return rows.map((r) => ({ id: r.id, name: r.name, createdAt: r.created_at }));
}

export async function getWalletById(walletId?: number): Promise<Wallet> {
  const db = await getDb();
  if (walletId) {
    const row = db
      .prepare("SELECT id, name, created_at FROM wallets WHERE id = ?")
      .get(walletId) as { id: number; name: string; created_at: string } | undefined;
    if (row) return { id: row.id, name: row.name, createdAt: row.created_at };
  }
  const first = db
    .prepare("SELECT id, name, created_at FROM wallets ORDER BY id ASC LIMIT 1")
    .get() as { id: number; name: string; created_at: string };
  return { id: first.id, name: first.name, createdAt: first.created_at };
}

export async function createWallet(name: string): Promise<Wallet> {
  const db = await getDb();
  const res = db.prepare("INSERT INTO wallets (name) VALUES (?)").run(name.trim());
  const id = Number(res.lastInsertRowid);
  const insertTarget = db.prepare(
    "INSERT OR IGNORE INTO category_targets (wallet_id, category, target_pct) VALUES (?, ?, ?)"
  );
  for (const cat of CATEGORY_LIST) {
    insertTarget.run(id, cat.id, cat.defaultTargetPct);
  }
  return getWalletById(id);
}

export async function renameWallet(id: number, name: string): Promise<Wallet | null> {
  const db = await getDb();
  const res = db
    .prepare("UPDATE wallets SET name = ? WHERE id = ?")
    .run(name.trim(), id);
  if (res.changes === 0) return null;
  return getWalletById(id);
}

export async function deleteWallet(id: number): Promise<boolean> {
  const db = await getDb();
  const count = db.prepare("SELECT COUNT(*) as cnt FROM wallets").get() as {
    cnt: number;
  };
  if (count.cnt <= 1) return false;
  const res = db.prepare("DELETE FROM wallets WHERE id = ?").run(id);
  return res.changes > 0;
}

export async function getCategoryTargets(
  walletId: number
): Promise<Record<AssetCategory, number>> {
  const db = await getDb();
  const rows = db
    .prepare("SELECT category, target_pct FROM category_targets WHERE wallet_id = ?")
    .all(walletId) as Array<{ category: AssetCategory; target_pct: number }>;

  const result = {} as Record<AssetCategory, number>;
  for (const cat of CATEGORY_LIST) {
    result[cat.id] = cat.defaultTargetPct;
  }
  for (const row of rows) {
    result[row.category] = row.target_pct;
  }
  return result;
}

export async function updateCategoryTargets(
  walletId: number,
  targets: Partial<Record<AssetCategory, number>>
): Promise<Record<AssetCategory, number>> {
  const db = await getDb();
  const stmt = db.prepare(`
    INSERT INTO category_targets (wallet_id, category, target_pct)
    VALUES (?, ?, ?)
    ON CONFLICT(wallet_id, category) DO UPDATE SET target_pct = excluded.target_pct
  `);
  for (const [category, pct] of Object.entries(targets)) {
    if (typeof pct === "number" && Number.isFinite(pct) && pct >= 0 && pct <= 100) {
      stmt.run(walletId, category, pct);
    }
  }
  return getCategoryTargets(walletId);
}

export async function listAssetsByWallet(walletId: number): Promise<AssetRecord[]> {
  const db = await getDb();
  const rows = db
    .prepare("SELECT * FROM assets WHERE wallet_id = ? ORDER BY id ASC")
    .all(walletId) as Array<Record<string, unknown>>;
  return rows.map(mapAssetRow);
}

export async function getAssetById(assetId: number): Promise<AssetRecord | null> {
  const db = await getDb();
  const row = db
    .prepare("SELECT * FROM assets WHERE id = ?")
    .get(assetId) as Record<string, unknown> | undefined;
  return row ? mapAssetRow(row) : null;
}

export async function findOrCreateAsset(input: UpsertAssetInput): Promise<AssetRecord> {
  const db = await getDb();
  const normalizedTicker = input.ticker.trim().toUpperCase();

  const existing = db
    .prepare(
      "SELECT * FROM assets WHERE wallet_id = ? AND ticker = ? AND category = ?"
    )
    .get(input.walletId, normalizedTicker, input.category) as
    | Record<string, unknown>
    | undefined;

  if (existing) {
    if (input.logoUrl && !existing.logo_url) {
      db.prepare("UPDATE assets SET logo_url = ? WHERE id = ?").run(
        input.logoUrl,
        Number(existing.id)
      );
      existing.logo_url = input.logoUrl;
    }
    return mapAssetRow(existing);
  }

  const defaultExempt =
    input.fixedIncomeType === "LCI" ||
    input.fixedIncomeType === "LCA" ||
    input.fixedIncomeType === "CRI_CRA";

  const res = db
    .prepare(
      `INSERT INTO assets (
        wallet_id, ticker, name, category, currency, logo_url, rating,
        fixed_income_type, indexer, rate, maturity_date, issuer, ir_exempt, iof_exempt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      input.walletId,
      normalizedTicker,
      input.name.trim() || normalizedTicker,
      input.category,
      input.currency ?? "BRL",
      input.logoUrl ?? null,
      input.rating ?? 10,
      input.fixedIncomeType ?? null,
      input.indexer ?? null,
      input.rate ?? null,
      input.maturityDate ?? null,
      input.issuer ?? null,
      (input.irExempt ?? defaultExempt) ? 1 : 0,
      (input.iofExempt ?? defaultExempt) ? 1 : 0
    );

  return (await getAssetById(Number(res.lastInsertRowid)))!;
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
  const db = await getDb();
  const existing = await getAssetById(assetId);
  if (!existing) return null;

  db.prepare(
    `UPDATE assets
     SET rating = ?, name = ?, logo_url = ?, rate = ?, indexer = ?, maturity_date = ?, issuer = ?, ir_exempt = ?, iof_exempt = ?
     WHERE id = ?`
  ).run(
    patch.rating !== undefined ? patch.rating : existing.rating,
    patch.name !== undefined ? patch.name : existing.name,
    patch.logoUrl !== undefined ? patch.logoUrl : existing.logoUrl,
    patch.rate !== undefined ? patch.rate : existing.rate,
    patch.indexer !== undefined ? patch.indexer : existing.indexer,
    patch.maturityDate !== undefined ? patch.maturityDate : existing.maturityDate,
    patch.issuer !== undefined ? patch.issuer : existing.issuer,
    (patch.irExempt !== undefined ? patch.irExempt : existing.irExempt) ? 1 : 0,
    (patch.iofExempt !== undefined ? patch.iofExempt : existing.iofExempt) ? 1 : 0,
    assetId
  );

  return getAssetById(assetId);
}

export async function deleteAsset(assetId: number): Promise<boolean> {
  const db = await getDb();
  const res = db.prepare("DELETE FROM assets WHERE id = ?").run(assetId);
  return res.changes > 0;
}

export async function listTransactionsByWallet(
  walletId: number
): Promise<TransactionRecord[]> {
  const db = await getDb();
  const rows = db
    .prepare(
      `SELECT t.*
       FROM transactions t
       INNER JOIN assets a ON a.id = t.asset_id
       WHERE a.wallet_id = ?
       ORDER BY t.executed_at ASC, t.id ASC`
    )
    .all(walletId) as Array<Record<string, unknown>>;

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
  const db = await getDb();
  const res = db
    .prepare(
      `INSERT INTO transactions (asset_id, type, quantity, unit_price, fees, executed_at, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      input.assetId,
      input.type,
      input.quantity,
      input.unitPrice,
      input.fees ?? 0,
      input.executedAt,
      input.notes ?? null
    );

  const row = db
    .prepare("SELECT * FROM transactions WHERE id = ?")
    .get(Number(res.lastInsertRowid)) as Record<string, unknown>;

  return {
    id: Number(row.id),
    assetId: Number(row.asset_id),
    type: row.type as TransactionType,
    quantity: Number(row.quantity),
    unitPrice: Number(row.unit_price),
    fees: Number(row.fees ?? 0),
    executedAt: String(row.executed_at),
    notes: row.notes ? String(row.notes) : null,
    createdAt: String(row.created_at),
  };
}

export async function deleteTransaction(transactionId: number): Promise<boolean> {
  const db = await getDb();
  const tx = db
    .prepare("SELECT asset_id FROM transactions WHERE id = ?")
    .get(transactionId) as { asset_id: number } | undefined;
  if (!tx) return false;

  const res = db
    .prepare("DELETE FROM transactions WHERE id = ?")
    .run(transactionId);

  const remainingTx = db
    .prepare("SELECT COUNT(*) as cnt FROM transactions WHERE asset_id = ?")
    .get(tx.asset_id) as { cnt: number };
  const remainingDiv = db
    .prepare("SELECT COUNT(*) as cnt FROM dividends WHERE asset_id = ?")
    .get(tx.asset_id) as { cnt: number };
  if (remainingTx.cnt === 0 && remainingDiv.cnt === 0) {
    db.prepare("DELETE FROM assets WHERE id = ?").run(tx.asset_id);
  }

  return res.changes > 0;
}

export async function listDividendsByWallet(
  walletId: number
): Promise<DividendRecord[]> {
  const db = await getDb();
  const rows = db
    .prepare(
      `SELECT d.*
       FROM dividends d
       INNER JOIN assets a ON a.id = d.asset_id
       WHERE a.wallet_id = ?
       ORDER BY d.paid_at DESC, d.id DESC`
    )
    .all(walletId) as Array<Record<string, unknown>>;

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
  const db = await getDb();
  const res = db
    .prepare(
      `INSERT INTO dividends (asset_id, type, amount, paid_at, notes)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(input.assetId, input.type, input.amount, input.paidAt, input.notes ?? null);

  const row = db
    .prepare("SELECT * FROM dividends WHERE id = ?")
    .get(Number(res.lastInsertRowid)) as Record<string, unknown>;

  return {
    id: Number(row.id),
    assetId: Number(row.asset_id),
    type: row.type as DividendType,
    amount: Number(row.amount),
    paidAt: String(row.paid_at),
    notes: row.notes ? String(row.notes) : null,
    createdAt: String(row.created_at),
  };
}

export async function deleteDividend(dividendId: number): Promise<boolean> {
  const db = await getDb();
  const res = db.prepare("DELETE FROM dividends WHERE id = ?").run(dividendId);
  return res.changes > 0;
}

export async function getCachedQuote(symbol: string): Promise<QuoteData | null> {
  const db = await getDb();
  const row = db
    .prepare("SELECT * FROM quote_cache WHERE symbol = ?")
    .get(symbol.toUpperCase()) as Record<string, unknown> | undefined;
  if (!row) return null;
  return {
    symbol: String(row.symbol),
    price: Number(row.price),
    previousClose:
      row.previous_close !== null ? Number(row.previous_close) : null,
    changePct: row.change_pct !== null ? Number(row.change_pct) : null,
    currency: (row.currency as "BRL" | "USD") || "BRL",
    name: row.name ? String(row.name) : null,
    logoUrl: row.logo_url ? String(row.logo_url) : null,
    source: String(row.source),
    fetchedAt: String(row.fetched_at),
  };
}

export async function saveCachedQuote(quote: QuoteData): Promise<void> {
  const db = await getDb();
  db.prepare(
    `INSERT INTO quote_cache (symbol, price, previous_close, change_pct, currency, name, logo_url, source, fetched_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(symbol) DO UPDATE SET
       price = excluded.price,
       previous_close = excluded.previous_close,
       change_pct = excluded.change_pct,
       currency = excluded.currency,
       name = COALESCE(excluded.name, quote_cache.name),
       logo_url = COALESCE(excluded.logo_url, quote_cache.logo_url),
       source = excluded.source,
       fetched_at = excluded.fetched_at`
  ).run(
    quote.symbol.toUpperCase(),
    quote.price,
    quote.previousClose,
    quote.changePct,
    quote.currency,
    quote.name,
    quote.logoUrl,
    quote.source,
    quote.fetchedAt
  );
}

export async function getCachedHistory(
  symbol: string
): Promise<{ points: MonthlyPricePoint[]; fetchedAt: string } | null> {
  const db = await getDb();
  const row = db
    .prepare("SELECT points_json, fetched_at FROM history_cache WHERE symbol = ?")
    .get(symbol.toUpperCase()) as
    | { points_json: string; fetched_at: string }
    | undefined;
  if (!row) return null;
  try {
    return {
      points: JSON.parse(row.points_json) as MonthlyPricePoint[],
      fetchedAt: row.fetched_at,
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
  const db = await getDb();
  db.prepare(
    `INSERT INTO history_cache (symbol, points_json, fetched_at)
     VALUES (?, ?, ?)
     ON CONFLICT(symbol) DO UPDATE SET
       points_json = excluded.points_json,
       fetched_at = excluded.fetched_at`
  ).run(symbol.toUpperCase(), JSON.stringify(points), fetchedAt);
}

export async function getSettings(): Promise<AppSettings> {
  const db = await getDb();
  const rows = db.prepare("SELECT key, value FROM app_settings").all() as Array<{
    key: string;
    value: string;
  }>;
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
  const db = await getDb();
  const upsert = db.prepare(
    `INSERT INTO app_settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`
  );
  if (
    patch.refreshIntervalSec !== undefined &&
    Number.isFinite(patch.refreshIntervalSec)
  ) {
    upsert.run(
      "refreshIntervalSec",
      String(Math.max(15, Math.min(3600, Math.round(patch.refreshIntervalSec))))
    );
  }
  if (patch.brapiToken !== undefined) {
    upsert.run("brapiToken", patch.brapiToken.trim());
  }
  return getSettings();
}

export async function getCachedMacro(): Promise<MacroRates | null> {
  const db = await getDb();
  const row = db
    .prepare("SELECT value FROM app_settings WHERE key = 'macroCache'")
    .get() as { value: string } | undefined;
  if (!row) return null;
  try {
    return JSON.parse(row.value) as MacroRates;
  } catch {
    return null;
  }
}

export async function saveCachedMacro(macro: MacroRates): Promise<void> {
  const db = await getDb();
  db.prepare(
    `INSERT INTO app_settings (key, value) VALUES ('macroCache', ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`
  ).run(JSON.stringify(macro));
}

