"use client";

import { useState } from "react";
import { Coins, Plus, Trash2, TrendingUp, X } from "lucide-react";
import {
  CATEGORY_MAP,
  type AssetCategory,
  type AssetPosition,
  type DividendRecord,
  type TransactionRecord,
} from "@/types/portfolio";
import { cn, formatBRL, formatDateBR, formatQty } from "@/lib/format";

interface AssetDetailsDrawerProps {
  open: boolean;
  positions: AssetPosition[];
  selectedAssetId: number | null;
  selectedCategory: AssetCategory | null;
  hideValues: boolean;
  onClose: () => void;
  onDeleteTransaction: (id: number) => Promise<void>;
  onDeleteDividend: (id: number) => Promise<void>;
  onAddTransaction: (category?: AssetCategory, ticker?: string) => void;
  onAddDividend: (assetId?: number) => void;
}

const DIV_LABELS: Record<string, string> = {
  DIVIDEND: "Dividendo",
  JCP: "JCP",
  YIELD: "Rendimento",
  INTEREST: "Juros",
};

export default function AssetDetailsDrawer({
  open,
  positions,
  selectedAssetId,
  selectedCategory,
  hideValues,
  onClose,
  onDeleteTransaction,
  onDeleteDividend,
  onAddTransaction,
  onAddDividend,
}: AssetDetailsDrawerProps) {
  const [activeTab, setActiveTab] = useState<"TX" | "DIV">("TX");
  const [busyId, setBusyId] = useState<string | null>(null);

  if (!open) return null;

  const filteredPositions = selectedAssetId
    ? positions.filter((p) => p.asset.id === selectedAssetId)
    : selectedCategory
      ? positions.filter((p) => p.asset.category === selectedCategory)
      : positions;

  const singlePosition =
    selectedAssetId && filteredPositions.length === 1
      ? filteredPositions[0]
      : null;

  const title = singlePosition
    ? `${singlePosition.asset.ticker} — ${singlePosition.asset.name}`
    : selectedCategory
      ? `Lançamentos · ${CATEGORY_MAP[selectedCategory].label}`
      : "Todos os Lançamentos e Proventos";

  const allTxs: Array<TransactionRecord & { ticker: string; category: AssetCategory }> =
    filteredPositions
      .flatMap((p) =>
        p.transactions.map((t) => ({
          ...t,
          ticker: p.asset.ticker,
          category: p.asset.category,
        }))
      )
      .sort((a, b) => b.executedAt.localeCompare(a.executedAt));

  const allDivs: Array<DividendRecord & { ticker: string }> = filteredPositions
    .flatMap((p) =>
      p.dividends.map((d) => ({
        ...d,
        ticker: p.asset.ticker,
      }))
    )
    .sort((a, b) => b.paidAt.localeCompare(a.paidAt));

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
    >
      <div className="flex h-full w-full max-w-lg flex-col border-l border-[var(--border-subtle)] bg-[var(--bg-surface)] shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-[var(--border-subtle)] px-6 py-4">
          <div className="min-w-0">
            <h2 className="truncate text-base font-bold text-[var(--text-primary)]">
              {title}
            </h2>
            <p className="mt-0.5 text-xs text-[var(--text-muted)]">
              {allTxs.length} lançamento(s) · {allDivs.length} provento(s)
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar painel"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-muted)] hover:bg-[var(--bg-surface-subtle)] cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="grid grid-cols-2 gap-1 border-b border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] p-2">
          <button
            type="button"
            onClick={() => setActiveTab("TX")}
            className={cn(
              "flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold cursor-pointer",
              activeTab === "TX"
                ? "bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-xs border border-[var(--border-subtle)]"
                : "text-[var(--text-muted)]"
            )}
          >
            <TrendingUp className="h-3.5 w-3.5" />
            Lançamentos ({allTxs.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("DIV")}
            className={cn(
              "flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold cursor-pointer",
              activeTab === "DIV"
                ? "bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-xs border border-[var(--border-subtle)]"
                : "text-[var(--text-muted)]"
            )}
          >
            <Coins className="h-3.5 w-3.5" />
            Proventos ({allDivs.length})
          </button>
        </div>

        {/* Content List */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-2.5">
          {activeTab === "TX" ? (
            allTxs.length === 0 ? (
              <p className="py-12 text-center text-xs text-[var(--text-muted)]">
                Nenhum lançamento registrado.
              </p>
            ) : (
              allTxs.map((tx) => {
                const isBuy = tx.type === "BUY";
                const total = tx.quantity * tx.unitPrice + (isBuy ? tx.fees : -tx.fees);
                const key = `tx-${tx.id}`;
                return (
                  <div
                    key={tx.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)]/60 p-3.5"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            "rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase",
                            isBuy
                              ? "bg-[var(--gain-soft)] text-[var(--gain)]"
                              : "bg-[var(--loss-soft)] text-[var(--loss)]"
                          )}
                        >
                          {tx.category === "RENDA_FIXA"
                            ? isBuy
                              ? "Aporte"
                              : "Resgate"
                            : isBuy
                              ? "Compra"
                              : "Venda"}
                        </span>
                        <span className="text-sm font-bold text-[var(--text-primary)]">
                          {tx.ticker}
                        </span>
                        <span className="text-[11px] text-[var(--text-muted)] tabular-nums">
                          {formatDateBR(tx.executedAt)}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-[var(--text-secondary)] tabular-nums">
                        {tx.category === "RENDA_FIXA"
                          ? `Aplicação: ${formatBRL(tx.unitPrice, hideValues)}`
                          : `${formatQty(tx.quantity)} × ${formatBRL(tx.unitPrice, hideValues)}`}
                        {tx.fees > 0
                          ? ` · Taxas ${formatBRL(tx.fees, hideValues)}`
                          : ""}
                      </p>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-sm font-bold text-[var(--text-primary)] tabular-nums">
                        {formatBRL(total, hideValues)}
                      </span>
                      <button
                        type="button"
                        disabled={busyId === key}
                        onClick={async () => {
                          setBusyId(key);
                          try {
                            await onDeleteTransaction(tx.id);
                          } finally {
                            setBusyId(null);
                          }
                        }}
                        title="Excluir lançamento"
                        className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--text-muted)] hover:bg-[var(--loss-soft)] hover:text-[var(--loss)] cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })
            )
          ) : allDivs.length === 0 ? (
            <p className="py-12 text-center text-xs text-[var(--text-muted)]">
              Nenhum provento registrado.
            </p>
          ) : (
            allDivs.map((div) => {
              const key = `div-${div.id}`;
              return (
                <div
                  key={div.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)]/60 p-3.5"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="rounded-md bg-[var(--gain-soft)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--gain)]">
                        {DIV_LABELS[div.type] ?? div.type}
                      </span>
                      <span className="text-sm font-bold text-[var(--text-primary)]">
                        {div.ticker}
                      </span>
                      <span className="text-[11px] text-[var(--text-muted)] tabular-nums">
                        {formatDateBR(div.paidAt)}
                      </span>
                    </div>
                    {div.notes ? (
                      <p className="mt-1 truncate text-xs text-[var(--text-muted)]">
                        {div.notes}
                      </p>
                    ) : null}
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-sm font-bold text-[var(--gain)] tabular-nums">
                      + {formatBRL(div.amount, hideValues)}
                    </span>
                    <button
                      type="button"
                      disabled={busyId === key}
                      onClick={async () => {
                        setBusyId(key);
                        try {
                          await onDeleteDividend(div.id);
                        } finally {
                          setBusyId(null);
                        }
                      }}
                      title="Excluir provento"
                      className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--text-muted)] hover:bg-[var(--loss-soft)] hover:text-[var(--loss)] cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Drawer Footer */}
        <div className="flex items-center justify-between gap-2 border-t border-[var(--border-subtle)] px-6 py-4 bg-[var(--bg-surface)]">
          <button
            type="button"
            onClick={() => {
              onClose();
              onAddDividend(singlePosition?.asset.id);
            }}
            disabled={positions.length === 0}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] px-3.5 py-2 text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-surface-subtle)] disabled:opacity-40 cursor-pointer"
          >
            <Coins className="h-3.5 w-3.5" />
            Lançar Provento
          </button>
          <button
            type="button"
            onClick={() => {
              onClose();
              onAddTransaction(
                singlePosition?.asset.category ?? selectedCategory ?? undefined,
                singlePosition?.asset.ticker
              );
            }}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--cta-bg)] px-4 py-2 text-xs font-semibold text-[var(--cta-text)] hover:bg-[var(--cta-hover)] cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" />
            Novo Lançamento
          </button>
        </div>
      </div>
    </div>
  );
}

