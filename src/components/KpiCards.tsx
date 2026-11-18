"use client";

import {
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Coins,
  DollarSign,
  Info,
  PiggyBank,
} from "lucide-react";
import type { PortfolioDashboardData } from "@/types/portfolio";
import { cn, formatBRL, formatPct } from "@/lib/format";

interface KpiCardsProps {
  totals: PortfolioDashboardData["totals"];
  sparkline12m: number[];
  sparklineTotal: number[];
  hideValues: boolean;
}

function MiniSparkline({
  values,
  positive,
}: {
  values: number[];
  positive: boolean;
}) {
  const clean = values.length >= 2 ? values : [0, 0];
  const min = Math.min(...clean);
  const max = Math.max(...clean);
  const span = max - min || 1;
  const width = 94;
  const height = 26;
  const padY = 4;

  const points = clean.map((val, idx) => {
    const x = Number(((idx / Math.max(1, clean.length - 1)) * (width - 8) + 2).toFixed(1));
    const y = Number(
      (height - padY - ((val - min) / span) * (height - padY * 2)).toFixed(1)
    );
    return { x, y };
  });

  const polyline = points.map((p) => `${p.x},${p.y}`).join(" ");
  const last = points[points.length - 1];
  const strokeColor = positive ? "var(--gain)" : "var(--loss)";

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="overflow-visible"
      aria-hidden="true"
    >
      <polyline
        fill="none"
        stroke={strokeColor}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={polyline}
      />
      <circle
        cx={last.x}
        cy={last.y}
        r="3"
        fill="var(--bg-surface)"
        stroke={strokeColor}
        strokeWidth="1.8"
      />
    </svg>
  );
}

function InfoTooltip({ text }: { text: string }) {
  return (
    <span className="group relative inline-flex items-center">
      <Info className="h-3.5 w-3.5 text-[var(--text-muted)] opacity-70 hover:opacity-100 transition-opacity cursor-help" />
      <span className="pointer-events-none absolute right-0 top-6 z-40 w-56 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-2.5 text-[11px] leading-relaxed text-[var(--text-secondary)] shadow-lg opacity-0 group-hover:opacity-100 transition-opacity">
        {text}
      </span>
    </span>
  );
}

