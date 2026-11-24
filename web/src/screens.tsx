import { useEffect, useState, type ReactNode } from "react";
import { request } from "./api.js";
import { daysLeft, fmt, left } from "./format.js";
import type { BoardResponse, GameState } from "./types.js";

export function Sheet({ title, text, onClose, children }: { title: string; text?: string; onClose: () => void; children?: ReactNode }) {
  return (
    <div className="sheet-back" onClick={onClose}>
      <div className="sheet glass" onClick={(event) => event.stopPropagation()}>
        <h2>{title}</h2>
        {text ? <p>{text}</p> : null}
        {children}
      </div>
    </div>
  );
}

export function TapScreen({
  state,
  squish,
  floats,
  onTap,
  onOpen,
  onBuy,
  onShop,
}: {
  state: GameState;
  squish: boolean;
  floats: { id: number; n: number; x: number }[];
  onTap: () => void;
  onOpen: (sheet: "streak" | "code" | "combo" | "offline" | "newbie") => void;
  onBuy: (sku: string) => void;
  onShop: () => void;
}) {
  const skin = state.skins.find((item) => item.id === state.me.skin);
  const filter = [skin?.filter, "drop-shadow(0 18px 18px rgba(0,0,0,.38))"].filter(Boolean).join(" ");
  const energyPct = Math.max(0, Math.min(100, (state.me.energy / Math.max(1, state.me.energyMax)) * 100));
  const autotap = state.timers.autotapUntil > state.now;
  return (
    <section>
      <header className="topbar">
        <div>
          <p className="eyebrow">TapTeddy</p>
          <h1 className="balance" data-coins={state.me.coins}>
            {fmt(state.me.coins)}
            <span>мёда</span>
          </h1>
        </div>
        <div className="level-pill glass">
          <strong>{state.me.level}</strong>
          <em>уровень</em>
          <div className="xp">
            <i style={{ width: `${Math.min(100, (state.me.xp / Math.max(1, state.me.xpNeed)) * 100)}%` }} />
          </div>
        </div>
      </header>

      <div className="glass energy">
        <div className="row">
          <span className="label">Энергия</span>
          <span className="value">
            {fmt(state.me.energy)} / {fmt(state.me.energyMax)}
          </span>
        </div>
        <div className="bar" aria-hidden="true">
          <i style={{ width: `${energyPct}%` }} />
        </div>
        <div className="row faint">
          <span>+1 / {(state.me.regenMs / 1000).toFixed(1)} с</span>
          <span>
            тап +{state.me.perTap}
            {state.me.tankTokens > 0 ? ` · жетоны ${state.me.tankTokens}` : ""}
          </span>
        </div>
      </div>

      <div className="chip-row">
        <button className="chip" onClick={() => onOpen("streak")}>
          Серия {state.streak.day || 0}/7
        </button>
        <button className="chip gold" onClick={onShop}>
          Teddy Pass · {daysLeft(state.pass.endsAt, state.now)} дн.
        </button>
        {state.clanBuff.stormUntil > state.now ? (
          <span className="chip">Шторм {state.clanBuff.stormPct}% · {left(state.clanBuff.stormUntil, state.now)}</span>
        ) : null}
      </div>

      {state.offer ? (
        <button className="cta" onClick={() => onBuy("offer")}>
          {state.offer.title} · {state.offer.stars}⭐
        </button>
      ) : null}

      <div className="stage">
        {state.me.boost >= 2 ? <div className="badge-x2">x2</div> : null}
        {floats.map((float) => (
          <span key={float.id} className="float" style={{ left: `${float.x}%` }}>
            +{float.n}
          </span>
        ))}
        <button className="bear-hit" data-testid="bear" aria-label="Тапнуть мишку" onPointerDown={(event) => { event.preventDefault(); onTap(); }} onContextMenu={(event) => event.preventDefault()}>
          <div className={squish ? "bear-wrap squish" : "bear-wrap"}>
            <img src="/bear.png" alt="" style={{ filter }} />
          </div>
        </button>
        <div className="per-tap">+{state.me.perTap} за тап</div>
        {state.timers.autopilotUntil > state.now ? <div className="capsule">Автопилот {left(state.timers.autopilotUntil, state.now)}</div> : null}
        {autotap ? <div className="capsule">Автотап {left(state.timers.autotapUntil, state.now)}</div> : null}
      </div>

      <button className="streak glass" onClick={() => onOpen("streak")} aria-label="Ежедневная серия">
        {state.streak.rewards.map((reward) => (
          <span key={reward.day} className={reward.day <= state.streak.day && state.streak.claimedToday ? "dot on" : reward.day < state.streak.day ? "dot on" : reward.day === state.streak.day + 1 && !state.streak.claimedToday ? "dot today" : "dot"}>
            {reward.day}
          </span>
        ))}
      </button>

      {state.refill.show ? (
        <button className="cta" onClick={() => onBuy("refill")}>
          Восстановить · {state.refill.price}⭐
        </button>
      ) : null}

      <div className="mini-grid">
        <button className="ghost" onClick={() => onOpen("code")}>
          Код дня
          <div className="faint">{state.daily.codeDone ? "уже введён" : state.daily.codeUnlocked ? `до ${fmt(state.daily.codeReward)}` : "с 5 уровня"}</div>
        </button>
        <button className="ghost" onClick={() => onOpen("combo")}>
          Комбо дня
          <div className="faint">{state.daily.comboDone ? "собрано" : `${state.daily.combo.filter((card) => card.done).length}/3`}</div>
        </button>
      </div>
    </section>
  );
}

