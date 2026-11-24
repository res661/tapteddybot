export interface TgWebApp {
  ready: () => void;
  expand: () => void;
  initData: string;
  initDataUnsafe?: { start_param?: string };
  setHeaderColor?: (color: string) => void;
  setBackgroundColor?: (color: string) => void;
  disableVerticalSwipes?: () => void;
  HapticFeedback?: {
    impactOccurred: (style: "light" | "medium" | "heavy" | "rigid" | "soft") => void;
    notificationOccurred: (type: "error" | "success" | "warning") => void;
  };
  openInvoice?: (url: string, cb?: (status: string) => void) => void;
  contentSafeAreaInset?: { top: number; bottom: number; left: number; right: number };
  safeAreaInset?: { top: number; bottom: number; left: number; right: number };
  onEvent?: (event: string, cb: () => void) => void;
  openTelegramLink?: (url: string) => void;
  platform?: string;
}

declare global {
  interface Window {
    Telegram?: { WebApp?: TgWebApp };
  }
}

export function telegram(): TgWebApp | null {
  return window.Telegram?.WebApp ?? null;
}

export function inTelegram(): boolean {
  return Boolean(telegram()?.initData);
}

export function haptic(kind: "tap" | "ok" | "err" = "tap"): void {
  const feedback = telegram()?.HapticFeedback;
  if (!feedback) return;
  if (kind === "tap") feedback.impactOccurred("light");
  else if (kind === "ok") feedback.notificationOccurred("success");
  else feedback.notificationOccurred("error");
}

export function applySafeArea(): void {
  const tg = telegram();
  const top = Math.max(tg?.contentSafeAreaInset?.top ?? 0, tg?.safeAreaInset?.top ?? 0);
  const bottom = Math.max(tg?.contentSafeAreaInset?.bottom ?? 0, tg?.safeAreaInset?.bottom ?? 0);
  document.documentElement.style.setProperty("--tg-top", `${top}px`);
  document.documentElement.style.setProperty("--tg-bottom", `${bottom}px`);
}

export function bootTelegram(): void {
  const tg = telegram();
  if (!tg) return;
  tg.ready();
  tg.expand();
  tg.disableVerticalSwipes?.();
  tg.setHeaderColor?.("#2a2a2e");
  tg.setBackgroundColor?.("#2a2a2e");
  applySafeArea();
  tg.onEvent?.("contentSafeAreaChanged", applySafeArea);
  tg.onEvent?.("safeAreaChanged", applySafeArea);
}