export default function KpiCards({
  totals,
  sparkline12m,
  sparklineTotal,
  hideValues,
}: KpiCardsProps) {
  const varPositive = totals.totalVariationPct >= 0;
  const profitPositive = totals.totalProfit >= 0;
  const ret12Positive = totals.profitability12mPct >= 0;
  const retTotalPositive = totals.profitabilityTotalPct >= 0;

  return (
    <section
      aria-label="Indicadores consolidados da carteira"
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
    >
      {/* Card 1: Patrimônio total */}
      <article className="flex flex-col justify-between rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 shadow-[0_1px_2px_rgba(16,24,40,0.03)]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[var(--text-secondary)]">
              <PiggyBank className="h-4 w-4" />
            </div>
            <h2 className="text-[13px] font-medium text-[var(--text-secondary)]">
              Patrimônio total
            </h2>
          </div>
          <InfoTooltip text="Soma atualizada em tempo real de todos os ativos da carteira (Renda Variável em cotações ao vivo + Renda Fixa líquida após IOF e IR regressivo)." />
        </div>

        <div className="mt-4 flex flex-wrap items-baseline gap-2.5">
          <p className="text-[22px] font-bold tracking-tight text-[var(--text-primary)] tabular-nums">
            {formatBRL(totals.totalEquity, hideValues)}
          </p>
          <span
            className={cn(
              "inline-flex items-center gap-0.5 text-xs font-semibold tabular-nums",
              varPositive ? "text-[var(--gain)]" : "text-[var(--loss)]"
            )}
          >
            {formatPct(totals.totalVariationPct)}
            <span className="text-[9px] leading-none">{varPositive ? "▲" : "▼"}</span>
          </span>
        </div>

        <div className="mt-3 pt-3 border-t border-[var(--border-subtle)]/70">
          <p className="text-[11px] font-medium text-[var(--text-muted)]">
            Valor investido
          </p>
          <p className="mt-0.5 text-[14px] font-semibold text-[var(--text-primary)] tabular-nums">
            {formatBRL(totals.totalInvested, hideValues)}
          </p>
        </div>
      </article>

      {/* Card 2: Lucro total */}
      <article className="flex flex-col justify-between rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 shadow-[0_1px_2px_rgba(16,24,40,0.03)]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[var(--text-secondary)]">
              <DollarSign className="h-4 w-4" />
            </div>
            <h2 className="text-[13px] font-medium text-[var(--text-secondary)]">
              Lucro total
            </h2>
          </div>
          <InfoTooltip text="Resultado consolidado: Ganho de Capital (valor atual menos valor investido) somado a todos os proventos recebidos." />
        </div>

        <div className="mt-4">
          <p
            className={cn(
              "text-[22px] font-bold tracking-tight tabular-nums",
              totals.totalProfit === 0
                ? "text-[var(--text-primary)]"
                : profitPositive
                  ? "text-[var(--gain)]"
                  : "text-[var(--loss)]"
            )}
          >
            {formatBRL(totals.totalProfit, hideValues)}
          </p>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-3 pt-3 border-t border-[var(--border-subtle)]/70">
          <div>
            <p className="text-[11px] font-medium text-[var(--text-muted)]">
              Ganho de Capital
            </p>
            <p className="mt-0.5 text-[14px] font-semibold text-[var(--text-primary)] tabular-nums">
              {formatBRL(totals.capitalGain, hideValues)}
            </p>
          </div>
          <div>
            <p className="text-[11px] font-medium text-[var(--text-muted)]">
              Proventos Recebidos
            </p>
            <p className="mt-0.5 text-[14px] font-semibold text-[var(--text-primary)] tabular-nums">
              {formatBRL(totals.dividendsTotal, hideValues)}
            </p>
          </div>
        </div>
      </article>

      {/* Card 3: Proventos Recebidos (12M) */}
      <article className="flex flex-col justify-between rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 shadow-[0_1px_2px_rgba(16,24,40,0.03)]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[var(--text-secondary)]">
              <Coins className="h-4 w-4" />
            </div>
            <h2 className="text-[13px] font-medium text-[var(--text-secondary)]">
              Proventos Recebidos (12M)
            </h2>
          </div>
          <InfoTooltip text="Total de dividendos, JCP, rendimentos de FIIs e juros lançados nos últimos 12 meses, além do acumulado histórico." />
        </div>

        <div className="mt-4">
          <p className="text-[22px] font-bold tracking-tight text-[var(--text-primary)] tabular-nums">
            {formatBRL(totals.dividends12m, hideValues)}
          </p>
        </div>

        <div className="mt-3 pt-3 border-t border-[var(--border-subtle)]/70">
          <p className="text-[11px] font-medium text-[var(--text-muted)]">
            Total acumulado
          </p>
          <p className="mt-0.5 text-[14px] font-semibold text-[var(--text-primary)] tabular-nums">
            {formatBRL(totals.dividendsTotal, hideValues)}
          </p>
        </div>
      </article>

      {/* Card 4: Rentabilidade */}
      <article className="flex flex-col justify-between rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 shadow-[0_1px_2px_rgba(16,24,40,0.03)]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[var(--text-secondary)]">
              <BarChart3 className="h-4 w-4" />
            </div>
            <h2 className="text-[13px] font-medium text-[var(--text-secondary)]">
              Rentabilidade
            </h2>
          </div>
          <InfoTooltip text="Retorno percentual consolidado da carteira (variação patrimonial + proventos) nos últimos 12 meses e no período total." />
        </div>

        <div className="mt-3 grid grid-cols-2 gap-3 pt-1">
          {/* 12M */}
          <div className="flex flex-col gap-2">
            <span className="text-[11px] font-medium text-[var(--text-muted)]">
              Últimos 12 meses
            </span>
            <MiniSparkline values={sparkline12m} positive={ret12Positive} />
            <span
              className={cn(
                "inline-flex w-fit items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold tabular-nums",
                ret12Positive
                  ? "bg-[var(--gain-soft)] text-[var(--gain)]"
                  : "bg-[var(--loss-soft)] text-[var(--loss)]"
              )}
            >
              {formatPct(totals.profitability12mPct)}
              {ret12Positive ? (
                <ArrowUpRight className="h-3.5 w-3.5" />
              ) : (
                <ArrowDownRight className="h-3.5 w-3.5" />
              )}
            </span>
          </div>

          {/* Total */}
          <div className="flex flex-col gap-2">
            <span className="text-[11px] font-medium text-[var(--text-muted)]">
              Total
            </span>
            <MiniSparkline values={sparklineTotal} positive={retTotalPositive} />
            <span
              className={cn(
                "inline-flex w-fit items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold tabular-nums",
                retTotalPositive
                  ? "bg-[var(--gain-soft)] text-[var(--gain)]"
                  : "bg-[var(--loss-soft)] text-[var(--loss)]"
              )}
            >
              {formatPct(totals.profitabilityTotalPct)}
              {retTotalPositive ? (
                <ArrowUpRight className="h-3.5 w-3.5" />
              ) : (
                <ArrowDownRight className="h-3.5 w-3.5" />
              )}
            </span>
          </div>
        </div>
      </article>
    </section>
  );
}

