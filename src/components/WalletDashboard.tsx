"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  Landmark,
  Plus,
  RefreshCw,
  TrendingUp,
} from "lucide-react";
import type {
  AppSettings,
  AssetCategory,
  AssetPosition,
  PortfolioDashboardData,
} from "@/types/portfolio";
import TopNav from "@/components/TopNav";
import KpiCards from "@/components/KpiCards";
import ChartsSection from "@/components/ChartsSection";
import AssetsByCategory from "@/components/AssetsByCategory";
import AddTransactionModal from "@/components/AddTransactionModal";
import AssetDetailsDrawer from "@/components/AssetDetailsDrawer";
import SettingsModal from "@/components/SettingsModal";
import FixedIncomeCalculator from "@/components/FixedIncomeCalculator";
import MagicNumberCalculator from "@/components/MagicNumberCalculator";
import DailyNotificationModal from "@/components/DailyNotificationModal";
import {
  getDailyNotificationSettings,
  initDailyYieldScheduler,
} from "@/lib/notifications/dailyYield";

export default function WalletDashboard() {
  const router = useRouter();
  const [data, setData] = useState<PortfolioDashboardData | null>(null);
  const [settings, setSettings] = useState<AppSettings>({
    refreshIntervalSec: 60,
    brapiToken: "",
  });
  const [walletId, setWalletId] = useState<number | null>(null);
  const [periodMonths, setPeriodMonths] = useState<number>(12);
  const [categoryFilter, setCategoryFilter] = useState<AssetCategory | "ALL">("ALL");
  const [loading, setLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // UI preferences
  const [hideValues, setHideValues] = useState<boolean>(false);
  const [darkMode, setDarkMode] = useState<boolean>(false);

  // Modals & Drawers
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [addModalConfig, setAddModalConfig] = useState<{
    tab: "VARIABLE" | "FIXED" | "DIVIDEND";
    category?: AssetCategory;
    ticker?: string;
    dividendAssetId?: number;
  }>({ tab: "VARIABLE" });

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerAssetId, setDrawerAssetId] = useState<number | null>(null);
  const [drawerCategory, setDrawerCategory] = useState<AssetCategory | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"DASHBOARD" | "FIXED_INCOME_CALC" | "MAGIC_NUMBER">("DASHBOARD");
  const [dailyNotificationModalOpen, setDailyNotificationModalOpen] = useState(false);
  const [dailyNotificationEnabled, setDailyNotificationEnabled] = useState(false);

  const isFetchingRef = useRef(false);

  // Sync dark mode state from document class on mount
  useEffect(() => {
    const isDark = document.documentElement.classList.contains("dark");
    setDarkMode(isDark);
    try {
      const savedHidden = localStorage.getItem("investidor-hide-values");
      if (savedHidden === "true") setHideValues(true);
    } catch {
      // ignore storage errors
    }
  }, []);

  const loadSettings = useCallback(async () => {
    try {
      const res = await fetch("/api/settings", { cache: "no-store" });
      if (res.ok) {
        const s = (await res.json()) as AppSettings;
        setSettings(s);
      }
    } catch {
      // keep defaults
    }
  }, []);

  const loadPortfolio = useCallback(
    async (opts?: { forceRefresh?: boolean; silent?: boolean; targetWalletId?: number | null }) => {
      if (isFetchingRef.current && opts?.silent) return;
      isFetchingRef.current = true;

      if (opts?.forceRefresh) {
        setIsRefreshing(true);
      } else if (!opts?.silent) {
        setLoading(true);
      }

      try {
        const params = new URLSearchParams();
        const wId = opts?.targetWalletId !== undefined ? opts.targetWalletId : walletId;
        if (wId) params.set("walletId", String(wId));
        params.set("periodMonths", String(periodMonths));
        params.set("category", categoryFilter);
        if (opts?.forceRefresh) params.set("refresh", "true");

        const res = await fetch(`/api/portfolio?${params.toString()}`, {
          cache: "no-store",
        });
        if (res.status === 401) {
          router.refresh();
          return;
        }
        if (!res.ok) {
          throw new Error("Não foi possível carregar os dados da carteira.");
        }
        const payload = (await res.json()) as PortfolioDashboardData;
        setData(payload);
        setWalletId(payload.wallet.id);
        setError(null);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Erro inesperado ao carregar a carteira."
        );
      } finally {
        setLoading(false);
        setIsRefreshing(false);
        isFetchingRef.current = false;
      }
    },
    [walletId, periodMonths, categoryFilter, router]
  );

  // Initial load + reload on filter/wallet change
  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  useEffect(() => {
    loadPortfolio({ silent: data !== null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walletId, periodMonths, categoryFilter]);

  // Frequent real-time quote auto-refresh (pauses when tab is hidden)
  useEffect(() => {
    const intervalMs = Math.max(15, settings.refreshIntervalSec) * 1000;
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") {
        loadPortfolio({ forceRefresh: true, silent: true });
      }
    }, intervalMs);
    return () => clearInterval(timer);
  }, [settings.refreshIntervalSec, loadPortfolio]);

  const allPositions = useMemo<AssetPosition[]>(() => {
    if (!data) return [];
    return data.categories.flatMap((c) => c.assets);
  }, [data]);

  // Compute estimated daily earnings of current Fixed Income positions (~1/252 business days)
  const estimatedDailyYield = useMemo(() => {
    if (!data) return 0;
    const rfCategory = data.categories.find((c) => c.category === "RENDA_FIXA");
    if (!rfCategory || rfCategory.assets.length === 0) return 0;

    return rfCategory.assets.reduce((acc, pos) => {
      const annualRatePct = pos.asset.rate || data.macro.cdiAnnualPct || 13.65;
      const dailyRate = Math.pow(1 + annualRatePct / 100, 1 / 252) - 1;
      const grossVal = pos.fixedIncomeBreakdown?.grossValue ?? pos.currentValue;
      return acc + grossVal * dailyRate;
    }, 0);
  }, [data]);

  // Initialize daily push notification scheduler (runs at 08:00 AM)
  useEffect(() => {
    const currentSettings = getDailyNotificationSettings();
    setDailyNotificationEnabled(currentSettings.enabled);
    if (currentSettings.enabled) {
      initDailyYieldScheduler(() => estimatedDailyYield);
    }
  }, [estimatedDailyYield]);

  function handleToggleDarkMode() {
    setDarkMode((prev) => {
      const next = !prev;
      document.documentElement.classList.toggle("dark", next);
      try {
        localStorage.setItem("investidor-theme", next ? "dark" : "light");
      } catch {
        // ignore
      }
      return next;
    });
  }

  function handleToggleHideValues() {
    setHideValues((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("investidor-hide-values", String(next));
      } catch {
        // ignore
      }
      return next;
    });
  }

  async function handleCreateWallet(name: string) {
    const res = await fetch("/api/wallets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (res.ok) {
      const body = await res.json();
      setWalletId(body.wallet.id);
      await loadPortfolio({ targetWalletId: body.wallet.id, silent: true });
    }
  }

  async function handleDeleteWallet(id: number) {
    const res = await fetch(`/api/wallets?id=${id}`, { method: "DELETE" });
    if (res.ok) {
      setWalletId(null);
      await loadPortfolio({ targetWalletId: null });
    }
  }

  async function handleUpdateTaxExemption(
    assetId: number,
    patch: { iofExempt?: boolean; irExempt?: boolean }
  ) {
    await fetch(`/api/assets/${assetId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    await loadPortfolio({ silent: true });
  }

  async function handleDeleteAsset(assetId: number, ticker: string) {
    const confirmed = window.confirm(
      `Excluir o ativo ${ticker} e todos os seus lançamentos e proventos?`
    );
    if (!confirmed) return;
    await fetch(`/api/assets/${assetId}`, { method: "DELETE" });
    await loadPortfolio({ silent: true });
  }

  async function handleDeleteTransaction(txId: number) {
    await fetch(`/api/transactions?id=${txId}`, { method: "DELETE" });
    await loadPortfolio({ silent: true });
  }

  async function handleDeleteDividend(divId: number) {
    await fetch(`/api/dividends?id=${divId}`, { method: "DELETE" });
    await loadPortfolio({ silent: true });
  }

  async function handleLockWallet() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.refresh();
  }

  function openAddModal(config: {
    tab?: "VARIABLE" | "FIXED" | "DIVIDEND";
    category?: AssetCategory;
    ticker?: string;
    dividendAssetId?: number;
  }) {
    setAddModalConfig({
      tab: config.tab ?? (config.category === "RENDA_FIXA" ? "FIXED" : "VARIABLE"),
      category: config.category,
      ticker: config.ticker,
      dividendAssetId: config.dividendAssetId,
    });
    setAddModalOpen(true);
  }

  // Initial Loading Skeleton
  if (loading && !data) {
    return (
      <div className="min-h-screen bg-[var(--bg-canvas)]">
        <div className="h-14 bg-[var(--bg-topbar)]" />
        <div className="h-[54px] bg-[var(--bg-surface)] border-b border-[var(--border-subtle)]" />
        <main className="mx-auto max-w-[1440px] px-4 py-6 sm:px-6 lg:px-8 space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="h-36 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] animate-pulse"
              />
            ))}
          </div>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
            <div className="lg:col-span-7 h-80 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] animate-pulse" />
            <div className="lg:col-span-5 h-80 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] animate-pulse" />
          </div>
        </main>
      </div>
    );
  }

  // Fatal Load Error State
  if (error && !data) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[var(--bg-canvas)] p-6 text-center">
        <div className="max-w-md rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6 shadow-sm">
          <AlertCircle className="mx-auto h-8 w-8 text-[var(--loss)]" />
          <h1 className="mt-3 text-base font-bold text-[var(--text-primary)]">
            Erro ao carregar a carteira
          </h1>
          <p className="mt-1 text-xs text-[var(--text-muted)]">{error}</p>
          <button
            type="button"
            onClick={() => loadPortfolio()}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[var(--cta-bg)] px-4 py-2 text-xs font-semibold text-[var(--cta-text)] cursor-pointer"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const isEmptyWallet = data.totals.assetCount === 0;

  return (
    <div className="min-h-screen bg-[var(--bg-canvas)] flex flex-col">
      <TopNav
        wallet={data.wallet}
        wallets={data.wallets}
        macro={data.macro}
        lastUpdatedAt={data.lastUpdatedAt}
        isRefreshing={isRefreshing}
        hideValues={hideValues}
        darkMode={darkMode}
        activeTab={activeTab}
        dailyNotificationEnabled={dailyNotificationEnabled}
        onChangeTab={(t) => setActiveTab(t)}
        onOpenDailyNotificationModal={() => {
          setDailyNotificationModalOpen(true);
          setDailyNotificationEnabled(getDailyNotificationSettings().enabled);
        }}
        onSelectWallet={(id) => setWalletId(id)}
        onCreateWallet={handleCreateWallet}
        onToggleHideValues={handleToggleHideValues}
        onToggleDarkMode={handleToggleDarkMode}
        onOpenSettings={() => setSettingsOpen(true)}
        onOpenAddTransaction={() => openAddModal({ tab: "VARIABLE" })}
        onOpenHistoryDrawer={() => {
          setDrawerAssetId(null);
          setDrawerCategory(null);
          setDrawerOpen(true);
        }}
        onManualRefresh={() => loadPortfolio({ forceRefresh: true, silent: true })}
        onLockWallet={handleLockWallet}
      />

      <main className="mx-auto w-full max-w-[1440px] flex-1 px-4 py-6 sm:px-6 lg:px-8 space-y-6">
        {/* Inline Non-blocking Error Banner */}
        {error ? (
          <div className="flex items-center justify-between rounded-xl border border-rose-500/30 bg-[var(--loss-soft)] px-4 py-3 text-xs font-medium text-[var(--loss)]">
            <span>{error}</span>
            <button
              type="button"
              onClick={() => loadPortfolio({ forceRefresh: true, silent: true })}
              className="underline font-semibold cursor-pointer"
            >
              Recarregar
            </button>
          </div>
        ) : null}

        {/* Tab 1: Dashboard Principal da Carteira */}
        {activeTab === "DASHBOARD" && (
          <>
            {/* 4 Consolidated KPI Cards */}
            <KpiCards
              totals={data.totals}
              sparkline12m={data.sparkline12m}
              sparklineTotal={data.sparklineTotal}
              hideValues={hideValues}
            />

            {/* Charts Row: Evolução do Patrimônio + Ativos na Carteira */}
            <ChartsSection
              evolution={data.evolution}
              allocation={data.allocation}
              periodMonths={periodMonths}
              categoryFilter={categoryFilter}
              hideValues={hideValues}
              onChangePeriod={(m) => setPeriodMonths(m)}
              onChangeCategory={(c) => setCategoryFilter(c)}
            />

            {/* Empty State CTA (Zero Mock Data) OR Real Categorized Asset Tables */}
            {isEmptyWallet ? (
              <section className="rounded-xl border border-dashed border-[var(--border-strong)] bg-[var(--bg-surface)] px-6 py-12 text-center shadow-[0_1px_2px_rgba(16,24,40,0.03)]">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-emerald-600 dark:text-emerald-400">
                  <TrendingUp className="h-6 w-6" />
                </div>
                <h2 className="mt-4 text-lg font-bold text-[var(--text-primary)]">
                  Sua carteira “{data.wallet.name}” está pronta para começar
                </h2>
                <p className="mx-auto mt-1.5 max-w-lg text-sm text-[var(--text-muted)]">
                  Nenhum dado fictício foi pré-carregado. Cadastre seu primeiro aporte de
                  Renda Variável ou Renda Fixa para acompanhar cotações em tempo real,
                  preço médio, rentabilidade e rebalanceamento.
                </p>
                <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => openAddModal({ tab: "VARIABLE", category: "ACOES" })}
                    className="inline-flex items-center gap-2 rounded-lg bg-[var(--cta-bg)] px-4 py-2.5 text-xs font-semibold text-[var(--cta-text)] hover:bg-[var(--cta-hover)] transition-colors cursor-pointer"
                  >
                    <Plus className="h-4 w-4" />
                    Lançar Ação, FII, ETF ou Cripto
                  </button>
                  <button
                    type="button"
                    onClick={() => openAddModal({ tab: "FIXED", category: "RENDA_FIXA" })}
                    className="inline-flex items-center gap-2 rounded-lg border border-[var(--border-strong)] bg-[var(--bg-surface)] px-4 py-2.5 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--bg-surface-subtle)] transition-colors cursor-pointer"
                  >
                    <Landmark className="h-4 w-4" />
                    Lançar Renda Fixa (CDB / Tesouro / LCI)
                  </button>
                </div>
              </section>
            ) : (
              <AssetsByCategory
                categories={data.categories}
                totalAssetCount={data.totals.assetCount}
                hideValues={hideValues}
                onAddTransactionForCategory={(cat, ticker) =>
                  openAddModal({
                    tab: cat === "RENDA_FIXA" ? "FIXED" : "VARIABLE",
                    category: cat,
                    ticker,
                  })
                }
                onAddDividendForAsset={(assetId) =>
                  openAddModal({ tab: "DIVIDEND", dividendAssetId: assetId })
                }
                onInspectAsset={(pos) => {
                  setDrawerAssetId(pos.asset.id);
                  setDrawerCategory(null);
                  setDrawerOpen(true);
                }}
                onInspectCategoryTransactions={(cat) => {
                  setDrawerAssetId(null);
                  setDrawerCategory(cat);
                  setDrawerOpen(true);
                }}
                onUpdateTaxExemption={handleUpdateTaxExemption}
                onDeleteAsset={handleDeleteAsset}
                onOpenTargetsSettings={() => setSettingsOpen(true)}
              />
            )}
          </>
        )}

        {/* Tab 2: Calculadora de Renda Fixa */}
        {activeTab === "FIXED_INCOME_CALC" && (
          <FixedIncomeCalculator macro={data.macro} />
        )}

        {/* Tab 3: Calculadora do Número Mágico */}
        {activeTab === "MAGIC_NUMBER" && (
          <MagicNumberCalculator
            userPositions={allPositions}
            onOpenAddTransaction={(t) =>
              openAddModal({ tab: "VARIABLE", ticker: t })
            }
          />
        )}
      </main>

      {/* Subtle Footer */}
      <footer className="mt-8 border-t border-[var(--border-subtle)] bg-[var(--bg-surface)]/70 py-4">
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-2 px-4 sm:px-6 lg:px-8 text-[11px] text-[var(--text-muted)]">
          <span>
            Dados de mercado em tempo real via Yahoo Finance, CoinGecko e Banco Central (SGS).
          </span>
          <span className="tabular-nums">
            Atualização automática a cada {settings.refreshIntervalSec}s · Netlify Database (Postgres)
          </span>
        </div>
      </footer>

      {/* Modals & Drawers */}
      <AddTransactionModal
        open={addModalOpen}
        walletId={data.wallet.id}
        macro={data.macro}
        existingPositions={allPositions}
        initialTab={addModalConfig.tab}
        initialCategory={addModalConfig.category}
        initialTicker={addModalConfig.ticker}
        initialDividendAssetId={addModalConfig.dividendAssetId}
        onClose={() => setAddModalOpen(false)}
        onSuccess={() => loadPortfolio({ forceRefresh: true, silent: true })}
      />

      <AssetDetailsDrawer
        open={drawerOpen}
        positions={allPositions}
        selectedAssetId={drawerAssetId}
        selectedCategory={drawerCategory}
        hideValues={hideValues}
        onClose={() => setDrawerOpen(false)}
        onDeleteTransaction={handleDeleteTransaction}
        onDeleteDividend={handleDeleteDividend}
        onAddTransaction={(cat, ticker) =>
          openAddModal({
            tab: cat === "RENDA_FIXA" ? "FIXED" : "VARIABLE",
            category: cat,
            ticker,
          })
        }
        onAddDividend={(assetId) =>
          openAddModal({ tab: "DIVIDEND", dividendAssetId: assetId })
        }
      />

      <SettingsModal
        open={settingsOpen}
        wallet={data.wallet}
        walletsCount={data.wallets.length}
        categoryTargets={data.categoryTargets}
        settings={settings}
        onClose={() => setSettingsOpen(false)}
        onSaved={async () => {
          await loadSettings();
          await loadPortfolio({ forceRefresh: true, silent: true });
        }}
        onDeleteWallet={handleDeleteWallet}
      />

      <DailyNotificationModal
        open={dailyNotificationModalOpen}
        onClose={() => {
          setDailyNotificationModalOpen(false);
          setDailyNotificationEnabled(getDailyNotificationSettings().enabled);
        }}
        estimatedDailyYield={estimatedDailyYield}
      />
    </div>
  );
}

