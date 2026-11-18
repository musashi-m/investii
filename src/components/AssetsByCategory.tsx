"use client";

import { useMemo, useState } from "react";
import {
  ArrowDownRight,
  ArrowUpDown,
  ArrowUpRight,
  Bitcoin,
  Building2,
  ChevronDown,
  ChevronUp,
  Coins,
  Globe,
  Landmark,
  Layers,
  MoreHorizontal,
  Plus,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
  TrendingUp,
} from "lucide-react";
import type {
  AssetCategory,
  AssetPosition,
  CategorySummary,
} from "@/types/portfolio";
import { cn, formatBRL, formatPct, formatQty, formatTimeBR } from "@/lib/format";

interface AssetsByCategoryProps {
  categories: CategorySummary[];
  totalAssetCount: number;
  hideValues: boolean;
  onAddTransactionForCategory: (category: AssetCategory, ticker?: string) => void;
  onAddDividendForAsset: (assetId: number) => void;
  onInspectAsset: (position: AssetPosition) => void;
  onInspectCategoryTransactions: (category: AssetCategory) => void;
  onUpdateTaxExemption: (
    assetId: number,
    patch: { iofExempt?: boolean; irExempt?: boolean }
  ) => Promise<void>;
  onDeleteAsset: (assetId: number, ticker: string) => Promise<void>;
  onOpenTargetsSettings: () => void;
}

type SortKey =
  | "ticker"
  | "quantity"
  | "averagePrice"
  | "currentPrice"
  | "variationPct"
  | "profitabilityPct"
  | "currentValue"
  | "portfolioPct"
  | "idealPct";

type ColumnKey =
  | "quantity"
  | "averagePrice"
  | "currentPrice"
  | "variationPct"
  | "profitabilityPct"
  | "currentValue"
  | "portfolioPct"
  | "idealPct";

function getColumnOptions(isFixedIncome: boolean): Array<{ key: ColumnKey; label: string }> {
  return [
    { key: "quantity", label: isFixedIncome ? "Rentabilidade" : "Quant." },
    { key: "averagePrice", label: isFixedIncome ? "Valor Aplicado" : "Preço Médio" },
    { key: "currentPrice", label: isFixedIncome ? "Valor Bruto" : "Preço Atual" },
    { key: "variationPct", label: "Variação" },
    { key: "profitabilityPct", label: "Rentabilidade" },
    { key: "currentValue", label: isFixedIncome ? "Valor Líquido" : "Saldo" },
    { key: "portfolioPct", label: "% Carteira" },
    { key: "idealPct", label: "% Ideal" },
  ];
}

function CategoryIcon({ category }: { category: AssetCategory }) {
  const cls = "h-4 w-4";
  switch (category) {
    case "ACOES":
      return <ShieldCheck className={cls} />;
    case "FIIS":
      return <Building2 className={cls} />;
    case "RENDA_FIXA":
      return <Landmark className={cls} />;
    case "CRIPTOS":
      return <Bitcoin className={cls} />;
    case "ETFS":
      return <Layers className={cls} />;
    case "BDRS":
      return <TrendingUp className={cls} />;
    case "STOCKS":
      return <Globe className={cls} />;
  }
}

const AVATAR_PALETTE = [
  "bg-sky-600",
  "bg-emerald-600",
  "bg-indigo-600",
  "bg-amber-600",
  "bg-cyan-600",
  "bg-slate-700",
  "bg-blue-700",
  "bg-teal-600",
];

function getTickerBg(ticker: string): string {
  let hash = 0;
  for (let i = 0; i < ticker.length; i++) {
    hash = (hash * 31 + ticker.charCodeAt(i)) | 0;
  }
  return AVATAR_PALETTE[Math.abs(hash) % AVATAR_PALETTE.length];
}

function AssetAvatar({ position }: { position: AssetPosition }) {
  const { ticker, logoUrl } = position.asset;
  const [imgError, setImgError] = useState(false);

  if (logoUrl && !imgError) {
    return (
      <img
        src={logoUrl}
        alt={ticker}
        onError={() => setImgError(true)}
        className="h-8 w-8 rounded-lg border border-[var(--border-subtle)] bg-white object-contain p-0.5 shrink-0"
      />
    );
  }

  return (
    <div
      className={cn(
        "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[11px] font-bold tracking-tight text-white shadow-2xs",
        getTickerBg(ticker)
      )}
    >
      {ticker.slice(0, 4)}
    </div>
  );
}

