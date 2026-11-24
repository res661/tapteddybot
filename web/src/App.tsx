import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { fingerprint, request, setToken } from "./api.js";
import { IconClan, IconFriends, IconShop, IconTap, IconTop, IconUp } from "./icons.js";
import { ClanScreen, FriendsScreen, Sheet, ShopScreen, TapScreen, TopScreen, UpgradesScreen } from "./screens.js";
import { bootTelegram, haptic, inTelegram, telegram } from "./telegram.js";
import type { GameState, LiteState, Tab } from "./types.js";

const TABS: { id: Tab; label: string; icon: ReactNode }[] = [
  { id: "tap", label: "Тап", icon: <IconTap /> },
  { id: "upgrades", label: "Сила", icon: <IconUp /> },
  { id: "shop", label: "Лавка", icon: <IconShop /> },
  { id: "clan", label: "Клан", icon: <IconClan /> },
  { id: "top", label: "Топ", icon: <IconTop /> },
  { id: "friends", label: "Друзья", icon: <IconFriends /> },
];

function applyLite(prev: GameState, lite: LiteState, extra: number): GameState {
  const perTap = lite.me.perTap || prev.me.perTap;
  return {
    ...prev,
    now: lite.now,
    me: {
      ...prev.me,
      ...lite.me,
      energy: Math.max(0, lite.me.energy - extra),
      coins: lite.me.coins + extra * perTap,
    },
    passive: lite.passive,
    timers: lite.timers,
    clanBuff: lite.clanBuff,
    refill: lite.refill,
    streak: { ...prev.streak, ...lite.streak },
  };
}

