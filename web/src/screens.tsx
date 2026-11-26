import { useEffect, useRef, useState } from "react";
import { BearFace } from "./bear.js";
import { daysLeft, fmt } from "./format.js";
import type { GameState } from "./types.js";

const RARITY: Record<string, string> = {
  common: "ОБЫЧНЫЙ",
  rare: "РЕДКИЙ",
  epic: "ЭПИК",
  legendary: "ЛЕГЕНДА",
  mythic: "МИФ",
};

export function TopBar({ state, onClan, onWallet }: { state: GameState; onClan: () => void; onWallet: () => void }) {
  const skin = state.skins.find((item) => item.equipped) ?? state.skins[0];
  return (
    <header className="topbar">
      <div className="pills">
        <button className="pill" onClick={onWallet} aria-label="Кошелёк">
          <span className="ava">{skin ? <img src="/bear.png" alt="" style={{ filter: skin.filter || undefined }} /> : null}</span>
        </button>
        <button className="pill" onClick={onClan}>{state.clan ? state.clan.name.slice(0, 10) : "СТАЯ"}</button>
      </div>
      <div className="counts">
        <div className="count"><span className="ic honey" />{fmt(state.me.coins)}</div>
        <div className="count"><span className="ic box" />{state.box.charges}</div>
      </div>
    </header>
  );
}

export function TapScreen({
  state, squish, floats, onTap, onAct, onBuy, onSkins,
}: {
  state: GameState;
  squish: boolean;
  floats: { id: number; n: number; x: number }[];
  onTap: () => void;
  onAct: (body: Record<string, unknown>) => void;
  onBuy: (sku: string) => void;
  onSkins: () => void;
}) {
  const owned = state.skins.filter((item) => item.owned);
  const start = Math.max(0, owned.findIndex((item) => item.equipped));
  const [index, setIndex] = useState(start);
  const startX = useRef(0);
  const slots = owned.length + 1;
  const safe = Math.min(index, slots - 1);
  const skin = safe < owned.length ? owned[safe] : null;
  const leftTaps = Math.max(0, state.box.goal - state.box.progress);
  const claimReady = !state.streak.claimedToday || state.pass.level > state.pass.claimedFree;

  return (
    <section>
      <div className="balance"><span className="ic honey" />{fmt(state.me.coins)}</div>
      <div className="stage">
        <button className="float-tile left" onClick={() => onBuy("pass")}>
          {claimReady ? <i className="dot" /> : null}
          <b>{daysLeft(state.pass.endsAt, state.now)} ДН</b>
          пасс
        </button>
        <button className="float-tile right" onClick={onSkins}>
          {state.box.charges > 0 ? <i className="dot" /> : null}
          <b>{state.box.charges > 0 ? "ГОТОВ" : leftTaps}</b>
          бокс
        </button>
        <div className="portrait-wrap">
          {skin ? <div className={`rarity-tag c-${skin.rarity}`}>{RARITY[skin.rarity]}</div> : null}
          {skin ? (
            <button
              className={`portrait b-${skin.rarity}`}
              data-testid="bear"
              aria-label="Тапай мишку"
              onPointerDown={(event) => { startX.current = event.clientX; }}
              onPointerUp={(event) => {
                const dx = event.clientX - startX.current;
                if (dx > 40) setIndex((value) => Math.max(0, value - 1));
                else if (dx < -40) setIndex((value) => Math.min(slots - 1, value + 1));
                else onTap();
              }}
            >
              <span className="lvl">LVL {state.me.level}</span>
              {floats.map((float) => <span key={float.id} className="float-num" style={{ left: `${float.x}%` }}>+{float.n}</span>)}
              <BearFace filter={skin.filter} accessory={skin.accessory} backdrop={skin.backdrop} squish={squish} />
              <span className="bubble">ТАПАЙ!</span>
            </button>
          ) : (
            <button className="portrait empty" onClick={onSkins}>
              <img src="/bear.png" alt="" style={{ width: 110, filter: "grayscale(1) brightness(.3)" }} />
              <div>ПУСТОЙ СЛОТ</div>
            </button>
          )}
        </div>
        <div className="dots">
          {owned.map((item, dot) => <i key={item.id} className={dot === safe ? "on" : ""} />)}
          <button aria-label="Пустой слот" onClick={onSkins}>+</button>
        </div>
      </div>
      <div className="track">
        {Array.from({ length: 9 }, (_, node) => <span key={node} className={node < Math.min(9, state.me.level) ? "node on" : "node"} />)}
      </div>
      <button className="btn btn-y" disabled={!claimReady} onClick={() => onAct(state.streak.claimedToday ? { type: "claim_pass" } : { type: "streak" })}>ЗАБЕРИ НАГРАДУ</button>
      <div className="prog">{Math.min(9, state.me.level)}/9</div>
    </section>
  );
}

