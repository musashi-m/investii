"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Check,
  Coins,
  Landmark,
  Loader2,
  Search,
  TrendingUp,
  X,
} from "lucide-react";
import {
  CATEGORY_LIST,
  type AssetCategory,
  type AssetPosition,
  type DividendType,
  type FixedIncomeIndexer,
  type FixedIncomeType,
  type MacroRates,
  type TickerSearchResult,
  type TransactionType,
} from "@/types/portfolio";
import { cn, formatBRL, formatCurrency, formatPct, getTodayISO } from "@/lib/format";
import { resolveFixedIncomeAnnualRate } from "@/lib/finance/calculator";

interface AddTransactionModalProps {
  open: boolean;
  walletId: number;
  macro: MacroRates;
  existingPositions: AssetPosition[];
  initialTab?: "VARIABLE" | "FIXED" | "DIVIDEND";
  initialCategory?: AssetCategory;
  initialTicker?: string;
  initialDividendAssetId?: number;
  onClose: () => void;
  onSuccess: () => Promise<void>;
}

const VARIABLE_CATEGORIES = CATEGORY_LIST.filter((c) => !c.isFixedIncome);

export default function AddTransactionModal({
  open,
  walletId,
  macro,
  existingPositions,
  initialTab = "VARIABLE",
  initialCategory,
  initialTicker,
  initialDividendAssetId,
  onClose,
  onSuccess,
}: AddTransactionModalProps) {
  const [tab, setTab] = useState<"VARIABLE" | "FIXED" | "DIVIDEND">(initialTab);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Variable Income fields
  const [category, setCategory] = useState<AssetCategory>(
    initialCategory && initialCategory !== "RENDA_FIXA" ? initialCategory : "ACOES"
  );
  const [txType, setTxType] = useState<TransactionType>("BUY");
  const [ticker, setTicker] = useState(initialTicker ?? "");
  const [assetName, setAssetName] = useState("");
  const [currency, setCurrency] = useState<"BRL" | "USD">("BRL");
  const [quantity, setQuantity] = useState("");
  const [unitPrice, setUnitPrice] = useState("");
  const [fees, setFees] = useState("0");
  const [executedAt, setExecutedAt] = useState(getTodayISO());
  const [rating, setRating] = useState("10");
  const [notes, setNotes] = useState("");

  // Live ticker search
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<TickerSearchResult[]>([]);
  const [selectedQuote, setSelectedQuote] = useState<TickerSearchResult | null>(null);

  // Fixed Income fields
  const existingFixedPositions = useMemo(
    () => existingPositions.filter((p) => p.asset.category === "RENDA_FIXA"),
    [existingPositions]
  );
  const [fiMode, setFiMode] = useState<"NEW" | "EXISTING">("NEW");
  const [fiExistingAssetId, setFiExistingAssetId] = useState<string>("");
  const [fiType, setFiType] = useState<FixedIncomeType>("CDB");
  const [fiTitle, setFiTitle] = useState("");
  const [fiIssuer, setFiIssuer] = useState("");
  const [fiIndexer, setFiIndexer] = useState<FixedIncomeIndexer>("CDI");
  const [fiRate, setFiRate] = useState("100");
  const [fiAmount, setFiAmount] = useState("");
  const [fiDate, setFiDate] = useState(getTodayISO());
  const [fiMaturity, setFiMaturity] = useState("");
  const [fiTxType, setFiTxType] = useState<TransactionType>("BUY");
  const [fiIofExempt, setFiIofExempt] = useState(false);
  const [fiIrExempt, setFiIrExempt] = useState(false);
  const [fiNotes, setFiNotes] = useState("");

  // Dividend fields
  const [divAssetId, setDivAssetId] = useState<string>(
    initialDividendAssetId
      ? String(initialDividendAssetId)
      : existingPositions[0]
        ? String(existingPositions[0].asset.id)
        : ""
  );
  const [divType, setDivType] = useState<DividendType>("DIVIDEND");
  const [divAmount, setDivAmount] = useState("");
  const [divDate, setDivDate] = useState(getTodayISO());
  const [divNotes, setDivNotes] = useState("");

  // Reset modal state whenever opened
  useEffect(() => {
    if (!open) return;
    setErrorMsg(null);
    if (initialCategory === "RENDA_FIXA") {
      setTab("FIXED");
    } else {
      setTab(initialTab);
    }
    if (initialCategory && initialCategory !== "RENDA_FIXA") {
      setCategory(initialCategory);
      setCurrency(initialCategory === "STOCKS" ? "USD" : "BRL");
    }
    setTicker(initialTicker ?? "");
    setAssetName("");
    setSelectedQuote(null);
    setSearchResults([]);
    setQuantity("");
    setUnitPrice("");
    setFees("0");
    setExecutedAt(getTodayISO());
    setNotes("");
    setFiAmount("");
    setFiDate(getTodayISO());
    setFiType("CDB");
    setFiTitle("");
    setFiIssuer("");
    setFiRate("100");
    setFiIndexer("CDI");
    setFiMaturity("");
    setFiTxType("BUY");
    setFiIofExempt(false);
    setFiIrExempt(false);
    setFiNotes("");

    // Pre-select existing fixed-income title when triggered from a row/drawer
    const matchedFixed =
      initialCategory === "RENDA_FIXA" && initialTicker
        ? existingFixedPositions.find(
            (p) => p.asset.ticker.toUpperCase() === initialTicker.toUpperCase()
          )
        : undefined;
    if (matchedFixed) {
      setFiMode("EXISTING");
      setFiExistingAssetId(String(matchedFixed.asset.id));
    } else {
      setFiMode("NEW");
      setFiExistingAssetId(
        existingFixedPositions[0] ? String(existingFixedPositions[0].asset.id) : ""
      );
    }
    if (initialDividendAssetId) {
      setDivAssetId(String(initialDividendAssetId));
    } else if (existingPositions[0]) {
      setDivAssetId(String(existingPositions[0].asset.id));
    }
    setDivAmount("");
    setDivDate(getTodayISO());
    setDivNotes("");
  }, [
    open,
    initialTab,
    initialCategory,
    initialTicker,
    initialDividendAssetId,
    existingPositions,
    existingFixedPositions,
  ]);

  // Debounced live ticker search against /api/market/search
  useEffect(() => {
    if (!open || tab !== "VARIABLE") return;
    const clean = ticker.trim();
    if (clean.length < 2) {
      setSearchResults([]);
      return;
    }
    if (selectedQuote && selectedQuote.ticker === clean.toUpperCase()) {
      return;
    }

    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(
          `/api/market/search?q=${encodeURIComponent(clean)}&category=${category}`
        );
        if (res.ok) {
          const data = (await res.json()) as { results: TickerSearchResult[] };
          setSearchResults(data.results ?? []);
        }
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 380);

    return () => clearTimeout(timer);
  }, [ticker, category, open, tab, selectedQuote]);

  const parsedQty = Number(quantity.replace(",", "."));
  const parsedPrice = Number(unitPrice.replace(",", "."));
  const parsedFees = Number(fees.replace(",", ".")) || 0;
  const totalOperation =
    Number.isFinite(parsedQty) && Number.isFinite(parsedPrice) && parsedQty > 0 && parsedPrice >= 0
      ? parsedQty * parsedPrice + (txType === "BUY" ? parsedFees : -parsedFees)
      : 0;

  const estimatedFixedAnnualRate = useMemo(() => {
    const r = Number(fiRate.replace(",", "."));
    if (!Number.isFinite(r)) return 0;
    return resolveFixedIncomeAnnualRate(fiIndexer, r, macro);
  }, [fiIndexer, fiRate, macro]);

  if (!open) return null;

  function handleSelectSearchResult(item: TickerSearchResult) {
    setSelectedQuote(item);
    setTicker(item.ticker);
    setAssetName(item.name);
    setCategory(item.category);
    setCurrency(item.currency);
    if (item.price && item.price > 0 && !unitPrice) {
      setUnitPrice(String(Number(item.price.toFixed(2))));
    }
    setSearchResults([]);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    setSubmitting(true);

    try {
      if (tab === "VARIABLE") {
        const q = Number(quantity.replace(",", "."));
        const p = Number(unitPrice.replace(",", "."));
        const f = Number(fees.replace(",", ".")) || 0;
        if (!ticker.trim()) throw new Error("Informe o código do ativo (ex: PETR4, MXRF11, BTC).");
        if (!Number.isFinite(q) || q <= 0) throw new Error("Informe uma quantidade válida.");
        if (!Number.isFinite(p) || p < 0) throw new Error("Informe um preço unitário válido.");

        const res = await fetch("/api/transactions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            walletId,
            category,
            ticker: ticker.trim().toUpperCase(),
            name: assetName.trim() || undefined,
            currency,
            type: txType,
            quantity: q,
            unitPrice: p,
            fees: f,
            executedAt,
            rating: Number(rating),
            notes: notes.trim() || null,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Falha ao registrar lançamento.");
      } else if (tab === "FIXED") {
        const amt = Number(fiAmount.replace(",", "."));
        if (!Number.isFinite(amt) || amt <= 0) {
          throw new Error(
            fiTxType === "BUY"
              ? "Informe o valor aplicado."
              : "Informe o valor resgatado."
          );
        }

        if (fiMode === "EXISTING") {
          const targetPos = existingFixedPositions.find(
            (p) => String(p.asset.id) === fiExistingAssetId
          );
          if (!targetPos) {
            throw new Error("Selecione um título de Renda Fixa existente.");
          }
          const a = targetPos.asset;
          const res = await fetch("/api/transactions", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              walletId,
              category: "RENDA_FIXA",
              ticker: a.ticker,
              name: a.name,
              currency: "BRL",
              type: fiTxType,
              quantity: 1,
              unitPrice: amt,
              fees: 0,
              executedAt: fiDate,
              rating: a.rating,
              fixedIncomeType: a.fixedIncomeType ?? "CDB",
              indexer: a.indexer ?? "CDI",
              rate: a.rate ?? 100,
              maturityDate: a.maturityDate,
              issuer: a.issuer,
              irExempt: a.irExempt,
              iofExempt: a.iofExempt,
              notes: fiNotes.trim() || null,
            }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || "Falha ao registrar movimentação.");
        } else {
          const r = Number(fiRate.replace(",", "."));
          if (!fiTitle.trim()) {
            throw new Error("Informe o nome do título (ex: CDB 110% CDI).");
          }
          if (!Number.isFinite(r) || r < 0) throw new Error("Informe uma taxa válida.");

          const res = await fetch("/api/transactions", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              walletId,
              category: "RENDA_FIXA",
              ticker: fiTitle.trim().toUpperCase().slice(0, 36),
              name: fiTitle.trim(),
              currency: "BRL",
              type: fiTxType,
              quantity: 1,
              unitPrice: amt,
              fees: 0,
              executedAt: fiDate,
              rating: Number(rating),
              fixedIncomeType: fiType,
              indexer: fiIndexer,
              rate: r,
              maturityDate: fiMaturity || null,
              issuer: fiIssuer.trim() || null,
              irExempt: fiIrExempt,
              iofExempt: fiIofExempt,
              notes: fiNotes.trim() || null,
            }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || "Falha ao registrar Renda Fixa.");
        }
      } else {
        const amt = Number(divAmount.replace(",", "."));
        if (!divAssetId) throw new Error("Selecione um ativo da carteira.");
        if (!Number.isFinite(amt) || amt <= 0) throw new Error("Informe o valor recebido.");

        const res = await fetch("/api/dividends", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            assetId: Number(divAssetId),
            type: divType,
            amount: amt,
            paidAt: divDate,
            notes: divNotes.trim() || null,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Falha ao registrar provento.");
      }

      await onSuccess();
      onClose();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Erro ao salvar lançamento.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-[2px] p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-tx-title"
    >
      <div className="w-full max-w-xl rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-[var(--border-subtle)] px-6 py-4">
          <div>
            <h2
              id="add-tx-title"
              className="text-base font-bold text-[var(--text-primary)]"
            >
              Adicionar Lançamento
            </h2>
            <p className="text-xs text-[var(--text-muted)]">
              Os valores são salvos localmente e atualizados com cotações reais.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar modal"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-muted)] hover:bg-[var(--bg-surface-subtle)] hover:text-[var(--text-primary)] cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Mode Tabs */}
        <div className="grid grid-cols-3 gap-1 border-b border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] p-2">
          <button
            type="button"
            onClick={() => setTab("VARIABLE")}
            className={cn(
              "flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition-colors cursor-pointer",
              tab === "VARIABLE"
                ? "bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-xs border border-[var(--border-subtle)]"
                : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            )}
          >
            <TrendingUp className="h-3.5 w-3.5" />
            Renda Variável
          </button>
          <button
            type="button"
            onClick={() => setTab("FIXED")}
            className={cn(
              "flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition-colors cursor-pointer",
              tab === "FIXED"
                ? "bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-xs border border-[var(--border-subtle)]"
                : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            )}
          >
            <Landmark className="h-3.5 w-3.5" />
            Renda Fixa
          </button>
          <button
            type="button"
            onClick={() => setTab("DIVIDEND")}
            disabled={existingPositions.length === 0}
            className={cn(
              "flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed",
              tab === "DIVIDEND"
                ? "bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-xs border border-[var(--border-subtle)]"
                : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            )}
          >
            <Coins className="h-3.5 w-3.5" />
            Provento
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="max-h-[75vh] overflow-y-auto px-6 py-5 space-y-4">
          {errorMsg ? (
            <div className="rounded-lg border border-rose-500/30 bg-[var(--loss-soft)] px-3.5 py-2.5 text-xs font-medium text-[var(--loss)]">
              {errorMsg}
            </div>
          ) : null}

          {tab === "VARIABLE" ? (
            <>
              {/* Buy / Sell Segmented Toggle */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setTxType("BUY")}
                  className={cn(
                    "rounded-lg border py-2 text-xs font-bold transition-colors cursor-pointer",
                    txType === "BUY"
                      ? "border-emerald-500 bg-[var(--gain-soft)] text-[var(--gain)]"
                      : "border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                  )}
                >
                  Compra (Aporte)
                </button>
                <button
                  type="button"
                  onClick={() => setTxType("SELL")}
                  className={cn(
                    "rounded-lg border py-2 text-xs font-bold transition-colors cursor-pointer",
                    txType === "SELL"
                      ? "border-rose-500 bg-[var(--loss-soft)] text-[var(--loss)]"
                      : "border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                  )}
                >
                  Venda (Resgate)
                </button>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {/* Category */}
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                    Tipo de ativo
                  </label>
                  <select
                    value={category}
                    onChange={(e) => {
                      const next = e.target.value as AssetCategory;
                      setCategory(next);
                      setCurrency(next === "STOCKS" ? "USD" : "BRL");
                      setSelectedQuote(null);
                    }}
                    className="w-full rounded-lg border border-[var(--border-strong)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-emerald-500"
                  >
                    {VARIABLE_CATEGORIES.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Live Ticker Search */}
                <div className="relative">
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                    Código do ativo (Ticker)
                  </label>
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--text-muted)]" />
                    <input
                      type="text"
                      value={ticker}
                      onChange={(e) => {
                        setTicker(e.target.value.toUpperCase());
                        setSelectedQuote(null);
                      }}
                      placeholder={
                        category === "CRIPTOS"
                          ? "Ex: BTC, ETH, SOL"
                          : category === "STOCKS"
                            ? "Ex: AAPL, NVDA, VOO"
                            : category === "FIIS"
                              ? "Ex: MXRF11, HGLG11"
                              : "Ex: PETR4, ITSA4, BBAS3"
                      }
                      required
                      className="w-full rounded-lg border border-[var(--border-strong)] bg-[var(--bg-surface)] pl-8 pr-8 py-2 text-sm font-semibold uppercase text-[var(--text-primary)] outline-none focus:border-emerald-500"
                    />
                    {searching ? (
                      <Loader2 className="absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-[var(--text-muted)]" />
                    ) : selectedQuote ? (
                      <Check className="absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-500" />
                    ) : null}
                  </div>

                  {/* Live Search Results Dropdown */}
                  {searchResults.length > 0 ? (
                    <div className="absolute left-0 right-0 top-[66px] z-50 max-h-52 overflow-y-auto rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] shadow-xl divide-y divide-[var(--border-subtle)]/60">
                      {searchResults.map((item) => (
                        <button
                          key={`${item.ticker}-${item.category}`}
                          type="button"
                          onClick={() => handleSelectSearchResult(item)}
                          className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-xs hover:bg-[var(--bg-surface-subtle)] cursor-pointer"
                        >
                          <div className="min-w-0">
                            <span className="font-bold text-[var(--text-primary)]">
                              {item.ticker}
                            </span>
                            <p className="truncate text-[11px] text-[var(--text-muted)]">
                              {item.name}
                            </p>
                          </div>
                          {item.price !== null ? (
                            <div className="text-right shrink-0 tabular-nums">
                              <p className="font-bold text-[var(--text-primary)]">
                                {formatCurrency(item.price, item.currency)}
                              </p>
                              <p className="text-[10px] text-emerald-600 dark:text-emerald-400">
                                Ao vivo · {item.source}
                              </p>
                            </div>
                          ) : (
                            <span className="text-[10px] text-[var(--text-muted)]">
                              Selecionar
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>

              {/* Selected live quote banner */}
              {selectedQuote && selectedQuote.price !== null ? (
                <div className="flex items-center justify-between rounded-lg border border-emerald-500/25 bg-[var(--gain-soft)] px-3.5 py-2 text-xs">
                  <span className="text-[var(--text-primary)]">
                    <strong>{selectedQuote.ticker}</strong> — {selectedQuote.name}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setUnitPrice(String(Number(selectedQuote.price!.toFixed(2))))
                    }
                    className="font-bold text-[var(--gain)] underline-offset-2 hover:underline tabular-nums cursor-pointer"
                  >
                    Usar cotação atual:{" "}
                    {formatCurrency(selectedQuote.price, selectedQuote.currency)}
                  </button>
                </div>
              ) : null}

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                    Data da operação
                  </label>
                  <input
                    type="date"
                    value={executedAt}
                    onChange={(e) => setExecutedAt(e.target.value)}
                    required
                    className="w-full rounded-lg border border-[var(--border-strong)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-emerald-500 tabular-nums"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                    Quantidade
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    placeholder="Ex: 10"
                    required
                    className="w-full rounded-lg border border-[var(--border-strong)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-emerald-500 tabular-nums"
                  />
                </div>

                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                    Preço ({currency === "USD" ? "US$" : "R$"})
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={unitPrice}
                    onChange={(e) => setUnitPrice(e.target.value)}
                    placeholder="Ex: 35,40"
                    required
                    className="w-full rounded-lg border border-[var(--border-strong)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-emerald-500 tabular-nums"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                    Taxas / Emolumentos ({currency === "USD" ? "US$" : "R$"})
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={fees}
                    onChange={(e) => setFees(e.target.value)}
                    placeholder="0,00"
                    className="w-full rounded-lg border border-[var(--border-strong)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-emerald-500 tabular-nums"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                    Nota do ativo (0 a 10)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={10}
                    value={rating}
                    onChange={(e) => setRating(e.target.value)}
                    className="w-full rounded-lg border border-[var(--border-strong)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-emerald-500 tabular-nums"
                  />
                </div>
              </div>

              {/* Total Preview */}
              <div className="flex items-center justify-between rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] px-4 py-3">
                <span className="text-xs font-medium text-[var(--text-secondary)]">
                  Valor total da operação
                </span>
                <span className="text-base font-bold text-[var(--text-primary)] tabular-nums">
                  {formatCurrency(totalOperation, currency)}
                </span>
              </div>
            </>
          ) : tab === "FIXED" ? (
            <>
              {/* Switcher: Novo título vs Título existente */}
              {existingFixedPositions.length > 0 ? (
                <div className="grid grid-cols-2 gap-1.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] p-1">
                  <button
                    type="button"
                    onClick={() => setFiMode("NEW")}
                    className={cn(
                      "rounded-lg py-1.5 text-xs font-semibold transition-colors cursor-pointer",
                      fiMode === "NEW"
                        ? "bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-xs border border-[var(--border-subtle)]"
                        : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                    )}
                  >
                    Novo título
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setFiMode("EXISTING");
                      if (!fiExistingAssetId && existingFixedPositions[0]) {
                        setFiExistingAssetId(String(existingFixedPositions[0].asset.id));
                      }
                    }}
                    className={cn(
                      "rounded-lg py-1.5 text-xs font-semibold transition-colors cursor-pointer",
                      fiMode === "EXISTING"
                        ? "bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-xs border border-[var(--border-subtle)]"
                        : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                    )}
                  >
                    Aportar / Resgatar em existente ({existingFixedPositions.length})
                  </button>
                </div>
              ) : null}

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setFiTxType("BUY")}
                  className={cn(
                    "rounded-lg border py-2 text-xs font-bold transition-colors cursor-pointer",
                    fiTxType === "BUY"
                      ? "border-emerald-500 bg-[var(--gain-soft)] text-[var(--gain)]"
                      : "border-[var(--border-subtle)] text-[var(--text-muted)]"
                  )}
                >
                  Aplicação (Aporte)
                </button>
                <button
                  type="button"
                  onClick={() => setFiTxType("SELL")}
                  className={cn(
                    "rounded-lg border py-2 text-xs font-bold transition-colors cursor-pointer",
                    fiTxType === "SELL"
                      ? "border-rose-500 bg-[var(--loss-soft)] text-[var(--loss)]"
                      : "border-[var(--border-subtle)] text-[var(--text-muted)]"
                  )}
                >
                  Resgate
                </button>
              </div>

              {fiMode === "EXISTING" && existingFixedPositions.length > 0 ? (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                      Selecione o título já cadastrado
                    </label>
                    <select
                      value={fiExistingAssetId}
                      onChange={(e) => setFiExistingAssetId(e.target.value)}
                      required
                      className="w-full rounded-lg border border-[var(--border-strong)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-emerald-500"
                    >
                      {existingFixedPositions.map((pos) => (
                        <option key={pos.asset.id} value={pos.asset.id}>
                          {pos.asset.name}
                          {pos.asset.issuer ? ` (${pos.asset.issuer})` : ""} — Líq.{" "}
                          {formatBRL(pos.currentValue)}
                        </option>
                      ))}
                    </select>
                  </div>

                  {(() => {
                    const sel = existingFixedPositions.find(
                      (p) => String(p.asset.id) === fiExistingAssetId
                    );
                    if (!sel) return null;
                    const a = sel.asset;
                    return (
                      <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] px-3.5 py-2.5 text-xs text-[var(--text-secondary)] flex flex-wrap items-center justify-between gap-2">
                        <span>
                          <strong>{a.fixedIncomeType ?? "RF"}</strong> ·{" "}
                          {a.indexer === "CDI"
                            ? `${a.rate}% CDI`
                            : a.indexer === "PRE"
                              ? `${a.rate}% a.a.`
                              : `${a.indexer} + ${a.rate}%`}
                          {a.issuer ? ` · ${a.issuer}` : ""}
                        </span>
                        <span className="text-[11px] font-semibold text-[var(--text-muted)]">
                          {a.iofExempt ? "Isento IOF" : "IOF regressivo"} ·{" "}
                          {a.irExempt ? "Isento IR" : "IR regressivo"}
                        </span>
                      </div>
                    );
                  })()}

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                        {fiTxType === "BUY" ? "Valor do Aporte (R$)" : "Valor do Resgate (R$)"}
                      </label>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={fiAmount}
                        onChange={(e) => setFiAmount(e.target.value)}
                        placeholder="Ex: 1000,00"
                        required
                        className="w-full rounded-lg border border-[var(--border-strong)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-emerald-500 tabular-nums"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                        {fiTxType === "BUY" ? "Data do Aporte" : "Data do Resgate"}
                      </label>
                      <input
                        type="date"
                        value={fiDate}
                        onChange={(e) => setFiDate(e.target.value)}
                        required
                        className="w-full rounded-lg border border-[var(--border-strong)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-emerald-500 tabular-nums"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                      Observação (opcional)
                    </label>
                    <input
                      type="text"
                      value={fiNotes}
                      onChange={(e) => setFiNotes(e.target.value)}
                      placeholder="Ex: Aporte mensal de novembro"
                      className="w-full rounded-lg border border-[var(--border-strong)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-emerald-500"
                    />
                  </div>

                  <p className="text-[11px] text-[var(--text-muted)]">
                    O novo lote será consolidado na mesma linha do título e terá sua própria contagem de dias corridos para IOF e tabela regressiva do IR.
                  </p>
                </>
              ) : (
                <>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                        Tipo de Título
                      </label>
                      <select
                        value={fiType}
                        onChange={(e) => {
                          const next = e.target.value as FixedIncomeType;
                          setFiType(next);
                          const autoExempt =
                            next === "LCI" || next === "LCA" || next === "CRI_CRA";
                          setFiIrExempt(autoExempt);
                          setFiIofExempt(autoExempt);
                        }}
                        className="w-full rounded-lg border border-[var(--border-strong)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-emerald-500"
                      >
                        <option value="CDB">CDB</option>
                        <option value="LCI">LCI</option>
                        <option value="LCA">LCA</option>
                        <option value="TESOURO">Tesouro Direto</option>
                        <option value="CRI_CRA">CRI / CRA</option>
                        <option value="DEBENTURE">Debênture</option>
                        <option value="OUTROS">Outros</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                        Emissor / Instituição
                      </label>
                      <input
                        type="text"
                        value={fiIssuer}
                        onChange={(e) => setFiIssuer(e.target.value)}
                        placeholder="Ex: Banco Inter, Tesouro Nacional"
                        className="w-full rounded-lg border border-[var(--border-strong)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                      Nome / Identificação do Título
                    </label>
                    <input
                      type="text"
                      value={fiTitle}
                      onChange={(e) => setFiTitle(e.target.value)}
                      placeholder="Ex: CDB Liquidez Diária 105% CDI ou Tesouro IPCA+ 2035"
                      required
                      className="w-full rounded-lg border border-[var(--border-strong)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                        Indexador
                      </label>
                      <select
                        value={fiIndexer}
                        onChange={(e) => setFiIndexer(e.target.value as FixedIncomeIndexer)}
                        className="w-full rounded-lg border border-[var(--border-strong)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-emerald-500"
                      >
                        <option value="CDI">% do CDI</option>
                        <option value="IPCA">IPCA + % a.a.</option>
                        <option value="PRE">Prefixado (% a.a.)</option>
                        <option value="SELIC">Selic + % a.a.</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                        {fiIndexer === "CDI" ? "Percentual do CDI (%)" : "Taxa contratada (% a.a.)"}
                      </label>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={fiRate}
                        onChange={(e) => setFiRate(e.target.value)}
                        placeholder={fiIndexer === "CDI" ? "Ex: 110" : "Ex: 6,5"}
                        required
                        className="w-full rounded-lg border border-[var(--border-strong)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-emerald-500 tabular-nums"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div>
                      <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                        {fiTxType === "BUY" ? "Valor Aplicado (R$)" : "Valor Resgatado (R$)"}
                      </label>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={fiAmount}
                        onChange={(e) => setFiAmount(e.target.value)}
                        placeholder="Ex: 5000,00"
                        required
                        className="w-full rounded-lg border border-[var(--border-strong)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-emerald-500 tabular-nums"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                        Data de Aplicação
                      </label>
                      <input
                        type="date"
                        value={fiDate}
                        onChange={(e) => setFiDate(e.target.value)}
                        required
                        className="w-full rounded-lg border border-[var(--border-strong)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-emerald-500 tabular-nums"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                        Vencimento (opcional)
                      </label>
                      <input
                        type="date"
                        value={fiMaturity}
                        onChange={(e) => setFiMaturity(e.target.value)}
                        className="w-full rounded-lg border border-[var(--border-strong)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-emerald-500 tabular-nums"
                      />
                    </div>
                  </div>

                  {/* Tax Exemption Clickable Options (IOF & IR) */}
                  <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={fiIofExempt}
                      onClick={() => setFiIofExempt((v) => !v)}
                      className={cn(
                        "flex items-center justify-between gap-2 rounded-xl border px-3.5 py-2.5 text-left transition-colors cursor-pointer",
                        fiIofExempt
                          ? "border-emerald-500/60 bg-[var(--gain-soft)]"
                          : "border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] hover:border-[var(--border-strong)]"
                      )}
                    >
                      <div>
                        <p className="text-xs font-semibold text-[var(--text-primary)]">
                          Isento de IOF (desde o 1º dia)
                        </p>
                        <p className="text-[11px] text-[var(--text-muted)]">
                          {fiIofExempt
                            ? "Sem cobrança de IOF nos primeiros 29 dias"
                            : "Aplica tabela regressiva de IOF (< 30 dias)"}
                        </p>
                      </div>
                      <span
                        className={cn(
                          "inline-flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition-colors",
                          fiIofExempt ? "bg-emerald-600 justify-end" : "bg-slate-400/50 justify-start"
                        )}
                      >
                        <span className="h-4 w-4 rounded-full bg-white shadow-xs" />
                      </span>
                    </button>

                    <button
                      type="button"
                      role="switch"
                      aria-checked={fiIrExempt}
                      onClick={() => setFiIrExempt((v) => !v)}
                      className={cn(
                        "flex items-center justify-between gap-2 rounded-xl border px-3.5 py-2.5 text-left transition-colors cursor-pointer",
                        fiIrExempt
                          ? "border-emerald-500/60 bg-[var(--gain-soft)]"
                          : "border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] hover:border-[var(--border-strong)]"
                      )}
                    >
                      <div>
                        <p className="text-xs font-semibold text-[var(--text-primary)]">
                          Isento de IR
                        </p>
                        <p className="text-[11px] text-[var(--text-muted)]">
                          {fiIrExempt
                            ? "LCI, LCA, CRI, CRA ou Debênture Incentivada"
                            : "Tabela regressiva: 22,5% até 15%"}
                        </p>
                      </div>
                      <span
                        className={cn(
                          "inline-flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition-colors",
                          fiIrExempt ? "bg-emerald-600 justify-end" : "bg-slate-400/50 justify-start"
                        )}
                      >
                        <span className="h-4 w-4 rounded-full bg-white shadow-xs" />
                      </span>
                    </button>
                  </div>

                  {/* Live BCB Rate Preview */}
                  <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] px-4 py-3 text-xs text-[var(--text-secondary)] flex flex-wrap items-center justify-between gap-2 tabular-nums">
                    <span>
                      Base BCB ao vivo: CDI <strong>{formatPct(macro.cdiAnnualPct)}</strong> · IPCA{" "}
                      <strong>{formatPct(macro.ipca12mPct)}</strong>
                    </span>
                    <span className="font-bold text-[var(--gain)]">
                      Taxa efetiva bruta est.: {formatPct(estimatedFixedAnnualRate)} a.a.
                    </span>
                  </div>
                </>
              )}
            </>
          ) : (
            <>
              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                  Ativo da carteira
                </label>
                <select
                  value={divAssetId}
                  onChange={(e) => setDivAssetId(e.target.value)}
                  required
                  className="w-full rounded-lg border border-[var(--border-strong)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-emerald-500"
                >
                  {existingPositions.map((pos) => (
                    <option key={pos.asset.id} value={pos.asset.id}>
                      {pos.asset.ticker} — {pos.asset.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                    Tipo de Provento
                  </label>
                  <select
                    value={divType}
                    onChange={(e) => setDivType(e.target.value as DividendType)}
                    className="w-full rounded-lg border border-[var(--border-strong)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-emerald-500"
                  >
                    <option value="DIVIDEND">Dividendo</option>
                    <option value="JCP">JCP</option>
                    <option value="YIELD">Rendimento (FII)</option>
                    <option value="INTEREST">Juros / Cupom</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                    Data de Pagamento
                  </label>
                  <input
                    type="date"
                    value={divDate}
                    onChange={(e) => setDivDate(e.target.value)}
                    required
                    className="w-full rounded-lg border border-[var(--border-strong)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-emerald-500 tabular-nums"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                    Valor Líquido (R$)
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={divAmount}
                    onChange={(e) => setDivAmount(e.target.value)}
                    placeholder="Ex: 42,50"
                    required
                    className="w-full rounded-lg border border-[var(--border-strong)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-emerald-500 tabular-nums"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                  Observação (opcional)
                </label>
                <input
                  type="text"
                  value={divNotes}
                  onChange={(e) => setDivNotes(e.target.value)}
                  placeholder="Ex: Referente a novembro/2026"
                  className="w-full rounded-lg border border-[var(--border-strong)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-emerald-500"
                />
              </div>

              {Number(divAmount.replace(",", ".")) > 0 ? (
                <div className="flex items-center justify-between rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] px-4 py-3 text-xs">
                  <span className="text-[var(--text-secondary)]">Provento a registrar</span>
                  <span className="text-sm font-bold text-[var(--gain)] tabular-nums">
                    + {formatBRL(Number(divAmount.replace(",", ".")))}
                  </span>
                </div>
              ) : null}
            </>
          )}

          {/* Footer Submit Buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[var(--border-subtle)]">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-[var(--border-subtle)] px-4 py-2 text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-surface-subtle)] cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 rounded-lg bg-[var(--cta-bg)] px-5 py-2 text-xs font-semibold text-[var(--cta-text)] hover:bg-[var(--cta-hover)] disabled:opacity-60 cursor-pointer"
            >
              {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              <span>{submitting ? "Salvando..." : "Salvar Lançamento"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

