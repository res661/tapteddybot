import { SKINS, skinById } from "./catalog.js";
import {
  DAY,
  currentOffer,
  energyCap,
  hasPass,
  maxMultitap,
  passLevelFromXp,
  refillPrice,
  regenEnergy,
  starMtapPrice,
  utcDay,
  weekId,
} from "./economy.js";
import { GameError } from "./errors.js";
import {
  addAutotap,
  commit,
  ctxFor,
  extendTimer,
  giveSkin,
  markOffer,
  mustUser,
  noteFriendPurchase,
  ownedOffer,
  prepare,
  type Ctx,
} from "./progress.js";
import { getPurchase, getPurchaseByCharge, getPurchaseByPayload, insertPurchase, savePurchase } from "./store.js";
import type { Grant, Purchase, User } from "./types.js";

export interface Quote {
  sku: string;
  group: string;
  title: string;
  description: string;
  stars: number;
  meta: Record<string, unknown>;
}

export interface ProductView {
  sku: string;
  group: string;
  title: string;
  description: string;
  stars: number | null;
  reason?: string;
}

function refillUsed(user: User, now: number): number {
  return user.data.refillDay === utcDay(now) ? user.data.refillCount : 0;
}

function paidFreezes(user: User, now: number): number {
  return user.data.paidFreezeWeek === weekId(now) ? user.data.paidFreezeCount : 0;
}

function fillEnergy(user: User, now: number): Grant {
  regenEnergy(user, now);
  const grant: Grant = { op: "energy", before: user.data.energy, taps: user.data.tapCount };
  user.data.energy = energyCap(user, now);
  user.data.energyAt = now;
  return grant;
}

function metaOf(meta: Record<string, unknown> | undefined): Record<string, unknown> {
  return meta ?? {};
}

function levelsOf(meta: Record<string, unknown>, ctx: Ctx): number {
  const room = 30 - passLevelFromXp(ctx.user.data.passXp);
  const asked = Math.floor(Number(meta.levels ?? 1));
  const n = Math.min(room, Math.max(1, Number.isFinite(asked) ? asked : 1));
  return n;
}

interface Spec {
  sku: string;
  group: string;
  title: (ctx: Ctx, now: number, meta: Record<string, unknown>) => string;
  description: string | ((ctx: Ctx, now: number, meta: Record<string, unknown>) => string);
  stars: (ctx: Ctx, now: number, meta: Record<string, unknown>) => number;
  reason: (ctx: Ctx, now: number, meta: Record<string, unknown>) => string | null;
  apply: (ctx: Ctx, now: number, meta: Record<string, unknown>) => Grant[];
  show?: (ctx: Ctx, now: number) => boolean;
  shape?: (ctx: Ctx, now: number, meta: Record<string, unknown>) => Record<string, unknown>;
}