export function SkinsScreen({ state, onAct, onBuy }: { state: GameState; onAct: (body: Record<string, unknown>) => void; onBuy: (sku: string) => void }) {
  const tabs = ["common", "rare", "epic", "legendary", "mythic"] as const;
  const [tab, setTab] = useState<(typeof tabs)[number]>("common");
  const list = state.skins.filter((item) => item.rarity === tab);
  const [id, setId] = useState(list[0]?.id ?? "classic");
  const skin = state.skins.find((item) => item.id === id && item.rarity === tab) ?? list[0];
  return (
    <section>
      <h1 className="h1">СКИНЫ</h1>
      <div className="tabs-row">
        {tabs.map((item) => (
          <button key={item} className={`chip c-${item} ${tab === item ? "on" : ""}`} onClick={() => { setTab(item); const first = state.skins.find((entry) => entry.rarity === item); if (first) setId(first.id); }}>{RARITY[item]}</button>
        ))}
      </div>
      {skin ? (
        <article className={`hero-card g-${skin.rarity}`}>
          <div className={`rarity-tag c-${skin.rarity}`}>{RARITY[skin.rarity]}</div>
          <BearFace filter={skin.filter} accessory={skin.accessory} backdrop={skin.backdrop} size={150} />
          <div className="row"><b>{skin.name}</b><span>LVL {skin.owned ? skin.level : 0}</span></div>
          <p>{skin.bonus}</p>
          {skin.owned && skin.upgradeShards != null ? <p className="tiny">Осколки {skin.shards}/{skin.upgradeShards}</p> : null}
          <div className="buy-row">
            {skin.owned && !skin.equipped ? <button className="btn btn-y" onClick={() => onAct({ type: "equip", skinId: skin.id })}>НАДЕТЬ</button> : null}
            {skin.equipped ? <button className="btn btn-y" disabled>НАДЕТ</button> : null}
            {skin.owned && skin.upgradeCoins != null ? <button className="btn btn-g" onClick={() => onAct({ type: "upgrade_skin", skinId: skin.id })}>УЛУЧШИТЬ 🪙{fmt(skin.upgradeCoins)}</button> : null}
            {!skin.owned && skin.currency === "coins" ? <button className="btn btn-g" disabled={skin.locked} onClick={() => onAct({ type: "buy_skin", skinId: skin.id })}>КУПИТЬ 🪙{fmt(skin.price)}</button> : null}
            {!skin.owned && skin.currency === "stars" ? <button className="btn btn-b" disabled={skin.locked} onClick={() => onBuy(`skin_${skin.id}`)}>КУПИТЬ ⭐{skin.price}</button> : null}
          </div>
        </article>
      ) : null}
    </section>
  );
}

export function BoxesScreen({ state, onAct }: { state: GameState; onAct: (body: Record<string, unknown>) => void }) {
  const opened = state.box.opened;
  return (
    <section>
      <h1 className="h1">БОКСЫ</h1>
      <p className="tiny">Шансы: {state.box.odds.map((odd) => `${RARITY[odd.rarity] ?? odd.rarity} ${odd.pct}%`).join(" · ")}. За звёзды бокс не продаётся.</p>
      <article className="list-card">
        <div className="row"><b>СЛЕДУЮЩАЯ КОРОБКА В ОЧЕРЕДИ</b><span>{state.box.progress}/{state.box.goal}</span></div>
      </article>
      <div className="grid5">
        {Array.from({ length: 25 }, (_, cell) => {
          const filled = cell < Math.min(25, opened);
          const queued = !filled && cell === Math.min(24, opened) && state.box.charges > 0;
          return <div key={cell} className={`egg ${filled || queued ? "" : "empty"} ${queued ? "next" : ""}`} style={filled || queued ? { background: queued ? "#f2c94c" : "#c4a574" } : undefined}>{filled || queued ? "🎁" : ""}</div>;
        })}
      </div>
      <button className="btn btn-y" style={{ marginTop: 12 }} disabled={state.box.charges <= 0} onClick={() => onAct({ type: "open_box" })}>ОТКРЫТЬ · {state.box.charges}</button>
    </section>
  );
}

