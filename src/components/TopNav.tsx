"use client";

import { useEffect, useRef, useState } from "react";
import {
  Bell,
  Calculator,
  ChevronDown,
  Eye,
  EyeOff,
  Home,
  ListOrdered,
  Lock,
  Moon,
  Plus,
  RefreshCw,
  Settings,
  Snowflake,
  Sun,
  TrendingUp,
} from "lucide-react";
import type { MacroRates, Wallet } from "@/types/portfolio";
import { cn, formatPct, formatTimeBR } from "@/lib/format";

interface TopNavProps {
  wallet: Wallet;
  wallets: Wallet[];
  macro: MacroRates;
  lastUpdatedAt: string | null;
  isRefreshing: boolean;
  hideValues: boolean;
  darkMode: boolean;
  activeTab?: "DASHBOARD" | "FIXED_INCOME_CALC" | "MAGIC_NUMBER";
  dailyNotificationEnabled?: boolean;
  onChangeTab?: (tab: "DASHBOARD" | "FIXED_INCOME_CALC" | "MAGIC_NUMBER") => void;
  onOpenDailyNotificationModal?: () => void;
  onSelectWallet: (id: number) => void;
  onCreateWallet: (name: string) => Promise<void>;
  onToggleHideValues: () => void;
  onToggleDarkMode: () => void;
  onOpenSettings: () => void;
  onOpenAddTransaction: () => void;
  onOpenHistoryDrawer: () => void;
  onManualRefresh: () => void;
  onLockWallet: () => Promise<void>;
}