const SPECS: Spec[] = [
  {
    sku: "refill",
    group: "energy",
    title: (ctx, now) => `Полный бак · ${refillPrice(refillUsed(ctx.user, now))}⭐`,
    description: "Энергия сразу до текущего максимума. Сверх бака не наливается.",
    stars: (ctx, now) => refillPrice(refillUsed(ctx.user, now)),
    reason: () => null,
    apply: (ctx, now) => {
      const day = utcDay(now);
      if (ctx.user.data.refillDay !== day) {
        ctx.user.data.refillDay = day;
        ctx.user.data.refillCount = 0;
      }
      ctx.user.data.refillCount += 1;
      return [fillEnergy(ctx.user, now)];
    },
  },
  {
    sku: "tank_pack",
    group: "energy",
    title: () => "3 жетона бака",
    description: "Три полных бака в запас. Дешевле, чем три разовых. На складе не больше пяти.",
    stars: () => 60,
    reason: (ctx) => (ctx.user.data.tankTokens + 3 > 5 ? "На складе уже много жетонов" : null),
    apply: (ctx) => {
      if (ctx.user.data.tankTokens + 3 > 5) throw new GameError("На складе не больше 5 жетонов");
      ctx.user.data.tankTokens += 3;
      return [{ op: "tokens", n: 3 }];
    },
  },
  {
    sku: "autotap_30",
    group: "energy",
    title: () => "Автотап 30 минут",
    description: "Пока приложение открыто, мишка тратит энергию сам: 8 тапов в секунду.",
    stars: () => 25,
    reason: () => null,
    apply: (ctx, now) => {
      addAutotap(ctx.user, 30 * 60_000, now);
      return [{ op: "autotap", ms: 30 * 60_000 }];
    },
  },
  {
    sku: "autopilot_1",
    group: "boost",
    title: () => "Автопилот 1 час",
    description: "Можно закрыть приложение: сервер забирает накопленную энергию и начисляет мёд.",
    stars: () => 50,
    reason: () => null,
    apply: (ctx, now) => {
      extendTimer(ctx.user, "autopilotUntil", 3_600_000, now);
      return [{ op: "autopilot", ms: 3_600_000 }];
    },
  },
  {
    sku: "autopilot_6",
    group: "boost",
    title: () => "Автопилот 6 часов",
    description: "Шесть часов, пока тебя нет. Час в этом пакете дешевле разового.",
    stars: () => 150,
    reason: () => null,
    apply: (ctx, now) => {
      extendTimer(ctx.user, "autopilotUntil", 6 * 3_600_000, now);
      return [{ op: "autopilot", ms: 6 * 3_600_000 }];
    },
  },
  {
    sku: "autopilot_24",
    group: "boost",
    title: () => "Автопилот 24 часа",
    description: "Сутки без заходов. Быстрее обычного регена не качает.",
    stars: () => 400,
    reason: () => null,
    apply: (ctx, now) => {
      extendTimer(ctx.user, "autopilotUntil", 24 * 3_600_000, now);
      return [{ op: "autopilot", ms: 24 * 3_600_000 }];
    },
  },
  {
    sku: "x2_1",
    group: "boost",
    title: () => "x2 на 1 час",
    description: "Двойной тап, пассив и копилка, пока идёт таймер. Сам с собой не складывается в x4.",
    stars: () => 40,
    reason: () => null,
    apply: (ctx, now) => {
      extendTimer(ctx.user, "x2Until", 3_600_000, now);
      return [{ op: "x2", ms: 3_600_000 }];
    },
  },
  {
    sku: "x2_8",
    group: "boost",
    title: () => "x2 на 8 часов",
    description: "Восемь часов двойного мёда. Повторная покупка продлевает время.",
    stars: () => 150,
    reason: () => null,
    apply: (ctx, now) => {
      extendTimer(ctx.user, "x2Until", 8 * 3_600_000, now);
      return [{ op: "x2", ms: 8 * 3_600_000 }];
    },
  },
  {
    sku: "x2_24",
    group: "boost",
    title: () => "x2 на 24 часа",
    description: "Сутки двойного дохода с тапа и пассива.",
    stars: () => 300,
    reason: () => null,
    apply: (ctx, now) => {
      extendTimer(ctx.user, "x2Until", 24 * 3_600_000, now);
      return [{ op: "x2", ms: 24 * 3_600_000 }];
    },
  },
  {
    sku: "multitap_star",
    group: "boost",
    title: (ctx) => {
      const price = starMtapPrice(ctx.user.data.starMtap);
      const next = ctx.user.data.multitap + 1;
      return price ? `Тап ${ctx.user.data.multitap} → ${next}` : "Мультитап за звёзды";
    },
    description: "Навсегда +1 к тапу до процентов карт. Всего пять покупок на аккаунт, не чаще раза в 6 часов.",
    stars: (ctx) => starMtapPrice(ctx.user.data.starMtap) ?? 0,
    reason: (ctx, now) => {
      if (starMtapPrice(ctx.user.data.starMtap) == null) return "Дальше только за мёд";
      if (ctx.user.data.multitap >= maxMultitap(ctx.user.level)) return "Сначала подними уровень";
      const wait = ctx.user.data.starMtapAt + 6 * 3_600_000 - now;
      if (ctx.user.data.starMtapAt && wait > 0) return "Следующая покупка через 6 часов";
      return null;
    },
    apply: (ctx, now) => {
      if (starMtapPrice(ctx.user.data.starMtap) == null) throw new GameError("Больше нельзя купить за звёзды");
      if (ctx.user.data.multitap >= maxMultitap(ctx.user.level)) throw new GameError("Сначала подними уровень");
      if (ctx.user.data.starMtapAt && now - ctx.user.data.starMtapAt < 6 * 3_600_000) throw new GameError("Подожди 6 часов");
      ctx.user.data.multitap += 1;
      ctx.user.data.starMtap += 1;
      ctx.user.data.starMtapAt = now;
      return [{ op: "multitap" }];
    },
  },
  {
    sku: "pass",
    group: "pass",
    title: () => "Teddy Pass",
    description: "+20% к тапу и пассиву до конца сезона, копилка 8 часов, заморозка серии и значок. Платная дорожка наград.",
    stars: () => 250,
    reason: (ctx, now) => (hasPass(ctx.user, now) ? "Пропуск этого сезона уже есть" : null),
    apply: (ctx, now) => {
      if (hasPass(ctx.user, now)) throw new GameError("Пропуск уже куплен");
      const season = ctx.user.seasonId;
      ctx.user.data.passSeason = season;
      if (!ctx.user.data.badges.includes("pass")) ctx.user.data.badges.push("pass");
      const exp = now + 7 * DAY;
      ctx.user.data.freezes.push({ exp });
      return [
        { op: "pass", season },
        { op: "badge", id: "pass" },
        { op: "freeze", exp },
      ];
    },
  },
  {
    sku: "pass_levels",
    group: "pass",
    title: (_ctx, _now, meta) => `Уровни пропуска × ${Number(meta.levels ?? 1)}`,
    description: "Сразу закрывает уровни Teddy Pass. Награда платной дорожки — только если пропуск куплен. 15⭐ за уровень.",
    stars: (ctx, _now, meta) => 15 * levelsOf(meta, ctx),
    reason: (ctx, now) => {
      if (!hasPass(ctx.user, now)) return "Сначала купи Teddy Pass";
      if (passLevelFromXp(ctx.user.data.passXp) >= 30) return "Пропуск уже на 30 уровне";
      return null;
    },
    show: (ctx, now) => hasPass(ctx.user, now) && passLevelFromXp(ctx.user.data.passXp) < 30,
    shape: (ctx, _now, meta) => ({ levels: levelsOf(meta, ctx) }),
    apply: (ctx, now, meta) => {
      if (!hasPass(ctx.user, now)) throw new GameError("Нет пропуска");
      const n = levelsOf(meta, ctx);
      if (passLevelFromXp(ctx.user.data.passXp) >= 30) throw new GameError("Уже 30 уровень");
      const amount = n * 80;
      ctx.user.data.passXp += amount;
      return [{ op: "passxp", amount }];
    },
  },
  {
    sku: "storm_20",
    group: "clan",
    title: () => "Шторм клана 4 часа",
    description: "+20% к тапу и пассиву всем, кто сейчас в клане. Не складывается с более сильным штормом, время продлевается.",
    stars: () => 150,
    reason: (ctx, now) => stormReason(ctx, now),
    show: (ctx) => Boolean(ctx.clan),
    apply: (ctx, now) => applyStorm(ctx, now, 20, 4),
  },
  {
    sku: "storm_30",
    group: "clan",
    title: () => "Шторм клана 8 часов",
    description: "+30% всему клану на 8 часов. Если уже есть слабее — заменяет процент и ставит новое время.",
    stars: () => 300,
    reason: (ctx, now) => stormReason(ctx, now),
    show: (ctx) => Boolean(ctx.clan),
    apply: (ctx, now) => applyStorm(ctx, now, 30, 8),
  },
  {
    sku: "newbie",
    group: "offer",
    title: () => "Набор новичка",
    description: "Полный бак, x2 на час, автопилот на час, окрас «Первая берлога» и 20 000 мёда. Один раз, первые 72 часа.",
    stars: () => 75,
    reason: (ctx, now) => {
      if (ctx.user.data.newbieBought) return "Уже куплен";
      if (now - ctx.user.createdAt > 72 * 3_600_000) return "72 часа с первого входа прошли";
      return null;
    },
    show: (ctx, now) => !ctx.user.data.newbieBought && now - ctx.user.createdAt <= 72 * 3_600_000,
    apply: (ctx, now) => {
      if (ctx.user.data.newbieBought) throw new GameError("Набор уже куплен");
      if (now - ctx.user.createdAt > 72 * 3_600_000) throw new GameError("Набор новичка уже недоступен");
      ctx.user.data.newbieBought = true;
      const grants: Grant[] = [{ op: "newbie" }, fillEnergy(ctx.user, now)];
      extendTimer(ctx.user, "x2Until", 3_600_000, now);
      grants.push({ op: "x2", ms: 3_600_000 });
      extendTimer(ctx.user, "autopilotUntil", 3_600_000, now);
      grants.push({ op: "autopilot", ms: 3_600_000 });
      if (giveSkin(ctx.user, "firstden")) grants.push({ op: "skin", id: "firstden" });
      ctx.user.coins += 20_000;
      grants.push({ op: "coins", amount: 20_000 });
      return grants;
    },
  },
  {
    sku: "offer",
    group: "offer",
    title: (_ctx, now) => currentOffer(now)?.title ?? "Набор",
    description: (_ctx, now) => currentOffer(now)?.description ?? "Лимитированный набор с фиксированным составом.",
    stars: (_ctx, now) => currentOffer(now)?.stars ?? 0,
    reason: (ctx, now, meta) => {
      const offer = currentOffer(now);
      if (!offer) return "Сейчас нет лимитированного набора";
      const id = String(meta.offerId ?? offer.id);
      if (id !== offer.id) return "Этот набор уже закончился";
      if (ownedOffer(ctx.user, offer.id)) return "Уже куплен";
      return null;
    },
    show: (_ctx, now) => currentOffer(now) != null,
    shape: (_ctx, now) => {
      const offer = currentOffer(now);
      return offer ? { offerId: offer.id } : {};
    },
    apply: (ctx, now, meta) => {
      const offer = currentOffer(now);
      const id = String(meta.offerId ?? "");
      if (!offer || offer.id !== id) throw new GameError("Набор уже закончился");
      if (ownedOffer(ctx.user, id)) throw new GameError("Набор уже куплен");
      markOffer(ctx.user, id);
      const grants: Grant[] = [{ op: "offer", id }];
      if (id.startsWith("night")) {
        extendTimer(ctx.user, "autopilotUntil", 6 * 3_600_000, now);
        grants.push({ op: "autopilot", ms: 6 * 3_600_000 });
        const add = Math.min(2, Math.max(0, 5 - ctx.user.data.tankTokens));
        ctx.user.data.tankTokens += add;
        if (add > 0) grants.push({ op: "tokens", n: add });
      } else {
        extendTimer(ctx.user, "x2Until", 8 * 3_600_000, now);
        grants.push({ op: "x2", ms: 8 * 3_600_000 });
        ctx.user.coins += 50_000;
        grants.push({ op: "coins", amount: 50_000 });
      }
      return grants;
    },
  },
  {
    sku: "freeze",
    group: "cosmetic",
    title: () => "Заморозка серии",
    description: "Один пропущенный день не сбрасывает серию. Лежит 7 дней. Не больше двух покупок в неделю.",
    stars: () => 25,
    reason: (ctx, now) => (paidFreezes(ctx.user, now) >= 2 ? "На этой неделе заморозки уже куплены" : null),
    apply: (ctx, now) => {
      const week = weekId(now);
      if (ctx.user.data.paidFreezeWeek !== week) {
        ctx.user.data.paidFreezeWeek = week;
        ctx.user.data.paidFreezeCount = 0;
      }
      if (ctx.user.data.paidFreezeCount >= 2) throw new GameError("Лимит заморозок на неделю");
      ctx.user.data.paidFreezeCount += 1;
      const exp = now + 7 * DAY;
      ctx.user.data.freezes.push({ exp });
      return [{ op: "freeze", exp }];
    },
  },
  {
    sku: "frame_caramel",
    group: "cosmetic",
    title: () => "Карамельная рамка",
    description: "Рамка в профиле и в топе. На мёд не влияет.",
    stars: () => 50,
    reason: (ctx) => (ctx.user.data.frames.includes("caramel") ? "Уже куплена" : null),
    apply: (ctx) => {
      if (ctx.user.data.frames.includes("caramel")) throw new GameError("Рамка уже есть");
      ctx.user.data.frames.push("caramel");
      ctx.user.data.frame = "caramel";
      ctx.user.data.frameUntil = 0;
      return [{ op: "frame", id: "caramel" }];
    },
  },
  {
    sku: "color_honey",
    group: "cosmetic",
    title: () => "Медовый цвет имени",
    description: "Цвет ника в рейтинге. Только косметика.",
    stars: () => 100,
    reason: (ctx) => (ctx.user.data.nameColor === "honey" ? "Уже включён" : null),
    apply: (ctx) => {
      ctx.user.data.nameColor = "honey";
      return [{ op: "color", id: "honey" }];
    },
  },
];