export function TasksScreen({ state, onAct }: { state: GameState; onAct: (body: Record<string, unknown>) => void }) {
  const [tab, setTab] = useState<"tasks" | "ach" | "friends">("tasks");
  const [code, setCode] = useState("");
  const equipped = state.skins.find((item) => item.equipped);
  return (
    <section>
      <div className="tabs-row">
        <button className={`chip c-legendary ${tab === "tasks" ? "on" : ""}`} onClick={() => setTab("tasks")}>ЗАДАНИЯ</button>
        <button className={`chip c-epic ${tab === "ach" ? "on" : ""}`} onClick={() => setTab("ach")}>ЧЕЛЛЕНДЖИ</button>
        <button className={`chip c-rare ${tab === "friends" ? "on" : ""}`} onClick={() => setTab("friends")}>ДРУЗЬЯ</button>
      </div>
      <div className="tabs-row">
        <span className="chip">СЕРИЯ {state.streak.day}</span>
        <span className="chip">ЛИГА {state.league.name}</span>
        <span className="chip">КОМБО {state.me.combo}</span>
      </div>
      <article className="banner">
        {equipped ? <BearFace filter={equipped.filter} accessory={equipped.accessory} backdrop="glow" size={88} /> : null}
        <div>
          <b>СЕЗОННЫЙ ЗАБЕГ</b>
          <p className="tiny">Пасс {state.pass.level}/30</p>
          <button className="btn btn-w" onClick={() => onAct({ type: "claim_pass" })}>ОТКРЫТЬ</button>
        </div>
      </article>
      <article className="list-card">
        <b>МОИ ПРЕДМЕТЫ</b>
        <p className="tiny">Жетоны бака {state.me.tankTokens} · боксы {state.box.charges} · заморозки {state.streak.freezes}</p>
      </article>
      {tab === "tasks" ? state.tasks.map((task) => (
        <div className="list-card" key={task.id}>
          <div className="row">
            <div><b>{task.title}</b><div className="tiny">{Math.min(task.value, task.goal)}/{task.goal} · {task.reward}</div></div>
            <button className="btn btn-y" style={{ width: "auto", fontSize: 14 }} disabled={!task.done || task.claimed} onClick={() => onAct({ type: "claim_task", taskId: task.id })}>{task.claimed ? "ОК" : "ЗАБРАТЬ"}</button>
          </div>
        </div>
      )) : null}
      {tab === "ach" ? (
        <>
          {state.achievements.map((item) => <div className="row" key={item.id}><span>{item.title}</span><b>{Math.min(item.value, item.goal)}/{item.goal}</b></div>)}
          <button className="btn btn-y" onClick={() => onAct({ type: "claim_achievement" })}>ЗАБРАТЬ ГОТОВЫЕ</button>
        </>
      ) : null}
      {tab === "friends" ? (
        <article className="list-card">
          <b>ДРУЗЬЯ {state.friends.qualified}/{state.friends.total}</b>
          <p className="tiny">{state.friends.link}</p>
          <button className="btn btn-y" onClick={() => void navigator.clipboard.writeText(state.friends.link)}>СКОПИРОВАТЬ</button>
          <input className="field" value={code} placeholder="КОД ДНЯ" onChange={(event) => setCode(event.target.value.toUpperCase())} />
          <button className="btn btn-b" disabled={!state.daily.codeUnlocked || state.daily.codeDone} onClick={() => onAct({ type: "code", code })}>ВВЕСТИ КОД</button>
        </article>
      ) : null}
    </section>
  );
}

