export type AssetCategory =
  | "ACOES"
  | "FIIS"
  | "RENDA_FIXA"
  | "ETFS"
  | "BDRS"
  | "CRIPTOS"
  | "STOCKS";

export type FixedIncomeType =
  | "CDB"
  | "LCI"
  | "LCA"
  | "TESOURO"
  | "CRI_CRA"
  | "DEBENTURE"
  | "OUTROS";

export type FixedIncomeIndexer = "CDI" | "IPCA" | "PRE" | "SELIC";

export type TransactionType = "BUY" | "SELL";

export type DividendType = "DIVIDEND" | "JCP" | "YIELD" | "INTEREST";

export interface CategoryMeta {
  id: AssetCategory;
  label: string;
  shortLabel: string;
  color: string;
  defaultTargetPct: number;
  isFixedIncome: boolean;
}

export const CATEGORY_LIST: CategoryMeta[] = [
  {
    id: "ACOES",
    label: "Ações",
    shortLabel: "Ações",
    color: "#3394D6",
    defaultTargetPct: 35,
    isFixedIncome: false,
  },
  {
    id: "FIIS",
    label: "FIIs",
    shortLabel: "FIIs",
    color: "#22B8DF",
    defaultTargetPct: 25,
    isFixedIncome: false,
  },
  {
    id: "RENDA_FIXA",
    label: "Renda Fixa",
    shortLabel: "Renda Fixa",
    color: "#19B26B",
    defaultTargetPct: 25,
    isFixedIncome: true,
  },
  {
    id: "CRIPTOS",
    label: "Criptos",
    shortLabel: "Criptos",
    color: "#5ED6D2",
    defaultTargetPct: 5,
    isFixedIncome: false,
  },
  {
    id: "ETFS",
    label: "ETFs",
    shortLabel: "ETFs",
    color: "#5B6CE1",
    defaultTargetPct: 5,
    isFixedIncome: false,
  },
  {
    id: "BDRS",
    label: "BDRs",
    shortLabel: "BDRs",
    color: "#8B5CF6",
    defaultTargetPct: 0,
    isFixedIncome: false,
  },
  {
    id: "STOCKS",
    label: "Stocks (EUA)",
    shortLabel: "Stocks",
    color: "#F59E0B",
    defaultTargetPct: 5,
    isFixedIncome: false,
  },
];

export const CATEGORY_MAP: Record<AssetCategory, CategoryMeta> = CATEGORY_LIST.reduce(
  (acc, item) => {
    acc[item.id] = item;
    return acc;
  },
  {} as Record<AssetCategory, CategoryMeta>
);

export interface Wallet {
  id: number;
  name: string;
  createdAt: string;
}

export interface AssetRecord {
  id: number;
  walletId: number;
  ticker: string;
  name: string;
  category: AssetCategory;
  currency: "BRL" | "USD";
  logoUrl: string | null;
  rating: number;
  fixedIncomeType: FixedIncomeType | null;
  indexer: FixedIncomeIndexer | null;
  rate: number | null;
  maturityDate: string | null;
  issuer: string | null;
  irExempt: boolean;
  iofExempt: boolean;
  createdAt: string;
}

export interface TransactionRecord {
  id: number;
  assetId: number;
  type: TransactionType;
  quantity: number;
  unitPrice: number;
  fees: number;
  executedAt: string; // YYYY-MM-DD
  notes: string | null;
  createdAt: string;
}

export interface DividendRecord {
  id: number;
  assetId: number;
  type: DividendType;
  amount: number;
  paidAt: string; // YYYY-MM-DD
  notes: string | null;
  createdAt: string;
}

export interface QuoteData {
  symbol: string;
  price: number;
  previousClose: number | null;
  changePct: number | null;
  currency: "BRL" | "USD";
  name: string | null;
  logoUrl: string | null;
  source: string;
  fetchedAt: string;
}

export interface MonthlyPricePoint {
  month: string; // YYYY-MM
  close: number;
}

export interface MacroRates {
  selicAnnualPct: number;
  cdiDailyPct: number;
  cdiAnnualPct: number;
  ipca12mPct: number;
  usdBrl: number;
  fetchedAt: string;
}

export interface FixedIncomeBreakdown {
  grossValue: number;
  grossGain: number;
  iofAmount: number;
  irAmount: number;
  netValue: number;
  netGain: number;
  effectiveIrRatePct: number;
  effectiveIofRatePct: number;
  irExempt: boolean;
  iofExempt: boolean;
}

export interface AssetPosition {
  asset: AssetRecord;
  quantity: number;
  averagePrice: number;
  investedValue: number;
  currentPrice: number;
  currentPriceOriginal: number;
  currentValue: number;
  dayChangePct: number | null;
  capitalGain: number;
  variationPct: number;
  dividendsReceived: number;
  dividends12m: number;
  totalProfit: number;
  profitabilityPct: number;
  portfolioPct: number;
  idealPct: number;
  shouldBuy: boolean;
  quoteSource: string;
  quoteUpdatedAt: string | null;
  fixedIncomeBreakdown?: FixedIncomeBreakdown;
  transactions: TransactionRecord[];
  dividends: DividendRecord[];
}

export interface CategorySummary {
  category: AssetCategory;
  label: string;
  color: string;
  assetCount: number;
  investedValue: number;
  currentValue: number;
  variationPct: number;
  profitabilityPct: number;
  portfolioPct: number;
  targetPct: number;
  assets: AssetPosition[];
}

export interface EvolutionPoint {
  month: string; // YYYY-MM
  label: string; // MM/YY
  invested: number;
  capitalGain: number;
  totalValue: number;
  returnPct: number;
}

export interface AllocationSlice {
  id: string;
  label: string;
  value: number;
  pct: number;
  color: string;
}

export interface PortfolioDashboardData {
  wallet: Wallet;
  wallets: Wallet[];
  totals: {
    totalEquity: number;
    totalInvested: number;
    totalVariationPct: number;
    totalProfit: number;
    capitalGain: number;
    dividendsTotal: number;
    dividends12m: number;
    profitabilityTotalPct: number;
    profitability12mPct: number;
    assetCount: number;
  };
  sparkline12m: number[];
  sparklineTotal: number[];
  evolution: EvolutionPoint[];
  allocation: AllocationSlice[];
  categories: CategorySummary[];
  categoryTargets: Record<AssetCategory, number>;
  macro: MacroRates;
  lastUpdatedAt: string;
}

export interface AppSettings {
  refreshIntervalSec: number;
  brapiToken: string;
}

export interface TickerSearchResult {
  ticker: string;
  name: string;
  category: AssetCategory;
  currency: "BRL" | "USD";
  price: number | null;
  changePct: number | null;
  logoUrl: string | null;
  source: string;
}

