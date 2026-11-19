"use client";

import { useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  Calculator,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Coins,
  FileSpreadsheet,
  Info,
  Landmark,
  Percent,
  PiggyBank,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { MacroRates } from "@/types/portfolio";
import { formatBRL, formatCurrencyBRL, formatPct } from "@/lib/format";
import {
  simulateFixedIncome,
  type IndexerType,
} from "@/lib/finance/fixedIncomeSimulator";

interface FixedIncomeCalculatorProps {
  macro: MacroRates;
}

interface PresetOption {
  name: string;
  category: string;
  indexer: IndexerType;
  ratePct: number;
  isIrExempt: boolean;
  isIofExempt: boolean;
}

const PRESETS: PresetOption[] = [
  {
    name: "CDB 100% CDI",
    category: "CDB",
    indexer: "CDI",
    ratePct: 100,
    isIrExempt: false,
    isIofExempt: false,
  },
  {
    name: "CDB 115% CDI",
    category: "CDB",
    indexer: "CDI",
    ratePct: 115,
    isIrExempt: false,
    isIofExempt: false,
  },
  {
    name: "LCI / LCA 90% CDI (Isento)",
    category: "LCI_LCA",
    indexer: "CDI",
    ratePct: 90,
    isIrExempt: true,
    isIofExempt: true,
  },
  {
    name: "Tesouro Selic",
    category: "TESOURO",
    indexer: "SELIC",
    ratePct: 100,
    isIrExempt: false,
    isIofExempt: false,
  },
  {
    name: "Tesouro IPCA+ 6,5% a.a.",
    category: "TESOURO",
    indexer: "IPCA",
    ratePct: 6.5,
    isIrExempt: false,
    isIofExempt: false,
  },
  {
    name: "Prefixado 13% a.a.",
    category: "PREFIXADO",
    indexer: "PRE",
    ratePct: 13,
    isIrExempt: false,
    isIofExempt: false,
  },
];

export default function FixedIncomeCalculator({ macro }: FixedIncomeCalculatorProps) {
  // Inputs
  const [initialAmount, setInitialAmount] = useState<number>(10000);
  const [monthlyContribution, setMonthlyContribution] = useState<number>(1000);
  const [periodValue, setPeriodValue] = useState<number>(2);
  const [periodUnit, setPeriodUnit] = useState<"MONTHS" | "YEARS">("YEARS");
  const [indexer, setIndexer] = useState<IndexerType>("CDI");
  const [ratePct, setRatePct] = useState<number>(100);
  const [isIrExempt, setIsIrExempt] = useState<boolean>(false);
  const [isIofExempt, setIsIofExempt] = useState<boolean>(false);

  // Reference macro overrides
  const [customCdi, setCustomCdi] = useState<number>(macro.cdiAnnualPct || 13.65);
  const [customSelic, setCustomSelic] = useState<number>(macro.selicAnnualPct || 13.75);
  const [customIpca, setCustomIpca] = useState<number>(macro.ipca12mPct || 4.5);

  // Accordion for lots table
  const [showLotsTable, setShowLotsTable] = useState<boolean>(false);

  // Perform chronological simulation
  const result = useMemo(() => {
    return simulateFixedIncome({
      initialAmount,
      monthlyContribution,
      periodValue,
      periodUnit,
      indexer,
      ratePct,
      customCdiAnnualPct: customCdi,
      customSelicAnnualPct: customSelic,
      customIpcaAnnualPct: customIpca,
      isIrExempt,
      isIofExempt,
    });
  }, [
    initialAmount,
    monthlyContribution,
    periodValue,
    periodUnit,
    indexer,
    ratePct,
    customCdi,
    customSelic,
    customIpca,
    isIrExempt,
    isIofExempt,
  ]);

  function applyPreset(preset: PresetOption) {
    setIndexer(preset.indexer);
    setRatePct(preset.ratePct);
    setIsIrExempt(preset.isIrExempt);
    setIsIofExempt(preset.isIofExempt);
  }

  return (
    <div className="space-y-6">
      {/* Page Title & Subtitle */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-[var(--text-primary)] flex items-center gap-2">
            <Calculator className="h-5 w-5 text-amber-500" />
            Calculadora de Renda Fixa & Simulação
          </h1>
          <p className="text-xs text-[var(--text-muted)]">
            Simule aportes iniciais e mensais com alíquota regressiva de IR calculada individualmente por lote cronológico
          </p>
        </div>

        {/* Quick Presets Pills */}
        <div className="flex flex-wrap items-center gap-1.5 pt-2 sm:pt-0">
          <span className="text-[11px] font-semibold text-[var(--text-muted)] mr-1">
            Exemplos rápidos:
          </span>
          {PRESETS.map((p) => (
            <button
              key={p.name}
              type="button"
              onClick={() => applyPreset(p)}
              className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] px-2.5 py-1 text-[11px] font-medium text-[var(--text-secondary)] hover:border-amber-400 hover:text-amber-500 transition-colors cursor-pointer"
            >
              {p.name}
            </button>
          ))}
        </div>
      </div>

      {/* Main Grid: Inputs Form & Results Highlights */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Form: Inputs (5 Cols) */}
        <div className="lg:col-span-5 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 shadow-xs space-y-4">
          <h2 className="text-sm font-bold text-[var(--text-primary)] border-b border-[var(--border-subtle)] pb-2.5 flex items-center gap-2">
            <Coins className="h-4 w-4 text-emerald-500" />
            Parâmetros da Simulação
          </h2>

          {/* Saldo Inicial & Aporte Mensal */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">
                Saldo Inicial (R$)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-xs text-[var(--text-muted)]">R$</span>
                <input
                  type="number"
                  min="0"
                  step="100"
                  value={initialAmount || ""}
                  onChange={(e) => setInitialAmount(Math.max(0, parseFloat(e.target.value) || 0))}
                  placeholder="0,00"
                  className="w-full rounded-xl border border-[var(--border-strong)] bg-[var(--bg-surface-subtle)] pl-9 pr-3 py-2 text-sm font-bold text-[var(--text-primary)] tabular-nums outline-none focus:border-amber-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">
                Aporte Mensal (R$)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-xs text-[var(--text-muted)]">R$</span>
                <input
                  type="number"
                  min="0"
                  step="50"
                  value={monthlyContribution || ""}
                  onChange={(e) => setMonthlyContribution(Math.max(0, parseFloat(e.target.value) || 0))}
                  placeholder="0,00"
                  className="w-full rounded-xl border border-[var(--border-strong)] bg-[var(--bg-surface-subtle)] pl-9 pr-3 py-2 text-sm font-bold text-[var(--text-primary)] tabular-nums outline-none focus:border-amber-500"
                />
              </div>
            </div>
          </div>

          {/* Prazo (Tempo & Unidade) */}
          <div>
            <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">
              Prazo de Investimento
            </label>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="number"
                min="1"
                max={periodUnit === "YEARS" ? 40 : 480}
                value={periodValue || ""}
                onChange={(e) => setPeriodValue(Math.max(1, parseInt(e.target.value, 10) || 1))}
                className="w-full rounded-xl border border-[var(--border-strong)] bg-[var(--bg-surface-subtle)] px-3 py-2 text-sm font-bold text-[var(--text-primary)] tabular-nums outline-none focus:border-amber-500"
              />
              <div className="flex rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] p-1">
                <button
                  type="button"
                  onClick={() => setPeriodUnit("MONTHS")}
                  className={`flex-1 rounded-lg py-1 text-xs font-semibold transition-colors cursor-pointer ${
                    periodUnit === "MONTHS"
                      ? "bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-xs"
                      : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                  }`}
                >
                  Meses
                </button>
                <button
                  type="button"
                  onClick={() => setPeriodUnit("YEARS")}
                  className={`flex-1 rounded-lg py-1 text-xs font-semibold transition-colors cursor-pointer ${
                    periodUnit === "YEARS"
                      ? "bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-xs"
                      : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                  }`}
                >
                  Anos
                </button>
              </div>
            </div>
            <p className="mt-1 text-[11px] text-[var(--text-muted)]">
              Equivalente a <strong className="text-[var(--text-primary)]">{result.totalMonths} meses</strong> ({Math.round(result.totalMonths * 30.4167)} dias corridos)
            </p>
          </div>

          {/* Tipo de Rentabilidade & Taxa */}
          <div className="space-y-2">
            <label className="block text-xs font-medium text-[var(--text-muted)]">
              Indexador & Taxa Contratada
            </label>
            <div className="grid grid-cols-4 gap-1.5">
              {(["CDI", "SELIC", "IPCA", "PRE"] as IndexerType[]).map((idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    setIndexer(idx);
                    if (idx === "CDI") setRatePct(100);
                    if (idx === "SELIC") setRatePct(100);
                    if (idx === "IPCA") setRatePct(6.5);
                    if (idx === "PRE") setRatePct(13.0);
                  }}
                  className={`rounded-xl border py-2 text-xs font-bold transition-all cursor-pointer ${
                    indexer === idx
                      ? "border-amber-400 bg-amber-400/15 text-amber-500 shadow-xs"
                      : "border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] text-[var(--text-secondary)] hover:border-[var(--border-strong)]"
                  }`}
                >
                  {idx === "PRE" ? "Prefixado" : idx}
                </button>
              ))}
            </div>

            {/* Input da taxa de acordo com o indexador */}
            <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] p-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-[var(--text-primary)]">
                  {indexer === "CDI" && "% do CDI"}
                  {indexer === "SELIC" && "% da Selic"}
                  {indexer === "IPCA" && "Taxa IPCA+ (% a.a.)"}
                  {indexer === "PRE" && "Taxa Prefixada (% a.a.)"}
                </span>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    step="0.1"
                    value={ratePct || ""}
                    onChange={(e) => setRatePct(parseFloat(e.target.value) || 0)}
                    className="w-24 rounded-lg border border-[var(--border-strong)] bg-[var(--bg-surface)] px-2.5 py-1 text-right text-sm font-bold text-[var(--text-primary)] tabular-nums outline-none focus:border-amber-500"
                  />
                  <span className="text-xs font-semibold text-[var(--text-muted)]">
                    {indexer === "CDI" || indexer === "SELIC" ? "%" : "% a.a."}
                  </span>
                </div>
              </div>

              {/* Taxa efetiva calculada */}
              <div className="mt-2 text-[11px] text-[var(--text-muted)] flex items-center justify-between border-t border-[var(--border-subtle)] pt-1.5">
                <span>Taxa anual bruta equivalente:</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">
                  {formatPct(result.effectiveAnnualRatePct)} a.a. (~{result.effectiveMonthlyRatePct.toFixed(2)}%/mês)
                </span>
              </div>
            </div>
          </div>

          {/* Isenções Fiscais (IR e IOF) */}
          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] p-3 space-y-2.5">
            <span className="text-xs font-bold text-[var(--text-primary)] block">
              Isenções Fiscais
            </span>

            <label className="flex items-center justify-between cursor-pointer">
              <span className="text-xs text-[var(--text-secondary)]">
                Isento de Imposto de Renda (LCI, LCA, CRI, CRA)
              </span>
              <input
                type="checkbox"
                checked={isIrExempt}
                onChange={(e) => setIsIrExempt(e.target.checked)}
                className="h-4 w-4 rounded border-[var(--border-strong)] accent-emerald-500 cursor-pointer"
              />
            </label>

            <label className="flex items-center justify-between cursor-pointer">
              <span className="text-xs text-[var(--text-secondary)]">
                Isento de IOF desde o 1º dia
              </span>
              <input
                type="checkbox"
                checked={isIofExempt}
                onChange={(e) => setIsIofExempt(e.target.checked)}
                className="h-4 w-4 rounded border-[var(--border-strong)] accent-emerald-500 cursor-pointer"
              />
            </label>
          </div>
        </div>

        {/* Right Section: Results Cards & Highlights (7 Cols) */}
        <div className="lg:col-span-7 space-y-4">
          {/* Main Giant Result Card (Saldo Total Líquido) */}
          <div className="rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-[#141821] to-[#0c1018] p-6 text-white shadow-xl relative overflow-hidden">
            <div className="absolute right-0 top-0 translate-x-8 -translate-y-8 w-44 h-44 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                <Sparkles className="h-4 w-4" />
                Saldo Total Líquido Final
              </span>
              <span className="rounded-full bg-emerald-500/20 border border-emerald-500/40 px-2.5 py-0.5 text-xs font-bold text-emerald-300">
                +{formatPct(result.netYieldPct)} líquido
              </span>
            </div>

            <div className="mt-3 text-3xl sm:text-4xl font-extrabold tracking-tight text-white tabular-nums">
              {formatCurrencyBRL(result.netTotal)}
            </div>

            <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-3 border-t border-white/10 pt-4 text-xs">
              <div>
                <span className="text-slate-400 block text-[11px]">Saldo Investido (Principal)</span>
                <span className="font-bold text-white tabular-nums">
                  {formatCurrencyBRL(result.totalInvested)}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Juros Brutos Acumulados</span>
                <span className="font-bold text-emerald-400 tabular-nums">
                  +{formatCurrencyBRL(result.grossInterest)}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Dedução de IR</span>
                <span className="font-bold text-rose-400 tabular-nums">
                  {result.totalIr > 0 ? `-${formatCurrencyBRL(result.totalIr)}` : "Isento"}
                  {result.totalIr > 0 && (
                    <span className="text-[10px] text-slate-300 ml-1 font-normal">
                      ({result.effectiveIrRatePct.toFixed(1)}% méd.)
                    </span>
                  )}
                </span>
              </div>
            </div>
          </div>

          {/* Secondary 3 KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3.5 shadow-xs">
              <span className="text-[11px] font-medium text-[var(--text-muted)] block">
                Rentabilidade Anualizada
              </span>
              <div className="mt-1 text-lg font-bold text-[var(--text-primary)] tabular-nums">
                {formatPct(result.netAnnualizedYieldPct)}
                <span className="text-xs font-normal text-[var(--text-muted)] ml-1">líq. a.a.</span>
              </div>
              <p className="mt-0.5 text-[10px] text-[var(--text-muted)]">
                Ganho real descontando imposto
              </p>
            </div>

            <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3.5 shadow-xs">
              <span className="text-[11px] font-medium text-[var(--text-muted)] block">
                Diferença vs Poupança
              </span>
              <div className="mt-1 text-lg font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                +{formatCurrencyBRL(result.benchmarks.differenceFromPoupanca)}
              </div>
              <p className="mt-0.5 text-[10px] text-[var(--text-muted)]">
                A mais no seu bolso
              </p>
            </div>

            <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3.5 shadow-xs">
              <span className="text-[11px] font-medium text-[var(--text-muted)] block">
                Cronologia de IR
              </span>
              <div className="mt-1 text-lg font-bold text-[var(--text-primary)] tabular-nums">
                {isIrExempt ? "Isento (0%)" : `${result.effectiveIrRatePct.toFixed(1)}%`}
              </div>
              <p className="mt-0.5 text-[10px] text-[var(--text-muted)]">
                Alíquota média ponderada dos lotes
              </p>
            </div>
          </div>

          {/* Benchmark Comparison Card */}
          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 shadow-xs">
            <span className="text-xs font-bold text-[var(--text-primary)] block mb-2.5 flex items-center gap-1.5">
              <PiggyBank className="h-4 w-4 text-amber-500" />
              Comparativo de Renda Fixa (Ao final do período)
            </span>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                <span className="font-semibold text-emerald-700 dark:text-emerald-300">
                  ✨ Sua Simulação Atual
                </span>
                <span className="font-extrabold text-emerald-700 dark:text-emerald-300 tabular-nums">
                  {formatCurrencyBRL(result.netTotal)}
                </span>
              </div>

              <div className="flex items-center justify-between text-xs p-2 rounded-lg bg-[var(--bg-surface-subtle)]">
                <span className="text-[var(--text-secondary)]">CDB 100% CDI (Tributado)</span>
                <span className="font-semibold text-[var(--text-primary)] tabular-nums">
                  {formatCurrencyBRL(result.benchmarks.cdi100NetTotal)}
                </span>
              </div>

              <div className="flex items-center justify-between text-xs p-2 rounded-lg bg-[var(--bg-surface-subtle)]">
                <span className="text-[var(--text-secondary)]">Caderneta de Poupança (~0,5%/mês)</span>
                <span className="font-semibold text-[var(--text-primary)] tabular-nums">
                  {formatCurrencyBRL(result.benchmarks.poupancaNetTotal)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Chart: Evolução Patrimonial (Investido vs Juros vs Líquido) */}
      <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 shadow-xs">
        <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-3 mb-4">
          <div>
            <h3 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-emerald-500" />
              Evolução da Simulação Mês a Mês
            </h3>
            <p className="text-xs text-[var(--text-muted)]">
              Crescimento do valor investido e dos juros líquidos ao longo do tempo
            </p>
          </div>
        </div>

        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={result.progression} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorNet" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorInvested" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
              <XAxis
                dataKey="label"
                stroke="var(--text-muted)"
                fontSize={11}
                tickLine={false}
              />
              <YAxis
                stroke="var(--text-muted)"
                fontSize={11}
                tickLine={false}
                tickFormatter={(val) => `R$ ${(val / 1000).toFixed(0)}k`}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload || !payload.length) return null;
                  const data = payload[0].payload;
                  return (
                    <div className="rounded-xl border border-[var(--border-strong)] bg-[var(--bg-surface)] p-3 text-xs shadow-xl space-y-1">
                      <p className="font-bold text-[var(--text-primary)]">{data.label}</p>
                      <p className="text-emerald-500 font-semibold">
                        Saldo Líquido: {formatCurrencyBRL(data.netBalance)}
                      </p>
                      <p className="text-blue-500">
                        Total Investido: {formatCurrencyBRL(data.totalInvested)}
                      </p>
                      <p className="text-amber-500">
                        Juros Brutos: +{formatCurrencyBRL(data.grossInterestEarned)}
                      </p>
                      {data.totalIrPaid > 0 && (
                        <p className="text-rose-400">
                          IR Retido: -{formatCurrencyBRL(data.totalIrPaid)}
                        </p>
                      )}
                    </div>
                  );
                }}
              />
              <Legend
                verticalAlign="top"
                align="right"
                iconType="circle"
                wrapperStyle={{ paddingBottom: 10, fontSize: 11 }}
              />
              <Area
                type="monotone"
                dataKey="netBalance"
                name="Saldo Líquido"
                stroke="#10b981"
                strokeWidth={2.5}
                fillOpacity={1}
                fill="url(#colorNet)"
              />
              <Area
                type="monotone"
                dataKey="totalInvested"
                name="Valor Investido (Aportes)"
                stroke="#3b82f6"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorInvested)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Accordion: Tabela Cronológica Lote a Lote & Dedução de IR */}
      <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] shadow-xs overflow-hidden">
        <button
          type="button"
          onClick={() => setShowLotsTable((v) => !v)}
          className="flex w-full items-center justify-between p-4 text-left hover:bg-[var(--bg-surface-subtle)] transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="h-4 w-4 text-amber-500" />
            <div>
              <span className="text-xs font-bold text-[var(--text-primary)] block">
                Detalhamento Cronológico Lote a Lote ({result.lots.length} lotes)
              </span>
              <span className="text-[11px] text-[var(--text-muted)]">
                Veja o tempo investido, os juros e a alíquota regressiva de IR (22,5% a 15%) de cada aporte individual
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1 text-xs font-semibold text-amber-500">
            <span>{showLotsTable ? "Ocultar lotes" : "Ver todos os lotes"}</span>
            {showLotsTable ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </div>
        </button>

        {showLotsTable && (
          <div className="overflow-x-auto border-t border-[var(--border-subtle)]">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] text-[11px] uppercase tracking-wider text-[var(--text-muted)]">
                <tr>
                  <th className="py-2.5 px-4 font-semibold">Lote</th>
                  <th className="py-2.5 px-4 font-semibold text-right">Aportado</th>
                  <th className="py-2.5 px-4 font-semibold text-right">Tempo</th>
                  <th className="py-2.5 px-4 font-semibold text-right">Juros Brutos</th>
                  <th className="py-2.5 px-4 font-semibold text-right">Alíquota IR</th>
                  <th className="py-2.5 px-4 font-semibold text-right">IR Retido</th>
                  <th className="py-2.5 px-4 font-semibold text-right">Saldo Líquido</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-subtle)]">
                {result.lots.map((lot) => (
                  <tr key={lot.lotIndex} className="hover:bg-[var(--bg-surface-subtle)]/60 transition-colors">
                    <td className="py-2 px-4 font-medium text-[var(--text-primary)]">
                      {lot.label}
                    </td>
                    <td className="py-2 px-4 text-right font-semibold text-[var(--text-primary)] tabular-nums">
                      {formatCurrencyBRL(lot.investedAmount)}
                    </td>
                    <td className="py-2 px-4 text-right text-[var(--text-muted)] tabular-nums">
                      {lot.monthsInvested}m ({lot.calendarDays}d)
                    </td>
                    <td className="py-2 px-4 text-right font-medium text-emerald-600 dark:text-emerald-400 tabular-nums">
                      +{formatCurrencyBRL(lot.grossYield)}
                    </td>
                    <td className="py-2 px-4 text-right tabular-nums">
                      <span
                        className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-bold ${
                          lot.irRatePct === 0
                            ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                            : lot.irRatePct <= 17.5
                            ? "bg-blue-500/15 text-blue-600 dark:text-blue-400"
                            : "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                        }`}
                      >
                        {lot.irRatePct === 0 ? "Isento" : `${lot.irRatePct}%`}
                      </span>
                    </td>
                    <td className="py-2 px-4 text-right text-rose-500 tabular-nums">
                      {lot.irAmount > 0 ? `-${formatCurrencyBRL(lot.irAmount)}` : "R$ 0,00"}
                    </td>
                    <td className="py-2 px-4 text-right font-bold text-[var(--text-primary)] tabular-nums">
                      {formatCurrencyBRL(lot.netBalance)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