for (const skin of SKINS) {
  if (skin.currency !== "stars" || !skin.shop) continue;
  SPECS.push({
    sku: `skin_${skin.id}`,
    group: "cosmetic",
    title: () => skin.name,
    description: `${skin.blurb}. Конкретный окрас, не случайный ящик. Бонус растёт с уровнем.`,
    stars: () => skin.price,
    reason: (ctx) => {
      if (ctx.user.data.skins.includes(skin.id)) return "Уже есть";
      if (ctx.user.level < skin.minLevel) return `С ${skin.minLevel} уровня`;
      return null;
    },
    apply: (ctx) => {
      const def = skinById(skin.id);
      if (!def) throw new GameError("Нет окраса");
      if (ctx.user.data.skins.includes(def.id)) throw new GameError("Окрас уже куплен");
      if (ctx.user.level < def.minLevel) throw new GameError(`Окрас откроется на ${def.minLevel} уровне`);
      giveSkin(ctx.user, def.id);
      ctx.user.skinId = def.id;
      return [{ op: "skin", id: def.id }];
    },
  });
}

function stormReason(ctx: Ctx, now: number): string | null {
  if (!ctx.clan) return "Сначала вступи в клан";
  if (now - ctx.user.data.clanJoinedAt < 2 * 3_600_000) return "Шторм можно через 2 часа после входа";
  const day = utcDay(now);
  const count = ctx.clan.data.stormDay === day ? ctx.clan.data.stormCount : 0;
  if (count >= 3) return "Сегодня у клана уже три шторма";
  return null;
}

