export interface TgWebApp {
  ready: () => void;
  expand: () => void;
  initData: string;
  initDataUnsafe?: { start_param?: string };
  platform?: string;
  version?: string;
  isVersionAtLeast?: (version: string) => boolean;
  requestFullscreen?: () => void;
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
}

declare global {
  interface Window {
    Telegram?: { WebApp?: TgWebApp };
  }
}

const DESKTOP = new Set(["tdesktop", "macos", "web", "weba", "webk"]);

export function telegram(): TgWebApp | null {
  return window.Telegram?.WebApp ?? null;
}

export function inTelegram(): boolean {
  return Boolean(telegram()?.initData);
}

export function haptic(kind: "tap" | "ok" | "err" | "crit" = "tap"): void {
  const feedback = telegram()?.HapticFeedback;
  if (!feedback) return;
  if (kind === "tap") feedback.impactOccurred("light");
  else if (kind === "crit") feedback.impactOccurred("medium");
  else if (kind === "ok") feedback.notificationOccurred("success");
  else feedback.notificationOccurred("error");
}

export function applySafeArea(): void {
  const tg = telegram();
  const safe = tg?.safeAreaInset;
  const content = tg?.contentSafeAreaInset;
  const root = document.documentElement.style;
  root.setProperty("--tg-safe-area-inset-top", `${safe?.top ?? 0}px`);
  root.setProperty("--tg-safe-area-inset-bottom", `${safe?.bottom ?? 0}px`);
  root.setProperty("--tg-safe-area-inset-left", `${safe?.left ?? 0}px`);
  root.setProperty("--tg-safe-area-inset-right", `${safe?.right ?? 0}px`);
  root.setProperty("--tg-content-safe-area-inset-top", `${content?.top ?? 0}px`);
  root.setProperty("--tg-content-safe-area-inset-bottom", `${content?.bottom ?? 0}px`);
  root.setProperty("--tg-content-safe-area-inset-left", `${content?.left ?? 0}px`);
  root.setProperty("--tg-content-safe-area-inset-right", `${content?.right ?? 0}px`);
}

export function bootTelegram(): void {
  const tg = telegram();
  if (!tg) return;
  tg.ready();
  tg.expand();
  const desktop = DESKTOP.has(tg.platform ?? "");
  try {
    if (!desktop && tg.isVersionAtLeast?.("8.0")) tg.requestFullscreen?.();
  } catch {
    /* старый клиент */
  }
  try {
    if (tg.isVersionAtLeast?.("7.7")) tg.disableVerticalSwipes?.();
  } catch {
    /* без свайпов всё равно играем */
  }
  tg.setHeaderColor?.("#15161a");
  tg.setBackgroundColor?.("#15161a");
  applySafeArea();
  tg.onEvent?.("fullscreenChanged", applySafeArea);
  tg.onEvent?.("viewportChanged", applySafeArea);
  tg.onEvent?.("safeAreaChanged", applySafeArea);
  tg.onEvent?.("contentSafeAreaChanged", applySafeArea);
}
