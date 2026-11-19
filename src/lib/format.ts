import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const brlFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const usdFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const numberFormatter = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 6,
});

const pctFormatter = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatBRL(value: number, hidden = false): string {
  if (hidden) return "R$ •••••";
  if (!Number.isFinite(value)) return "R$ 0,00";
  return brlFormatter.format(value);
}

export const formatCurrencyBRL = formatBRL;

export function formatCurrency(
  value: number,
  currency: "BRL" | "USD" = "BRL",
  hidden = false
): string {
  if (hidden) return currency === "USD" ? "US$ •••••" : "R$ •••••";
  if (!Number.isFinite(value)) return currency === "USD" ? "US$ 0,00" : "R$ 0,00";
  return currency === "USD" ? usdFormatter.format(value) : brlFormatter.format(value);
}

export function formatPct(value: number, showPlus = false): string {
  if (!Number.isFinite(value)) return "0,00%";
  const sign = showPlus && value > 0 ? "+" : "";
  return `${sign}${pctFormatter.format(value)}%`;
}

export function formatQty(value: number): string {
  if (!Number.isFinite(value)) return "0";
  return numberFormatter.format(value);
}

export function formatDateBR(isoDate: string): string {
  if (!isoDate) return "-";
  const [y, m, d] = isoDate.slice(0, 10).split("-");
  if (!y || !m || !d) return isoDate;
  return `${d}/${m}/${y}`;
}

export function formatMonthLabel(ym: string): string {
  const [y, m] = ym.split("-");
  if (!y || !m) return ym;
  return `${m}/${y.slice(-2)}`;
}

export function formatTimeBR(isoTimestamp: string | null): string {
  if (!isoTimestamp) return "--:--";
  const dt = new Date(isoTimestamp);
  if (Number.isNaN(dt.getTime())) return "--:--";
  return dt.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function getTodayISO(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