export function UpgradesScreen({ state, onAct }: { state: GameState; onAct: (body: Record<string, unknown>) => void }) {
  const [page, setPage] = useState<"core" | "cards">("core");
  return (
    <section>
      <h2 className="screen-title">Сила</h2>
      <div className="seg glass">
        <button className={page === "core" ? "on" : ""} onClick={() => setPage("core")}>Прокачка</button>
        <button className={page === "cards" ? "on" : ""} onClick={() => setPage("cards")}>Карты</button>
      </div>
      {page === "core" ? (
        <div className="stack">
          <article className="glass upgrade-card">
            <div>
              <b>Мультитап {state.upgrades.multitap.level}</b>
              <p>Сейчас +{state.me.perTap} мёда за тап. Потолок до уровня: {state.me.level + 3}.</p>
            </div>
            <button className="tiny" disabled={state.upgrades.multitap.cost == null} onClick={() => onAct({ type: "upgrade", kind: "multitap" })}>
              {state.upgrades.multitap.cost == null ? "Потолок" : fmt(state.upgrades.multitap.cost)}
            </button>
          </article>
          <article className="glass upgrade-card">
            <div>
              <b>Бак {state.upgrades.energy.level}</b>
              <p>+250 энергии за уровень. Сейчас {fmt(state.me.energyMax)}.</p>
            </div>
            <button className="tiny" disabled={state.upgrades.energy.cost == null} onClick={() => onAct({ type: "upgrade", kind: "energy" })}>
              {state.upgrades.energy.cost == null ? "Потолок" : fmt(state.upgrades.energy.cost)}
            </button>
          </article>
          <article className="glass upgrade-card">
            <div>
              <b>Реген {state.upgrades.regen.level}</b>
              <p>Сейчас 1 энергия за {(state.me.regenMs / 1000).toFixed(1)} с. Быстрее 1.2 с нельзя.</p>
            </div>
            <button className="tiny" disabled={state.upgrades.regen.cost == null} onClick={() => onAct({ type: "upgrade", kind: "regen" })}>
              {state.upgrades.regen.cost == null ? "Потолок" : fmt(state.upgrades.regen.cost)}
            </button>
          </article>
          {state.me.tankTokens > 0 ? (
            <button className="cta" onClick={() => onAct({ type: "use_token" })}>Жетон бака · {state.me.tankTokens}</button>
          ) : null}
        </div>
      ) : (
        <div className="stack">
          <p className="sub">Карты — главный сток мёда. Доход и сила написаны на карточке.</p>
          {state.categories.map((category) => (
            <div key={category.id}>
              <h3>{category.name}</h3>
              <p className="sub">{category.locked ? `Откроется на ${category.minLevel} уровне` : category.blurb}</p>
              <div className="card-grid">
                {category.cards.map((card) => (
                  <article key={card.id} className="glass upgrade-card">
                    <div>
                      <div className="kind">{card.kind === "income" ? "доход" : card.kind === "tap" ? "сила" : card.kind === "regen" ? "реген" : "бак"} · {card.level}/{card.max}</div>
                      <b>{card.name}</b>
                      <p>{card.locked ? `с ${card.minLevel} уровня` : `${card.effect} → ${card.next}`}</p>
                    </div>
                    <button className="tiny" disabled={card.cost == null} onClick={() => onAct({ type: "card", cardId: card.id })}>
                      {card.cost == null ? (card.locked ? "Закрыто" : "Макс") : fmt(card.cost)}
                    </button>
                  </article>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

const GROUPS: { id: string; title: string }[] = [
  { id: "offer", title: "Наборы" },
  { id: "energy", title: "Энергия" },
  { id: "boost", title: "Бусты" },
  { id: "pass", title: "Teddy Pass" },
  { id: "clan", title: "Клан" },
  { id: "cosmetic", title: "Внешность" },
];

export function ShopScreen({
  state,
  onAct,
  onBuy,
}: {
  state: GameState;
  onAct: (body: Record<string, unknown>) => void;
  onBuy: (sku: string, extra?: { levels?: number }) => void;
}) {
  const [levels, setLevels] = useState(1);
  const rewardTracks = state.pass.tracks.filter((track) => track.free || track.paid);
  return (
    <section>
      <h2 className="screen-title">Лавка</h2>
      <p className="sub">Звёзды покупают время, бак и окрасы. Случайных ящиков нет: на кнопке весь состав.</p>
      <article className="glass card">
        <h3>Teddy Pass · уровень {state.pass.level}/30</h3>
        <p>{state.pass.owned ? "+20% до конца сезона и платная дорожка." : "Бесплатная дорожка уже идёт. Пропуск добавляет +20% и редкие окрасы."}</p>
        <div className="bar" style={{ marginTop: 10 }}>
          <i style={{ width: `${(state.pass.xpInto / state.pass.xpPerLevel) * 100}%` }} />
        </div>
        <div className="actions">
          <button className="tiny" onClick={() => onAct({ type: "claim_pass" })}>Забрать награды</button>
          {!state.pass.owned ? <button className="tiny" onClick={() => onBuy("pass")}>Купить · 250⭐</button> : null}
        </div>
        {state.pass.owned && state.pass.level < 30 ? (
          <div className="actions">
            <button className="tiny glass-btn" onClick={() => setLevels((value) => Math.max(1, value - 1))}>−</button>
            <button className="tiny" onClick={() => onBuy("pass_levels", { levels })}>{levels} ур. · {15 * levels}⭐</button>
            <button className="tiny glass-btn" onClick={() => setLevels((value) => Math.min(30 - state.pass.level, value + 1))}>+</button>
          </div>
        ) : null}
        <div style={{ marginTop: 8 }}>
          {rewardTracks.map((track) => (
            <div className="track" key={track.level}>
              <b>{track.level}.</b> {track.free ?? "—"} {track.paid ? ` / пасс: ${track.paid}` : ""}
              {track.level <= state.pass.claimedFree ? " · забрано" : ""}
            </div>
          ))}
        </div>
      </article>

      <h3>Окрасы мишки</h3>
      <p className="sub">Только внешний вид. На мёд и рейтинг не влияют.</p>
      <div className="skin-grid">
        {state.skins.filter((skin) => skin.shop || skin.owned).map((skin) => (
          <article key={skin.id} className="glass skin">
            <img src="/bear.png" alt="" style={{ filter: skin.filter || undefined }} />
            <strong>{skin.name}</strong>
            <em>{skin.blurb}</em>
            {skin.equipped ? <div className="price">Надет</div> : null}
            {skin.owned && !skin.equipped ? <button className="tiny" onClick={() => onAct({ type: "equip", skinId: skin.id })}>Надеть</button> : null}
            {!skin.owned && skin.currency === "coins" ? (
              <button className="tiny" disabled={skin.locked} onClick={() => onAct({ type: "buy_skin", skinId: skin.id })}>
                {skin.locked ? `${skin.minLevel} ур.` : `${fmt(skin.price)} мёда`}
              </button>
            ) : null}
            {!skin.owned && skin.currency === "stars" ? (
              <button className="tiny" disabled={skin.locked} onClick={() => onBuy(`skin_${skin.id}`)}>
                {skin.locked ? `${skin.minLevel} ур.` : `${skin.price}⭐`}
              </button>
            ) : null}
          </article>
        ))}
      </div>

      {GROUPS.map((group) => {
        const items = state.products.filter((item) => item.group === group.id && item.sku !== "pass" && item.sku !== "pass_levels" && !item.sku.startsWith("skin_"));
        if (!items.length) return null;
        return (
          <div key={group.id}>
            <h3>{group.title}</h3>
            <div className="stack">
              {items.map((item) => (
                <article key={item.sku} className="glass card">
                  <h3>{item.title}</h3>
                  <p>{item.description}</p>
                  <div className="actions">
                    <button className="tiny" disabled={item.stars == null} onClick={() => onBuy(item.sku)}>
                      {item.stars == null ? item.reason ?? "Недоступно" : `${item.stars}⭐`}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </div>
        );
      })}
    </section>
  );
}

export function ClanScreen({ state, onAct, onBuy }: { state: GameState; onAct: (body: Record<string, unknown>) => void; onBuy: (sku: string) => void }) {
  const [name, setName] = useState("");
  const [chat, setChat] = useState("");
  const [code, setCode] = useState("");
  if (state.me.level < 8) {
    return (
      <section>
        <h2 className="screen-title">Клан</h2>
        <article className="glass card">
          <h3>Откроется на 8 уровне</h3>
          <p>Клан — это канал или чат. Соло-рейтинг от этого не страдает.</p>
        </article>
      </section>
    );
  }
  if (!state.clan) {
    return (
      <section>
        <h2 className="screen-title">Клан</h2>
        <article className="glass card">
          <h3>Создать</h3>
          <p>Если привязываешь канал, добавь бота админом и укажи @username.</p>
          <input className="field" placeholder="Название" value={name} onChange={(event) => setName(event.target.value)} />
          <input className="field" placeholder="@канал, необязательно" value={chat} onChange={(event) => setChat(event.target.value)} />
          <button className="cta" onClick={() => onAct({ type: "clan_create", name, chat })}>Создать клан</button>
        </article>
        <article className="glass card">
          <h3>Вступить по коду</h3>
          <input className="field" placeholder="Код" value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} />
          <button className="ghost" onClick={() => onAct({ type: "clan_join", code })}>Вступить</button>
        </article>
      </section>
    );
  }
  const clan = state.clan;
  return (
    <section>
      <h2 className="screen-title">{clan.name}</h2>
      <p className="sub">
        Уровень {clan.level} · {clan.members}/{clan.cap} · код {clan.code}
        {clan.flag === "gold" ? " · золотой флаг" : clan.flag === "silver" ? " · флаг" : clan.flag === "top10" ? " · рамка недели" : ""}
      </p>
      <article className="glass card">
        <div className="list-row"><span>Неделя</span><b>{fmt(clan.weekPoints)}</b></div>
        <div className="list-row"><span>Сезон</span><b>{fmt(clan.seasonPoints)}</b></div>
        <div className="list-row"><span>Место в сезоне</span><b>{clan.rankSeason}</b></div>
        {clan.chat ? <div className="list-row"><span>Чат</span><b>{clan.chat}</b></div> : null}
        <div className="actions">
          <button className="tiny glass-btn" onClick={() => void navigator.clipboard.writeText(clan.link)}>Ссылка</button>
          <button className="tiny" onClick={() => onBuy("storm_20")}>Шторм 20% · 150⭐</button>
          <button className="tiny" onClick={() => onBuy("storm_30")}>Шторм 30% · 300⭐</button>
        </div>
        {clan.stormUntil > state.now ? <p>Шторм {clan.stormPct}% ещё {left(clan.stormUntil, state.now)}</p> : null}
      </article>
      <article className="glass card">
        {clan.top.map((member) => (
          <div className="list-row" key={member.id}>
            <span>{member.name}</span>
            <b>{fmt(member.points)}</b>
          </div>
        ))}
        <button className="ghost" onClick={() => onAct({ type: "clan_leave" })}>Выйти</button>
      </article>
    </section>
  );
}

export function TopScreen({ state }: { state: GameState }) {
  const [board, setBoard] = useState<"solo" | "clan">("solo");
  const [scope, setScope] = useState<"season" | "all">("season");
  const [data, setData] = useState<BoardResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let stop = false;
    request<BoardResponse>(`/api/leaderboard?board=${board}&scope=${scope}`)
      .then((payload) => { if (!stop) setData(payload); })
      .catch((err: Error) => { if (!stop) setError(err.message); });
    return () => { stop = true; };
  }, [board, scope]);
  return (
    <section>
      <h2 className="screen-title">Топ</h2>
      <div className="seg glass">
        <button className={board === "solo" ? "on" : ""} onClick={() => setBoard("solo")}>Соло</button>
        <button className={board === "clan" ? "on" : ""} onClick={() => setBoard("clan")}>Кланы</button>
      </div>
      <div className="seg glass">
        <button className={scope === "season" ? "on" : ""} onClick={() => setScope("season")}>Сезон</button>
        <button className={scope === "all" ? "on" : ""} onClick={() => setScope("all")}>Всё время</button>
      </div>
      <p className="sub">{state.me.name}: {data?.meRank ? `место ${data.meRank}` : "очки ещё копиются"} {error}</p>
      <article className="glass card">
        {(data?.rows ?? []).map((row) => (
          <div className="list-row" key={row.id}>
            <span className={row.nameColor === "honey" ? "name-honey" : row.me ? "me-name" : ""}>
              {row.rank}. {row.name}
            </span>
            <b>{scope === "all" && board === "solo" ? `ур. ${row.level}` : fmt(row.score)}</b>
          </div>
        ))}
        {!data?.rows.length ? <p>Пока тихо. Первый мёд уже считается.</p> : null}
      </article>
    </section>
  );
}

export function FriendsScreen({ state }: { state: GameState }) {
  return (
    <section>
      <h2 className="screen-title">Друзья</h2>
      <article className="glass card">
        <h3>{state.friends.qualified} из {state.friends.total} играют</h3>
        <p>5 000 мёда, когда друг дойдёт до 3 уровня и сделает 500 тапов. 10% его мёда — первые 14 дней, только игровые, не звёзды.</p>
        <div className="actions">
          <button className="tiny" onClick={() => void navigator.clipboard.writeText(state.friends.link)}>Скопировать ссылку</button>
        </div>
        <p className="faint">{state.friends.link}</p>
      </article>
      <article className="glass card">
        {state.friends.milestones.map((item) => (
          <div className="list-row" key={item.n}>
            <span>{item.n} друзей — {item.label}</span>
            <b>{item.done ? "есть" : "ещё нет"}</b>
          </div>
        ))}
      </article>
      <article className="glass card">
        {state.friends.list.map((friend) => (
          <div className="list-row" key={friend.id}>
            <span>{friend.name} · ур. {friend.level}</span>
            <b>{friend.qualified ? "засчитан" : `${friend.taps}/500`}</b>
          </div>
        ))}
        {!state.friends.list.length ? <p>Пока никого. Ссылка выше.</p> : null}
      </article>
    </section>
  );
}
