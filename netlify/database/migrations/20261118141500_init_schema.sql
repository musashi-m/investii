-- Initial PostgreSQL schema for Investidor10x on Netlify Database
-- Zero mock assets or transactions: initializes only the default empty wallet and settings.

CREATE TABLE IF NOT EXISTS wallets (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS category_targets (
  wallet_id INTEGER NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  target_pct DOUBLE PRECISION NOT NULL,
  PRIMARY KEY (wallet_id, category)
);

CREATE TABLE IF NOT EXISTS assets (
  id SERIAL PRIMARY KEY,
  wallet_id INTEGER NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
  ticker TEXT NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'BRL',
  logo_url TEXT,
  rating INTEGER NOT NULL DEFAULT 10,
  fixed_income_type TEXT,
  indexer TEXT,
  rate DOUBLE PRECISION,
  maturity_date TEXT,
  issuer TEXT,
  ir_exempt BOOLEAN NOT NULL DEFAULT FALSE,
  iof_exempt BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (wallet_id, ticker, category)
);

CREATE INDEX IF NOT EXISTS idx_assets_wallet ON assets(wallet_id);

CREATE TABLE IF NOT EXISTS transactions (
  id SERIAL PRIMARY KEY,
  asset_id INTEGER NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('BUY', 'SELL')),
  quantity DOUBLE PRECISION NOT NULL CHECK (quantity > 0),
  unit_price DOUBLE PRECISION NOT NULL CHECK (unit_price >= 0),
  fees DOUBLE PRECISION NOT NULL DEFAULT 0 CHECK (fees >= 0),
  executed_at TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transactions_asset ON transactions(asset_id, executed_at);

CREATE TABLE IF NOT EXISTS dividends (
  id SERIAL PRIMARY KEY,
  asset_id INTEGER NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('DIVIDEND', 'JCP', 'YIELD', 'INTEREST')),
  amount DOUBLE PRECISION NOT NULL CHECK (amount > 0),
  paid_at TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dividends_asset ON dividends(asset_id, paid_at);

CREATE TABLE IF NOT EXISTS quote_cache (
  symbol TEXT PRIMARY KEY,
  price DOUBLE PRECISION NOT NULL,
  previous_close DOUBLE PRECISION,
  change_pct DOUBLE PRECISION,
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

-- Seed default empty wallet only if wallets table is empty
INSERT INTO wallets (name)
SELECT 'Investimentos'
WHERE NOT EXISTS (SELECT 1 FROM wallets);

-- Seed default category allocation targets for the first wallet
INSERT INTO category_targets (wallet_id, category, target_pct)
SELECT w.id, t.category, t.target_pct
FROM (SELECT id FROM wallets ORDER BY id ASC LIMIT 1) w
CROSS JOIN (
  VALUES
    ('ACOES', 35),
    ('FIIS', 25),
    ('RENDA_FIXA', 25),
    ('CRIPTOS', 5),
    ('ETFS', 5),
    ('BDRS', 0),
    ('STOCKS', 5)
) AS t(category, target_pct)
ON CONFLICT (wallet_id, category) DO NOTHING;

-- Seed default app settings
INSERT INTO app_settings (key, value) VALUES
  ('refreshIntervalSec', '60'),
  ('brapiToken', '')
ON CONFLICT (key) DO NOTHING;

