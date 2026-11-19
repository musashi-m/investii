"use client";

import { useMemo, useState } from "react";
import {
  ArrowRight,
  Calculator,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  Flame,
  Info,
  Layers,
  Search,
  Snowflake,
  Sparkles,
  TrendingUp,
  Wallet,
} from "lucide-react";
import type { AssetPosition } from "@/types/portfolio";
import { formatCurrencyBRL, formatPct } from "@/lib/format";
import {
  calculateMagicNumber,
  type MagicNumberResult,
} from "@/lib/finance/magicNumber";

interface MagicNumberCalculatorProps {
  userPositions: AssetPosition[];
  onOpenAddTransaction?: (ticker: string) => void;
}

// Popular sample FIIs and Dividend Stocks in Brazil with typical recent metrics
const POPULAR_EXAMPLES = [
  { ticker: "MXRF11", name: "Maxi Renda FII", price: 10.15, dividend: 0.10 },
  { ticker: "HGLG11", name: "CSHG Logística FII", price: 161.50, dividend: 1.10 },
  { ticker: "XPML11", name: "XP Malls FII", price: 112.80, dividend: 0.92 },
  { ticker: "KNCR11", name: "Kinea Rendimentos FII", price: 104.20, dividend: 1.05 },
  { ticker: "BBAS3", name: "Banco do Brasil", price: 27.50, dividend: 0.23 },
  { ticker: "ITSA4", name: "Itaúsa", price: 10.40, dividend: 0.08 },
  { ticker: "TAEE11", name: "Taesa", price: 34.80, dividend: 0.32 },
];