export default function TopNav({
  wallet,
  wallets,
  macro,
  lastUpdatedAt,
  isRefreshing,
  hideValues,
  darkMode,
  activeTab = "DASHBOARD",
  dailyNotificationEnabled = false,
  onChangeTab,
  onOpenDailyNotificationModal,
  onSelectWallet,
  onCreateWallet,
  onToggleHideValues,
  onToggleDarkMode,
  onOpenSettings,
  onOpenAddTransaction,
  onOpenHistoryDrawer,
  onManualRefresh,
  onLockWallet,
}: TopNavProps) {
  const [walletMenuOpen, setWalletMenuOpen] = useState(false);
  const [creatingWallet, setCreatingWallet] = useState(false);
  const [newWalletName, setNewWalletName] = useState("");
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setWalletMenuOpen(false);
        setCreatingWallet(false);
      }
    }
    if (walletMenuOpen) {
      document.addEventListener("mousedown", handleOutside);
      return () => document.removeEventListener("mousedown", handleOutside);
    }
  }, [walletMenuOpen]);

  async function handleAddWalletSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = newWalletName.trim();
    if (!trimmed) return;
    await onCreateWallet(trimmed);
    setNewWalletName("");
    setCreatingWallet(false);
    setWalletMenuOpen(false);
  }

  return (
    <header className="sticky top-0 z-30 w-full">
      {/* Primary Dark Institutional Bar */}
      <div className="bg-[var(--bg-topbar)] text-white border-b border-white/10">
        <div className="mx-auto flex h-14 max-w-[1440px] items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3 sm:gap-5">
            {/* Brand Logo */}
            <div className="flex items-center gap-2 select-none">
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-amber-400/15 border border-amber-400/35">
                <TrendingUp className="h-4 w-4 text-amber-400" strokeWidth={2.4} />
              </div>
              <span className="text-[17px] font-bold tracking-tight text-white">
                Investidor<span className="text-amber-400 font-extrabold">10x</span>
              </span>
            </div>

            <div className="hidden h-5 w-px bg-white/15 sm:block" />

            {/* Wallet Selector Dropdown */}
            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={() => setWalletMenuOpen((v) => !v)}
                className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm font-medium text-slate-100 hover:bg-white/10 transition-colors cursor-pointer"
                aria-expanded={walletMenuOpen}
                aria-haspopup="listbox"
              >
                <span className="max-w-[160px] truncate">{wallet.name}</span>
                <ChevronDown className="h-4 w-4 text-slate-400" />
              </button>

              {walletMenuOpen ? (
                <div className="absolute left-0 mt-2 w-64 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-xl overflow-hidden z-50">
                  <div className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] border-b border-[var(--border-subtle)]">
                    Minhas Carteiras
                  </div>
                  <div className="max-h-56 overflow-y-auto py-1">
                    {wallets.map((w) => (
                      <button
                        key={w.id}
                        type="button"
                        onClick={() => {
                          onSelectWallet(w.id);
                          setWalletMenuOpen(false);
                        }}
                        className={cn(
                          "flex w-full items-center justify-between px-3 py-2 text-left text-sm transition-colors cursor-pointer",
                          w.id === wallet.id
                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold"
                            : "hover:bg-[var(--bg-surface-subtle)]"
                        )}
                      >
                        <span className="truncate">{w.name}</span>
                        {w.id === wallet.id ? (
                          <span className="h-2 w-2 rounded-full bg-emerald-500" />
                        ) : null}
                      </button>
                    ))}
                  </div>
                  <div className="border-t border-[var(--border-subtle)] p-2">
                    {creatingWallet ? (
                      <form onSubmit={handleAddWalletSubmit} className="flex gap-1.5">
                        <input
                          type="text"
                          value={newWalletName}
                          onChange={(e) => setNewWalletName(e.target.value)}
                          placeholder="Nome da carteira..."
                          autoFocus
                          maxLength={60}
                          className="w-full rounded-lg border border-[var(--border-strong)] bg-[var(--bg-surface-subtle)] px-2.5 py-1.5 text-xs outline-none focus:border-emerald-500"
                        />
                        <button
                          type="submit"
                          className="rounded-lg bg-emerald-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 cursor-pointer"
                        >
                          Criar
                        </button>
                      </form>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setCreatingWallet(true)}
                        className="flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-surface-subtle)] cursor-pointer"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Nova carteira
                      </button>
                    )}
                  </div>
                </div>
              ) : null}
            </div>

            {/* Settings Gear */}
            <button
              type="button"
              onClick={onOpenSettings}
              title="Configurações da carteira e cotações"
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/15 bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
            >
              <Settings className="h-4 w-4" />
            </button>
          </div>

          {/* Right Utilities */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Live Macro Strip (Desktop) */}
            <div className="hidden xl:flex items-center gap-3 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] text-slate-300 tabular-nums">
              <span>
                Selic <strong className="text-white">{formatPct(macro.selicAnnualPct)}</strong>
              </span>
              <span className="text-white/20">·</span>
              <span>
                CDI <strong className="text-white">{formatPct(macro.cdiAnnualPct)}</strong>
              </span>
              <span className="text-white/20">·</span>
              <span>
                IPCA 12M <strong className="text-white">{formatPct(macro.ipca12mPct)}</strong>
              </span>
              <span className="text-white/20">·</span>
              <span>
                USD <strong className="text-white">R$ {macro.usdBrl.toFixed(2).replace(".", ",")}</strong>
              </span>
            </div>

            {/* Daily Notification Bell */}
            {onOpenDailyNotificationModal && (
              <button
                type="button"
                onClick={onOpenDailyNotificationModal}
                title="Notificação diária de rendimento de Renda Fixa (08:00)"
                className="relative flex h-8 w-8 items-center justify-center rounded-lg text-slate-300 hover:bg-white/10 hover:text-amber-400 transition-colors cursor-pointer"
                aria-label="Notificações diárias"
              >
                <Bell className="h-4 w-4" />
                {dailyNotificationEnabled && (
                  <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-emerald-400 ring-2 ring-[var(--bg-topbar)]" />
                )}
              </button>
            )}

            {/* Privacy Toggle */}
            <button
              type="button"
              onClick={onToggleHideValues}
              title={hideValues ? "Exibir valores" : "Ocultar valores"}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-300 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
              aria-label={hideValues ? "Exibir valores" : "Ocultar valores"}
            >
              {hideValues ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>

            {/* Theme Toggle */}
            <button
              type="button"
              onClick={onToggleDarkMode}
              title={darkMode ? "Modo claro" : "Modo escuro"}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-300 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
              aria-label={darkMode ? "Modo claro" : "Modo escuro"}
            >
              {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>

            {/* Lock Session (PIN) */}
            <button
              type="button"
              onClick={onLockWallet}
              title="Bloquear carteira (exigir PIN novamente)"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-300 hover:bg-white/10 hover:text-amber-400 transition-colors cursor-pointer"
              aria-label="Bloquear carteira"
            >
              <Lock className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Sub-navigation & Primary Action Bar */}
      <div className="bg-[var(--bg-surface)] border-b border-[var(--border-subtle)] shadow-[0_1px_2px_rgba(16,24,40,0.03)]">
        <div className="mx-auto flex min-h-[54px] max-w-[1440px] flex-wrap items-center justify-between gap-3 px-4 py-2 sm:px-6 lg:px-8 sm:py-0">
          {/* Navigation Tabs */}
          <nav className="flex items-center gap-1 sm:gap-2 overflow-x-auto py-1 sm:py-0" aria-label="Navegação da carteira">
            <button
              type="button"
              onClick={() => onChangeTab?.("DASHBOARD")}
              className={`relative flex items-center gap-2 px-3 py-3 text-sm font-semibold transition-colors cursor-pointer ${
                activeTab === "DASHBOARD"
                  ? "text-[var(--text-primary)]"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              }`}
            >
              <Home className="h-4 w-4" />
              <span>Resumo</span>
              {activeTab === "DASHBOARD" && (
                <span className="absolute bottom-0 left-2 right-2 h-[2.5px] rounded-full bg-[var(--text-primary)]" />
              )}
            </button>

            <button
              type="button"
              onClick={() => onChangeTab?.("FIXED_INCOME_CALC")}
              className={`relative flex items-center gap-2 px-3 py-3 text-sm font-semibold transition-colors cursor-pointer ${
                activeTab === "FIXED_INCOME_CALC"
                  ? "text-[var(--text-primary)]"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              }`}
            >
              <Calculator className="h-4 w-4 text-emerald-500" />
              <span>Calculadora Renda Fixa</span>
              {activeTab === "FIXED_INCOME_CALC" && (
                <span className="absolute bottom-0 left-2 right-2 h-[2.5px] rounded-full bg-emerald-500" />
              )}
            </button>

            <button
              type="button"
              onClick={() => onChangeTab?.("MAGIC_NUMBER")}
              className={`relative flex items-center gap-2 px-3 py-3 text-sm font-semibold transition-colors cursor-pointer ${
                activeTab === "MAGIC_NUMBER"
                  ? "text-[var(--text-primary)]"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              }`}
            >
              <Snowflake className="h-4 w-4 text-amber-500" />
              <span>Número Mágico</span>
              {activeTab === "MAGIC_NUMBER" && (
                <span className="absolute bottom-0 left-2 right-2 h-[2.5px] rounded-full bg-amber-500" />
              )}
            </button>

            <button
              type="button"
              onClick={onOpenHistoryDrawer}
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-surface-subtle)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
            >
              <ListOrdered className="h-4 w-4" />
              <span className="hidden sm:inline">Lançamentos & Proventos</span>
              <span className="sm:hidden">Extrato</span>
            </button>
          </nav>

          {/* Right Actions */}
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onManualRefresh}
              disabled={isRefreshing}
              title="Atualizar cotações agora em tempo real"
              className="flex items-center gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-xs sm:text-[13px] font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-surface-subtle)] hover:text-[var(--text-primary)] disabled:opacity-60 transition-colors cursor-pointer"
            >
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              <RefreshCw className={cn("h-3.5 w-3.5", isRefreshing && "animate-spin")} />
              <span className="hidden sm:inline tabular-nums">
                {isRefreshing
                  ? "Atualizando..."
                  : `Cotação ${formatTimeBR(lastUpdatedAt)}`}
              </span>
            </button>

            <button
              type="button"
              onClick={onOpenAddTransaction}
              className="flex items-center gap-1.5 rounded-lg bg-[var(--cta-bg)] px-4 py-2 text-[13px] font-semibold text-[var(--cta-text)] hover:bg-[var(--cta-hover)] transition-colors shadow-xs cursor-pointer"
            >
              <Plus className="h-4 w-4" strokeWidth={2.5} />
              <span>Adicionar Lançamento</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}