export function App() {
  const [state, setState] = useState<GameState | null>(null);
  const [dev, setDev] = useState(false);
  const [tab, setTab] = useState<Tab>(() => {
    const asked = new URLSearchParams(location.search).get("tab");
    if (asked === "upgrades" || asked === "shop" || asked === "clan" || asked === "top" || asked === "friends" || asked === "tap") return asked;
    return "tap";
  });
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sheet, setSheet] = useState<null | "streak" | "code" | "combo" | "offline" | "newbie">(null);
  const [squish, setSquish] = useState(false);
  const [floats, setFloats] = useState<{ id: number; n: number; x: number }[]>([]);
  const [code, setCode] = useState("");
  const pending = useRef(0);
  const flushing = useRef(false);
  const stateRef = useRef<GameState | null>(null);
  stateRef.current = state;

  const ping = useCallback((text: string) => {
    setToast(text);
    window.setTimeout(() => setToast((current) => (current === text ? null : current)), 2200);
  }, []);

  const refresh = useCallback(async () => {
    const payload = await request<{ state: GameState; dev: boolean }>("/api/state");
    if (pending.current === 0) setState(payload.state);
    setDev(payload.dev);
    return payload.state;
  }, []);

  useEffect(() => {
    bootTelegram();
    const params = new URLSearchParams(location.search);
    const devId = Number(params.get("dev") || localStorage.getItem("tapteddy_dev_id") || 10001);
    if (params.get("dev")) localStorage.setItem("tapteddy_dev_id", String(devId));
    let stop = false;
    (async () => {
      try {
        const fp = await fingerprint();
        const tg = telegram();
        const body = tg?.initData
          ? { initData: tg.initData, fp }
          : { devId, name: "Мишка", fp, startParam: params.get("startapp") };
        const payload = await request<{ token: string; dev: boolean; state: GameState }>("/api/session", body);
        if (stop) return;
        setToken(payload.token);
        setDev(payload.dev);
        setState(payload.state);
        if (payload.state.passive.bank > 0) setSheet("offline");
        else if (payload.state.newbie && payload.state.me.level >= 2 && !sessionStorage.getItem("tapteddy_newbie")) {
          sessionStorage.setItem("tapteddy_newbie", "1");
          setSheet("newbie");
        }
      } catch (err) {
        if (!stop) setError(err instanceof Error ? err.message : "Не открылось");
      }
    })();
    return () => { stop = true; };
  }, []);

  useEffect(() => {
    if (!state) return;
    const id = window.setInterval(() => { void flush(); }, 700);
    const slow = window.setInterval(() => {
      if (pending.current === 0 && !flushing.current) void refresh().catch(() => undefined);
    }, 12000);
    return () => {
      window.clearInterval(id);
      window.clearInterval(slow);
    };
  }, [Boolean(state)]);

  async function flush() {
    if (flushing.current || !stateRef.current) return;
    const taps = pending.current;
    if (taps === 0 && document.visibilityState !== "visible") return;
    flushing.current = true;
    pending.current = 0;
    try {
      const lite = await request<LiteState>("/api/sync", {
        taps,
        batchId: taps ? `${Date.now()}-${Math.random().toString(16).slice(2)}` : "",
        active: document.visibilityState === "visible",
      });
      const extra = pending.current;
      setState((prev) => (prev ? applyLite(prev, lite, extra) : prev));
      if (lite.me.level !== stateRef.current?.me.level) void refresh().catch(() => undefined);
    } catch (err) {
      pending.current += taps;
      const message = err instanceof Error ? err.message : "Сеть";
      if (message !== "Слишком часто") ping(message);
    } finally {
      flushing.current = false;
    }
  }

  function onTap() {
    const current = stateRef.current;
    if (!current) return;
    const autotap = current.timers.autotapUntil > current.now;
    haptic("tap");
    setSquish(true);
    window.setTimeout(() => setSquish(false), 180);
    const id = Date.now() + Math.random();
    setFloats((list) => [...list.slice(-12), { id, n: current.me.perTap, x: 42 + Math.random() * 16 }]);
    window.setTimeout(() => setFloats((list) => list.filter((item) => item.id !== id)), 900);
    if (autotap || current.me.energy <= 0) return;
    pending.current += 1;
    setState((prev) => {
      if (!prev || prev.me.energy <= 0) return prev;
      return { ...prev, me: { ...prev.me, energy: prev.me.energy - 1, coins: prev.me.coins + prev.me.perTap } };
    });
  }

  async function onAct(body: Record<string, unknown>) {
    try {
      const payload = await request<{ state: GameState; message: string }>("/api/action", body);
      setState(payload.state);
      haptic("ok");
      ping(payload.message);
      if (body.type === "claim_passive") setSheet(null);
    } catch (err) {
      haptic("err");
      ping(err instanceof Error ? err.message : "Не вышло");
    }
  }

  async function onBuy(sku: string, extra?: { levels?: number }) {
    try {
      const tg = telegram();
      if (inTelegram() && tg?.openInvoice) {
        const invoice = await request<{ url: string }>("/api/invoice", { sku, ...extra });
        tg.openInvoice(invoice.url, (status) => {
          if (status === "paid") {
            haptic("ok");
            void refresh().then(() => ping("Оплата прошла")).catch(() => undefined);
          } else if (status === "cancelled") ping("Оплата отменена");
          else void refresh().catch(() => undefined);
        });
        return;
      }
      if (dev) {
        await onAct({ type: "dev_buy", sku, ...extra });
        return;
      }
      ping("Оплата звёздами открывается в Telegram");
    } catch (err) {
      haptic("err");
      ping(err instanceof Error ? err.message : "Платёж не создался");
    }
  }

  if (error) {
    return (
      <div className="gate">
        <img src="/bear.png" alt="" />
        <h1>TapTeddy</h1>
        <p>{error}</p>
      </div>
    );
  }
  if (!state) {
    return (
      <div className="loading">
        <img src="/bear.png" alt="" />
        <p className="eyebrow">TapTeddy</p>
      </div>
    );
  }

  return (
    <div className="app">
      {toast ? <div className="toast">{toast}</div> : null}
      {tab === "tap" ? <TapScreen state={state} squish={squish} floats={floats} onTap={onTap} onOpen={setSheet} onBuy={(sku) => void onBuy(sku)} onShop={() => setTab("shop")} /> : null}
      {tab === "upgrades" ? <UpgradesScreen state={state} onAct={(body) => void onAct(body)} /> : null}
      {tab === "shop" ? <ShopScreen state={state} onAct={(body) => void onAct(body)} onBuy={(sku, extra) => void onBuy(sku, extra)} /> : null}
      {tab === "clan" ? <ClanScreen state={state} onAct={(body) => void onAct(body)} onBuy={(sku) => void onBuy(sku)} /> : null}
      {tab === "top" ? <TopScreen state={state} /> : null}
      {tab === "friends" ? <FriendsScreen state={state} /> : null}

      <nav className="tabbar" aria-label="Разделы">
        {TABS.map((item) => (
          <button key={item.id} className={tab === item.id ? "tab on" : "tab"} aria-current={tab === item.id ? "page" : undefined} onClick={() => setTab(item.id)}>
            {item.icon}
            {item.label}
          </button>
        ))}
      </nav>

      {sheet === "offline" ? (
        <Sheet title="Пока тебя не было" text={state.passive.bank > 0 ? `${state.passive.bank.toLocaleString("ru-RU")} мёда в копилке. Дальше ${state.passive.capHours} ч не копится, пока не заберёшь.` : "Копилка пустая. Пассив капает, пока ты не в игре."} onClose={() => setSheet(null)}>
          <button className="cta" disabled={state.passive.bank <= 0} onClick={() => void onAct({ type: "claim_passive" })}>Забрать</button>
        </Sheet>
      ) : null}
      {sheet === "streak" ? (
        <Sheet title="Серия" text={state.streak.claimedToday ? "Сегодня уже забрал." : "Раз в сутки по UTC. Пропуск сбрасывает на день 1."} onClose={() => setSheet(null)}>
          {state.streak.rewards.map((reward) => (
            <div className="list-row" key={reward.day}>
              <span>День {reward.day}</span>
              <b>{reward.coins.toLocaleString("ru-RU")}{reward.extra ? ` · ${reward.extra}` : ""}</b>
            </div>
          ))}
          <p>Заморозок: {state.streak.freezes}</p>
          {state.streak.canSave ? <button className="ghost" onClick={() => state.streak.freezes > 0 ? void onAct({ type: "save_streak" }) : void onBuy("freeze")}>{state.streak.freezes > 0 ? "Сохранить серию" : "Сохранить серию · 25⭐"}</button> : null}
          <button className="cta" disabled={state.streak.claimedToday} onClick={() => void onAct({ type: "streak" })}>Забрать</button>
        </Sheet>
      ) : null}
      {sheet === "code" ? (
        <Sheet title="Код дня" text={state.daily.codeUnlocked ? `Награда ${state.daily.codeReward.toLocaleString("ru-RU")} мёда. Один раз до полуночи UTC.` : "Откроется на 5 уровне."} onClose={() => setSheet(null)}>
          {state.channelUrl ? <p><a href={state.channelUrl}>Канал с кодом</a></p> : <p>Код публикует владелец бота командой /dailycode.</p>}
          <input className="field" maxLength={8} value={code} placeholder="4 символа" onChange={(event) => setCode(event.target.value.toUpperCase())} />
          <button className="cta" disabled={!state.daily.codeUnlocked || state.daily.codeDone} onClick={() => void onAct({ type: "code", code })}>Ввести</button>
        </Sheet>
      ) : null}
      {sheet === "combo" ? (
        <Sheet title="Комбо дня" text={`Подними каждую карту хотя бы на уровень сегодня. Награда ${state.daily.comboReward.toLocaleString("ru-RU")} и x2 на 15 минут.`} onClose={() => setSheet(null)}>
          {state.daily.combo.map((card) => (
            <div className="list-row" key={card.id}><span>{card.name}</span><b>{card.done ? "есть" : "ещё нет"}</b></div>
          ))}
          <button className="cta" disabled={state.daily.comboDone} onClick={() => void onAct({ type: "combo" })}>Забрать</button>
        </Sheet>
      ) : null}
      {sheet === "newbie" && state.newbie ? (
        <Sheet title="Набор новичка" text="Полный бак, x2 на час, автопилот на час, окрас «Первая берлога» и 20 000 мёда. Один раз." onClose={() => setSheet(null)}>
          <button className="cta" onClick={() => void onBuy("newbie")}>Забрать набор · 75⭐</button>
        </Sheet>
      ) : null}
    </div>
  );
}
