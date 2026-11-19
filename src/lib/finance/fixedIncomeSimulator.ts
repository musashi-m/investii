import { getIofRatePct, getIrRatePct } from "./calculator.ts";

export type IndexerType = "PRE" | "CDI" | "SELIC" | "IPCA";

export interface FixedIncomeSimulationParams {
  initialAmount: number;
  monthlyContribution: number;
  periodValue: number;
  periodUnit: "MONTHS" | "YEARS";
  indexer: IndexerType;
  ratePct: number;
  customCdiAnnualPct?: number;
  customSelicAnnualPct?: number;
  customIpcaAnnualPct?: number;
  isIrExempt?: boolean;
  isIofExempt?: boolean;
  skipBenchmarks?: boolean;
}

export interface ContributionLotResult {
  lotIndex: number; // 0 = aporte inicial, 1..N = aportes mensais
  label: string;
  investedAmount: number;
  monthsInvested: number;
  calendarDays: number;
  grossYield: number;
  grossBalance: number;
  iofRatePct: number;
  iofAmount: number;
  irRatePct: number;
  irAmount: number;
  netYield: number;
  netBalance: number;
}

export interface MonthlyProgressionPoint {
  month: number;
  label: string;
  totalInvested: number;
  grossBalance: number;
  netBalance: number;
  grossInterestEarned: number;
  netInterestEarned: number;
  totalIrPaid: number;
}

export interface FixedIncomeSimulationResult {
  totalInvested: number;
  grossInterest: number;
  grossTotal: number;
  totalIof: number;
  totalIr: number;
  netTotal: number;
  effectiveIrRatePct: number;
  netYieldPct: number;
  netAnnualizedYieldPct: number;
  effectiveAnnualRatePct: number;
  effectiveMonthlyRatePct: number;
  totalMonths: number;
  lots: ContributionLotResult[];
  progression: MonthlyProgressionPoint[];
  benchmarks: {
    poupancaNetTotal: number;
    poupancaYield: number;
    cdi100NetTotal: number;
    cdi100Yield: number;
    differenceFromPoupanca: number;
  };
}

/**
 * Resolves the effective annual interest rate (%) given the chosen indexer
 * and market reference rates (CDI, Selic, IPCA).
 */
export function resolveSimulationAnnualRate(
  indexer: IndexerType,
  ratePct: number,
  cdiAnnual: number = 13.65,
  selicAnnual: number = 13.75,
  ipcaAnnual: number = 4.5
): number {
  switch (indexer) {
    case "CDI":
      // ratePct is % of CDI, e.g. 100 means 100% CDI, 115 means 115% CDI
      return cdiAnnual * (ratePct / 100);
    case "SELIC":
      // ratePct is % of Selic or Selic rate
      return selicAnnual * (ratePct / 100);
    case "IPCA":
      // ratePct is real interest spread, e.g. 6.5% + IPCA
      return ((1 + ipcaAnnual / 100) * (1 + ratePct / 100) - 1) * 100;
    case "PRE":
    default:
      return ratePct;
  }
}

/**
 * Simulates a chronological fixed income investment with initial deposit + monthly contributions.
 * Each monthly contribution lot is tracked individually to apply the accurate Brazilian
 * regressive Income Tax (IR) brackets based on its own holding duration (cronologia dos aportes).
 */
