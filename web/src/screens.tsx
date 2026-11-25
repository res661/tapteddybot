import { useEffect, useState } from "react";
import { request } from "./api.js";
import { BearFace } from "./bear.js";
import { fmt, left } from "./format.js";
import type { BoardResponse, GameState } from "./types.js";

function stars(level: number) {
  return "★".repeat(level) + "☆".repeat(Math.max(0, 5 - Math.ceil(level / 2)));
}

export function TapScreen({
  state,
  squish,
  crit,
  floats,
  sparks,
  onTap,
  onBuy,
}: {
  state: GameState;
  squish: boolean;
  crit: boolean;
  floats: { id: number; n: number; x: number; crit: boolean }[];
  sparks: { id: number; dx: string; dy: string }[];
  onTap: () => void;
  onBuy: (sku: string) => void;
}) {
  const skin = state.skins.find((item) => item.id === state.me.skin) ?? state.skins[0];
  const pct = Math.max(0, Math.min(100, (state.me.energy / Math.max(1, state.me.energyMax)) * 100));
  return (
    <section className="play">
      <header className="hud">
        <div className="coin-pill">
          <span className="coin-ic" aria-hidden="true">🍯</span>
          <div>
            <div className="num" data-coins={state.me.coins}>{fmt(state.me.coins)}</div>
            <div className="tiny">мёд</div>
          </div>
        </div>
        <div className="lvl-pill">
          <div>
            <div className="num">{state.me.level}</div>
            <div className="tiny">ур.</div>
          </div>
        </div>
      </header>
      <div className="energy">
        <div className="row tiny"><span>Энергия</span><span>{fmt(state.me.energy)} / {fmt(state.me.energyMax)}</span></div>
        <div className="bar"><i style={{ width: `${pct}%` }} /></div>
      </div>
      <div className={`stage ${crit ? "crit" : ""}`}>
        {state.me.combo >= 10 ? <div className="combo-flag">x{state.me.combo}</div> : null}
        {floats.map((float) => (
          <span key={float.id} className={float.crit ? "float crit" : "float"} style={{ left: `${float.x}%` }}>+{float.n}</span>
        ))}
        {sparks.map((spark) => (
          <i key={spark.id} className="spark" style={{ left: "50%", top: "46%", ["--dx" as string]: spark.dx, ["--dy" as string]: spark.dy }} />
        ))}
        <button className="bear-btn" data-testid="bear" aria-label="Тапнуть мишку" onPointerDown={(event) => { event.preventDefault(); onTap(); }} onContextMenu={(event) => event.preventDefault()}>
          {skin ? <BearFace filter={skin.filter} accessory={skin.accessory} backdrop={skin.backdrop} squish={squish} /> : null}
        </button>
      </div>
      <p className="sub" style={{ textAlign: "center" }}>+{state.me.perTap} за тап{state.me.crit > 0 ? ` · крит ${Math.round(state.me.crit * 100)}%` : ""}</p>
      {state.refill.show ? <button className="press wide" onClick={() => onBuy("refill")}>Восстановить · {state.refill.price}⭐</button> : null}
    </section>
  );
}