function applyStorm(ctx: Ctx, now: number, pct: number, hours: number): Grant[] {
  const why = stormReason(ctx, now);
  if (why) throw new GameError(why);
  const clan = ctx.clan!;
  const day = utcDay(now);
  if (clan.data.stormDay !== day) {
    clan.data.stormDay = day;
    clan.data.stormCount = 0;
  }
  const active = clan.data.stormUntil > now;
  if (!active) {
    clan.data.stormPct = pct;
    clan.data.stormUntil = now + hours * 3_600_000;
  } else if (pct > clan.data.stormPct) {
    clan.data.stormPct = pct;
    clan.data.stormUntil = now + hours * 3_600_000;
  } else {
    clan.data.stormUntil += hours * 3_600_000;
  }
  clan.data.stormCount += 1;
  ctx.clanDirty = true;
  return [{ op: "storm" }];
}

function describe(spec: Spec, ctx: Ctx, now: number, meta: Record<string, unknown>): string {
  const text = typeof spec.description === "function" ? spec.description(ctx, now, meta) : spec.description;
  return text.slice(0, 255);
}

function specBySku(sku: string): Spec {
  const spec = SPECS.find((item) => item.sku === sku);
  if (!spec) throw new GameError("Нет такого товара");
  return spec;
}

export function quoteSku(ctx: Ctx, sku: string, meta: Record<string, unknown> | undefined, now: number): Quote {
  const spec = specBySku(sku);
  const input = metaOf(meta);
  const why = spec.reason(ctx, now, input);
  if (why) throw new GameError(why);
  const shaped = spec.shape ? spec.shape(ctx, now, input) : {};
  const stars = spec.stars(ctx, now, { ...input, ...shaped });
  if (!Number.isFinite(stars) || stars <= 0) throw new GameError("Товар сейчас недоступен");
  return {
    sku,
    group: spec.group,
    title: spec.title(ctx, now, { ...input, ...shaped }).slice(0, 32),
    description: describe(spec, ctx, now, { ...input, ...shaped }),
    stars,
    meta: shaped,
  };
}

