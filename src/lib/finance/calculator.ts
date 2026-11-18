import {
  CATEGORY_LIST,
  CATEGORY_MAP,
  type AllocationSlice,
  type AssetCategory,
  type AssetPosition,
  type AssetRecord,
  type CategorySummary,
  type DividendRecord,
  type EvolutionPoint,
  type FixedIncomeBreakdown,
  type FixedIncomeIndexer,
  type MacroRates,
  type MonthlyPricePoint,
  type PortfolioDashboardData,
  type QuoteData,
  type TransactionRecord,
  type Wallet,
} from "../../types/portfolio.ts";
import { formatMonthLabel } from "../format.ts";

/**
 * Official Brazilian Regressive IOF table (% of gross yield) for days 1..29.
 * Day 30+ is 0%.
 */
const IOF_REGRESSIVE_TABLE: number[] = [
  0, // day 0
  96, 93, 90, 86, 83, 80, 76, 73, 70, 66,
  63, 60, 56, 53, 50, 46, 43, 40, 36, 33,
  30, 26, 23, 20, 16, 13, 10, 6, 3,
];

/**
 * Counts calendar days (dias corridos) between two ISO dates.
 * Used for Brazilian IOF and regressive Income Tax (IR) brackets.
 */
export function countCalendarDays(startISO: string, endISO: string): number {
  const start = new Date(`${startISO.slice(0, 10)}T00:00:00Z`);
  const end = new Date(`${endISO.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
    return 0;
  }
  return Math.floor((end.getTime() - start.getTime()) / 86_400_000);
}

/**
 * Returns the Brazilian regressive IOF rate (%) for a given number of calendar days.
 */
export function getIofRatePct(calendarDays: number, iofExempt: boolean): number {
  if (iofExempt || calendarDays <= 0 || calendarDays >= 30) return 0;
  return IOF_REGRESSIVE_TABLE[calendarDays] ?? 0;
}

/**
 * Returns the Brazilian regressive Income Tax (IR) rate (%) for fixed income:
 * - Up to 180 days: 22.5%
 * - 181 to 360 days: 20.0%
 * - 361 to 720 days: 17.5%
 * - Over 720 days: 15.0%
 */
export function getIrRatePct(calendarDays: number, irExempt: boolean): number {
  if (irExempt) return 0;
  if (calendarDays <= 180) return 22.5;
  if (calendarDays <= 360) return 20.0;
  if (calendarDays <= 720) return 17.5;
  return 15.0;
}

/**
 * Counts approximate Brazilian business days (Mon-Fri) between two ISO dates.
 */
export function countBusinessDays(startISO: string, endISO: string): number {
  const start = new Date(`${startISO.slice(0, 10)}T00:00:00Z`);
  const end = new Date(`${endISO.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
    return 0;
  }
  const totalDays = Math.floor((end.getTime() - start.getTime()) / 86_400_000);
  const fullWeeks = Math.floor(totalDays / 7);
  let businessDays = fullWeeks * 5;
  const remainder = totalDays % 7;
  const startDay = start.getUTCDay();
  for (let i = 1; i <= remainder; i++) {
    const dow = (startDay + i) % 7;
    if (dow !== 0 && dow !== 6) businessDays++;
  }
  return businessDays;
}

/**
 * Computes the annual effective rate for a Brazilian Fixed Income asset
 * using live Banco Central macro rates (CDI, Selic, IPCA).
 */
export function resolveFixedIncomeAnnualRate(
  indexer: FixedIncomeIndexer | null,
  rate: number | null,
  macro: MacroRates
): number {
  const r = rate ?? 0;
  switch (indexer) {
    case "CDI":
      // rate is % of CDI, e.g., 100 means 100% of CDI
      return macro.cdiAnnualPct * (r / 100);
    case "SELIC":
      // rate is spread over Selic, e.g., 0.15 means Selic + 0.15%
      return ((1 + macro.selicAnnualPct / 100) * (1 + r / 100) - 1) * 100;
    case "IPCA":
      // rate is real spread over IPCA, e.g., 6.5 means IPCA + 6.5%
      return ((1 + macro.ipca12mPct / 100) * (1 + r / 100) - 1) * 100;
    case "PRE":
    default:
      return r;
  }
}

/**
 * Compounds a single fixed-income contribution from startISO up to targetISO
 * (clamped at maturityDate if present) using 252 business days/year convention (ANBIMA/B3).
 */
export function compoundFixedIncomeValue(
  principal: number,
  startISO: string,
  targetISO: string,
  maturityISO: string | null,
  indexer: FixedIncomeIndexer | null,
  rate: number | null,
  macro: MacroRates
): number {
  if (principal <= 0) return 0;
  const effectiveEnd =
    maturityISO && maturityISO < targetISO ? maturityISO : targetISO;
  if (effectiveEnd <= startISO) return principal;

  const businessDays = countBusinessDays(startISO, effectiveEnd);
  if (businessDays <= 0) return principal;

  const annualRatePct = resolveFixedIncomeAnnualRate(indexer, rate, macro);
  const factor = Math.pow(1 + annualRatePct / 100, businessDays / 252);
  return principal * factor;
}

export interface PositionCostResult {
  quantity: number;
  averagePrice: number;
  investedValue: number;
  realizedProfit: number;
}

/**
 * Calculates current quantity and weighted average cost (Preço Médio) following
 * standard Brazilian fiscal accounting:
 * - BUY recalculates weighted average including fees
 * - SELL reduces quantity keeping the same average price and books realized gain/loss
 */
export function calculateWeightedPosition(
  transactions: TransactionRecord[],
  asOfDate?: string
): PositionCostResult {
  const sorted = [...transactions]
    .filter((tx) => !asOfDate || tx.executedAt <= asOfDate)
    .sort((a, b) => {
      if (a.executedAt !== b.executedAt) return a.executedAt.localeCompare(b.executedAt);
      return a.id - b.id;
    });

  let quantity = 0;
  let totalCost = 0;
  let realizedProfit = 0;

  for (const tx of sorted) {
    if (tx.type === "BUY") {
      const txTotal = tx.quantity * tx.unitPrice + (tx.fees || 0);
      totalCost += txTotal;
      quantity += tx.quantity;
    } else if (tx.type === "SELL") {
      if (quantity <= 0) continue;
      const sellQty = Math.min(tx.quantity, quantity);
      const avgBefore = totalCost / quantity;
      const costBasisSold = sellQty * avgBefore;
      const netProceeds = sellQty * tx.unitPrice - (tx.fees || 0);
      realizedProfit += netProceeds - costBasisSold;
      quantity -= sellQty;
      totalCost = quantity > 1e-10 ? totalCost - costBasisSold : 0;
      if (quantity <= 1e-10) {
        quantity = 0;
        totalCost = 0;
      }
    }
  }

  const averagePrice = quantity > 0 ? totalCost / quantity : 0;
  return {
    quantity,
    averagePrice,
    investedValue: totalCost,
    realizedProfit,
  };
}

/**
 * Evaluates a Fixed Income asset's gross and net (after regressive IOF & IR) value on targetISO
 * by compounding each FIFO contribution lot with real BCB macro rates.
 */
export function evaluateFixedIncomeAsOf(
  asset: AssetRecord,
  transactions: TransactionRecord[],
  targetISO: string,
  macro: MacroRates
): { invested: number; currentValue: number; breakdown: FixedIncomeBreakdown } {
  const sorted = [...transactions]
    .filter((tx) => tx.executedAt <= targetISO)
    .sort((a, b) => a.executedAt.localeCompare(b.executedAt));

  // FIFO lot tracking for redemptions
  const lots: Array<{ principal: number; date: string }> = [];
  for (const tx of sorted) {
    const amount = tx.quantity * tx.unitPrice + (tx.type === "BUY" ? tx.fees || 0 : 0);
    if (tx.type === "BUY") {
      lots.push({ principal: amount, date: tx.executedAt });
    } else {
      let remaining = amount;
      while (remaining > 0 && lots.length > 0) {
        const lot = lots[0];
        if (lot.principal <= remaining) {
          remaining -= lot.principal;
          lots.shift();
        } else {
          lot.principal -= remaining;
          remaining = 0;
        }
      }
    }
  }

  const isDefaultTaxExempt =
    asset.fixedIncomeType === "LCI" ||
    asset.fixedIncomeType === "LCA" ||
    asset.fixedIncomeType === "CRI_CRA";
  const irExempt = asset.irExempt ?? isDefaultTaxExempt;
  const iofExempt = asset.iofExempt ?? isDefaultTaxExempt;

  let invested = 0;
  let grossValue = 0;
  let iofAmount = 0;
  let irAmount = 0;
  let weightedIrNum = 0;
  let weightedIofNum = 0;
  let totalGrossGain = 0;
  let totalAfterIofGain = 0;

  for (const lot of lots) {
    invested += lot.principal;
    const lotGross = compoundFixedIncomeValue(
      lot.principal,
      lot.date,
      targetISO,
      asset.maturityDate,
      asset.indexer,
      asset.rate,
      macro
    );
    grossValue += lotGross;

    const effectiveEnd =
      asset.maturityDate && asset.maturityDate < targetISO
        ? asset.maturityDate
        : targetISO;
    const calDays = countCalendarDays(lot.date, effectiveEnd);
    const lotGain = Math.max(0, lotGross - lot.principal);

    const iofRate = getIofRatePct(calDays, iofExempt);
    const lotIof = lotGain * (iofRate / 100);
    const gainAfterIof = Math.max(0, lotGain - lotIof);

    const irRate = getIrRatePct(calDays, irExempt);
    const lotIr = gainAfterIof * (irRate / 100);

    iofAmount += lotIof;
    irAmount += lotIr;
    totalGrossGain += lotGain;
    totalAfterIofGain += gainAfterIof;
    weightedIofNum += lotGain * iofRate;
    weightedIrNum += gainAfterIof * irRate;
  }

  const netValue = grossValue - iofAmount - irAmount;
  const grossGain = grossValue - invested;
  const netGain = netValue - invested;
  const effectiveIofRatePct =
    totalGrossGain > 0 ? weightedIofNum / totalGrossGain : 0;
  const effectiveIrRatePct =
    totalAfterIofGain > 0
      ? weightedIrNum / totalAfterIofGain
      : irExempt
        ? 0
        : lots.length > 0
          ? getIrRatePct(
              countCalendarDays(lots[0].date, targetISO),
              irExempt
            )
          : 0;

  const breakdown: FixedIncomeBreakdown = {
    grossValue: Number(grossValue.toFixed(2)),
    grossGain: Number(grossGain.toFixed(2)),
    iofAmount: Number(iofAmount.toFixed(2)),
    irAmount: Number(irAmount.toFixed(2)),
    netValue: Number(netValue.toFixed(2)),
    netGain: Number(netGain.toFixed(2)),
    effectiveIrRatePct: Number(effectiveIrRatePct.toFixed(2)),
    effectiveIofRatePct: Number(effectiveIofRatePct.toFixed(2)),
    irExempt,
    iofExempt,
  };

  return { invested, currentValue: netValue, breakdown };
}

function getMonthKeysRange(monthsBack: number, nowDate: Date): string[] {
  const keys: string[] = [];
  const y = nowDate.getFullYear();
  const m = nowDate.getMonth(); // 0-indexed
  for (let offset = monthsBack - 1; offset >= 0; offset--) {
    const d = new Date(y, m - offset, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    keys.push(key);
  }
  return keys;
}

function endOfMonthISO(ym: string, todayISO: string): string {
  const [yStr, mStr] = ym.split("-");
  const y = Number(yStr);
  const m = Number(mStr);
  const lastDay = new Date(y, m, 0).getDate();
  const candidate = `${yStr}-${mStr}-${String(lastDay).padStart(2, "0")}`;
  return candidate > todayISO ? todayISO : candidate;
}

function resolveHistoricalPrice(
  ym: string,
  history: MonthlyPricePoint[] | undefined,
  fallbackPrice: number
): number {
  if (!history || history.length === 0) return fallbackPrice;
  const exact = history.find((pt) => pt.month === ym);
  if (exact && exact.close > 0) return exact.close;
  // Find latest price at or before ym
  let latest: MonthlyPricePoint | null = null;
  for (const pt of history) {
    if (pt.month <= ym && pt.close > 0) {
      if (!latest || pt.month > latest.month) latest = pt;
    }
  }
  if (latest) return latest.close;
  // Otherwise earliest known price
  const earliest = history.find((pt) => pt.close > 0);
  return earliest ? earliest.close : fallbackPrice;
}

export interface BuildPortfolioInput {
  wallet: Wallet;
  wallets: Wallet[];
  assets: AssetRecord[];
  transactions: TransactionRecord[];
  dividends: DividendRecord[];
  categoryTargets: Record<AssetCategory, number>;
  quotes: Record<string, QuoteData>;
  histories: Record<string, MonthlyPricePoint[]>;
  macro: MacroRates;
  periodMonths?: number; // 6, 12, 24, 0 (all)
  categoryFilter?: AssetCategory | "ALL";
  now?: Date;
}

export function buildPortfolioDashboard(
  input: BuildPortfolioInput
): PortfolioDashboardData {
  const now = input.now ?? new Date();
  const todayISO = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
    now.getDate()
  ).padStart(2, "0")}`;
  const twelveMonthsAgoDate = new Date(now);
  twelveMonthsAgoDate.setFullYear(twelveMonthsAgoDate.getFullYear() - 1);
  const twelveMonthsAgoISO = `${twelveMonthsAgoDate.getFullYear()}-${String(
    twelveMonthsAgoDate.getMonth() + 1
  ).padStart(2, "0")}-${String(twelveMonthsAgoDate.getDate()).padStart(2, "0")}`;

  // Group transactions and dividends by assetId in O(N)
  const txByAsset = new Map<number, TransactionRecord[]>();
  for (const tx of input.transactions) {
    const arr = txByAsset.get(tx.assetId) ?? [];
    arr.push(tx);
    txByAsset.set(tx.assetId, arr);
  }

  const divByAsset = new Map<number, DividendRecord[]>();
  for (const div of input.dividends) {
    const arr = divByAsset.get(div.assetId) ?? [];
    arr.push(div);
    divByAsset.set(div.assetId, arr);
  }

  const rawPositions: AssetPosition[] = [];
  let totalEquity = 0;
  let totalInvested = 0;
  let totalDividends = 0;
  let totalDividends12m = 0;

  for (const asset of input.assets) {
    const assetTxs = txByAsset.get(asset.id) ?? [];
    const assetDivs = divByAsset.get(asset.id) ?? [];

    const dividendsReceived = assetDivs.reduce((sum, d) => sum + d.amount, 0);
    const dividends12m = assetDivs
      .filter((d) => d.paidAt >= twelveMonthsAgoISO)
      .reduce((sum, d) => sum + d.amount, 0);

    const isFixedIncome = asset.category === "RENDA_FIXA";
    const fxRate = asset.currency === "USD" ? input.macro.usdBrl : 1;

    let quantity = 0;
    let averagePrice = 0;
    let investedValue = 0;
    let currentPriceOriginal = 0;
    let currentPrice = 0;
    let currentValue = 0;
    let dayChangePct: number | null = null;
    let quoteSource = isFixedIncome ? "BCB" : "fallback";
    let quoteUpdatedAt: string | null = isFixedIncome ? input.macro.fetchedAt : null;
    let fixedIncomeBreakdown: FixedIncomeBreakdown | undefined;

    if (isFixedIncome) {
      const fi = evaluateFixedIncomeAsOf(asset, assetTxs, todayISO, input.macro);
      investedValue = fi.invested;
      currentValue = fi.currentValue; // Net value (after IOF & regressive IR) as primary
      quantity = investedValue > 0 ? 1 : 0;
      averagePrice = investedValue;
      currentPrice = currentValue;
      currentPriceOriginal = currentValue;
      fixedIncomeBreakdown = fi.breakdown;
    } else {
      const cost = calculateWeightedPosition(assetTxs, todayISO);
      quantity = cost.quantity;
      averagePrice = cost.averagePrice * fxRate;
      investedValue = cost.investedValue * fxRate;

      const quote = input.quotes[asset.ticker.toUpperCase()];
      if (quote && quote.price > 0) {
        currentPriceOriginal = quote.price;
        const quoteFx = quote.currency === "USD" ? input.macro.usdBrl : 1;
        currentPrice = quote.price * quoteFx;
        dayChangePct = quote.changePct;
        quoteSource = quote.source;
        quoteUpdatedAt = quote.fetchedAt;
      } else {
        currentPriceOriginal = cost.averagePrice;
        currentPrice = averagePrice;
      }
      currentValue = quantity * currentPrice;
    }

    // Keep active positions (or positions with transactions/dividends)
    if (quantity <= 1e-10 && investedValue <= 0 && dividendsReceived <= 0) {
      continue;
    }

    const capitalGain = currentValue - investedValue;
    const variationPct = investedValue > 0 ? (capitalGain / investedValue) * 100 : 0;
    const totalProfit = capitalGain + dividendsReceived;
    const profitabilityPct = investedValue > 0 ? (totalProfit / investedValue) * 100 : 0;

    totalEquity += currentValue;
    totalInvested += investedValue;
    totalDividends += dividendsReceived;
    totalDividends12m += dividends12m;

    rawPositions.push({
      asset,
      quantity,
      averagePrice,
      investedValue,
      currentPrice,
      currentPriceOriginal,
      currentValue,
      dayChangePct,
      capitalGain,
      variationPct,
      dividendsReceived,
      dividends12m,
      totalProfit,
      profitabilityPct,
      portfolioPct: 0, // computed below
      idealPct: 0, // computed below
      shouldBuy: false, // computed below
      quoteSource,
      quoteUpdatedAt,
      fixedIncomeBreakdown,
      transactions: [...assetTxs].sort((a, b) => b.executedAt.localeCompare(a.executedAt)),
      dividends: [...assetDivs].sort((a, b) => b.paidAt.localeCompare(a.paidAt)),
    });
  }

  // Group into categories and compute portfolioPct, idealPct, shouldBuy
  const categories: CategorySummary[] = [];
  for (const meta of CATEGORY_LIST) {
    const catAssets = rawPositions.filter((p) => p.asset.category === meta.id);
    if (catAssets.length === 0) continue;

    const catTarget = input.categoryTargets[meta.id] ?? meta.defaultTargetPct;
    const ratingSum = catAssets.reduce((sum, p) => sum + Math.max(0, p.asset.rating), 0);

    let catInvested = 0;
    let catValue = 0;
    let catDividends = 0;

    for (const pos of catAssets) {
      catInvested += pos.investedValue;
      catValue += pos.currentValue;
      catDividends += pos.dividendsReceived;

      pos.portfolioPct = totalEquity > 0 ? (pos.currentValue / totalEquity) * 100 : 0;
      pos.idealPct =
        ratingSum > 0
          ? catTarget * (Math.max(0, pos.asset.rating) / ratingSum)
          : catTarget / catAssets.length;
      pos.shouldBuy = pos.asset.rating > 0 && pos.portfolioPct < pos.idealPct - 0.01;
    }

    catAssets.sort((a, b) => b.currentValue - a.currentValue);

    const catCapGain = catValue - catInvested;
    const catVarPct = catInvested > 0 ? (catCapGain / catInvested) * 100 : 0;
    const catProfPct =
      catInvested > 0 ? ((catCapGain + catDividends) / catInvested) * 100 : 0;

    categories.push({
      category: meta.id,
      label: meta.label,
      color: meta.color,
      assetCount: catAssets.length,
      investedValue: catInvested,
      currentValue: catValue,
      variationPct: catVarPct,
      profitabilityPct: catProfPct,
      portfolioPct: totalEquity > 0 ? (catValue / totalEquity) * 100 : 0,
      targetPct: catTarget,
      assets: catAssets,
    });
  }

  categories.sort((a, b) => b.currentValue - a.currentValue);

  // Allocation donut slices (by category, or by asset if filtered)
  const filterCat = input.categoryFilter ?? "ALL";
  let allocation: AllocationSlice[] = [];
  if (filterCat === "ALL") {
    allocation = categories.map((c) => ({
      id: c.category,
      label: c.label,
      value: c.currentValue,
      pct: c.portfolioPct,
      color: c.color,
    }));
  } else {
    const selectedCat = categories.find((c) => c.category === filterCat);
    const palette = [
      "#3394D6",
      "#22B8DF",
      "#5ED6D2",
      "#19B26B",
      "#5B6CE1",
      "#8B5CF6",
      "#F59E0B",
      "#EC4899",
    ];
    if (selectedCat && selectedCat.currentValue > 0) {
      allocation = selectedCat.assets.map((pos, idx) => ({
        id: pos.asset.ticker,
        label: pos.asset.ticker,
        value: pos.currentValue,
        pct: (pos.currentValue / selectedCat.currentValue) * 100,
        color: palette[idx % palette.length],
      }));
    }
  }

  // Monthly Portfolio Evolution (Real historical calculation from transactions + live/historical prices)
  const earliestTx = input.transactions.reduce<string | null>((min, tx) => {
    if (!min || tx.executedAt < min) return tx.executedAt;
    return min;
  }, null);

  let monthsToShow = input.periodMonths ?? 12;
  if (monthsToShow <= 0 && earliestTx) {
    const [ey, em] = earliestTx.split("-").map(Number);
    const diff = (now.getFullYear() - ey) * 12 + (now.getMonth() + 1 - em) + 1;
    monthsToShow = Math.max(6, Math.min(36, diff));
  } else if (monthsToShow <= 0) {
    monthsToShow = 12;
  }

  const monthKeys = getMonthKeysRange(monthsToShow, now);
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const filteredAssets =
    filterCat === "ALL"
      ? input.assets
      : input.assets.filter((a) => a.category === filterCat);

  const evolution: EvolutionPoint[] = monthKeys.map((ym) => {
    const asOf = endOfMonthISO(ym, todayISO);
    const isCurrentMonth = ym === currentMonthKey;
    let monthInvested = 0;
    let monthValue = 0;

    for (const asset of filteredAssets) {
      const assetTxs = txByAsset.get(asset.id) ?? [];
      if (assetTxs.length === 0) continue;

      if (asset.category === "RENDA_FIXA") {
        const fi = evaluateFixedIncomeAsOf(asset, assetTxs, asOf, input.macro);
        monthInvested += fi.invested;
        monthValue += fi.currentValue;
      } else {
        const cost = calculateWeightedPosition(assetTxs, asOf);
        if (cost.quantity <= 1e-10) continue;

        const fxRate = asset.currency === "USD" ? input.macro.usdBrl : 1;
        const investedBRL = cost.investedValue * fxRate;
        monthInvested += investedBRL;

        const quote = input.quotes[asset.ticker.toUpperCase()];
        const currentPriceBRL =
          quote && quote.price > 0
            ? quote.price * (quote.currency === "USD" ? input.macro.usdBrl : 1)
            : cost.averagePrice * fxRate;

        if (isCurrentMonth) {
          monthValue += cost.quantity * currentPriceBRL;
        } else {
          const hist = input.histories[asset.ticker.toUpperCase()];
          const histPriceOriginal = resolveHistoricalPrice(
            ym,
            hist,
            quote?.price ?? cost.averagePrice
          );
          const priceBRL = histPriceOriginal * fxRate;
          monthValue += cost.quantity * priceBRL;
        }
      }
    }

    const capGain = monthValue - monthInvested;
    const returnPct = monthInvested > 0 ? (capGain / monthInvested) * 100 : 0;

    return {
      month: ym,
      label: formatMonthLabel(ym),
      invested: Number(monthInvested.toFixed(2)),
      capitalGain: Number(capGain.toFixed(2)),
      totalValue: Number(monthValue.toFixed(2)),
      returnPct: Number(returnPct.toFixed(2)),
    };
  });

  // Totals & Sparklines
  const capitalGain = totalEquity - totalInvested;
  const totalVariationPct =
    totalInvested > 0 ? (capitalGain / totalInvested) * 100 : 0;
  const totalProfit = capitalGain + totalDividends;
  const profitabilityTotalPct =
    totalInvested > 0 ? (totalProfit / totalInvested) * 100 : 0;

  // 12M profitability based on 12m evolution + 12m dividends
  const activeEvo = evolution.filter((e) => e.invested > 0);
  const firstActive = activeEvo[0];
  let profitability12mPct = profitabilityTotalPct;
  if (firstActive && firstActive.totalValue > 0 && totalInvested > 0) {
    const startGain = firstActive.capitalGain;
    const deltaGain12m = capitalGain - startGain + totalDividends12m;
    profitability12mPct = (deltaGain12m / totalInvested) * 100;
  }

  const sparkline12m = evolution
    .slice(-12)
    .map((pt) => (pt.invested > 0 ? pt.returnPct : 0));
  const sparklineTotal = evolution.map((pt) => (pt.invested > 0 ? pt.returnPct : 0));

  return {
    wallet: input.wallet,
    wallets: input.wallets,
    totals: {
      totalEquity: Number(totalEquity.toFixed(2)),
      totalInvested: Number(totalInvested.toFixed(2)),
      totalVariationPct: Number(totalVariationPct.toFixed(2)),
      totalProfit: Number(totalProfit.toFixed(2)),
      capitalGain: Number(capitalGain.toFixed(2)),
      dividendsTotal: Number(totalDividends.toFixed(2)),
      dividends12m: Number(totalDividends12m.toFixed(2)),
      profitabilityTotalPct: Number(profitabilityTotalPct.toFixed(2)),
      profitability12mPct: Number(profitability12mPct.toFixed(2)),
      assetCount: rawPositions.length,
    },
    sparkline12m,
    sparklineTotal,
    evolution,
    allocation,
    categories,
    categoryTargets: input.categoryTargets,
    macro: input.macro,
    lastUpdatedAt: new Date().toISOString(),
  };
}
