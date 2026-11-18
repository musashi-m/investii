import {
  getCachedHistory,
  getCachedMacro,
  getCachedQuote,
  getSettings,
  saveCachedHistory,
  saveCachedMacro,
  saveCachedQuote,
} from "@/lib/db";
import type {
  AssetCategory,
  AssetRecord,
  MacroRates,
  MonthlyPricePoint,
  QuoteData,
  TickerSearchResult,
} from "@/types/portfolio";

const QUOTE_TTL_MS = 45_000; // 45s cache for frequent real-time updates
const HISTORY_TTL_MS = 6 * 3_600_000; // 6h cache for monthly historical series
const MACRO_TTL_MS = 2 * 3_600_000; // 2h cache for BCB & FX macro rates
const FETCH_TIMEOUT_MS = 8_000;

const COMMON_CRYPTO_IDS: Record<string, { id: string; name: string }> = {
  BTC: { id: "bitcoin", name: "Bitcoin" },
  ETH: { id: "ethereum", name: "Ethereum" },
  SOL: { id: "solana", name: "Solana" },
  BNB: { id: "binancecoin", name: "BNB" },
  XRP: { id: "ripple", name: "XRP" },
  ADA: { id: "cardano", name: "Cardano" },
  DOGE: { id: "dogecoin", name: "Dogecoin" },
  DOT: { id: "polkadot", name: "Polkadot" },
  AVAX: { id: "avalanche-2", name: "Avalanche" },
  LINK: { id: "chainlink", name: "Chainlink" },
  MATIC: { id: "matic-network", name: "Polygon" },
  POL: { id: "polygon-ecosystem-token", name: "Polygon (POL)" },
  LTC: { id: "litecoin", name: "Litecoin" },
  USDT: { id: "tether", name: "Tether USD" },
  USDC: { id: "usd-coin", name: "USD Coin" },
  TON: { id: "the-open-network", name: "Toncoin" },
  SUI: { id: "sui", name: "Sui" },
  ARB: { id: "arbitrum", name: "Arbitrum" },
  OP: { id: "optimism", name: "Optimism" },
  NEAR: { id: "near", name: "NEAR Protocol" },
};

async function fetchJsonWithTimeout<T>(url: string, headers?: Record<string, string>): Promise<T | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        Accept: "application/json",
        ...headers,
      },
      cache: "no-store",
      signal: controller.signal,
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function isFresh(isoDate: string, ttlMs: number): boolean {
  const t = new Date(isoDate).getTime();
  if (Number.isNaN(t)) return false;
  return Date.now() - t < ttlMs;
}

/**
 * Formats an asset ticker for Yahoo Finance based on its category.
 */
export function toYahooSymbol(ticker: string, category: AssetCategory): string {
  const clean = ticker.trim().toUpperCase();
  if (category === "CRIPTOS") {
    return clean.endsWith("-USD") || clean.endsWith("-BRL") ? clean : `${clean}-BRL`;
  }
  if (category === "STOCKS") {
    return clean;
  }
  // Brazilian B3 categories: ACOES, FIIS, ETFS, BDRS
  return clean.endsWith(".SA") ? clean : `${clean}.SA`;
}

// ---------------------------------------------------------------------------
// Live Macro Rates (BCB SGS + Yahoo USD/BRL)
// ---------------------------------------------------------------------------