export function applySku(ctx: Ctx, sku: string, meta: Record<string, unknown> | undefined, now: number): Grant[] {
  const spec = specBySku(sku);
  const input = metaOf(meta);
  return spec.apply(ctx, now, input);
}

export function listProducts(ctx: Ctx, now: number): ProductView[] {
  const views: ProductView[] = [];
  for (const spec of SPECS) {
    if (spec.show && !spec.show(ctx, now)) continue;
    const shaped = spec.shape ? spec.shape(ctx, now, {}) : {};
    const why = spec.reason(ctx, now, shaped);
    let stars: number | null = null;
    if (!why) {
      try {
        const value = spec.stars(ctx, now, shaped);
        stars = value > 0 ? value : null;
      } catch {
        stars = null;
      }
    }
    views.push({
      sku: spec.sku,
      group: spec.group,
      title: spec.title(ctx, now, shaped),
      description: describe(spec, ctx, now, shaped),
      stars,
      reason: why ?? undefined,
    });
  }
  return views;
}

export function revertGrants(ctx: Ctx, grants: Grant[], now: number): void {
  for (const grant of [...grants].reverse()) {
    const user = ctx.user;
    switch (grant.op) {
      case "coins":
        user.coins = Math.max(0, user.coins - grant.amount);
        break;
      case "energy":
        if (user.data.tapCount === grant.taps) user.data.energy = Math.min(user.data.energy, grant.before);
        else user.data.reviewFlag = true;
        break;
      case "multitap":
        user.data.multitap = Math.max(1, user.data.multitap - 1);
        user.data.starMtap = Math.max(0, user.data.starMtap - 1);
        break;
      case "x2":
        user.data.x2Until = Math.max(0, user.data.x2Until - grant.ms);
        break;
      case "autopilot":
        user.data.autopilotUntil = Math.max(0, user.data.autopilotUntil - grant.ms);
        break;
      case "autotap":
        if (user.data.autotapUntil > now) user.data.autotapUntil = Math.max(now, user.data.autotapUntil - grant.ms);
        else user.data.autotapPauseLeft = Math.max(0, user.data.autotapPauseLeft - grant.ms);
        break;
      case "skin":
        user.data.skins = user.data.skins.filter((id) => id !== grant.id);
        if (user.data.skinState) delete user.data.skinState[grant.id];
        if (!user.data.skins.includes("classic")) user.data.skins.unshift("classic");
        if (!user.data.skinState.classic) user.data.skinState.classic = { level: 1, shards: 0 };
        if (user.skinId === grant.id) user.skinId = "classic";
        break;
      case "pass":
        if (user.data.passSeason === grant.season) user.data.passSeason = 0;
        break;
      case "freeze":
        user.data.freezes = user.data.freezes.filter((item) => item.exp !== grant.exp);
        break;
      case "tokens":
        user.data.tankTokens = Math.max(0, user.data.tankTokens - grant.n);
        break;
      case "frame":
        user.data.frames = user.data.frames.filter((id) => id !== grant.id);
        if (user.data.frame === grant.id) {
          user.data.frame = null;
          user.data.frameUntil = 0;
        }
        break;
      case "color":
        if (user.data.nameColor === grant.id) user.data.nameColor = null;
        break;
      case "badge":
        user.data.badges = user.data.badges.filter((id) => id !== grant.id);
        break;
      case "storm":
        if (ctx.clan) {
          ctx.clan.data.stormUntil = now;
          ctx.clan.data.stormPct = 0;
          ctx.clan.data.stormCount = Math.max(0, ctx.clan.data.stormCount - 1);
          ctx.clanDirty = true;
        }
        break;
      case "passxp": {
        user.data.passXp = Math.max(0, user.data.passXp - grant.amount);
        const level = passLevelFromXp(user.data.passXp);
        user.data.passClaimedFree = Math.min(user.data.passClaimedFree, level);
        user.data.passClaimedPaid = Math.min(user.data.passClaimedPaid, level);
        break;
      }
      case "offer":
        user.data.offers = user.data.offers.filter((id) => id !== grant.id);
        break;
      case "newbie":
        user.data.newbieBought = true;
        break;
      default:
        break;
    }
  }
}