export default function MagicNumberCalculator({
  userPositions,
  onOpenAddTransaction,
}: MagicNumberCalculatorProps) {
  const [activeTab, setActiveTab] = useState<"MY_ASSETS" | "SIMULATOR">("MY_ASSETS");

  // Simulator Inputs
  const [ticker, setTicker] = useState<string>("MXRF11");
  const [sharePrice, setSharePrice] = useState<number>(10.15);
  const [monthlyDividend, setMonthlyDividend] = useState<number>(0.10);
  const [currentShares, setCurrentShares] = useState<number>(35);
  const [monthlyContribution, setMonthlyContribution] = useState<number>(100);

  // Search input state
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<
    Array<{ ticker: string; name: string; price: number; category: string }>
  >([]);

  // Filter user's dividend-paying positions (FIIs, Ações, BDRs)
  const myDividendPositions = useMemo(() => {
    return userPositions.filter(
      (p) =>
        p.asset.category === "FIIS" ||
        p.asset.category === "ACOES" ||
        p.asset.category === "BDRS"
    );
  }, [userPositions]);

  // Compute magic number for all user positions
  const myPositionsCalculated = useMemo(() => {
    return myDividendPositions.map((pos) => {
      const price = pos.currentPrice > 0 ? pos.currentPrice : pos.averagePrice || 10;
      // Estimate monthly dividend: if 12m dividends exist, use them or fallback to ~0.85% a month for FIIs / 0.55% for Ações
      const dyAnnualPct =
        pos.currentValue > 0 && pos.dividends12m > 0
          ? (pos.dividends12m / pos.currentValue) * 100
          : 0;

      const estMonthlyDiv =
        dyAnnualPct > 0
          ? (price * (dyAnnualPct / 100)) / 12
          : pos.asset.category === "FIIS"
          ? price * 0.0085
          : price * 0.0055;

      const calc = calculateMagicNumber({
        ticker: pos.asset.ticker,
        sharePrice: price,
        monthlyDividend: estMonthlyDiv,
        currentShares: pos.quantity,
        monthlyContribution: 0,
      });

      return {
        position: pos,
        calc,
      };
    });
  }, [myDividendPositions]);

  // Active Simulator calculation
  const simResult: MagicNumberResult = useMemo(() => {
    return calculateMagicNumber({
      ticker,
      sharePrice,
      monthlyDividend,
      currentShares,
      monthlyContribution,
    });
  }, [ticker, sharePrice, monthlyDividend, currentShares, monthlyContribution]);

  async function handleSearch(q: string) {
    setSearchQuery(q);
    if (q.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    setIsSearching(true);
    try {
      const res = await fetch(`/api/market/search?q=${encodeURIComponent(q.trim())}`);
      if (res.ok) {
        const data = await res.json();
        setSearchResults(data.results || []);
      }
    } catch {
      // ignore
    } finally {
      setIsSearching(false);
    }
  }

  function selectTicker(selectedTicker: string, name: string, price: number) {
    setTicker(selectedTicker);
    setSharePrice(price > 0 ? price : 10);
    // Estimate reasonable default dividend if not specified
    const defaultDiv = (price > 0 ? price : 10) * 0.008;
    setMonthlyDividend(parseFloat(defaultDiv.toFixed(2)));
    setSearchQuery("");
    setSearchResults([]);
  }

  return (
    <div className="space-y-6">
      {/* Top Banner / Explanation */}
      <div className="rounded-2xl border border-amber-400/30 bg-gradient-to-r from-amber-500/10 via-[#141821] to-[#0c1018] p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-400/20 border border-amber-400/30 text-amber-400">
              <Snowflake className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white flex items-center gap-2">
                Calculadora do Número Mágico
                <span className="rounded-full bg-amber-400/20 px-2 py-0.5 text-[10px] font-extrabold text-amber-300">
                  Efeito Bola de Neve
                </span>
              </h1>
              <p className="mt-1 text-xs text-slate-300 max-w-2xl leading-relaxed">
                O <strong>Número Mágico</strong> é a quantidade exata de cotas que você precisa ter para que os dividendos mensais sejam suficientes para <strong>comprar 1 nova cota sozinho todo mês</strong>, fazendo seu patrimônio crescer exponencialmente no piloto automático!
              </p>
            </div>
          </div>

          {/* Tab Selector */}
          <div className="flex rounded-xl border border-white/10 bg-white/5 p-1 shrink-0 self-start sm:self-center">
            <button
              type="button"
              onClick={() => setActiveTab("MY_ASSETS")}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                activeTab === "MY_ASSETS"
                  ? "bg-amber-400 text-slate-950 shadow-xs"
                  : "text-slate-300 hover:text-white"
              }`}
            >
              <Wallet className="h-3.5 w-3.5" />
              <span>Meus Ativos ({myPositionsCalculated.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("SIMULATOR")}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                activeTab === "SIMULATOR"
                  ? "bg-amber-400 text-slate-950 shadow-xs"
                  : "text-slate-300 hover:text-white"
              }`}
            >
              <Calculator className="h-3.5 w-3.5" />
              <span>Simulador Aberto</span>
            </button>
          </div>
        </div>
      </div>

      {/* TAB 1: MEUS ATIVOS DA CARTEIRA */}
      {activeTab === "MY_ASSETS" && (
        <div className="space-y-4">
          {myPositionsCalculated.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[var(--border-strong)] bg-[var(--bg-surface)] p-8 text-center">
              <Snowflake className="mx-auto h-8 w-8 text-amber-500 mb-2" />
              <h3 className="text-sm font-bold text-[var(--text-primary)]">
                Nenhum FII ou Ação na carteira atual
              </h3>
              <p className="mt-1 text-xs text-[var(--text-muted)] max-w-md mx-auto">
                Cadastre seus ativos de renda variável para ver o progresso do Número Mágico de cada um ou use o <strong>Simulador Aberto</strong> ao lado!
              </p>
              <button
                type="button"
                onClick={() => setActiveTab("SIMULATOR")}
                className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-amber-400 px-3.5 py-2 text-xs font-bold text-slate-950 hover:bg-amber-300 transition-colors cursor-pointer"
              >
                Abrir Simulador Aberto
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {myPositionsCalculated.map(({ position, calc }) => (
                <div
                  key={position.asset.id}
                  className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 shadow-xs hover:border-amber-400/40 transition-all space-y-4"
                >
                  {/* Card Header */}
                  <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-base font-extrabold text-[var(--text-primary)]">
                          {position.asset.ticker}
                        </span>
                        <span className="rounded-md bg-[var(--bg-surface-subtle)] px-2 py-0.5 text-[10px] font-bold text-[var(--text-muted)] uppercase">
                          {position.asset.category}
                        </span>
                      </div>
                      <span className="text-xs text-[var(--text-muted)] truncate block max-w-[180px]">
                        {position.asset.name}
                      </span>
                    </div>

                    <div className="text-right">
                      <span className="text-xs text-[var(--text-muted)] block">Preço da cota</span>
                      <span className="text-sm font-bold text-[var(--text-primary)] tabular-nums">
                        {formatCurrencyBRL(calc.sharePrice)}
                      </span>
                    </div>
                  </div>

                  {/* Magic Number Target Hero */}
                  <div className="rounded-xl border border-amber-400/20 bg-amber-400/10 p-3 flex items-center justify-between">
                    <div>
                      <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 block">
                        Número Mágico
                      </span>
                      <span className="text-2xl font-black text-amber-500 tabular-nums">
                        {calc.magicNumberShares}{" "}
                        <span className="text-xs font-medium text-[var(--text-muted)]">cotas</span>
                      </span>
                    </div>

                    <div className="text-right">
                      <span className="text-[11px] text-[var(--text-muted)] block">Custo Total</span>
                      <span className="text-xs font-bold text-[var(--text-primary)] tabular-nums">
                        {formatCurrencyBRL(calc.magicNumberCost)}
                      </span>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div>
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="text-[var(--text-muted)]">
                        Você tem <strong className="text-[var(--text-primary)]">{calc.currentShares}</strong> cotas
                      </span>
                      <span className="font-extrabold text-amber-500 tabular-nums">
                        {calc.progressPct.toFixed(1)}%
                      </span>
                    </div>

                    <div className="h-2.5 w-full rounded-full bg-[var(--bg-surface-subtle)] overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-amber-500 to-emerald-500 transition-all duration-500"
                        style={{ width: `${Math.min(100, calc.progressPct)}%` }}
                      />
                    </div>
                  </div>

                  {/* Missing Info or Goal Met */}
                  <div className="border-t border-[var(--border-subtle)] pt-3 text-xs">
                    {calc.isMagicReached ? (
                      <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-bold">
                        <CheckCircle2 className="h-4 w-4" />
                        <span>Parabéns! Efeito bola de neve atingido neste ativo!</span>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-[11px] text-[var(--text-muted)] block">Faltam aportar</span>
                          <span className="font-bold text-[var(--text-primary)] tabular-nums">
                            {calc.missingShares} cotas ({formatCurrencyBRL(calc.missingCapital)})
                          </span>
                        </div>
                        {onOpenAddTransaction && (
                          <button
                            type="button"
                            onClick={() => onOpenAddTransaction(position.asset.ticker)}
                            className="rounded-lg bg-amber-400/20 px-2.5 py-1 text-[11px] font-bold text-amber-600 dark:text-amber-400 hover:bg-amber-400/30 transition-colors cursor-pointer"
                          >
                            + Aportar
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: SIMULADOR ABERTO (QUALQUER ATIVO) */}
      {activeTab === "SIMULATOR" && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Inputs Column (5 Cols) */}
          <div className="lg:col-span-5 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 shadow-xs space-y-4">
            <h2 className="text-sm font-bold text-[var(--text-primary)] border-b border-[var(--border-subtle)] pb-2.5 flex items-center gap-2">
              <Calculator className="h-4 w-4 text-amber-500" />
              Simular Qualquer Ativo
            </h2>

            {/* Quick Suggestions Pills */}
            <div>
              <span className="text-[11px] font-medium text-[var(--text-muted)] block mb-1.5">
                Escolha um exemplo popular:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {POPULAR_EXAMPLES.map((ex) => (
                  <button
                    key={ex.ticker}
                    type="button"
                    onClick={() => {
                      setTicker(ex.ticker);
                      setSharePrice(ex.price);
                      setMonthlyDividend(ex.dividend);
                    }}
                    className={`rounded-lg border px-2.5 py-1 text-[11px] font-bold transition-all cursor-pointer ${
                      ticker === ex.ticker
                        ? "border-amber-400 bg-amber-400/15 text-amber-500"
                        : "border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] text-[var(--text-secondary)] hover:border-amber-400"
                    }`}
                  >
                    {ex.ticker}
                  </button>
                ))}
              </div>
            </div>

            {/* Search Input for any ticker */}
            <div className="relative">
              <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">
                Buscar Ticker da B3
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-[var(--text-muted)]" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => handleSearch(e.target.value)}
                  placeholder="Ex: HGLG11, MXRF11, BBAS3..."
                  className="w-full rounded-xl border border-[var(--border-strong)] bg-[var(--bg-surface-subtle)] pl-9 pr-3 py-2 text-xs font-semibold uppercase text-[var(--text-primary)] outline-none focus:border-amber-500"
                />
              </div>

              {/* Search Dropdown Results */}
              {searchResults.length > 0 && (
                <div className="absolute left-0 right-0 top-full mt-1 max-h-48 overflow-y-auto rounded-xl border border-[var(--border-strong)] bg-[var(--bg-surface)] p-1 shadow-2xl z-20">
                  {searchResults.map((res) => (
                    <button
                      key={res.ticker}
                      type="button"
                      onClick={() => selectTicker(res.ticker, res.name, res.price)}
                      className="flex w-full items-center justify-between rounded-lg p-2 text-left text-xs hover:bg-[var(--bg-surface-subtle)] cursor-pointer"
                    >
                      <div>
                        <span className="font-bold text-[var(--text-primary)] block">
                          {res.ticker}
                        </span>
                        <span className="text-[10px] text-[var(--text-muted)] truncate block max-w-[200px]">
                          {res.name}
                        </span>
                      </div>
                      <span className="font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                        {formatCurrencyBRL(res.price)}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Preço da Cota & Dividendo Mensal */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">
                  Preço da Cota (R$)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={sharePrice || ""}
                  onChange={(e) => setSharePrice(parseFloat(e.target.value) || 0.01)}
                  className="w-full rounded-xl border border-[var(--border-strong)] bg-[var(--bg-surface-subtle)] px-3 py-2 text-sm font-bold text-[var(--text-primary)] tabular-nums outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">
                  Dividendo Mensal (R$)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.001"
                  value={monthlyDividend || ""}
                  onChange={(e) => setMonthlyDividend(parseFloat(e.target.value) || 0.001)}
                  className="w-full rounded-xl border border-[var(--border-strong)] bg-[var(--bg-surface-subtle)] px-3 py-2 text-sm font-bold text-[var(--text-primary)] tabular-nums outline-none focus:border-amber-500"
                />
              </div>
            </div>

            <div className="text-[11px] text-[var(--text-muted)] flex items-center justify-between border-t border-[var(--border-subtle)] pt-2">
              <span>Dividend Yield estimado:</span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400">
                {simResult.dividendYieldMonthlyPct.toFixed(2)}%/mês ({formatPct(simResult.dividendYieldAnnualPct)} a.a.)
              </span>
            </div>

            {/* Suas Cotas Atuais & Aporte Mensal Planejado */}
            <div className="grid grid-cols-2 gap-3 pt-2">
              <div>
                <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">
                  Suas Cotas Atuais
                </label>
                <input
                  type="number"
                  min="0"
                  value={currentShares || ""}
                  onChange={(e) => setCurrentShares(parseInt(e.target.value, 10) || 0)}
                  placeholder="0"
                  className="w-full rounded-xl border border-[var(--border-strong)] bg-[var(--bg-surface-subtle)] px-3 py-2 text-sm font-bold text-[var(--text-primary)] tabular-nums outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">
                  Aporte Mensal (R$)
                </label>
                <input
                  type="number"
                  step="50"
                  min="0"
                  value={monthlyContribution || ""}
                  onChange={(e) => setMonthlyContribution(parseFloat(e.target.value) || 0)}
                  placeholder="0,00"
                  className="w-full rounded-xl border border-[var(--border-strong)] bg-[var(--bg-surface-subtle)] px-3 py-2 text-sm font-bold text-[var(--text-primary)] tabular-nums outline-none focus:border-amber-500"
                />
              </div>
            </div>
          </div>

          {/* Results Column (7 Cols) */}
          <div className="lg:col-span-7 space-y-4">
            {/* Giant Magic Card */}
            <div className="rounded-2xl border border-amber-400/40 bg-gradient-to-br from-[#141821] to-[#0a0e17] p-6 text-white shadow-xl relative overflow-hidden">
              <div className="absolute right-0 top-0 translate-x-8 -translate-y-8 w-44 h-44 bg-amber-400/10 rounded-full blur-3xl pointer-events-none" />

              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                  <Snowflake className="h-4 w-4" />
                  Número Mágico para {ticker || "o Ativo"}
                </span>
                <span className="rounded-full bg-amber-400/20 border border-amber-400/40 px-2.5 py-0.5 text-xs font-bold text-amber-300">
                  1 cota nova/mês grátis
                </span>
              </div>

              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-4xl sm:text-5xl font-black text-amber-400 tabular-nums">
                  {simResult.magicNumberShares}
                </span>
                <span className="text-sm font-medium text-slate-300">cotas necessárias</span>
              </div>

              <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-3 border-t border-white/10 pt-4 text-xs">
                <div>
                  <span className="text-slate-400 block text-[11px]">Custo Total para Atingir</span>
                  <span className="font-bold text-white tabular-nums">
                    {formatCurrencyBRL(simResult.magicNumberCost)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Renda Mensal Passiva</span>
                  <span className="font-bold text-emerald-400 tabular-nums">
                    {formatCurrencyBRL(simResult.monthlyIncomeAtMagicNumber)} /mês
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Tempo Estimado</span>
                  <span className="font-bold text-amber-300 tabular-nums">
                    {simResult.isMagicReached
                      ? "Atingido!"
                      : simResult.monthsToGoal !== null
                      ? `~${simResult.monthsToGoal} meses`
                      : "Sem aporte informado"}
                  </span>
                </div>
              </div>
            </div>

            {/* User Progress Bar if currentShares > 0 */}
            <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 shadow-xs space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[var(--text-secondary)]">
                  Seu progresso atual:{" "}
                  <strong className="text-[var(--text-primary)]">
                    {simResult.currentShares} de {simResult.magicNumberShares} cotas
                  </strong>
                </span>
                <span className="font-extrabold text-amber-500 tabular-nums">
                  {simResult.progressPct.toFixed(1)}%
                </span>
              </div>

              <div className="h-3 w-full rounded-full bg-[var(--bg-surface-subtle)] overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-amber-500 to-emerald-500 transition-all duration-500"
                  style={{ width: `${Math.min(100, simResult.progressPct)}%` }}
                />
              </div>

              <div className="flex items-center justify-between text-[11px] text-[var(--text-muted)] pt-1">
                <span>Renda atual: {formatCurrencyBRL(simResult.currentMonthlyIncome)}/mês</span>
                <span>
                  Faltam: <strong>{simResult.missingShares} cotas</strong> ({formatCurrencyBRL(simResult.missingCapital)})
                </span>
              </div>
            </div>

            {/* Snowball Levels Table */}
            <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 shadow-xs">
              <h3 className="text-xs font-bold text-[var(--text-primary)] mb-2.5 flex items-center gap-1.5">
                <Layers className="h-4 w-4 text-amber-500" />
                Níveis do Efeito Bola de Neve (Multiplicadores)
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-[var(--border-subtle)] text-[11px] text-[var(--text-muted)] uppercase">
                    <tr>
                      <th className="py-2 px-3">Nível</th>
                      <th className="py-2 px-3 text-right">Cotas</th>
                      <th className="py-2 px-3 text-right">Capital Investido</th>
                      <th className="py-2 px-3 text-right">Renda Mensal</th>
                      <th className="py-2 px-3 text-right">Renda Anual</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-subtle)]">
                    {simResult.tiers.map((t) => (
                      <tr key={t.sharesPerMonth} className="hover:bg-[var(--bg-surface-subtle)]">
                        <td className="py-2 px-3 font-semibold text-[var(--text-primary)] flex items-center gap-1">
                          <Flame className="h-3.5 w-3.5 text-amber-500" />
                          +{t.sharesPerMonth} cota{t.sharesPerMonth > 1 ? "s" : ""}/mês
                        </td>
                        <td className="py-2 px-3 text-right font-medium text-[var(--text-primary)] tabular-nums">
                          {t.totalSharesNeeded}
                        </td>
                        <td className="py-2 px-3 text-right font-medium text-[var(--text-secondary)] tabular-nums">
                          {formatCurrencyBRL(t.totalCapitalRequired)}
                        </td>
                        <td className="py-2 px-3 text-right font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                          {formatCurrencyBRL(t.monthlyIncomeGenerated)}
                        </td>
                        <td className="py-2 px-3 text-right font-bold text-[var(--text-primary)] tabular-nums">
                          {formatCurrencyBRL(t.annualIncomeGenerated)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

