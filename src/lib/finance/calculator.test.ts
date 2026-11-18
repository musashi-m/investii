import test from "node:test";
import assert from "node:assert/strict";
import {
  buildPortfolioDashboard,
  calculateWeightedPosition,
  compoundFixedIncomeValue,
  countBusinessDays,
  evaluateFixedIncomeAsOf,
  getIofRatePct,
  getIrRatePct,
} from "./calculator.ts";
import type {
  AssetRecord,
  DividendRecord,
  MacroRates,
  TransactionRecord,
  Wallet,
} from "../../types/portfolio.ts";

const sampleMacro: MacroRates = {
  selicAnnualPct: 13.75,
  cdiDailyPct: 0.050788,
  cdiAnnualPct: 13.65,
  ipca12mPct: 4.5,
  usdBrl: 5.5,
  fetchedAt: "2026-11-18T12:00:00.000Z",
};

test("calculateWeightedPosition handles buys, fees, and partial sells properly", () => {
  const txs: TransactionRecord[] = [
    {
      id: 1,
      assetId: 1,
      type: "BUY",
      quantity: 10,
      unitPrice: 20,
      fees: 5,
      executedAt: "2026-01-10",
      notes: null,
      createdAt: "2026-01-10",
    },
    {
      id: 2,
      assetId: 1,
      type: "BUY",
      quantity: 10,
      unitPrice: 30,
      fees: 5,
      executedAt: "2026-02-10",
      notes: null,
      createdAt: "2026-02-10",
    },
    {
      id: 3,
      assetId: 1,
      type: "SELL",
      quantity: 5,
      unitPrice: 40,
      fees: 0,
      executedAt: "2026-03-10",
      notes: null,
      createdAt: "2026-03-10",
    },
  ];

  // After 2 buys: 20 shares, total cost = 205 + 305 = 510 => avg = 25.50
  // After sell 5 @ 40: 15 shares left, avg stays 25.50, invested = 382.50, realized = 5*(40-25.5)=72.50
  const result = calculateWeightedPosition(txs);
  assert.equal(result.quantity, 15);
  assert.ok(Math.abs(result.averagePrice - 25.5) < 1e-6);
  assert.ok(Math.abs(result.investedValue - 382.5) < 1e-6);
  assert.ok(Math.abs(result.realizedProfit - 72.5) < 1e-6);
});

test("compoundFixedIncomeValue compounds 100% CDI over 1 year (~252 business days)", () => {
  const bd = countBusinessDays("2025-11-18", "2026-11-18");
  assert.ok(bd >= 250 && bd <= 262);

  const val = compoundFixedIncomeValue(
    1000,
    "2025-11-18",
    "2026-11-18",
    null,
    "CDI",
    100,
    sampleMacro
  );
  // Expect ~R$ 1.136,50 to R$ 1.142,00
  assert.ok(val > 1130 && val < 1150, `Unexpected compounded value: ${val}`);
});

test("buildPortfolioDashboard computes totals, dividends, ideal % and Comprar? accurately", () => {
  const wallet: Wallet = { id: 1, name: "Investimentos", createdAt: "2026-01-01" };
  const assets: AssetRecord[] = [
    {
      id: 1,
      walletId: 1,
      ticker: "ITSA4",
      name: "Itausa",
      category: "ACOES",
      currency: "BRL",
      logoUrl: null,
      rating: 10,
      fixedIncomeType: null,
      indexer: null,
      rate: null,
      maturityDate: null,
      issuer: null,
      irExempt: false,
      iofExempt: false,
      createdAt: "2026-01-01",
    },
    {
      id: 2,
      walletId: 1,
      ticker: "BBAS3",
      name: "Banco do Brasil",
      category: "ACOES",
      currency: "BRL",
      logoUrl: null,
      rating: 10,
      fixedIncomeType: null,
      indexer: null,
      rate: null,
      maturityDate: null,
      issuer: null,
      irExempt: false,
      iofExempt: false,
      createdAt: "2026-01-01",
    },
  ];

  const transactions: TransactionRecord[] = [
    {
      id: 1,
      assetId: 1,
      type: "BUY",
      quantity: 100,
      unitPrice: 10,
      fees: 0,
      executedAt: "2026-01-15",
      notes: null,
      createdAt: "2026-01-15",
    },
    {
      id: 2,
      assetId: 2,
      type: "BUY",
      quantity: 10,
      unitPrice: 20,
      fees: 0,
      executedAt: "2026-01-15",
      notes: null,
      createdAt: "2026-01-15",
    },
  ];

  const dividends: DividendRecord[] = [
    {
      id: 1,
      assetId: 1,
      type: "DIVIDEND",
      amount: 100,
      paidAt: "2026-06-15",
      notes: null,
      createdAt: "2026-06-15",
    },
  ];

  const dashboard = buildPortfolioDashboard({
    wallet,
    wallets: [wallet],
    assets,
    transactions,
    dividends,
    categoryTargets: {
      ACOES: 100,
      FIIS: 0,
      RENDA_FIXA: 0,
      ETFS: 0,
      BDRS: 0,
      CRIPTOS: 0,
      STOCKS: 0,
    },
    quotes: {
      ITSA4: {
        symbol: "ITSA4",
        price: 12,
        previousClose: 11.8,
        changePct: 1.69,
        currency: "BRL",
        name: "Itausa",
        logoUrl: null,
        source: "Yahoo Finance",
        fetchedAt: "2026-11-18T12:00:00.000Z",
      },
      BBAS3: {
        symbol: "BBAS3",
        price: 20,
        previousClose: 20,
        changePct: 0,
        currency: "BRL",
        name: "Banco do Brasil",
        logoUrl: null,
        source: "Yahoo Finance",
        fetchedAt: "2026-11-18T12:00:00.000Z",
      },
    },
    histories: {},
    macro: sampleMacro,
    now: new Date("2026-11-18T12:00:00Z"),
  });

  // ITSA4: 100 * 12 = 1200 (cost 1000, div 100)
  // BBAS3: 10 * 20 = 200 (cost 200, div 0)
  // Total equity = 1400, Total invested = 1200, Capital gain = 200, Total profit = 300
  assert.equal(dashboard.totals.totalEquity, 1400);
  assert.equal(dashboard.totals.totalInvested, 1200);
  assert.equal(dashboard.totals.capitalGain, 200);
  assert.equal(dashboard.totals.dividendsTotal, 100);
  assert.equal(dashboard.totals.totalProfit, 300);

  const acoes = dashboard.categories[0];
  assert.equal(acoes.category, "ACOES");
  const itsa = acoes.assets.find((a) => a.asset.ticker === "ITSA4")!;
  const bbas = acoes.assets.find((a) => a.asset.ticker === "BBAS3")!;
  // Both have rating 10, target 100 => idealPct = 50% each
  // ITSA4 is 85.71% (>50% -> shouldBuy false), BBAS3 is 14.29% (<50% -> shouldBuy true)
  assert.equal(itsa.idealPct, 50);
  assert.equal(itsa.shouldBuy, false);
  assert.equal(bbas.idealPct, 50);
  assert.equal(bbas.shouldBuy, true);
});

