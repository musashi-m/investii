"use client";

import { useEffect, useState } from "react";
import { Loader2, Save, Trash2, X } from "lucide-react";
import {
  CATEGORY_LIST,
  type AppSettings,
  type AssetCategory,
  type Wallet,
} from "@/types/portfolio";
import { cn } from "@/lib/format";

interface SettingsModalProps {
  open: boolean;
  wallet: Wallet;
  walletsCount: number;
  categoryTargets: Record<AssetCategory, number>;
  settings: AppSettings;
  onClose: () => void;
  onSaved: () => Promise<void>;
  onDeleteWallet: (id: number) => Promise<void>;
}

export default function SettingsModal({
  open,
  wallet,
  walletsCount,
  categoryTargets,
  settings,
  onClose,
  onSaved,
  onDeleteWallet,
}: SettingsModalProps) {
  const [walletName, setWalletName] = useState(wallet.name);
  const [targets, setTargets] = useState<Record<AssetCategory, number>>(categoryTargets);
  const [refreshSec, setRefreshSec] = useState(settings.refreshIntervalSec);
  const [brapiToken, setBrapiToken] = useState(settings.brapiToken);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setWalletName(wallet.name);
    setTargets({ ...categoryTargets });
    setRefreshSec(settings.refreshIntervalSec);
    setBrapiToken(settings.brapiToken);
  }, [open, wallet, categoryTargets, settings]);

  if (!open) return null;

  const targetSum = Object.values(targets).reduce((acc, v) => acc + (Number(v) || 0), 0);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await Promise.all([
        fetch("/api/wallets", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: wallet.id,
            name: walletName.trim() || wallet.name,
            categoryTargets: targets,
          }),
        }),
        fetch("/api/settings", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            refreshIntervalSec: refreshSec,
            brapiToken,
          }),
        }),
      ]);
      await onSaved();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-[2px] p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-lg rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between border-b border-[var(--border-subtle)] px-6 py-4">
          <div>
            <h2 className="text-base font-bold text-[var(--text-primary)]">
              Configurações da Carteira
            </h2>
            <p className="text-xs text-[var(--text-muted)]">
              Metas de alocação, intervalo de cotação e APIs externas.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar configurações"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-muted)] hover:bg-[var(--bg-surface-subtle)] cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSave} className="max-h-[75vh] overflow-y-auto px-6 py-5 space-y-5">
          {/* Wallet Name */}
          <div>
            <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
              Nome da Carteira
            </label>
            <input
              type="text"
              value={walletName}
              onChange={(e) => setWalletName(e.target.value)}
              maxLength={60}
              required
              className="w-full rounded-lg border border-[var(--border-strong)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-emerald-500"
            />
          </div>

          {/* Category Targets */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-[var(--text-secondary)]">
                Metas de Alocação por Categoria (% Ideal)
              </label>
              <span
                className={cn(
                  "text-xs font-bold tabular-nums",
                  Math.abs(targetSum - 100) < 0.01
                    ? "text-[var(--gain)]"
                    : "text-amber-500"
                )}
              >
                Soma: {targetSum}%
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
              {CATEGORY_LIST.map((cat) => (
                <div
                  key={cat.id}
                  className="flex items-center justify-between gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] px-3 py-2"
                >
                  <span className="text-xs font-medium text-[var(--text-primary)] truncate">
                    {cat.shortLabel}
                  </span>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={targets[cat.id] ?? 0}
                      onChange={(e) =>
                        setTargets((prev) => ({
                          ...prev,
                          [cat.id]: Math.max(0, Math.min(100, Number(e.target.value) || 0)),
                        }))
                      }
                      className="w-12 rounded border border-[var(--border-strong)] bg-[var(--bg-surface)] px-1.5 py-0.5 text-right text-xs font-bold text-[var(--text-primary)] tabular-nums outline-none focus:border-emerald-500"
                    />
                    <span className="text-[11px] text-[var(--text-muted)]">%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Auto Refresh Interval */}
          <div>
            <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
              Frequência de atualização das cotações
            </label>
            <select
              value={refreshSec}
              onChange={(e) => setRefreshSec(Number(e.target.value))}
              className="w-full rounded-lg border border-[var(--border-strong)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-emerald-500"
            >
              <option value={30}>A cada 30 segundos (Tempo real)</option>
              <option value={60}>A cada 1 minuto (Recomendado)</option>
              <option value={120}>A cada 2 minutos</option>
              <option value={300}>A cada 5 minutos</option>
            </select>
          </div>

          {/* Optional brapi.dev token */}
          <div>
            <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
              Token brapi.dev (opcional — logos oficiais B3)
            </label>
            <input
              type="password"
              value={brapiToken}
              onChange={(e) => setBrapiToken(e.target.value)}
              placeholder="Deixe vazio para usar Yahoo Finance + CoinGecko + BCB automaticamente"
              className="w-full rounded-lg border border-[var(--border-strong)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-emerald-500"
            />
            <p className="mt-1 text-[11px] text-[var(--text-muted)]">
              Sem o token, as cotações B3/EUA/Cripto e taxas do Banco Central funcionam normalmente de graça.
            </p>
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-[var(--border-subtle)]">
            {walletsCount > 1 ? (
              <button
                type="button"
                onClick={async () => {
                  await onDeleteWallet(wallet.id);
                  onClose();
                }}
                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-[var(--loss)] hover:bg-[var(--loss-soft)] cursor-pointer"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Excluir carteira
              </button>
            ) : (
              <div />
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-[var(--border-subtle)] px-4 py-2 text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-surface-subtle)] cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--cta-bg)] px-4 py-2 text-xs font-semibold text-[var(--cta-text)] hover:bg-[var(--cta-hover)] disabled:opacity-60 cursor-pointer"
              >
                {saving ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Save className="h-3.5 w-3.5" />
                )}
                Salvar
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

