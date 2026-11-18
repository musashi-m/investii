"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Lock, ShieldCheck, TrendingUp } from "lucide-react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/format";

export default function PinGate() {
  const router = useRouter();
  const [digits, setDigits] = useState<string[]>(["", "", "", ""]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputsRef = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    inputsRef.current[0]?.focus();
  }, []);

  async function submitPin(pinCode: string) {
    if (submitting || pinCode.length !== 4) return;
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: pinCode }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "PIN incorreto.");
        setDigits(["", "", "", ""]);
        setTimeout(() => inputsRef.current[0]?.focus(), 30);
        return;
      }
      router.refresh();
    } catch {
      setError("Não foi possível validar o PIN. Tente novamente.");
      setDigits(["", "", "", ""]);
      setTimeout(() => inputsRef.current[0]?.focus(), 30);
    } finally {
      setSubmitting(false);
    }
  }

  function handleChange(index: number, raw: string) {
    const clean = raw.replace(/\D/g, "");
    if (!clean) {
      setDigits((prev) => {
        const next = [...prev];
        next[index] = "";
        return next;
      });
      return;
    }

    // Support pasting all 4 digits at once
    if (clean.length > 1) {
      const sliced = clean.slice(0, 4).split("");
      const next = ["", "", "", ""];
      for (let i = 0; i < sliced.length; i++) next[i] = sliced[i];
      setDigits(next);
      setError(null);
      if (sliced.length === 4) {
        submitPin(next.join(""));
      } else {
        inputsRef.current[sliced.length]?.focus();
      }
      return;
    }

    const next = [...digits];
    next[index] = clean;
    setDigits(next);
    setError(null);

    if (index < 3) {
      inputsRef.current[index + 1]?.focus();
    } else if (next.every((d) => d !== "")) {
      submitPin(next.join(""));
    }
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      inputsRef.current[index - 1]?.focus();
    }
    if (e.key === "ArrowLeft" && index > 0) {
      inputsRef.current[index - 1]?.focus();
    }
    if (e.key === "ArrowRight" && index < 3) {
      inputsRef.current[index + 1]?.focus();
    }
  }

  function handleFormSubmit(e: React.FormEvent) {
    e.preventDefault();
    const code = digits.join("");
    if (code.length === 4) {
      submitPin(code);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[var(--bg-canvas)] px-4 py-10">
      <div className="w-full max-w-sm rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-7 shadow-[0_8px_30px_rgba(16,24,40,0.06)]">
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--bg-topbar)] border border-white/10 shadow-sm">
            <TrendingUp className="h-6 w-6 text-amber-400" strokeWidth={2.4} />
          </div>
          <h1 className="mt-4 text-lg font-bold tracking-tight text-[var(--text-primary)]">
            Investidor<span className="text-amber-500 font-extrabold">10x</span>
          </h1>
          <p className="mt-1 flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
            <Lock className="h-3.5 w-3.5" />
            Digite o PIN de 4 dígitos para acessar sua carteira
          </p>
        </div>

        {/* 4-Digit PIN Form */}
        <form onSubmit={handleFormSubmit} className="mt-7 space-y-5">
          <div className="flex items-center justify-center gap-3">
            {digits.map((digit, idx) => (
              <input
                key={idx}
                ref={(el) => {
                  inputsRef.current[idx] = el;
                }}
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                autoComplete="one-time-code"
                maxLength={4}
                value={digit}
                disabled={submitting}
                onChange={(e) => handleChange(idx, e.target.value)}
                onKeyDown={(e) => handleKeyDown(idx, e)}
                aria-label={`Dígito ${idx + 1} do PIN`}
                className={cn(
                  "h-14 w-14 rounded-xl border text-center text-2xl font-bold tabular-nums outline-none transition-all",
                  "bg-[var(--bg-surface-subtle)] text-[var(--text-primary)]",
                  error
                    ? "border-rose-500 focus:ring-2 focus:ring-rose-500/20"
                    : digit
                      ? "border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                      : "border-[var(--border-strong)] focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                )}
              />
            ))}
          </div>

          {error ? (
            <div
              role="alert"
              className="rounded-lg border border-rose-500/30 bg-[var(--loss-soft)] px-3 py-2 text-center text-xs font-medium text-[var(--loss)]"
            >
              {error}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={submitting || digits.some((d) => !d)}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--cta-bg)] py-3 text-sm font-semibold text-[var(--cta-text)] hover:bg-[var(--cta-hover)] disabled:opacity-50 transition-colors cursor-pointer"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Verificando...
              </>
            ) : (
              <>
                <ShieldCheck className="h-4 w-4" />
                Desbloquear Carteira
              </>
            )}
          </button>
        </form>

        <p className="mt-5 text-center text-[11px] text-[var(--text-muted)]">
          Sessão protegida por cookie assinado · Bloqueio automático após 5 erros
        </p>
      </div>
    </div>
  );
}