export function simulateFixedIncome(
  params: FixedIncomeSimulationParams
): FixedIncomeSimulationResult {
  const initial = Math.max(0, Number(params.initialAmount) || 0);
  const monthly = Math.max(0, Number(params.monthlyContribution) || 0);
  const totalMonths = Math.max(
    1,
    Math.min(
      600, // max 50 years
      params.periodUnit === "YEARS"
        ? Math.round((Number(params.periodValue) || 1) * 12)
        : Math.round(Number(params.periodValue) || 1)
    )
  );

  const cdiAnnual = params.customCdiAnnualPct ?? 13.65;
  const selicAnnual = params.customSelicAnnualPct ?? 13.75;
  const ipcaAnnual = params.customIpcaAnnualPct ?? 4.5;
  const isIrExempt = !!params.isIrExempt;
  const isIofExempt = !!params.isIofExempt;

  // 1. Determine annual and monthly gross compounding rates
  const annualRatePct = resolveSimulationAnnualRate(
    params.indexer,
    Number(params.ratePct) || 0,
    cdiAnnual,
    selicAnnual,
    ipcaAnnual
  );
  const annualFactor = 1 + annualRatePct / 100;
  const monthlyRate = Math.pow(annualFactor, 1 / 12) - 1;
  const monthlyRatePct = monthlyRate * 100;

  // 2. Track lots individually for chronological tax calculation
  const lots: ContributionLotResult[] = [];

  // Initial lot (month 0)
  if (initial > 0 || totalMonths > 0) {
    const calendarDays = Math.round(totalMonths * 30.4167);
    const grossBalance = initial * Math.pow(1 + monthlyRate, totalMonths);
    const grossYield = Math.max(0, grossBalance - initial);

    const iofRate = getIofRatePct(calendarDays, isIofExempt);
    const iofAmount = (grossYield * iofRate) / 100;
    const taxableYield = Math.max(0, grossYield - iofAmount);

    const irRate = getIrRatePct(calendarDays, isIrExempt);
    const irAmount = (taxableYield * irRate) / 100;

    const netYield = grossYield - iofAmount - irAmount;
    const netBalance = initial + netYield;

    lots.push({
      lotIndex: 0,
      label: "Aporte Inicial",
      investedAmount: initial,
      monthsInvested: totalMonths,
      calendarDays,
      grossYield,
      grossBalance,
      iofRatePct: iofRate,
      iofAmount,
      irRatePct: irRate,
      irAmount,
      netYield,
      netBalance,
    });
  }

  // Monthly contribution lots (months 1..N)
  for (let m = 1; m <= totalMonths; m++) {
    if (monthly <= 0) continue;

    // Aporte feito no início do mês m rende até o final do mês totalMonths
    const monthsInvested = totalMonths - m + 1;
    const calendarDays = Math.round(monthsInvested * 30.4167);

    const grossBalance = monthly * Math.pow(1 + monthlyRate, monthsInvested);
    const grossYield = Math.max(0, grossBalance - monthly);

    const iofRate = getIofRatePct(calendarDays, isIofExempt);
    const iofAmount = (grossYield * iofRate) / 100;
    const taxableYield = Math.max(0, grossYield - iofAmount);

    const irRate = getIrRatePct(calendarDays, isIrExempt);
    const irAmount = (taxableYield * irRate) / 100;

    const netYield = grossYield - iofAmount - irAmount;
    const netBalance = monthly + netYield;

    lots.push({
      lotIndex: m,
      label: `Mês ${m}`,
      investedAmount: monthly,
      monthsInvested,
      calendarDays,
      grossYield,
      grossBalance,
      iofRatePct: iofRate,
      iofAmount,
      irRatePct: irRate,
      irAmount,
      netYield,
      netBalance,
    });
  }

  // 3. Aggregate totals across all lots
  const totalInvested = lots.reduce((acc, l) => acc + l.investedAmount, 0);
  const grossInterest = lots.reduce((acc, l) => acc + l.grossYield, 0);
  const grossTotal = totalInvested + grossInterest;
  const totalIof = lots.reduce((acc, l) => acc + l.iofAmount, 0);
  const totalIr = lots.reduce((acc, l) => acc + l.irAmount, 0);
  const netTotal = lots.reduce((acc, l) => acc + l.netBalance, 0);

  const effectiveIrRatePct =
    grossInterest > 0 ? (totalIr / grossInterest) * 100 : 0;

  const netYieldPct =
    totalInvested > 0 ? ((netTotal - totalInvested) / totalInvested) * 100 : 0;

  const yearsInvested = totalMonths / 12;
  const netAnnualizedYieldPct =
    yearsInvested > 0 && totalInvested > 0
      ? (Math.pow(netTotal / totalInvested, 1 / yearsInvested) - 1) * 100
      : 0;

  // 4. Monthly progression timeline (for chart and table)
  const progression: MonthlyProgressionPoint[] = [];

  // Month 0 (Starting point)
  progression.push({
    month: 0,
    label: "Início",
    totalInvested: initial,
    grossBalance: initial,
    netBalance: initial,
    grossInterestEarned: 0,
    netInterestEarned: 0,
    totalIrPaid: 0,
  });

  // Month by month accumulation
  for (let currentMonth = 1; currentMonth <= totalMonths; currentMonth++) {
    let cumInvested = initial;
    let cumGross = initial * Math.pow(1 + monthlyRate, currentMonth);
    let cumIr = 0;
    let cumIof = 0;

    // Initial lot IR as of currentMonth
    const initDays = Math.round(currentMonth * 30.4167);
    const initGrossInterest = Math.max(0, cumGross - initial);
    const initIof = (initGrossInterest * getIofRatePct(initDays, isIofExempt)) / 100;
    const initIr = ((initGrossInterest - initIof) * getIrRatePct(initDays, isIrExempt)) / 100;
    cumIr += initIr;
    cumIof += initIof;

    for (let k = 1; k <= currentMonth; k++) {
      cumInvested += monthly;
      const kMonthsInvested = currentMonth - k + 1;
      const kDays = Math.round(kMonthsInvested * 30.4167);
      const kGross = monthly * Math.pow(1 + monthlyRate, kMonthsInvested);
      const kInterest = Math.max(0, kGross - monthly);
      const kIof = (kInterest * getIofRatePct(kDays, isIofExempt)) / 100;
      const kIr = ((kInterest - kIof) * getIrRatePct(kDays, isIrExempt)) / 100;
      cumGross += kGross - monthly; // add the pure compounding above principal
      cumIr += kIr;
      cumIof += kIof;
    }

    const cumGrossTotal = cumInvested + Math.max(0, cumGross - initial);
    const cumNetInterest = Math.max(0, cumGross - initial) - cumIr - cumIof;
    const cumNetTotal = cumInvested + cumNetInterest;

    progression.push({
      month: currentMonth,
      label: currentMonth % 12 === 0 ? `${currentMonth / 12} ano(s)` : `Mês ${currentMonth}`,
      totalInvested: cumInvested,
      grossBalance: cumGrossTotal,
      netBalance: cumNetTotal,
      grossInterestEarned: Math.max(0, cumGross - initial),
      netInterestEarned: cumNetInterest,
      totalIrPaid: cumIr,
    });
  }

  // 5. Benchmark comparisons
  // Poupança: ~0.5% ao mês (isentos de IR)
  const poupancaMonthlyRate = 0.005;
  let poupancaNet = initial * Math.pow(1 + poupancaMonthlyRate, totalMonths);
  for (let m = 1; m <= totalMonths; m++) {
    poupancaNet += monthly * Math.pow(1 + poupancaMonthlyRate, totalMonths - m + 1);
  }
  const poupancaYield = Math.max(0, poupancaNet - totalInvested);

  // CDB 100% CDI benchmark (only compute if not skipBenchmarks to avoid recursion)
  let cdi100NetTotal = 0;
  if (!params.skipBenchmarks) {
    const cdi100Sim = simulateFixedIncome({
      initialAmount: initial,
      monthlyContribution: monthly,
      periodValue: totalMonths,
      periodUnit: "MONTHS",
      indexer: "CDI",
      ratePct: 100,
      customCdiAnnualPct: cdiAnnual,
      isIrExempt: false,
      isIofExempt: isIofExempt,
      skipBenchmarks: true,
    });
    cdi100NetTotal = cdi100Sim.netTotal;
  }

  return {
    totalInvested,
    grossInterest,
    grossTotal,
    totalIof,
    totalIr,
    netTotal,
    effectiveIrRatePct,
    netYieldPct,
    netAnnualizedYieldPct,
    effectiveAnnualRatePct: annualRatePct,
    effectiveMonthlyRatePct: monthlyRatePct,
    totalMonths,
    lots,
    progression,
    benchmarks: {
      poupancaNetTotal: poupancaNet,
      poupancaYield,
      cdi100NetTotal: cdi100NetTotal,
      cdi100Yield: Math.max(0, cdi100NetTotal - totalInvested),
      differenceFromPoupanca: netTotal - poupancaNet,
    },
  };
}