test("regressive IR and IOF brackets follow Brazilian tax rules", () => {
  assert.equal(getIrRatePct(100, false), 22.5);
  assert.equal(getIrRatePct(180, false), 22.5);
  assert.equal(getIrRatePct(181, false), 20.0);
  assert.equal(getIrRatePct(360, false), 20.0);
  assert.equal(getIrRatePct(361, false), 17.5);
  assert.equal(getIrRatePct(720, false), 17.5);
  assert.equal(getIrRatePct(721, false), 15.0);
  assert.equal(getIrRatePct(100, true), 0);

  assert.equal(getIofRatePct(1, false), 96);
  assert.equal(getIofRatePct(15, false), 50);
  assert.equal(getIofRatePct(29, false), 3);
  assert.equal(getIofRatePct(30, false), 0);
  assert.equal(getIofRatePct(1, true), 0);
  assert.equal(getIofRatePct(15, true), 0);
});

test("evaluateFixedIncomeAsOf discounts regressive IOF/IR and respects iofExempt & irExempt", () => {
  const baseAsset: AssetRecord = {
    id: 10,
    walletId: 1,
    ticker: "CDB 100% CDI",
    name: "CDB 100% CDI",
    category: "RENDA_FIXA",
    currency: "BRL",
    logoUrl: null,
    rating: 10,
    fixedIncomeType: "CDB",
    indexer: "CDI",
    rate: 100,
    maturityDate: null,
    issuer: "Banco Teste",
    irExempt: false,
    iofExempt: false,
    createdAt: "2026-11-01",
  };

  const tx15Days: TransactionRecord[] = [
    {
      id: 10,
      assetId: 10,
      type: "BUY",
      quantity: 1,
      unitPrice: 10000,
      fees: 0,
      executedAt: "2026-11-03",
      notes: null,
      createdAt: "2026-11-03",
    },
  ];

  // After 15 calendar days (2026-11-03 -> 2026-11-18): IOF 50%, IR 22.5%
  const taxed = evaluateFixedIncomeAsOf(baseAsset, tx15Days, "2026-11-18", sampleMacro);
  assert.equal(taxed.breakdown.effectiveIofRatePct, 50);
  assert.equal(taxed.breakdown.effectiveIrRatePct, 22.5);
  assert.ok(taxed.breakdown.iofAmount > 0);
  assert.ok(taxed.breakdown.irAmount > 0);
  assert.ok(taxed.currentValue < taxed.breakdown.grossValue);

  // Same investment with iofExempt = true (isento de IOF desde o 1º dia): IOF 0%, IR 22.5%
  const noIof = evaluateFixedIncomeAsOf(
    { ...baseAsset, iofExempt: true },
    tx15Days,
    "2026-11-18",
    sampleMacro
  );
  assert.equal(noIof.breakdown.iofAmount, 0);
  assert.equal(noIof.breakdown.effectiveIrRatePct, 22.5);
  assert.ok(noIof.currentValue > taxed.currentValue);
  assert.ok(noIof.currentValue < noIof.breakdown.grossValue);

  // LCI (irExempt = true, iofExempt = true): net === gross
  const lci = evaluateFixedIncomeAsOf(
    { ...baseAsset, fixedIncomeType: "LCI", irExempt: true, iofExempt: true },
    tx15Days,
    "2026-11-18",
    sampleMacro
  );
  assert.equal(lci.breakdown.iofAmount, 0);
  assert.equal(lci.breakdown.irAmount, 0);
  assert.equal(lci.breakdown.netValue, lci.breakdown.grossValue);
});

