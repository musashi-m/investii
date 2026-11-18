"use client";

import { Calendar, CircleDollarSign, PieChart as PieChartIcon } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  CATEGORY_LIST,
  type AllocationSlice,
  type AssetCategory,
  type EvolutionPoint,
} from "@/types/portfolio";
import { formatBRL, formatPct } from "@/lib/format";

interface ChartsSectionProps {
  evolution: EvolutionPoint[];
  allocation: AllocationSlice[];
  periodMonths: number;
  categoryFilter: AssetCategory | "ALL";
  hideValues: boolean;
  onChangePeriod: (months: number) => void;
  onChangeCategory: (category: AssetCategory | "ALL") => void;
}

interface EvolutionBarRow {
  label: string;
  month: string;
  investedBase: number;
  positiveGain: number;
  investedRaw: number;
  capitalGainRaw: number;
  totalValue: number;
  returnPct: number;
}

function formatAxisBRL(val: number, hideValues: boolean): string {
  if (hideValues) return "R$ ••";
  if (val === 0) return "R$ 0";
  if (val >= 1_000_000) return `R$ ${(val / 1_000_000).toFixed(1).replace(".", ",")}M`;
  if (val >= 1000) return `R$ ${Math.round(val).toLocaleString("pt-BR")}`;
  return `R$ ${Math.round(val)}`;
}