export async function getMacroRates(forceRefresh = false): Promise<MacroRates> {
  const cached = await getCachedMacro();
  if (!forceRefresh && cached && isFresh(cached.fetchedAt, MACRO_TTL_MS)) {
    return cached;
  }

  const [selicData, cdiData, ipcaData, fxData] = await Promise.all([
    fetchJsonWithTimeout<Array<{ data: string; valor: string }>>(
      "https://api.bcb.gov.br/dados/serie/bcdata.sgs.432/dados/ultimos/1?formato=json",
      { "Cache-Control": "no-cache" }
    ),
    fetchJsonWithTimeout<Array<{ data: string; valor: string }>>(
      "https://api.bcb.gov.br/dados/serie/bcdata.sgs.12/dados/ultimos/1?formato=json",
      { "Cache-Control": "no-cache" }
    ),
    fetchJsonWithTimeout<Array<{ data: string; valor: string }>>(
      "https://api.bcb.gov.br/dados/serie/bcdata.sgs.433/dados/ultimos/12?formato=json",
      { "Cache-Control": "no-cache" }
    ),
    fetchJsonWithTimeout<{
      chart?: { result?: Array<{ meta?: { regularMarketPrice?: number } }> };
    }>("https://query1.finance.yahoo.com/v8/finance/chart/BRL=X?interval=1d&range=5d"),
  ]);

  const selicAnnualPct =
    selicData && selicData[0]?.valor
      ? Number(selicData[0].valor)
      : cached?.selicAnnualPct ?? 13.75;

  const cdiDailyPct =
    cdiData && cdiData[0]?.valor
      ? Number(cdiData[0].valor)
      : cached?.cdiDailyPct ?? ((Math.pow(1 + (selicAnnualPct - 0.1) / 100, 1 / 252) - 1) * 100);

  const cdiAnnualPct = Number(
    ((Math.pow(1 + cdiDailyPct / 100, 252) - 1) * 100).toFixed(2)
  );

  let ipca12mPct = cached?.ipca12mPct ?? 4.5;
  if (ipcaData && ipcaData.length > 0) {
    let acc = 1;
    for (const item of ipcaData) {
      const v = Number(item.valor);
      if (Number.isFinite(v)) acc *= 1 + v / 100;
    }
    ipca12mPct = Number(((acc - 1) * 100).toFixed(2));
  }

  const usdBrl =
    fxData?.chart?.result?.[0]?.meta?.regularMarketPrice ?? cached?.usdBrl ?? 5.5;

  const macro: MacroRates = {
    selicAnnualPct,
    cdiDailyPct,
    cdiAnnualPct,
    ipca12mPct,
    usdBrl: Number(usdBrl.toFixed(4)),
    fetchedAt: new Date().toISOString(),
  };

  await saveCachedMacro(macro);
  return macro;
}

// ---------------------------------------------------------------------------
// Live Asset Quotes (Yahoo Finance + CoinGecko + optional brapi.dev)
// ---------------------------------------------------------------------------

interface YahooChartResponse {
  chart?: {
    result?: Array<{
      meta?: {
        currency?: string;
        symbol?: string;
        shortName?: string;
        longName?: string;
        regularMarketPrice?: number;
        chartPreviousClose?: number;
        previousClose?: number;
      };
      timestamp?: number[];
      indicators?: {
        quote?: Array<{ close?: Array<number | null> }>;
      };
    }>;
  };
}

