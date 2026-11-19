/**
 * Daily Fixed Income Yield Push Notification Manager
 * Schedules and dispatches notifications at 08:00 AM every day
 * reporting the estimated daily earnings of the user's fixed income portfolio.
 */

export interface DailyNotificationSettings {
  enabled: boolean;
  scheduledTime: string; // "08:00"
  lastTriggeredDate: string | null; // "YYYY-MM-DD"
}

export const STORAGE_KEYS = {
  SETTINGS: "investidor-daily-push-settings",
  LAST_DATE: "investidor-daily-push-last-date",
};

export function getDailyNotificationSettings(): DailyNotificationSettings {
  if (typeof window === "undefined") {
    return { enabled: false, scheduledTime: "08:00", lastTriggeredDate: null };
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch {
    // fallback
  }
  return { enabled: false, scheduledTime: "08:00", lastTriggeredDate: null };
}

export function saveDailyNotificationSettings(settings: DailyNotificationSettings): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
  } catch {
    // ignore
  }
}

/**
 * Calculates milliseconds remaining until the specified time (e.g. "08:00") today or tomorrow.
 */
export function getMsUntilTime(timeStr: string = "08:00"): number {
  const [targetHour, targetMin] = timeStr.split(":").map((v) => parseInt(v, 10) || 0);
  const now = new Date();
  const nextTarget = new Date();
  nextTarget.setHours(targetHour, targetMin, 0, 0);

  // If target time has already passed today, schedule for tomorrow
  if (now.getTime() >= nextTarget.getTime()) {
    nextTarget.setDate(nextTarget.getDate() + 1);
  }

  return nextTarget.getTime() - now.getTime();
}

/**
 * Dispatches a push/system notification via Service Worker (if available) or Notification API.
 */
export async function showFixedIncomeNotification(
  dailyYieldBRL: number,
  options?: { isTest?: boolean; customMessage?: string }
): Promise<boolean> {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return false;
  }

  if (Notification.permission !== "granted") {
    const perm = await Notification.requestPermission();
    if (perm !== "granted") return false;
  }

  const formattedYield = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(dailyYieldBRL);

  const title = options?.isTest
    ? "🔔 Teste de Notificação — Investidor10x"
    : "💰 Rendimento de Hoje — Investidor10x";

  const body = options?.customMessage
    ? options.customMessage
    : dailyYieldBRL > 0
    ? `Sua Renda Fixa rendeu aproximadamente +${formattedYield} nas últimas 24h úteis. Toque para ver sua carteira!`
    : "Seus investimentos de Renda Fixa continuam rendendo com segurança. Toque para conferir!";

  const notificationOptions: NotificationOptions = {
    body,
    icon: "/icons/icon-192x192.png",
    badge: "/icons/favicon-32x32.png",
    tag: "fixed-income-daily-yield",
    data: { url: "/" },
  };

  // Try Service Worker registration first (standard for Android PWA)
  if ("serviceWorker" in navigator) {
    try {
      const reg = await navigator.serviceWorker.ready;
      if (reg && reg.showNotification) {
        await reg.showNotification(title, notificationOptions);
        return true;
      }
    } catch (err) {
      console.warn("[PWA] Service Worker showNotification fallback:", err);
    }
  }

  // Fallback to standard window Notification
  try {
    new Notification(title, notificationOptions);
    return true;
  } catch (err) {
    console.error("[PWA] Notification display error:", err);
    return false;
  }
}

let notificationTimer: NodeJS.Timeout | null = null;

/**
 * Initializes and schedules the 08:00 AM daily check.
 */
export function initDailyYieldScheduler(getEstimatedDailyYield: () => number): void {
  if (typeof window === "undefined" || !("Notification" in window)) return;

  const settings = getDailyNotificationSettings();
  if (!settings.enabled || Notification.permission !== "granted") return;

  if (notificationTimer) {
    clearTimeout(notificationTimer);
    notificationTimer = null;
  }

  const todayStr = new Date().toISOString().slice(0, 10);
  const now = new Date();
  const [scheduledH, scheduledM] = settings.scheduledTime.split(":").map(Number);

  // If today it's already past 08:00 and hasn't triggered today yet, trigger once
  const passedScheduledToday =
    now.getHours() > scheduledH ||
    (now.getHours() === scheduledH && now.getMinutes() >= scheduledM);

  if (passedScheduledToday && settings.lastTriggeredDate !== todayStr) {
    const yieldAmount = getEstimatedDailyYield();
    showFixedIncomeNotification(yieldAmount);
    settings.lastTriggeredDate = todayStr;
    saveDailyNotificationSettings(settings);
  }

  // Schedule next 08:00
  const msUntilNext = getMsUntilTime(settings.scheduledTime);
  notificationTimer = setTimeout(() => {
    const updatedSettings = getDailyNotificationSettings();
    if (updatedSettings.enabled) {
      const yieldAmount = getEstimatedDailyYield();
      showFixedIncomeNotification(yieldAmount);
      updatedSettings.lastTriggeredDate = new Date().toISOString().slice(0, 10);
      saveDailyNotificationSettings(updatedSettings);
    }
    // Re-schedule for next day
    initDailyYieldScheduler(getEstimatedDailyYield);
  }, msUntilNext);
}