export default function ChartsSection({
  evolution,
  allocation,
  periodMonths,
  categoryFilter,
  hideValues,
  onChangePeriod,
  onChangeCategory,
}: ChartsSectionProps) {
  const hasEvolutionData = evolution.some((e) => e.invested > 0 || e.totalValue > 0);
  const hasAllocationData = allocation.length > 0 && allocation.some((a) => a.value > 0);

  // Stacked bars: if capitalGain >= 0, base = invested & top = gain;
  // if capitalGain < 0, base = totalValue & top = 0 (tooltip still shows exact negative gain).
  const chartRows: EvolutionBarRow[] = evolution.map((pt) => {
    const isPositiveGain = pt.capitalGain >= 0;
    return {
      label: pt.label,
      month: pt.month,
      investedBase: isPositiveGain ? pt.invested : Math.max(0, pt.totalValue),
      positiveGain: isPositiveGain ? pt.capitalGain : 0,
      investedRaw: pt.invested,
      capitalGainRaw: pt.capitalGain,
      totalValue: pt.totalValue,
      returnPct: pt.returnPct,
    };
  });

  return (
    <section
      aria-label="Gráficos de evolução patrimonial e alocação"
      className="grid grid-cols-1 gap-4 lg:grid-cols-12"
    >
      {/* Left: Evolução do Patrimônio (Stacked Bar Chart) */}
      <div className="lg:col-span-7 flex flex-col rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 shadow-[0_1px_2px_rgba(16,24,40,0.03)]">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-[var(--border-subtle)]/70">
          <h2 className="text-[16px] font-semibold tracking-tight text-[var(--text-primary)]">
            Evolução do Patrimônio
          </h2>

          <div className="flex flex-wrap items-center gap-2">
            {/* Period Filter */}
            <label className="relative flex items-center">
              <Calendar className="pointer-events-none absolute left-2.5 h-3.5 w-3.5 text-[var(--text-muted)]" />
              <select
                value={periodMonths}
                onChange={(e) => onChangePeriod(Number(e.target.value))}
                aria-label="Selecionar período da evolução"
                className="appearance-none rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] pl-8 pr-7 py-1.5 text-xs font-medium text-[var(--text-secondary)] hover:border-[var(--border-strong)] focus:border-emerald-500 focus:outline-none cursor-pointer"
              >
                <option value={6}>Últimos 6 Meses</option>
                <option value={12}>Últimos 12 Meses</option>
                <option value={24}>Últimos 24 Meses</option>
                <option value={0}>Todo o período</option>
              </select>
            </label>

            {/* Category Filter */}
            <label className="relative flex items-center">
              <CircleDollarSign className="pointer-events-none absolute left-2.5 h-3.5 w-3.5 text-[var(--text-muted)]" />
              <select
                value={categoryFilter}
                onChange={(e) =>
                  onChangeCategory(e.target.value as AssetCategory | "ALL")
                }
                aria-label="Filtrar evolução por tipo de ativo"
                className="appearance-none rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] pl-8 pr-7 py-1.5 text-xs font-medium text-[var(--text-secondary)] hover:border-[var(--border-strong)] focus:border-emerald-500 focus:outline-none cursor-pointer"
              >
                <option value="ALL">Todos os tipos</option>
                {CATEGORY_LIST.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        {/* Custom Legend */}
        <div className="mt-4 mb-2 flex items-center justify-center gap-6 text-xs font-medium text-[var(--text-secondary)]">
          <span className="inline-flex items-center gap-2">
            <span className="h-3 w-4 rounded-xs bg-[#19B26B]" />
            Valor aplicado
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="h-3 w-4 rounded-xs bg-[#8EE4B8]" />
            Ganho de Capital
          </span>
        </div>

        {/* Chart Area */}
        <div className="h-[260px] w-full">
          {hasEvolutionData ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartRows}
                margin={{ top: 10, right: 8, left: 4, bottom: 8 }}
                barCategoryGap="24%"
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="var(--border-subtle)"
                />
                <XAxis
                  dataKey="label"
                  tick={{ fill: "var(--text-muted)", fontSize: 11 }}
                  axisLine={{ stroke: "var(--border-subtle)" }}
                  tickLine={false}
                  dy={6}
                />
                <YAxis
                  tickFormatter={(val) => formatAxisBRL(Number(val), hideValues)}
                  tick={{ fill: "var(--text-muted)", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  width={76}
                />
                <Tooltip
                  cursor={{ fill: "rgba(148, 163, 184, 0.1)" }}
                  content={({ active, payload }) => {
                    if (!active || !payload || payload.length === 0) return null;
                    const row = payload[0].payload as EvolutionBarRow;
                    return (
                      <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3 shadow-lg text-xs tabular-nums">
                        <p className="font-semibold text-[var(--text-primary)] mb-2 border-b border-[var(--border-subtle)] pb-1.5">
                          Competência {row.label}
                        </p>
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between gap-5">
                            <span className="flex items-center gap-1.5 text-[var(--text-secondary)]">
                              <span className="h-2.5 w-2.5 rounded-xs bg-[#19B26B]" />
                              Valor aplicado
                            </span>
                            <span className="font-semibold text-[var(--text-primary)]">
                              {formatBRL(row.investedRaw, hideValues)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-5">
                            <span className="flex items-center gap-1.5 text-[var(--text-secondary)]">
                              <span className="h-2.5 w-2.5 rounded-xs bg-[#8EE4B8]" />
                              Ganho de Capital
                            </span>
                            <span
                              className={
                                row.capitalGainRaw >= 0
                                  ? "font-semibold text-[var(--gain)]"
                                  : "font-semibold text-[var(--loss)]"
                              }
                            >
                              {formatBRL(row.capitalGainRaw, hideValues)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-5 pt-1.5 border-t border-[var(--border-subtle)]">
                            <span className="font-medium text-[var(--text-secondary)]">
                              Patrimônio
                            </span>
                            <span className="font-bold text-[var(--text-primary)]">
                              {formatBRL(row.totalValue, hideValues)} (
                              {formatPct(row.returnPct, true)})
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  }}
                />
                <Bar
                  dataKey="investedBase"
                  stackId="equity"
                  fill="#19B26B"
                  radius={[0, 0, 0, 0]}
                  maxBarSize={38}
                />
                <Bar
                  dataKey="positiveGain"
                  stackId="equity"
                  fill="#8EE4B8"
                  radius={[5, 5, 0, 0]}
                  maxBarSize={38}
                />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full flex-col items-center justify-center text-center px-6">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[var(--text-muted)] mb-3">
                <Calendar className="h-5 w-5" />
              </div>
              <p className="text-sm font-medium text-[var(--text-primary)]">
                Sem histórico patrimonial ainda
              </p>
              <p className="mt-1 max-w-xs text-xs text-[var(--text-muted)]">
                Adicione seu primeiro lançamento para acompanhar a evolução mensal com cotações históricas reais.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Right: Ativos na Carteira (Donut Chart) */}
      <div className="lg:col-span-5 flex flex-col rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 shadow-[0_1px_2px_rgba(16,24,40,0.03)]">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-[var(--border-subtle)]/70">
          <h2 className="text-[16px] font-semibold tracking-tight text-[var(--text-primary)]">
            Ativos na Carteira
          </h2>

          <label className="relative flex items-center">
            <CircleDollarSign className="pointer-events-none absolute left-2.5 h-3.5 w-3.5 text-[var(--text-muted)]" />
            <select
              value={categoryFilter}
              onChange={(e) =>
                onChangeCategory(e.target.value as AssetCategory | "ALL")
              }
              aria-label="Filtrar distribuição da carteira"
              className="appearance-none rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] pl-8 pr-7 py-1.5 text-xs font-medium text-[var(--text-secondary)] hover:border-[var(--border-strong)] focus:border-emerald-500 focus:outline-none cursor-pointer"
            >
              <option value="ALL">Todos os tipos</option>
              {CATEGORY_LIST.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="flex flex-1 items-center justify-center pt-4 min-h-[280px]">
          {hasAllocationData ? (
            <div className="grid w-full grid-cols-1 items-center gap-4 sm:grid-cols-12">
              <div className="sm:col-span-7 h-[230px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={allocation}
                      dataKey="value"
                      nameKey="label"
                      cx="50%"
                      cy="50%"
                      innerRadius={56}
                      outerRadius={94}
                      paddingAngle={1.5}
                      stroke="none"
                    >
                      {allocation.map((entry) => (
                        <Cell key={entry.id} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload || payload.length === 0) return null;
                        const slice = payload[0].payload as AllocationSlice;
                        return (
                          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 shadow-lg text-xs tabular-nums">
                            <div className="flex items-center gap-2 font-semibold text-[var(--text-primary)]">
                              <span
                                className="h-2.5 w-2.5 rounded-xs"
                                style={{ backgroundColor: slice.color }}
                              />
                              <span>{slice.label}</span>
                            </div>
                            <p className="mt-1 text-[var(--text-secondary)]">
                              {formatBRL(slice.value, hideValues)} ·{" "}
                              <strong className="text-[var(--text-primary)]">
                                {formatPct(slice.pct)}
                              </strong>
                            </p>
                          </div>
                        );
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* Right-aligned Percentage Legend */}
              <div className="sm:col-span-5 flex flex-col gap-2.5 pr-1">
                {allocation.map((slice) => (
                  <div
                    key={slice.id}
                    className="flex items-center justify-between gap-2 text-[13px]"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className="h-3.5 w-3.5 shrink-0 rounded-xs"
                        style={{ backgroundColor: slice.color }}
                      />
                      <span className="truncate font-medium text-[var(--text-secondary)]">
                        {slice.label}
                      </span>
                    </div>
                    <span className="font-semibold text-[var(--text-primary)] tabular-nums shrink-0">
                      {formatPct(slice.pct)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center text-center px-6">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[var(--text-muted)] mb-3">
                <PieChartIcon className="h-5 w-5" />
              </div>
              <p className="text-sm font-medium text-[var(--text-primary)]">
                Carteira sem ativos
              </p>
              <p className="mt-1 max-w-xs text-xs text-[var(--text-muted)]">
                A alocação percentual por categoria aparecerá aqui assim que você cadastrar seus ativos.
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