export function openInvoice(userId: number, sku: string, meta: Record<string, unknown> | undefined, now: number): { purchase: Purchase; quote: Quote } {
  const user = mustUser(userId);
  const ctx = ctxFor(user);
  prepare(ctx, now);
  const quote = quoteSku(ctx, sku, meta, now);
  const id = insertPurchase({
    userId,
    sku,
    stars: quote.stars,
    status: "pending",
    grants: [],
    meta: quote.meta,
    title: quote.title,
    createdAt: now,
  });
  commit(ctx);
  const purchase = getPurchase(id);
  if (!purchase) throw new GameError("Не удалось создать счёт");
  return { purchase, quote };
}

export function assertPayable(payload: string, stars: number, userId: number, now: number): void {
  const purchase = getPurchaseByPayload(payload);
  if (!purchase || purchase.status !== "pending") throw new GameError("Счёт устарел");
  if (purchase.userId !== userId) throw new GameError("Счёт другого игрока");
  if (purchase.stars !== stars) throw new GameError("Сумма изменилась");
  const user = mustUser(purchase.userId);
  const ctx = ctxFor(user);
  prepare(ctx, now);
  quoteSku(ctx, purchase.sku, purchase.meta, now);
  commit(ctx);
}

export function fulfillPurchase(payload: string, chargeId: string, userId: number, stars: number, now: number): Purchase {
  const existing = getPurchaseByCharge(chargeId);
  if (existing?.status === "paid") return existing;
  const purchase = getPurchaseByPayload(payload);
  if (!purchase) throw new GameError("Счёт не найден");
  if (purchase.status === "paid") return purchase;
  if (purchase.userId !== userId) throw new GameError("Счёт другого игрока");
  if (purchase.stars !== stars) throw new GameError("Сумма не сходится");
  const user = mustUser(purchase.userId);
  const ctx = ctxFor(user);
  prepare(ctx, now);
  let grants: Grant[] = [];
  try {
    quoteSku(ctx, purchase.sku, purchase.meta, now);
    grants = applySku(ctx, purchase.sku, purchase.meta, now);
  } catch (error) {
    user.data.reviewFlag = true;
    console.error("[pay] не вышло выдать товар", purchase.id, error instanceof Error ? error.message : error);
  }
  purchase.status = "paid";
  purchase.chargeId = chargeId;
  purchase.paidAt = now;
  purchase.grants = grants;
  noteFriendPurchase(user, now);
  savePurchase(purchase);
  commit(ctx);
  return purchase;
}

