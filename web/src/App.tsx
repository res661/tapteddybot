import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { fingerprint, request, setToken } from "./api.js";
import { IconShop, IconTap, IconTop, IconUp } from "./icons.js";
import { BoostsSheet, BoxesScreen, SkinsScreen, TapScreen, TasksScreen, TopBar, TopScreen } from "./screens.js";
import { bootTelegram, haptic, inTelegram, telegram } from "./telegram.js";
import type { GameState, LiteState, Tab } from "./types.js";

const TABS: { id: Tab; label: string; icon: ReactNode }[] = [
  { id: "tap", label: "ТАП", icon: <IconTap /> },
  { id: "skins", label: "СКИНЫ", icon: <IconShop /> },
  { id: "boxes", label: "БОКСЫ", icon: <IconUp /> },
  { id: "tasks", label: "ДЕЛА", icon: <IconTop /> },
  { id: "top", label: "ТОП", icon: <IconTop /> },
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
    box: { ...prev.box, ...lite.box },
  };
}

interface Drop {
  id: string;
  name: string;
  rarity: string;
  duplicate: boolean;
  shards: number;
  filter: string;
  accessory: string;
  backdrop: string;
}

export function App() {
  const [state, setState] = useState<GameState | null>(null);
  const [dev, setDev] = useState(false);
  const [tab, setTab] = useState<Tab>(() => {
    const asked = new URLSearchParams(location.search).get("tab");
    if (asked === "skins" || asked === "boxes" || asked === "tasks" || asked === "top" || asked === "tap") return asked;
    return "tap";
  });
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [squish, setSquish] = useState(false);
  const [floats, setFloats] = useState<{ id: number; n: number; x: number }[]>([]);
  const [drop, setDrop] = useState<Drop | null>(null);
  const [levelUp, setLevelUp] = useState<number | null>(null);
  const [boosts, setBoosts] = useState(false);
  const [tutor, setTutor] = useState(() => localStorage.getItem("tapteddy_tutor") !== "1" && new URLSearchParams(location.search).get("tutor") !== "0");
  const [unlock, setUnlock] = useState<string | null>(null);
  const pending = useRef(0);
  const flushing = useRef(false);
  const stateRef = useRef<GameState | null>(null);
  stateRef.current = state;

  const ping = useCallback((text: string) => {
    setToast(text);
    window.setTimeout(() => setToast((current) => (current === text ? null : current)), 1800);
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
        const body = tg?.initData ? { initData: tg.initData, fp } : { devId, name: "Мишка", fp, startParam: params.get("startapp") };
        const payload = await request<{ token: string; dev: boolean; state: GameState }>("/api/session", body);
        if (stop) return;
        setToken(payload.token);
        setDev(payload.dev);
        setState(payload.state);
      } catch (err) {
        if (!stop) setError(err instanceof Error ? err.message : "Не открылось");
      }
    })();
    return () => { stop = true; };
  }, []);

  useEffect(() => {
    if (!state) return;
    const id = window.setInterval(() => { void flush(); }, 700);
    return () => window.clearInterval(id);
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
      if (lite.gained.crits > 0) haptic("crit");
      if (lite.gained.levelUp) {
        haptic("ok");
        setLevelUp(lite.me.level);
        void refresh();
      }
      if (lite.gained.boxes > 0) {
        haptic("ok");
        ping("Плюшевый бокс заряжен");
      }
      if (lite.me.tapCount >= 20 && localStorage.getItem("tapteddy_unlock_boxes") !== "1") setUnlock("БОКСЫ");
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
    haptic("tap");
    if (tutor) {
      localStorage.setItem("tapteddy_tutor", "1");
      setTutor(false);
    }
    setSquish(true);
    window.setTimeout(() => setSquish(false), 200);
    const id = Date.now() + Math.random();
    setFloats((list) => [...list.slice(-10), { id, n: current.me.perTap, x: 40 + Math.random() * 20 }]);
    window.setTimeout(() => setFloats((list) => list.filter((item) => item.id !== id)), 860);
    if (current.timers.autotapUntil > current.now || current.me.energy <= 0) return;
    pending.current += 1;
    setState((prev) => {
      if (!prev || prev.me.energy <= 0) return prev;
      const combo = prev.me.combo + 1;
      return { ...prev, me: { ...prev.me, energy: prev.me.energy - 1, coins: prev.me.coins + prev.me.perTap, combo } };
    });
  }

  async function onAct(body: Record<string, unknown>) {
    try {
      const payload = await request<{ state: GameState; message: string; drop?: Drop }>("/api/action", body);
      setState(payload.state);
      if (payload.drop) {
        haptic("ok");
        setDrop(payload.drop);
      } else haptic("ok");
      ping(payload.message);
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
            void refresh().then(() => ping("Оплата прошла"));
          }
        });
        return;
      }
      if (dev) {
        await onAct({ type: "dev_buy", sku, ...extra });
        return;
      }
      ping("Звёзды открываются в Telegram");
    } catch (err) {
      haptic("err");
      ping(err instanceof Error ? err.message : "Платёж не создался");
    }
  }

  if (error) {
    return <div className="gate"><img src="/bear.png" alt="" /><h1>TapTeddy</h1><p>{error}</p></div>;
  }
  if (!state) {
    return <div className="loading"><img src="/bear.png" alt="" /><p>TapTeddy</p></div>;
  }
  const equipped = state.skins.find((item) => item.equipped);

  const locked = (id: Tab) => (id === "boxes" && state.me.tapCount < 20) || (id === "tasks" && state.me.level < 2) || (id === "top" && state.me.level < 3);
  const badge = (id: Tab) => (id === "boxes" ? state.box.charges : id === "tasks" ? state.tasks.filter((task) => task.done && !task.claimed).length : 0);
  return (
    <div className="app">
      {toast ? <div className="toast">{toast}</div> : null}
      {tab === "tap" ? <TopBar state={state} onClan={() => (locked("top") ? ping("Топ откроется на 3 уровне") : setTab("top"))} onWallet={() => setBoosts(true)} /> : null}
      <div className="screen" key={tab}>
        {tab === "tap" ? <TapScreen state={state} squish={squish} floats={floats} onTap={onTap} onAct={(body) => void onAct(body)} onBuy={(sku) => void onBuy(sku)} onSkins={() => setTab("skins")} /> : null}
        {tab === "skins" ? <SkinsScreen state={state} onAct={(body) => void onAct(body)} onBuy={(sku) => void onBuy(sku)} /> : null}
        {tab === "boxes" ? <BoxesScreen state={state} onAct={(body) => void onAct(body)} /> : null}
        {tab === "tasks" ? <TasksScreen state={state} onAct={(body) => void onAct(body)} /> : null}
        {tab === "top" ? <TopScreen state={state} onAct={(body) => void onAct(body)} /> : null}
      </div>
      <nav className="nav">
        {TABS.map((item) => {
          const isLocked = locked(item.id);
          const count = badge(item.id);
          return (
            <button key={item.id} className={tab === item.id ? "on" : ""} onClick={() => {
              if (isLocked) {
                ping(item.id === "boxes" ? "Боксы откроются после 20 тапов" : item.id === "tasks" ? "Дела откроются на 2 уровне" : "Топ откроется на 3 уровне");
                return;
              }
              haptic("tap");
              setTab(item.id);
            }}>
              {item.icon}
              {item.label}
              {isLocked ? <span className="lock">🔒</span> : null}
              {!isLocked && count > 0 ? <span className="badge">{count}</span> : null}
            </button>
          );
        })}
      </nav>
      {boosts ? <BoostsSheet state={state} onAct={(body) => void onAct(body)} onBuy={(sku) => void onBuy(sku)} onClose={() => setBoosts(false)} /> : null}
      {tutor && tab === "tap" ? (
        <div className="tutor">
          <div className="speech">
            <img src="/bear.png" alt="" />
            Тапай мишку. Свайпни карточку, чтобы сменить окрас.
            <span className="hand">👇</span>
          </div>
        </div>
      ) : null}
      {unlock ? (
        <div className="reveal">
          <div className="unlock-card">
            <p>ДОСТУПЕН НОВЫЙ РАЗДЕЛ ИГРЫ!</p>
            <button className="q" onClick={() => { localStorage.setItem("tapteddy_unlock_boxes", "1"); setUnlock(null); setTab("boxes"); }}>?</button>
            <div>{unlock}</div>
          </div>
        </div>
      ) : null}
      {drop && equipped ? (
        <div className="reveal" onClick={() => setDrop(null)}>
          <div className={`unlock-card g-${drop.rarity}`} onClick={(event) => event.stopPropagation()}>
            <p className="tiny">{drop.duplicate ? "ПОВТОР" : "НОВЫЙ ОКРАС"}</p>
            <h2>{drop.name}</h2>
            <p>{drop.duplicate ? `+${drop.shards} осколков` : drop.rarity}</p>
            <button className="btn btn-y" onClick={() => setDrop(null)}>КЛАСС</button>
          </div>
        </div>
      ) : null}
      {levelUp != null ? (
        <div className="reveal" onClick={() => setLevelUp(null)}>
          <div className="unlock-card" onClick={(event) => event.stopPropagation()}>
            <p>УРОВЕНЬ</p>
            <div className="balance">{levelUp}</div>
            <button className="btn btn-y" onClick={() => setLevelUp(null)}>ДАЛЬШЕ</button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