async function fetchYahooQuote(
  ticker: string,
  category: AssetCategory
): Promise<QuoteData | null> {
  const yahooSymbol = toYahooSymbol(ticker, category);
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
    yahooSymbol
  )}?interval=1d&range=5d`;

  const data = await fetchJsonWithTimeout<YahooChartResponse>(url);
  const meta = data?.chart?.result?.[0]?.meta;
  if (!meta || typeof meta.regularMarketPrice !== "number" || meta.regularMarketPrice <= 0) {
    return null;
  }

  const price = meta.regularMarketPrice;
  const prevClose = meta.chartPreviousClose ?? meta.previousClose ?? null;
  const changePct =
    prevClose && prevClose > 0 ? ((price - prevClose) / prevClose) * 100 : null;
  const currency: "BRL" | "USD" = meta.currency === "USD" ? "USD" : "BRL";

  return {
    symbol: ticker.trim().toUpperCase(),
    price,
    previousClose: prevClose,
    changePct: changePct !== null ? Number(changePct.toFixed(2)) : null,
    currency,
    name: meta.shortName || meta.longName || null,
    logoUrl: null,
    source: "Yahoo Finance",
    fetchedAt: new Date().toISOString(),
  };
}

interface BrapiResponse {
  results?: Array<{
    symbol?: string;
    shortName?: string;
    longName?: string;
    regularMarketPrice?: number;
    regularMarketPreviousClose?: number;
    regularMarketChangePercent?: number;
    logourl?: string;
    currency?: string;
  }>;
}

async function fetchBrapiQuote(
  ticker: string,
  token: string
): Promise<QuoteData | null> {
  if (!token) return null;
  const clean = ticker.trim().toUpperCase().replace(/\.SA$/, "");
  const url = `https://brapi.dev/api/quote/${encodeURIComponent(
    clean
  )}?token=${encodeURIComponent(token)}`;
  const data = await fetchJsonWithTimeout<BrapiResponse>(url);
  const item = data?.results?.[0];
  if (!item || typeof item.regularMarketPrice !== "number" || item.regularMarketPrice <= 0) {
    return null;
  }
  return {
    symbol: clean,
    price: item.regularMarketPrice,
    previousClose: item.regularMarketPreviousClose ?? null,
    changePct:
      typeof item.regularMarketChangePercent === "number"
        ? Number(item.regularMarketChangePercent.toFixed(2))
        : null,
    currency: item.currency === "USD" ? "USD" : "BRL",
    name: item.shortName || item.longName || null,
    logoUrl: item.logourl || null,
    source: "brapi.dev",
    fetchedAt: new Date().toISOString(),
  };
}

async function resolveCoinGeckoId(
  ticker: string
): Promise<{ id: string; name: string; logoUrl: string | null } | null> {
  const clean = ticker.trim().toUpperCase();
  if (COMMON_CRYPTO_IDS[clean]) {
    return { ...COMMON_CRYPTO_IDS[clean], logoUrl: null };
  }
  const search = await fetchJsonWithTimeout<{
    coins?: Array<{ id: string; symbol: string; name: string; thumb?: string }>;
  }>(`https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(clean)}`);
  const match =
    search?.coins?.find((c) => c.symbol.toUpperCase() === clean) ??
    search?.coins?.[0];
  if (!match) return null;
  return { id: match.id, name: match.name, logoUrl: match.thumb ?? null };
}

async function fetchCryptoQuote(ticker: string): Promise<QuoteData | null> {
  const clean = ticker.trim().toUpperCase();
  const resolved = await resolveCoinGeckoId(clean);
  if (resolved) {
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(
      resolved.id
    )}&vs_currencies=brl&include_24hr_change=true`;
    const data = await fetchJsonWithTimeout<
      Record<string, { brl?: number; brl_24h_change?: number }>
    >(url);
    const entry = data?.[resolved.id];
    if (entry && typeof entry.brl === "number" && entry.brl > 0) {
      return {
        symbol: clean,
        price: entry.brl,
        previousClose: null,
        changePct:
          typeof entry.brl_24h_change === "number"
            ? Number(entry.brl_24h_change.toFixed(2))
            : null,
        currency: "BRL",
        name: resolved.name,
        logoUrl: resolved.logoUrl,
        source: "CoinGecko",
        fetchedAt: new Date().toISOString(),
      };
    }
  }
  // Fallback to Yahoo Finance crypto pair
  return fetchYahooQuote(clean, "CRIPTOS");
}