export function grantDevPurchase(userId: number, sku: string, meta: Record<string, unknown> | undefined, now: number): Purchase {
  const user = mustUser(userId);
  const ctx = ctxFor(user);
  prepare(ctx, now);
  const quote = quoteSku(ctx, sku, meta, now);
  const grants = applySku(ctx, sku, quote.meta, now);
  const id = insertPurchase({
    userId,
    sku,
    stars: quote.stars,
    status: "paid",
    grants,
    meta: quote.meta,
    title: quote.title,
    createdAt: now,
  });
  const purchase = getPurchase(id);
  if (!purchase) throw new GameError("Покупка не сохранилась");
  purchase.chargeId = `dev_${id}`;
  purchase.paidAt = now;
  savePurchase(purchase);
  noteFriendPurchase(user, now);
  commit(ctx);
  return purchase;
}

export function refundPurchase(chargeId: string, now: number): Purchase {
  const purchase = getPurchaseByCharge(chargeId);
  if (!purchase || purchase.status !== "paid") throw new GameError("Оплаченный счёт не найден");
  const user = mustUser(purchase.userId);
  const ctx = ctxFor(user);
  prepare(ctx, now);
  revertGrants(ctx, purchase.grants, now);
  purchase.status = "refunded";
  savePurchase(purchase);
  commit(ctx);
  return purchase;
}