export function SkinsScreen({
  state,
  onAct,
  onBuy,
}: {
  state: GameState;
  onAct: (body: Record<string, unknown>) => void;
  onBuy: (sku: string) => void;
}) {
  const [picked, setPicked] = useState<string | null>(null);
  const skin = state.skins.find((item) => item.id === picked) ?? null;
  const pct = Math.min(100, (state.box.progress / Math.max(1, state.box.goal)) * 100);
  return (
    <section>
      <h1 className="h1">Окрасы</h1>
      <p className="sub">Коллекция {state.collection.owned}/{state.collection.total} · {state.collection.pct}%</p>
      <div className="bar" style={{ marginBottom: 12 }}><i style={{ width: `${state.collection.pct}%` }} /></div>
      <article className="gloss">
        <b>Плюшевый бокс</b>
        <p className="tiny">Бесплатно за тапы. Каждые {state.box.goal} тапов — заряд. Шансы: {state.box.odds.map((odd) => `${({ common: "обычный", rare: "редкий", epic: "эпик", legendary: "легенда", mythic: "миф" } as Record<string, string>)[odd.rarity] ?? odd.rarity} ${odd.pct}%`).join(" · ")}</p>
        <div className="bar"><i style={{ width: `${pct}%` }} /></div>
        <button className="press wide" disabled={state.box.charges <= 0} onClick={() => onAct({ type: "open_box" })}>
          Открыть · {state.box.charges}
        </button>
      </article>
      <div className="grid">
        {state.skins.map((item) => (
          <button key={item.id} className={`gloss skin-card r-${item.rarity} ${item.owned ? "" : "lock"}`} onClick={() => setPicked(item.id)}>
            <BearFace filter={item.filter} accessory={item.accessory} backdrop={item.backdrop} size={96} />
            <b>{item.name}</b>
            <span className="tiny">{item.owned ? stars(item.level) : item.rarity}</span>
          </button>
        ))}
      </div>
      {skin ? (
        <div className="sheet-back" onClick={() => setPicked(null)}>
          <div className="sheet" onClick={(event) => event.stopPropagation()}>
            <BearFace filter={skin.filter} accessory={skin.accessory} backdrop={skin.backdrop} size={140} />
            <h2 className="h1" style={{ fontSize: 28 }}>{skin.name}</h2>
            <p className="sub">{skin.blurb}</p>
            <p>{skin.bonus}</p>
            {skin.owned && skin.upgradeShards ? <p className="tiny">Дальше: {skin.nextBonus}. Осколки {skin.shards}/{skin.upgradeShards}</p> : null}
            <div className="row">
              {skin.owned && !skin.equipped ? <button className="press sm" onClick={() => onAct({ type: "equip", skinId: skin.id })}>Надеть</button> : null}
              {skin.equipped ? <b>Надет</b> : null}
              {skin.owned && skin.upgradeCoins != null ? (
                <button className="press sm" onClick={() => onAct({ type: "upgrade_skin", skinId: skin.id })}>
                  Улучшить · {fmt(skin.upgradeCoins)}
                </button>
              ) : null}
              {!skin.owned && skin.currency === "coins" ? (
                <button className="press sm" disabled={skin.locked} onClick={() => onAct({ type: "buy_skin", skinId: skin.id })}>
                  {skin.locked ? `${skin.minLevel} ур.` : `${fmt(skin.price)} мёда`}
                </button>
              ) : null}
              {!skin.owned && skin.currency === "stars" ? (
                <button className="press sm" disabled={skin.locked} onClick={() => onBuy(`skin_${skin.id}`)}>
                  {skin.locked ? `${skin.minLevel} ур.` : `${skin.price}⭐`}
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

export function BoostsScreen({ state, onAct, onBuy }: { state: GameState; onAct: (body: Record<string, unknown>) => void; onBuy: (sku: string, extra?: { levels?: number }) => void }) {
  const [cards, setCards] = useState(false);
  return (
    <section>
      <h1 className="h1">Бусты</h1>
      <article className="gloss">
        <div className="row"><b>Мультитап {state.upgrades.multitap.level}</b>
          <button className="press sm" disabled={state.upgrades.multitap.cost == null} onClick={() => onAct({ type: "upgrade", kind: "multitap" })}>{state.upgrades.multitap.cost == null ? "Макс" : fmt(state.upgrades.multitap.cost)}</button>
        </div>
        <div className="row"><b>Бак {state.upgrades.energy.level}</b>
          <button className="press sm" disabled={state.upgrades.energy.cost == null} onClick={() => onAct({ type: "upgrade", kind: "energy" })}>{state.upgrades.energy.cost == null ? "Макс" : fmt(state.upgrades.energy.cost)}</button>
        </div>
        <div className="row"><b>Реген {state.upgrades.regen.level}</b>
          <button className="press sm" disabled={state.upgrades.regen.cost == null} onClick={() => onAct({ type: "upgrade", kind: "regen" })}>{state.upgrades.regen.cost == null ? "Макс" : fmt(state.upgrades.regen.cost)}</button>
        </div>
        <p className="tiny">Пассив {fmt(state.passive.perHour)}/ч · копилка {state.passive.capHours} ч · {fmt(state.passive.bank)} внутри</p>
        <button className="press sm" disabled={state.passive.bank <= 0} onClick={() => onAct({ type: "claim_passive" })}>Забрать копилку</button>
      </article>
      <button className="press wide" onClick={() => setCards((value) => !value)}>{cards ? "Скрыть карты" : "Карты дохода"}</button>
      {cards ? state.categories.map((category) => (
        <div key={category.id}>
          <h3>{category.name}</h3>
          {category.locked ? <p className="tiny">С {category.minLevel} уровня</p> : null}
          {category.cards.map((card) => (
            <div className="gloss" key={card.id}>
              <div className="row">
                <div><b>{card.name}</b><div className="tiny">{card.locked ? `ур. ${card.minLevel}` : `${card.effect} · ${card.level}/${card.max}`}</div></div>
                <button className="press sm" disabled={card.cost == null} onClick={() => onAct({ type: "card", cardId: card.id })}>{card.cost == null ? "—" : fmt(card.cost)}</button>
              </div>
            </div>
          ))}
        </div>
      )) : null}
      <article className="gloss">
        <b>Teddy Pass · {state.pass.level}/30</b>
        <p className="tiny">{state.pass.owned ? "Пропуск активен" : "Бесплатная дорожка уже идёт"} · осталось {left(state.pass.endsAt, state.now)}</p>
        <div className="row">
          <button className="press sm" onClick={() => onAct({ type: "claim_pass" })}>Забрать</button>
          {!state.pass.owned ? <button className="press sm" onClick={() => onBuy("pass")}>250⭐</button> : null}
        </div>
      </article>
      {state.products.filter((item) => !item.sku.startsWith("skin_") && item.sku !== "pass").map((item) => (
        <div className="gloss" key={item.sku}>
          <div className="row">
            <div><b>{item.title}</b><div className="tiny">{item.description}</div></div>
            <button className="press sm" disabled={item.stars == null} onClick={() => onBuy(item.sku)}>{item.stars == null ? "—" : `${item.stars}⭐`}</button>
          </div>
        </div>
      ))}
    </section>
  );
}

export function TasksScreen({ state, onAct }: { state: GameState; onAct: (body: Record<string, unknown>) => void }) {
  const [code, setCode] = useState("");
  return (
    <section>
      <h1 className="h1">Дела</h1>
      <article className="gloss">
        <b>Серия {state.streak.day}/7</b>
        <div className="row">
          {state.streak.rewards.map((reward) => <span key={reward.day} className="tiny">{reward.day}</span>)}
        </div>
        <button className="press wide" disabled={state.streak.claimedToday} onClick={() => onAct({ type: "streak" })}>Забрать день</button>
        {state.streak.canSave && state.streak.freezes > 0 ? <button className="press sm" onClick={() => onAct({ type: "save_streak" })}>Сохранить серию</button> : null}
      </article>
      {state.tasks.map((task) => (
        <div className="gloss" key={task.id}>
          <div className="row">
            <div><b>{task.title}</b><div className="tiny">{Math.min(task.value, task.goal)}/{task.goal} · {task.reward}</div></div>
            <button className="press sm" disabled={!task.done || task.claimed} onClick={() => onAct({ type: "claim_task", taskId: task.id })}>{task.claimed ? "Ок" : "Забрать"}</button>
          </div>
        </div>
      ))}
      <h3>Ачивки</h3>
      {state.achievements.map((item) => (
        <div className="row" key={item.id}>
          <span>{item.title} · {Math.min(item.value, item.goal)}/{item.goal}</span>
          <b>{item.claimed ? "✓" : fmt(item.coins)}</b>
        </div>
      ))}
      <button className="press wide" onClick={() => onAct({ type: "claim_achievement" })}>Забрать готовые</button>
      <article className="gloss">
        <b>Код дня</b>
        <p className="tiny">{state.daily.codeUnlocked ? `до ${fmt(state.daily.codeReward)}` : "с 5 уровня"} {state.channelUrl}</p>
        <input className="field" value={code} maxLength={8} placeholder="Код" onChange={(event) => setCode(event.target.value.toUpperCase())} />
        <button className="press sm" disabled={!state.daily.codeUnlocked || state.daily.codeDone} onClick={() => onAct({ type: "code", code })}>Ввести</button>
      </article>
      <article className="gloss">
        <b>Комбо карт</b>
        {state.daily.combo.map((card) => <div className="row" key={card.id}><span>{card.name}</span><b>{card.done ? "да" : "нет"}</b></div>)}
        <button className="press sm" disabled={state.daily.comboDone} onClick={() => onAct({ type: "combo" })}>Забрать {fmt(state.daily.comboReward)}</button>
      </article>
      <article className="gloss">
        <b>Друзья {state.friends.qualified}/{state.friends.total}</b>
        <p className="tiny">{state.friends.link}</p>
        <button className="press sm" onClick={() => void navigator.clipboard.writeText(state.friends.link)}>Скопировать</button>
      </article>
    </section>
  );
}

export function TopScreen({ state, onAct, onBuy }: { state: GameState; onAct: (body: Record<string, unknown>) => void; onBuy: (sku: string) => void }) {
  const [board, setBoard] = useState<"solo" | "clan">("solo");
  const [scope, setScope] = useState<"season" | "all">("season");
  const [data, setData] = useState<BoardResponse | null>(null);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  useEffect(() => {
    let stop = false;
    request<BoardResponse>(`/api/leaderboard?board=${board}&scope=${scope}`)
      .then((payload) => { if (!stop) setData(payload); })
      .catch(() => undefined);
    return () => { stop = true; };
  }, [board, scope]);
  const leaguePct = state.league.next ? Math.min(100, (state.league.score / state.league.next) * 100) : 100;
  return (
    <section>
      <h1 className="h1">Топ</h1>
      <article className="gloss">
        <b>Лига: {state.league.name}</b>
        <p className="tiny">Неделя {fmt(state.league.score)}{state.league.next ? ` / ${fmt(state.league.next)}` : ""}</p>
        <div className="bar"><i style={{ width: `${leaguePct}%` }} /></div>
      </article>
      <div className="row">
        <button className={board === "solo" ? "press sm" : "press sm"} onClick={() => setBoard("solo")}>Соло</button>
        <button className="press sm" onClick={() => setBoard("clan")}>Кланы</button>
        <button className="press sm" onClick={() => setScope(scope === "season" ? "all" : "season")}>{scope === "season" ? "Сезон" : "Всё время"}</button>
      </div>
      <p className="tiny">{data?.meRank ? `Место ${data.meRank}` : "Пока без места"}</p>
      <article className="gloss">
        {(data?.rows ?? []).slice(0, 30).map((row) => (
          <div className="row" key={`${row.id}-${row.rank}`}>
            <span>{row.rank}. {row.name}</span>
            <b>{fmt(row.score)}</b>
          </div>
        ))}
      </article>
      <h3>Клан</h3>
      {state.me.level < 8 ? <p className="tiny">Кланы с 8 уровня. Соло-лига от этого не страдает.</p> : null}
      {state.clan ? (
        <article className="gloss">
          <b>{state.clan.name}</b>
          <p className="tiny">Код {state.clan.code} · {state.clan.members}/{state.clan.cap} · неделя {fmt(state.clan.weekPoints)}</p>
          {state.clan.stormUntil > state.now ? <p>Шторм {state.clan.stormPct}% · {left(state.clan.stormUntil, state.now)}</p> : null}
          <div className="row">
            <button className="press sm" onClick={() => onBuy("storm_20")}>Шторм 150⭐</button>
            <button className="press sm" onClick={() => onAct({ type: "clan_leave" })}>Выйти</button>
          </div>
        </article>
      ) : state.me.level >= 8 ? (
        <article className="gloss">
          <input className="field" placeholder="Название" value={name} onChange={(event) => setName(event.target.value)} />
          <button className="press sm" onClick={() => onAct({ type: "clan_create", name })}>Создать</button>
          <input className="field" placeholder="Код" value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} />
          <button className="press sm" onClick={() => onAct({ type: "clan_join", code })}>Вступить</button>
        </article>
      ) : null}
    </section>
  );
}