function formatFixedIncomeTag(pos: AssetPosition): string {
  const { fixedIncomeType, indexer, rate } = pos.asset;
  const typeLabel = fixedIncomeType ?? "RF";
  if (!indexer || rate === null) return typeLabel;
  if (indexer === "CDI") return `${typeLabel} · ${rate}% CDI`;
  if (indexer === "PRE") return `${typeLabel} · ${rate}% a.a.`;
  return `${typeLabel} · ${indexer} + ${rate}%`;
}

export default function AssetsByCategory({
  categories,
  totalAssetCount,
  hideValues,
  onAddTransactionForCategory,
  onAddDividendForAsset,
  onInspectAsset,
  onInspectCategoryTransactions,
  onUpdateTaxExemption,
  onDeleteAsset,
  onOpenTargetsSettings,
}: AssetsByCategoryProps) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [sortState, setSortState] = useState<{ key: SortKey; dir: "asc" | "desc" }>({
    key: "currentValue",
    dir: "desc",
  });
  const [visibleCols, setVisibleCols] = useState<Record<ColumnKey, boolean>>({
    quantity: true,
    averagePrice: true,
    currentPrice: true,
    variationPct: true,
    profitabilityPct: true,
    currentValue: true,
    portfolioPct: true,
    idealPct: true,
  });
  const [columnMenuCategory, setColumnMenuCategory] = useState<string | null>(null);
  const [openMenuAssetId, setOpenMenuAssetId] = useState<number | null>(null);

  function toggleSort(key: SortKey) {
    setSortState((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === "desc" ? "asc" : "desc" }
        : { key, dir: "desc" }
    );
  }

  const filteredCategories = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return categories
      .map((cat) => {
        const matched = q
          ? cat.assets.filter(
              (pos) =>
                pos.asset.ticker.toLowerCase().includes(q) ||
                pos.asset.name.toLowerCase().includes(q) ||
                (pos.asset.issuer ?? "").toLowerCase().includes(q)
            )
          : cat.assets;

        const sorted = [...matched].sort((a, b) => {
          const factor = sortState.dir === "asc" ? 1 : -1;
          switch (sortState.key) {
            case "ticker":
              return a.asset.ticker.localeCompare(b.asset.ticker) * factor;
            case "currentPrice": {
              const va = a.fixedIncomeBreakdown
                ? a.fixedIncomeBreakdown.grossValue
                : a.currentPrice;
              const vb = b.fixedIncomeBreakdown
                ? b.fixedIncomeBreakdown.grossValue
                : b.currentPrice;
              return (va - vb) * factor;
            }
            default:
              return ((a[sortState.key] as number) - (b[sortState.key] as number)) * factor;
          }
        });

        return { ...cat, assets: sorted };
      })
      .filter((cat) => cat.assets.length > 0);
  }, [categories, searchQuery, sortState]);

  if (totalAssetCount === 0) {
    return null;
  }

  return (
    <section aria-label="Meus ativos separados por categoria" className="space-y-4">
      {/* Section Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-baseline gap-2">
          <h2 className="text-[19px] font-bold tracking-tight text-[var(--text-primary)]">
            Meus Ativos
          </h2>
          <span className="text-sm font-medium text-[var(--text-muted)] tabular-nums">
            ({totalAssetCount})
          </span>
        </div>

        {/* Filter input */}
        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--text-muted)]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filtrar por código ou nome..."
            className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] pl-8 pr-3 py-1.5 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-emerald-500 focus:outline-none"
          />
        </div>
      </div>

      {/* Category Collapsible Cards */}
      {filteredCategories.map((cat) => {
        const isCollapsed = !!collapsed[cat.category];
        const isFixedIncome = cat.category === "RENDA_FIXA";
        const catVarPos = cat.variationPct >= 0;
        const catProfPos = cat.profitabilityPct >= 0;

        return (
          <div
            key={cat.category}
            className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] shadow-[0_1px_2px_rgba(16,24,40,0.03)] overflow-visible"
          >
            {/* Category Summary Header */}
            <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-4 border-b border-[var(--border-subtle)]/80">
              <button
                type="button"
                onClick={() =>
                  setCollapsed((prev) => ({
                    ...prev,
                    [cat.category]: !prev[cat.category],
                  }))
                }
                className="flex items-center gap-3 text-left cursor-pointer group"
              >
                <div
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)]"
                  style={{ color: cat.color }}
                >
                  <CategoryIcon category={cat.category} />
                </div>
                <div>
                  <h3 className="text-[16px] font-bold text-[var(--text-primary)] group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                    {cat.label}
                  </h3>
                </div>
              </button>

              <div className="flex flex-wrap items-center gap-5 sm:gap-7">
                <div className="text-right">
                  <p className="text-[11px] font-medium text-[var(--text-muted)]">
                    Ativos
                  </p>
                  <p className="text-sm font-bold text-[var(--text-primary)] tabular-nums">
                    {cat.assetCount}
                  </p>
                </div>

                <div className="text-right">
                  <p className="text-[11px] font-medium text-[var(--text-muted)]">
                    Valor total
                  </p>
                  <p className="text-sm font-bold text-[var(--text-primary)] tabular-nums">
                    {formatBRL(cat.currentValue, hideValues)}
                  </p>
                </div>

                <div className="text-right">
                  <p className="text-[11px] font-medium text-[var(--text-muted)]">
                    Variação
                  </p>
                  <p
                    className={cn(
                      "inline-flex items-center gap-0.5 text-sm font-bold tabular-nums",
                      catVarPos ? "text-[var(--gain)]" : "text-[var(--loss)]"
                    )}
                  >
                    {formatPct(cat.variationPct)}
                    <span className="text-[9px]">{catVarPos ? "▲" : "▼"}</span>
                  </p>
                </div>

                <div className="text-right">
                  <p className="text-[11px] font-medium text-[var(--text-muted)]">
                    Rentabilidade
                  </p>
                  <p
                    className={cn(
                      "inline-flex items-center gap-0.5 text-sm font-bold tabular-nums",
                      catProfPos ? "text-[var(--gain)]" : "text-[var(--loss)]"
                    )}
                  >
                    {formatPct(cat.profitabilityPct)}
                    {catProfPos ? (
                      <ArrowUpRight className="h-3.5 w-3.5" />
                    ) : (
                      <ArrowDownRight className="h-3.5 w-3.5" />
                    )}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={onOpenTargetsSettings}
                  title="Clique para ajustar a meta percentual da categoria"
                  className="text-right hover:opacity-80 transition-opacity cursor-pointer"
                >
                  <p className="text-[11px] font-medium text-[var(--text-muted)]">
                    % na carteira
                  </p>
                  <p className="text-sm font-semibold text-[var(--text-primary)] tabular-nums">
                    {Math.round(cat.portfolioPct)}%{" "}
                    <span className="text-[var(--text-muted)] font-normal">
                      / {cat.targetPct}%
                    </span>
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setCollapsed((prev) => ({
                      ...prev,
                      [cat.category]: !prev[cat.category],
                    }))
                  }
                  aria-label={isCollapsed ? "Expandir categoria" : "Recolher categoria"}
                  className="flex h-7 w-7 items-center justify-center rounded-full border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:bg-[var(--bg-surface-subtle)] cursor-pointer"
                >
                  {isCollapsed ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronUp className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Table Body */}
            {!isCollapsed ? (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-left">
                    <thead>
                      <tr className="border-b border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] text-[11px] font-semibold text-[var(--text-muted)]">
                        <th className="py-3 pl-5 pr-3 whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => toggleSort("ticker")}
                            className="inline-flex items-center gap-1 hover:text-[var(--text-primary)] cursor-pointer"
                          >
                            Ativo
                            <ArrowUpDown className="h-3 w-3 opacity-60" />
                          </button>
                        </th>

                        {visibleCols.quantity ? (
                          <th className="px-3 py-3 text-right whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => toggleSort("quantity")}
                              className="inline-flex items-center gap-1 hover:text-[var(--text-primary)] cursor-pointer"
                            >
                              {isFixedIncome ? "Rentabilidade" : "Quant."}
                              <ArrowUpDown className="h-3 w-3 opacity-60" />
                            </button>
                          </th>
                        ) : null}

                        {visibleCols.averagePrice ? (
                          <th className="px-3 py-3 text-right whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => toggleSort("averagePrice")}
                              className="inline-flex items-center gap-1 hover:text-[var(--text-primary)] cursor-pointer"
                            >
                              {isFixedIncome ? "Valor Aplicado" : "Preço Médio"}
                              <ArrowUpDown className="h-3 w-3 opacity-60" />
                            </button>
                          </th>
                        ) : null}

                        {visibleCols.currentPrice ? (
                          <th className="px-3 py-3 text-right whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => toggleSort("currentPrice")}
                              className="inline-flex items-center gap-1 hover:text-[var(--text-primary)] cursor-pointer"
                            >
                              {isFixedIncome ? "Valor Bruto" : "Preço Atual"}
                              <ArrowUpDown className="h-3 w-3 opacity-60" />
                            </button>
                          </th>
                        ) : null}

                        {visibleCols.variationPct ? (
                          <th className="px-3 py-3 text-right whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => toggleSort("variationPct")}
                              className="inline-flex items-center gap-1 hover:text-[var(--text-primary)] cursor-pointer"
                            >
                              Variação
                              <ArrowUpDown className="h-3 w-3 opacity-60" />
                            </button>
                          </th>
                        ) : null}

                        {visibleCols.profitabilityPct ? (
                          <th className="px-3 py-3 text-right whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => toggleSort("profitabilityPct")}
                              className="inline-flex items-center gap-1 hover:text-[var(--text-primary)] cursor-pointer"
                            >
                              Rentabilidade
                              <ArrowUpDown className="h-3 w-3 opacity-60" />
                            </button>
                          </th>
                        ) : null}

                        {visibleCols.currentValue ? (
                          <th className="px-3 py-3 text-right whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => toggleSort("currentValue")}
                              className="inline-flex items-center gap-1 hover:text-[var(--text-primary)] cursor-pointer"
                            >
                              {isFixedIncome ? "Valor Líquido" : "Saldo"}
                              <ArrowUpDown className="h-3 w-3 opacity-60" />
                            </button>
                          </th>
                        ) : null}

                        {visibleCols.portfolioPct ? (
                          <th className="px-3 py-3 text-right whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => toggleSort("portfolioPct")}
                              className="inline-flex items-center gap-1 hover:text-[var(--text-primary)] cursor-pointer"
                            >
                              % Carteira
                            </button>
                          </th>
                        ) : null}

                        {visibleCols.idealPct ? (
                          <th className="px-3 py-3 text-right whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => toggleSort("idealPct")}
                              className="inline-flex items-center gap-1 hover:text-[var(--text-primary)] cursor-pointer"
                            >
                              % Ideal
                            </button>
                          </th>
                        ) : null}

                        <th className="py-3 pl-3 pr-5 text-right whitespace-nowrap">
                          Opções
                        </th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-[var(--border-subtle)]/70 text-[13px]">
                      {cat.assets.map((pos) => {
                        const varPos = pos.variationPct >= 0;
                        const profPos = pos.profitabilityPct >= 0;

                        return (
                          <tr
                            key={pos.asset.id}
                            className="hover:bg-[var(--bg-surface-subtle)]/70 transition-colors"
                          >
                            {/* Ativo */}
                            <td className="py-3.5 pl-5 pr-3 whitespace-nowrap">
                              <button
                                type="button"
                                onClick={() => onInspectAsset(pos)}
                                className="flex items-center gap-3 text-left group cursor-pointer"
                              >
                                <AssetAvatar position={pos} />
                                <div className="min-w-0">
                                  <p className="font-bold text-[var(--text-primary)] group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                                    {pos.asset.ticker}
                                  </p>
                                  <p className="max-w-[160px] truncate text-[11px] text-[var(--text-muted)]">
                                    {isFixedIncome
                                      ? pos.asset.issuer || pos.asset.name
                                      : pos.asset.name !== pos.asset.ticker
                                        ? pos.asset.name
                                        : pos.quoteSource}
                                  </p>
                                </div>
                              </button>
                            </td>

                            {/* Quant / Indexer */}
                            {visibleCols.quantity ? (
                              <td className="px-3 py-3.5 text-right font-medium text-[var(--text-primary)] tabular-nums whitespace-nowrap">
                                {isFixedIncome ? (
                                  <span className="inline-flex rounded-md bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] px-2 py-0.5 text-[11px] font-semibold text-[var(--text-secondary)]">
                                    {formatFixedIncomeTag(pos)}
                                  </span>
                                ) : (
                                  formatQty(pos.quantity)
                                )}
                              </td>
                            ) : null}

                            {/* Preço Médio */}
                            {visibleCols.averagePrice ? (
                              <td className="px-3 py-3.5 text-right font-medium text-[var(--text-secondary)] tabular-nums whitespace-nowrap">
                                {formatBRL(pos.averagePrice, hideValues)}
                              </td>
                            ) : null}

                            {/* Preço Atual (RV) / Valor Bruto + Juros (RF) */}
                            {visibleCols.currentPrice ? (
                              <td
                                className="px-3 py-3.5 text-right font-semibold text-[var(--text-primary)] tabular-nums whitespace-nowrap"
                                title={
                                  !isFixedIncome
                                    ? `Fonte: ${pos.quoteSource}${
                                        pos.quoteUpdatedAt
                                          ? ` · Atualizado às ${formatTimeBR(pos.quoteUpdatedAt)}`
                                          : ""
                                      }`
                                    : undefined
                                }
                              >
                                {isFixedIncome && pos.fixedIncomeBreakdown ? (
                                  <div className="inline-flex flex-col items-end">
                                    <span>
                                      {formatBRL(pos.fixedIncomeBreakdown.grossValue, hideValues)}
                                    </span>
                                    <span className="text-[10px] font-medium text-[var(--gain)]">
                                      +{formatBRL(pos.fixedIncomeBreakdown.grossGain, hideValues)} juros
                                    </span>
                                  </div>
                                ) : (
                                  <>
                                    <div>{formatBRL(pos.currentPrice, hideValues)}</div>
                                    {pos.dayChangePct !== null ? (
                                      <div
                                        className={cn(
                                          "text-[10px] font-medium",
                                          pos.dayChangePct >= 0
                                            ? "text-[var(--gain)]"
                                            : "text-[var(--loss)]"
                                        )}
                                      >
                                        Dia {formatPct(pos.dayChangePct, true)}
                                      </div>
                                    ) : null}
                                  </>
                                )}
                              </td>
                            ) : null}

                            {/* Variação */}
                            {visibleCols.variationPct ? (
                              <td className="px-3 py-3.5 text-right whitespace-nowrap">
                                <span
                                  className={cn(
                                    "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold tabular-nums",
                                    varPos
                                      ? "bg-[var(--gain-soft)] text-[var(--gain)]"
                                      : "bg-[var(--loss-soft)] text-[var(--loss)]"
                                  )}
                                >
                                  {formatPct(pos.variationPct)}
                                  <span className="text-[9px]">
                                    {varPos ? "▲" : "▼"}
                                  </span>
                                </span>
                              </td>
                            ) : null}

                            {/* Rentabilidade (c/ proventos) */}
                            {visibleCols.profitabilityPct ? (
                              <td className="px-3 py-3.5 text-right whitespace-nowrap">
                                <span
                                  className={cn(
                                    "inline-flex items-center gap-0.5 rounded-full px-2.5 py-1 text-xs font-semibold tabular-nums",
                                    profPos
                                      ? "bg-[var(--gain-soft)] text-[var(--gain)]"
                                      : "bg-[var(--loss-soft)] text-[var(--loss)]"
                                  )}
                                >
                                  {formatPct(pos.profitabilityPct)}
                                  {profPos ? (
                                    <ArrowUpRight className="h-3.5 w-3.5" />
                                  ) : (
                                    <ArrowDownRight className="h-3.5 w-3.5" />
                                  )}
                                </span>
                              </td>
                            ) : null}

                            {/* Saldo (RV) / Valor Líquido com demonstrativo de impostos (RF) */}
                            {visibleCols.currentValue ? (
                              <td className="px-3 py-3.5 text-right font-bold text-[var(--text-primary)] tabular-nums whitespace-nowrap">
                                {isFixedIncome && pos.fixedIncomeBreakdown ? (
                                  <div className="group relative inline-flex flex-col items-end cursor-help">
                                    <span>
                                      {formatBRL(pos.fixedIncomeBreakdown.netValue, hideValues)}
                                    </span>
                                    <span className="text-[10px] font-medium text-[var(--text-muted)]">
                                      {pos.fixedIncomeBreakdown.irExempt &&
                                      pos.fixedIncomeBreakdown.iofExempt
                                        ? "Isento de IR/IOF"
                                        : pos.fixedIncomeBreakdown.iofAmount > 0
                                          ? `IOF ${formatPct(pos.fixedIncomeBreakdown.effectiveIofRatePct)} · IR ${formatPct(pos.fixedIncomeBreakdown.effectiveIrRatePct)}`
                                          : pos.fixedIncomeBreakdown.irExempt
                                            ? "Isento de IR"
                                            : `IR ${formatPct(pos.fixedIncomeBreakdown.effectiveIrRatePct)}`}
                                    </span>

                                    {/* Rich Fixed Income Tax Breakdown Tooltip */}
                                    <div className="pointer-events-none absolute right-0 top-full mt-1.5 z-50 w-64 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3 text-left text-[11px] font-normal text-[var(--text-secondary)] shadow-xl opacity-0 group-hover:opacity-100 transition-opacity">
                                      <p className="font-bold text-[var(--text-primary)] pb-1.5 mb-1.5 border-b border-[var(--border-subtle)]">
                                        Demonstrativo Bruto × Líquido
                                      </p>
                                      <div className="space-y-1 tabular-nums">
                                        <div className="flex justify-between gap-2">
                                          <span>Valor aplicado</span>
                                          <span className="font-medium text-[var(--text-primary)]">
                                            {formatBRL(pos.investedValue, hideValues)}
                                          </span>
                                        </div>
                                        <div className="flex justify-between gap-2">
                                          <span>Juros brutos</span>
                                          <span className="font-medium text-[var(--gain)]">
                                            + {formatBRL(pos.fixedIncomeBreakdown.grossGain, hideValues)}
                                          </span>
                                        </div>
                                        <div className="flex justify-between gap-2">
                                          <span>Valor bruto</span>
                                          <span className="font-semibold text-[var(--text-primary)]">
                                            {formatBRL(pos.fixedIncomeBreakdown.grossValue, hideValues)}
                                          </span>
                                        </div>
                                        <div className="flex justify-between gap-2">
                                          <span>
                                            IOF{" "}
                                            {pos.fixedIncomeBreakdown.iofExempt
                                              ? "(Isento)"
                                              : pos.fixedIncomeBreakdown.effectiveIofRatePct > 0
                                                ? `(${formatPct(pos.fixedIncomeBreakdown.effectiveIofRatePct)})`
                                                : "(0%)"}
                                          </span>
                                          <span
                                            className={
                                              pos.fixedIncomeBreakdown.iofAmount > 0
                                                ? "text-[var(--loss)]"
                                                : "text-[var(--text-muted)]"
                                            }
                                          >
                                            {pos.fixedIncomeBreakdown.iofAmount > 0
                                              ? `- ${formatBRL(pos.fixedIncomeBreakdown.iofAmount, hideValues)}`
                                              : "R$ 0,00"}
                                          </span>
                                        </div>
                                        <div className="flex justify-between gap-2">
                                          <span>
                                            IR{" "}
                                            {pos.fixedIncomeBreakdown.irExempt
                                              ? "(Isento)"
                                              : `(${formatPct(pos.fixedIncomeBreakdown.effectiveIrRatePct)})`}
                                          </span>
                                          <span
                                            className={
                                              pos.fixedIncomeBreakdown.irAmount > 0
                                                ? "text-[var(--loss)]"
                                                : "text-[var(--text-muted)]"
                                            }
                                          >
                                            {pos.fixedIncomeBreakdown.irAmount > 0
                                              ? `- ${formatBRL(pos.fixedIncomeBreakdown.irAmount, hideValues)}`
                                              : "R$ 0,00"}
                                          </span>
                                        </div>
                                        <div className="flex justify-between gap-2 pt-1.5 mt-1 border-t border-[var(--border-subtle)] font-bold text-[var(--text-primary)]">
                                          <span>Valor líquido</span>
                                          <span className="text-[var(--gain)]">
                                            {formatBRL(pos.fixedIncomeBreakdown.netValue, hideValues)}
                                          </span>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                ) : (
                                  <div>{formatBRL(pos.currentValue, hideValues)}</div>
                                )}
                              </td>
                            ) : null}

                            {/* % Carteira */}
                            {visibleCols.portfolioPct ? (
                              <td className="px-3 py-3.5 text-right font-medium text-[var(--text-primary)] tabular-nums whitespace-nowrap">
                                {formatPct(pos.portfolioPct)}
                              </td>
                            ) : null}

                            {/* % Ideal */}
                            {visibleCols.idealPct ? (
                              <td className="px-3 py-3.5 text-right font-medium text-[var(--text-muted)] tabular-nums whitespace-nowrap">
                                {formatPct(pos.idealPct)}
                              </td>
                            ) : null}

                            {/* Opções */}
                            <td className="relative py-3.5 pl-3 pr-5 text-right whitespace-nowrap">
                              <button
                                type="button"
                                onClick={() =>
                                  setOpenMenuAssetId((prev) =>
                                    prev === pos.asset.id ? null : pos.asset.id
                                  )
                                }
                                aria-label={`Opções para ${pos.asset.ticker}`}
                                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-muted)] hover:bg-[var(--bg-surface-subtle)] hover:text-[var(--text-primary)] cursor-pointer"
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </button>

                              {openMenuAssetId === pos.asset.id ? (
                                <div
                                  className="absolute right-5 top-11 z-40 w-52 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] py-1.5 shadow-xl text-left text-xs"
                                  onMouseLeave={() => setOpenMenuAssetId(null)}
                                >
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setOpenMenuAssetId(null);
                                      onInspectAsset(pos);
                                    }}
                                    className="flex w-full items-center gap-2 px-3 py-2 font-medium text-[var(--text-primary)] hover:bg-[var(--bg-surface-subtle)] cursor-pointer"
                                  >
                                    <ArrowUpRight className="h-3.5 w-3.5 text-[var(--text-muted)]" />
                                    Ver lançamentos e proventos
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setOpenMenuAssetId(null);
                                      onAddTransactionForCategory(
                                        pos.asset.category,
                                        pos.asset.ticker
                                      );
                                    }}
                                    className="flex w-full items-center gap-2 px-3 py-2 font-medium text-[var(--text-primary)] hover:bg-[var(--bg-surface-subtle)] cursor-pointer"
                                  >
                                    <Plus className="h-3.5 w-3.5 text-[var(--text-muted)]" />
                                    {isFixedIncome
                                      ? "Novo aporte / resgate"
                                      : "Nova compra / venda"}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setOpenMenuAssetId(null);
                                      onAddDividendForAsset(pos.asset.id);
                                    }}
                                    className="flex w-full items-center gap-2 px-3 py-2 font-medium text-[var(--text-primary)] hover:bg-[var(--bg-surface-subtle)] cursor-pointer"
                                  >
                                    <Coins className="h-3.5 w-3.5 text-[var(--text-muted)]" />
                                    Lançar provento
                                  </button>
                                  {isFixedIncome ? (
                                    <>
                                      <div className="my-1 border-t border-[var(--border-subtle)]" />
                                      <button
                                        type="button"
                                        onClick={async () => {
                                          setOpenMenuAssetId(null);
                                          await onUpdateTaxExemption(pos.asset.id, {
                                            iofExempt: !pos.asset.iofExempt,
                                          });
                                        }}
                                        className="flex w-full items-center justify-between px-3 py-2 font-medium text-[var(--text-primary)] hover:bg-[var(--bg-surface-subtle)] cursor-pointer"
                                      >
                                        <span>Isento de IOF</span>
                                        <span
                                          className={cn(
                                            "rounded px-1.5 py-0.5 text-[10px] font-bold",
                                            pos.asset.iofExempt
                                              ? "bg-[var(--gain-soft)] text-[var(--gain)]"
                                              : "bg-[var(--bg-surface-subtle)] text-[var(--text-muted)]"
                                          )}
                                        >
                                          {pos.asset.iofExempt ? "Sim" : "Não"}
                                        </span>
                                      </button>
                                      <button
                                        type="button"
                                        onClick={async () => {
                                          setOpenMenuAssetId(null);
                                          await onUpdateTaxExemption(pos.asset.id, {
                                            irExempt: !pos.asset.irExempt,
                                          });
                                        }}
                                        className="flex w-full items-center justify-between px-3 py-2 font-medium text-[var(--text-primary)] hover:bg-[var(--bg-surface-subtle)] cursor-pointer"
                                      >
                                        <span>Isento de IR</span>
                                        <span
                                          className={cn(
                                            "rounded px-1.5 py-0.5 text-[10px] font-bold",
                                            pos.asset.irExempt
                                              ? "bg-[var(--gain-soft)] text-[var(--gain)]"
                                              : "bg-[var(--bg-surface-subtle)] text-[var(--text-muted)]"
                                          )}
                                        >
                                          {pos.asset.irExempt ? "Sim" : "Não"}
                                        </span>
                                      </button>
                                    </>
                                  ) : null}
                                  <div className="my-1 border-t border-[var(--border-subtle)]" />
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      setOpenMenuAssetId(null);
                                      await onDeleteAsset(pos.asset.id, pos.asset.ticker);
                                    }}
                                    className="flex w-full items-center gap-2 px-3 py-2 font-medium text-[var(--loss)] hover:bg-[var(--loss-soft)] cursor-pointer"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                    Excluir ativo
                                  </button>
                                </div>
                              ) : null}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Category Footer Bar */}
                <div className="relative flex flex-wrap items-center justify-end gap-2.5 border-t border-[var(--border-subtle)]/80 px-5 py-3 bg-[var(--bg-surface)]">
                  <button
                    type="button"
                    onClick={() => onInspectCategoryTransactions(cat.category)}
                    className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-surface-subtle)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
                  >
                    <span>Lançamentos</span>
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  </button>

                  {/* Column Visibility Picker */}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() =>
                        setColumnMenuCategory((prev) =>
                          prev === cat.category ? null : cat.category
                        )
                      }
                      className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-1.5 text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-surface-subtle)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
                    >
                      <SlidersHorizontal className="h-3.5 w-3.5" />
                      <span>Editar colunas</span>
                    </button>

                    {columnMenuCategory === cat.category ? (
                      <div
                        className="absolute right-0 bottom-10 z-40 w-48 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-2.5 shadow-xl"
                        onMouseLeave={() => setColumnMenuCategory(null)}
                      >
                        <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                          Colunas visíveis
                        </p>
                        <div className="space-y-1">
                          {getColumnOptions(isFixedIncome).map((col) => (
                            <label
                              key={col.key}
                              className="flex items-center gap-2 rounded-md px-1.5 py-1 text-xs text-[var(--text-primary)] hover:bg-[var(--bg-surface-subtle)] cursor-pointer"
                            >
                              <input
                                type="checkbox"
                                checked={visibleCols[col.key]}
                                onChange={() =>
                                  setVisibleCols((prev) => ({
                                    ...prev,
                                    [col.key]: !prev[col.key],
                                  }))
                                }
                                className="rounded border-slate-300 accent-emerald-600"
                              />
                              <span>{col.label}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>

                  <button
                    type="button"
                    onClick={() => onAddTransactionForCategory(cat.category)}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--cta-bg)] px-3.5 py-1.5 text-xs font-semibold text-[var(--cta-text)] hover:bg-[var(--cta-hover)] transition-colors cursor-pointer"
                  >
                    <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
                    <span>Adicionar Lançamento</span>
                  </button>
                </div>
              </>
            ) : null}
          </div>
        );
      })}
    </section>
  );
}

