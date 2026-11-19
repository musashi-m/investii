"use client";

import { useEffect, useState } from "react";
import {
  Bell,
  BellOff,
  CheckCircle2,
  Clock,
  Sparkles,
  TrendingUp,
  X,
} from "lucide-react";
import { formatCurrencyBRL } from "@/lib/format";
import {
  getDailyNotificationSettings,
  saveDailyNotificationSettings,
  showFixedIncomeNotification,
  type DailyNotificationSettings,
} from "@/lib/notifications/dailyYield";

interface DailyNotificationModalProps {
  open: boolean;
  onClose: () => void;
  estimatedDailyYield: number;
}

export default function DailyNotificationModal({
  open,
  onClose,
  estimatedDailyYield,
}: DailyNotificationModalProps) {
  const [settings, setSettings] = useState<DailyNotificationSettings>({
    enabled: false,
    scheduledTime: "08:00",
    lastTriggeredDate: null,
  });
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [testing, setTesting] = useState(false);
  const [testSuccess, setTestSuccess] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      setPermission(Notification.permission);
      setSettings(getDailyNotificationSettings());
    }
  }, [open]);

  if (!open) return null;

  async function handleToggle(enable: boolean) {
    if (enable) {
      if (typeof window !== "undefined" && "Notification" in window) {
        const res = await Notification.requestPermission();
        setPermission(res);
        if (res !== "granted") {
          alert(
            "Para receber o rendimento diário às 08:00, permita as notificações no seu navegador ou configurações do celular."
          );
          return;
        }
      }
    }
    const updated = { ...settings, enabled: enable };
    setSettings(updated);
    saveDailyNotificationSettings(updated);
  }

  function handleTimeChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    const updated = { ...settings, scheduledTime: val };
    setSettings(updated);
    saveDailyNotificationSettings(updated);
  }

  async function handleTestNotification() {
    setTesting(true);
    setTestSuccess(false);
    try {
      const ok = await showFixedIncomeNotification(estimatedDailyYield, {
        isTest: true,
      });
      if (ok) {
        setTestSuccess(true);
        setTimeout(() => setTestSuccess(false), 4000);
      }
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      {/* Modal Dialog */}
      <div className="relative w-full max-w-lg rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6 shadow-2xl z-10 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-[var(--border-subtle)] pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-400/15 border border-amber-400/30 text-amber-500">
              <Bell className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[var(--text-primary)]">
                Notificação Diária de Renda Fixa
              </h2>
              <p className="text-xs text-[var(--text-muted)]">
                Receba todos os dias às 08:00 quanto seus aportes renderam
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-[var(--text-muted)] hover:bg-[var(--bg-surface-subtle)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="mt-5 space-y-4">
          {/* Daily Yield Estimate Card */}
          <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5">
                <TrendingUp className="h-4 w-4" />
                Rendimento Diário Estimado
              </span>
              <span className="text-xs text-emerald-600 dark:text-emerald-400">
                1 dia útil (~1/252)
              </span>
            </div>
            <div className="mt-2 text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 tabular-nums">
              +{formatCurrencyBRL(estimatedDailyYield)}
              <span className="text-xs font-normal text-[var(--text-muted)] ml-1.5">
                / dia
              </span>
            </div>
            <p className="mt-1 text-[11px] text-[var(--text-muted)]">
              Calculado automaticamente a partir dos seus ativos de Renda Fixa (CDB, Tesouro, LCI, etc.) cadastrados na carteira.
            </p>
          </div>

          {/* Toggle Setting */}
          <div className="flex items-center justify-between rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] p-4">
            <div className="space-y-0.5">
              <span className="text-sm font-semibold text-[var(--text-primary)]">
                Ativar alerta diário
              </span>
              <p className="text-xs text-[var(--text-muted)]">
                Dispara no celular ou navegador no horário programado
              </p>
            </div>
            <button
              type="button"
              onClick={() => handleToggle(!settings.enabled)}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                settings.enabled ? "bg-amber-500" : "bg-slate-300 dark:bg-slate-700"
              }`}
              role="switch"
              aria-checked={settings.enabled}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                  settings.enabled ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>

          {/* Time Picker */}
          <div className="flex items-center justify-between rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] p-4">
            <div className="flex items-center gap-2.5">
              <Clock className="h-4 w-4 text-[var(--text-muted)]" />
              <div>
                <span className="text-sm font-medium text-[var(--text-primary)]">
                  Horário do disparo
                </span>
                <p className="text-[11px] text-[var(--text-muted)]">
                  Horário local diário
                </p>
              </div>
            </div>
            <input
              type="time"
              value={settings.scheduledTime}
              onChange={handleTimeChange}
              disabled={!settings.enabled}
              className="rounded-lg border border-[var(--border-strong)] bg-[var(--bg-surface)] px-2.5 py-1 text-sm font-bold text-[var(--text-primary)] tabular-nums outline-none disabled:opacity-50"
            />
          </div>

          {/* Test Button & Status */}
          <div className="pt-2">
            <button
              type="button"
              onClick={handleTestNotification}
              disabled={testing}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-amber-400/40 bg-amber-400/10 px-4 py-2.5 text-xs font-bold text-amber-600 dark:text-amber-400 hover:bg-amber-400/20 transition-colors cursor-pointer"
            >
              <Sparkles className="h-4 w-4" />
              {testing ? "Enviando notificação..." : "Testar Notificação Agora"}
            </button>

            {testSuccess && (
              <p className="mt-2 text-center text-xs text-emerald-500 flex items-center justify-center gap-1.5 animate-in fade-in">
                <CheckCircle2 className="h-4 w-4" />
                Notificação enviada com sucesso! Verifique a barra do seu dispositivo.
              </p>
            )}

            {permission === "denied" && (
              <p className="mt-2 text-center text-xs text-rose-500">
                Atenção: As notificações estão bloqueadas no navegador. Clique no ícone de cadeado na barra de endereços para permitir.
              </p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-[var(--bg-surface-subtle)] px-4 py-2 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--border-subtle)] transition-colors cursor-pointer"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}