export function TopScreen({ state, onAct }: { state: GameState; onAct: (body: Record<string, unknown>) => void }) {
  const [board, setBoard] = useState<"solo" | "clan">("solo");
  const [rows, setRows] = useState<{ rank: number; id: number; name: string; score: number }[]>([]);
  const [rank, setRank] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  useEffect(() => {
    let stop = false;
    void fetch(`/api/leaderboard?board=${board}&scope=season`, { headers: { authorization: `Bearer ${localStorage.getItem("tapteddy_token") ?? ""}` } })
      .then((response) => response.json())
      .then((payload: { meRank: number | null; rows: { rank: number; id: number; name: string; score: number }[] }) => {
        if (stop) return;
        setRows(payload.rows ?? []);
        setRank(payload.meRank);
      })
      .catch(() => undefined);
    return () => { stop = true; };
  }, [board]);
  return (
    <section>
      <h1 className="h1">ТОП · {state.league.name.toUpperCase()}</h1>
      <div className="tabs-row">
        <button className={`chip c-legendary ${board === "solo" ? "on" : ""}`} onClick={() => setBoard("solo")}>СОЛО</button>
        <button className={`chip c-rare ${board === "clan" ? "on" : ""}`} onClick={() => setBoard("clan")}>СТАЯ</button>
      </div>
      <p className="tiny">{rank ? `МЕСТО ${rank}` : "ПОКА БЕЗ МЕСТА"} · неделя {fmt(state.league.score)}</p>
      {rows.slice(0, 20).map((row) => <div className="row" key={row.id}><span>{row.rank}. {row.name}</span><b>{fmt(row.score)}</b></div>)}
      {state.me.level < 8 ? <p className="tiny">Стая с 8 уровня.</p> : null}
      {state.clan ? <button className="btn btn-b" onClick={() => onAct({ type: "clan_leave" })}>ВЫЙТИ ИЗ {state.clan.name}</button> : state.me.level >= 8 ? (
        <>
          <input className="field" placeholder="НАЗВАНИЕ" value={name} onChange={(event) => setName(event.target.value)} />
          <button className="btn btn-y" onClick={() => onAct({ type: "clan_create", name })}>СОЗДАТЬ СТАЮ</button>
          <input className="field" placeholder="КОД" value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} />
          <button className="btn btn-g" onClick={() => onAct({ type: "clan_join", code })}>ВСТУПИТЬ</button>
        </>
      ) : null}
    </section>
  );
}

export function BoostsSheet({ state, onAct, onBuy, onClose }: { state: GameState; onAct: (body: Record<string, unknown>) => void; onBuy: (sku: string) => void; onClose: () => void }) {
  return (
    <div className="sheet-back" onClick={onClose}>
      <div className="sheet" onClick={(event) => event.stopPropagation()}>
        <h2 className="h1">БУСТЫ</h2>
        <div className="row"><span>МУЛЬТИТАП {state.upgrades.multitap.level}</span><button className="btn btn-g" style={{ width: "auto" }} disabled={state.upgrades.multitap.cost == null} onClick={() => onAct({ type: "upgrade", kind: "multitap" })}>{state.upgrades.multitap.cost == null ? "МАКС" : fmt(state.upgrades.multitap.cost)}</button></div>
        <div className="row"><span>БАК {state.upgrades.energy.level}</span><button className="btn btn-g" style={{ width: "auto" }} disabled={state.upgrades.energy.cost == null} onClick={() => onAct({ type: "upgrade", kind: "energy" })}>{state.upgrades.energy.cost == null ? "МАКС" : fmt(state.upgrades.energy.cost)}</button></div>
        <div className="row"><span>РЕГЕН {state.upgrades.regen.level}</span><button className="btn btn-g" style={{ width: "auto" }} disabled={state.upgrades.regen.cost == null} onClick={() => onAct({ type: "upgrade", kind: "regen" })}>{state.upgrades.regen.cost == null ? "МАКС" : fmt(state.upgrades.regen.cost)}</button></div>
        <button className="btn btn-y" disabled={state.passive.bank <= 0} onClick={() => onAct({ type: "claim_passive" })}>КОПИЛКА {fmt(state.passive.bank)}</button>
        {state.products.filter((item) => item.group === "boost" || item.group === "energy").slice(0, 5).map((item) => (
          <button key={item.sku} className="btn btn-b" style={{ marginTop: 8 }} disabled={item.stars == null} onClick={() => onBuy(item.sku)}>{item.title}{item.stars ? ` ⭐${item.stars}` : ""}</button>
        ))}
      </div>
    </div>
  );
}
