"use client";

import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export default function PwaRegister() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showBanner, setShowBanner] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // 1. Check if running in standalone mode (already installed)
    const isRunningStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    setIsStandalone(isRunningStandalone);

    // 2. Register Service Worker
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker
        .register("/sw.js")
        .then((reg) => {
          console.log("[PWA] Service Worker registered with scope:", reg.scope);
        })
        .catch((err) => {
          console.warn("[PWA] Service Worker registration failed:", err);
        });
    }

    // 3. Listen for install prompt on Android / Chrome
    function handleBeforeInstallPrompt(e: Event) {
      e.preventDefault();
      const promptEvent = e as BeforeInstallPromptEvent;
      setInstallPrompt(promptEvent);

      // Check if user dismissed recently
      const dismissedUntil = localStorage.getItem("investidor-pwa-dismissed");
      if (dismissedUntil && Date.now() < Number(dismissedUntil)) {
        return;
      }

      setShowBanner(true);
    }

    function handleAppInstalled() {
      setShowBanner(false);
      setInstallPrompt(null);
      console.log("[PWA] App successfully installed");
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  async function handleInstallClick() {
    if (!installPrompt) return;
    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (choice.outcome === "accepted") {
      setShowBanner(false);
    }
    setInstallPrompt(null);
  }

  function handleDismiss() {
    setShowBanner(false);
    // Dismiss for 7 days
    localStorage.setItem(
      "investidor-pwa-dismissed",
      String(Date.now() + 7 * 24 * 60 * 60 * 1000)
    );
  }

  if (!showBanner || isStandalone) {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-md sm:left-auto sm:right-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="flex items-center gap-3 rounded-2xl border border-amber-400/30 bg-[#141821]/95 p-3.5 text-white shadow-2xl backdrop-blur-md">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-400/15 border border-amber-400/30">
          <Download className="h-5 w-5 text-amber-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-white truncate">
            Instalar Investidor10x
          </p>
          <p className="text-[11px] text-slate-300 leading-tight">
            Adicione à tela inicial para abrir como app no Android.
          </p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={handleInstallClick}
            className="rounded-lg bg-amber-400 px-3 py-1.5 text-xs font-bold text-slate-950 hover:bg-amber-300 transition-colors cursor-pointer shadow-sm"
          >
            Instalar
          </button>
          <button
            type="button"
            onClick={handleDismiss}
            aria-label="Fechar"
            className="rounded-lg p-1 text-slate-400 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

