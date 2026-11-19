export interface MagicNumberParams {
  ticker?: string;
  sharePrice: number; // Preço unitário da cota (R$)
  monthlyDividend: number; // Dividendo mensal por cota (R$)
  currentShares?: number; // Quantidade de cotas que o usuário já possui
  monthlyContribution?: number; // Aporte mensal planejado (R$)
}

export interface SnowballTier {
  sharesPerMonth: number; // Ex: 1 cota/mês, 2 cotas/mês, etc.
  totalSharesNeeded: number;
  totalCapitalRequired: number;
  monthlyIncomeGenerated: number;
  annualIncomeGenerated: number;
}

export interface MagicNumberResult {
  ticker?: string;
  sharePrice: number;
  monthlyDividend: number;
  dividendYieldMonthlyPct: number;
  dividendYieldAnnualPct: number;
  magicNumberShares: number; // Quantidade de cotas para comprar 1 cota/mês
  magicNumberCost: number; // Valor financeiro total para atingir o número mágico
  monthlyIncomeAtMagicNumber: number; // Renda mensal gerada no número mágico
  currentShares: number;
  currentValue: number;
  currentMonthlyIncome: number;
  missingShares: number;
  missingCapital: number;
  progressPct: number;
  isMagicReached: boolean;
  monthsToGoal: number | null;
  tiers: SnowballTier[];
}

/**
 * Calculates the Magic Number (Número Mágico) for Real Estate Investment Trusts (FIIs)
 * and Dividend Stocks (Ações de Dividendos).
 *
 * Magic Number is the exact number of shares needed so that the monthly dividend
 * payout is sufficient to purchase at least 1 new share automatically (the snowball effect).
 */
export function calculateMagicNumber(params: MagicNumberParams): MagicNumberResult {
  const sharePrice = Math.max(0.01, Number(params.sharePrice) || 0.01);
  const monthlyDividend = Math.max(0.0001, Number(params.monthlyDividend) || 0.0001);
  const currentShares = Math.max(0, Number(params.currentShares) || 0);
  const monthlyContribution = Math.max(0, Number(params.monthlyContribution) || 0);

  // 1. Core Magic Number
  const magicNumberShares = Math.ceil(sharePrice / monthlyDividend);
  const magicNumberCost = magicNumberShares * sharePrice;
  const monthlyIncomeAtMagicNumber = magicNumberShares * monthlyDividend;

  // 2. Yields
  const dividendYieldMonthlyPct = (monthlyDividend / sharePrice) * 100;
  const dividendYieldAnnualPct =
    (Math.pow(1 + dividendYieldMonthlyPct / 100, 12) - 1) * 100;

  // 3. User progress
  const currentValue = currentShares * sharePrice;
  const currentMonthlyIncome = currentShares * monthlyDividend;
  const missingShares = Math.max(0, magicNumberShares - currentShares);
  const missingCapital = missingShares * sharePrice;
  const progressPct = Math.min(100, (currentShares / magicNumberShares) * 100);
  const isMagicReached = currentShares >= magicNumberShares;

  // 4. Time to goal
  let monthsToGoal: number | null = null;
  if (isMagicReached) {
    monthsToGoal = 0;
  } else if (monthlyContribution > 0) {
    // Estimativa considerando o aporte mensal + reinvestimento dos dividendos atuais
    let shares = currentShares;
    let months = 0;
    const maxMonths = 360; // 30 anos limite
    while (shares < magicNumberShares && months < maxMonths) {
      months++;
      const divIncome = shares * monthlyDividend;
      const totalAvailable = monthlyContribution + divIncome;
      const newSharesBought = Math.floor(totalAvailable / sharePrice);
      shares += newSharesBought;
    }
    monthsToGoal = months;
  }

  // 5. Snowball Tiers (1 cota/mês, 2 cotas/mês, 5 cotas/mês, 10 cotas/mês, 20 cotas/mês)
  const tierMultipliers = [1, 2, 5, 10, 20];
  const tiers: SnowballTier[] = tierMultipliers.map((multiplier) => {
    const totalSharesNeeded = magicNumberShares * multiplier;
    const totalCapitalRequired = totalSharesNeeded * sharePrice;
    const monthlyIncomeGenerated = totalSharesNeeded * monthlyDividend;
    const annualIncomeGenerated = monthlyIncomeGenerated * 12;
    return {
      sharesPerMonth: multiplier,
      totalSharesNeeded,
      totalCapitalRequired,
      monthlyIncomeGenerated,
      annualIncomeGenerated,
    };
  });

  return {
    ticker: params.ticker,
    sharePrice,
    monthlyDividend,
    dividendYieldMonthlyPct,
    dividendYieldAnnualPct,
    magicNumberShares,
    magicNumberCost,
    monthlyIncomeAtMagicNumber,
    currentShares,
    currentValue,
    currentMonthlyIncome,
    missingShares,
    missingCapital,
    progressPct,
    isMagicReached,
    monthsToGoal,
    tiers,
  };
}