export async function fetchLiveQuote(
  ticker: string,
  category: AssetCategory,
  forceRefresh = false
): Promise<QuoteData | null> {
  if (category === "RENDA_FIXA") return null;

  const clean = ticker.trim().toUpperCase();
  const cached = await getCachedQuote(clean);
  if (!forceRefresh && cached && isFresh(cached.fetchedAt, QUOTE_TTL_MS)) {
    return cached;
  }

  let live: QuoteData | null = null;
  const settings = await getSettings();

  if (category === "CRIPTOS") {
    live = await fetchCryptoQuote(clean);
  } else if (category === "STOCKS") {
    live = await fetchYahooQuote(clean, "STOCKS");
  } else {
    // B3 assets: try brapi if user provided a token (gets official logo!), otherwise Yahoo Finance
    if (settings.brapiToken) {
      live = await fetchBrapiQuote(clean, settings.brapiToken);
    }
    if (!live) {
      live = await fetchYahooQuote(clean, category);
    }
  }

  if (live) {
    await saveCachedQuote(live);
    return live;
  }

  // Return stale cache if upstream temporarily failed
  return cached;
}

// ---------------------------------------------------------------------------
// Historical Monthly Prices for Real Portfolio Evolution Chart
// ---------------------------------------------------------------------------

export async function fetchMonthlyHistory(
  ticker: string,
  category: AssetCategory,
  forceRefresh = false
): Promise<MonthlyPricePoint[]> {
  if (category === "RENDA_FIXA") return [];

  const clean = ticker.trim().toUpperCase();
  const cached = await getCachedHistory(clean);
  if (!forceRefresh && cached && isFresh(cached.fetchedAt, HISTORY_TTL_MS)) {
    return cached.points;
  }

  const yahooSymbol = toYahooSymbol(clean, category);
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
    yahooSymbol
  )}?interval=1mo&range=2y`;

  const data = await fetchJsonWithTimeout<YahooChartResponse>(url);
  const result = data?.chart?.result?.[0];
  const timestamps = result?.timestamp ?? [];
  const closes = result?.indicators?.quote?.[0]?.close ?? [];

  const byMonth = new Map<string, number>();
  for (let i = 0; i < timestamps.length; i++) {
    const close = closes[i];
    if (typeof close !== "number" || !Number.isFinite(close) || close <= 0) {
      continue;
    }
    const dt = new Date(timestamps[i] * 1000);
    const ym = `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}`;
    byMonth.set(ym, Number(close.toFixed(4)));
  }

  const points: MonthlyPricePoint[] = Array.from(byMonth.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, close]) => ({ month, close }));

  if (points.length > 0) {
    await saveCachedHistory(clean, points, new Date().toISOString());
    return points;
  }

  return cached?.points ?? [];
}

/**
 * Fetches live quotes and monthly histories for all assets in parallel (zero waterfalls).
 */
export async function hydrateMarketDataForAssets(
  assets: AssetRecord[],
  forceRefresh = false
): Promise<{
  quotes: Record<string, QuoteData>;
  histories: Record<string, MonthlyPricePoint[]>;
  macro: MacroRates;
}> {
  const uniqueAssets = new Map<string, AssetRecord>();
  for (const asset of assets) {
    if (asset.category !== "RENDA_FIXA") {
      uniqueAssets.set(asset.ticker.toUpperCase(), asset);
    }
  }

  const entries = Array.from(uniqueAssets.values());
  const [macro, quoteList, historyList] = await Promise.all([
    getMacroRates(forceRefresh),
    Promise.all(
      entries.map(async (a) => [
        a.ticker.toUpperCase(),
        await fetchLiveQuote(a.ticker, a.category, forceRefresh),
      ] as const)
    ),
    Promise.all(
      entries.map(async (a) => [
        a.ticker.toUpperCase(),
        await fetchMonthlyHistory(a.ticker, a.category, false),
      ] as const)
    ),
  ]);

  const quotes: Record<string, QuoteData> = {};
  for (const [sym, q] of quoteList) {
    if (q) quotes[sym] = q;
  }

  const histories: Record<string, MonthlyPricePoint[]> = {};
  for (const [sym, h] of historyList) {
    histories[sym] = h;
  }

  return { quotes, histories, macro };
}

// ---------------------------------------------------------------------------
// Live Ticker Search (for the Add Transaction Modal)
// ---------------------------------------------------------------------------

function inferB3Category(symbol: string, quoteType?: string, longname?: string): AssetCategory {
  const upper = symbol.toUpperCase().replace(/\.SA$/, "");
  const nameUpper = (longname ?? "").toUpperCase();
  if (quoteType === "ETF" || nameUpper.includes("ETF") || nameUpper.includes("ISHARES")) {
    return "ETFS";
  }
  if (/(34|35|39)$/.test(upper)) {
    return "BDRS";
  }
  if (
    /11$/.test(upper) &&
    (nameUpper.includes("FII") ||
      nameUpper.includes("FUNDO") ||
      nameUpper.includes("IMOB") ||
      nameUpper.includes("FIAGRO"))
  ) {
    return "FIIS";
  }
  return "ACOES";
}

export async function searchLiveTicker(
  query: string,
  preferredCategory?: AssetCategory
): Promise<TickerSearchResult[]> {
  const clean = query.trim().toUpperCase();
  if (clean.length < 2) return [];

  if (preferredCategory === "CRIPTOS") {
    const q = await fetchCryptoQuote(clean);
    if (q) {
      return [
        {
          ticker: clean,
          name: q.name || clean,
          category: "CRIPTOS",
          currency: "BRL",
          price: q.price,
          changePct: q.changePct,
          logoUrl: q.logoUrl,
          source: q.source,
        },
      ];
    }
    return [];
  }

  // First try direct exact lookup + Yahoo Finance autocomplete search in parallel
  const categoryForDirect: AssetCategory =
    preferredCategory && preferredCategory !== "RENDA_FIXA"
      ? preferredCategory
      : "ACOES";

  const [directQuote, searchResp] = await Promise.all([
    fetchLiveQuote(clean, categoryForDirect, false),
    fetchJsonWithTimeout<{
      quotes?: Array<{
        symbol?: string;
        shortname?: string;
        longname?: string;
        exchange?: string;
        quoteType?: string;
      }>;
    }>(
      `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(
        clean
      )}&quotesCount=8&newsCount=0`
    ),
  ]);

  const results: TickerSearchResult[] = [];
  const seen = new Set<string>();

  if (directQuote) {
    seen.add(clean);
    results.push({
      ticker: clean,
      name: directQuote.name || clean,
      category: categoryForDirect,
      currency: directQuote.currency,
      price: directQuote.price,
      changePct: directQuote.changePct,
      logoUrl: directQuote.logoUrl,
      source: directQuote.source,
    });
  }

  for (const item of searchResp?.quotes ?? []) {
    if (!item.symbol) continue;
    const isB3 = item.symbol.endsWith(".SA") || item.exchange === "SAO";
    const isUS =
      !isB3 &&
      (item.exchange === "NMS" ||
        item.exchange === "NYQ" ||
        item.exchange === "PCX" ||
        item.exchange === "NGM");

    if (preferredCategory === "STOCKS" && !isUS) continue;
    if (
      preferredCategory &&
      preferredCategory !== "STOCKS" &&
      preferredCategory !== "RENDA_FIXA" &&
      !isB3
    ) {
      continue;
    }
    if (!isB3 && !isUS) continue;

    const cleanSym = item.symbol.replace(/\.SA$/, "").toUpperCase();
    if (seen.has(cleanSym)) continue;
    seen.add(cleanSym);

    const cat: AssetCategory = isUS
      ? "STOCKS"
      : preferredCategory && preferredCategory !== "RENDA_FIXA"
        ? preferredCategory
        : inferB3Category(cleanSym, item.quoteType, item.longname || item.shortname);

    results.push({
      ticker: cleanSym,
      name: item.shortname || item.longname || cleanSym,
      category: cat,
      currency: isUS ? "USD" : "BRL",
      price: null,
      changePct: null,
      logoUrl: null,
      source: "Yahoo Finance",
    });

    if (results.length >= 6) break;
  }

  return results;
}

