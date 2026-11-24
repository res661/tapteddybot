import { CATEGORIES, CARDS, FREE_TRACK, PAID_TRACK, SKINS, cardById, cardEffect } from "./catalog.js";
import { config } from "./config.js";
import {
  boostMult,
  canSaveStreak,
  cardLevel,
  cardUpgradeCost,
  clanMemberCap,
  codeReward,
  comboReward,
  currentOffer,
  dailyCombo,
  energyCap,
  energyUpgradeCost,
  hasPass,
  maxMultitap,
  multitapCost,
  passiveCapMs,
  passivePerHour,
  passLevelFromXp,
  refillPrice,
  regenIntervalMs,
  regenUpgradeCost,
  seasonEndsAt,
  starMtapPrice,
  streakReward,
  tapCardFraction,
  tapValue,
  utcDay,
} from "./economy.js";
import { dailySalt, cardsTouchedToday } from "./progress.js";
import { listProducts } from "./stars.js";
import {
  clanRank,
  countClanMembers,
  countQualified,
  countReferrals,
  getClan,
  listClanMembers,
  listFriends,
  soloRank,
} from "./store.js";
import type { User } from "./types.js";

const BADGE_ORDER = ["season", "veteran", "pass", "lvl30", "hive"];

function bestBadge(badges: string[]): string | null {
  return BADGE_ORDER.find((id) => badges.includes(id)) ?? badges[0] ?? null;
}

function referralLink(userId: number): string {
  return `https://t.me/${config().botUsername}?startapp=ref_${userId}`;
}

export interface FullDTO {
  now: number;
  channelUrl: string;
  me: {
    id: number;
    name: string;
    username: string | null;
    coins: number;
    level: number;
    xp: number;
    xpNeed: number;
    energy: number;
    energyMax: number;
    regenMs: number;
    multitap: number;
    perTap: number;
    tapCardsPct: number;
    boost: number;
    skin: string;
    badge: string | null;
    frame: string | null;
    nameColor: string | null;
    tankTokens: number;
    createdAt: number;
    tapCount: number;
  };
  streak: {
    day: number;
    claimedToday: boolean;
    canSave: boolean;
    freezes: number;
    rewards: { day: number; coins: number; extra: string }[];
  };
  passive: { bank: number; perHour: number; capHours: number };
  timers: { x2Until: number; autopilotUntil: number; autotapUntil: number; autotapPausedMs: number };
  clanBuff: { stormUntil: number; stormPct: number; buffUntil: number; buffPct: number };
  refill: { price: number; show: boolean; count: number };
  daily: {
    codeUnlocked: boolean;
    codeDone: boolean;
    codeReward: number;
    combo: { id: string; name: string; done: boolean }[];
    comboDone: boolean;
    comboReward: number;
  };
  pass: {
    seasonId: number;
    endsAt: number;
    owned: boolean;
    level: number;
    xpInto: number;
    xpPerLevel: number;
    claimedFree: number;
    claimedPaid: number;
    tracks: { level: number; free: string | null; paid: string | null }[];
  };
  upgrades: {
    multitap: { level: number; cost: number | null; capped: boolean; starPrice: number | null; starReadyAt: number };
    energy: { level: number; cost: number | null; nextCap: number };
    regen: { level: number; cost: number | null };
  };
  categories: {
    id: string;
    name: string;
    blurb: string;
    minLevel: number;
    locked: boolean;
    cards: {
      id: string;
      name: string;
      kind: string;
      level: number;
      max: number;
      effect: string;
      next: string;
      cost: number | null;
      locked: boolean;
      minLevel: number;
    }[];
  }[];
  skins: {
    id: string;
    name: string;
    blurb: string;
    filter: string;
    price: number;
    currency: string;
    rarity: string;
    owned: boolean;
    equipped: boolean;
    locked: boolean;
    minLevel: number;
    shop: boolean;
  }[];
  products: ReturnType<typeof listProducts>;
  newbie: { available: boolean; until: number } | null;
  offer: { id: string; title: string; description: string; stars: number; until: number } | null;
  clan: null | {
    id: number;
    name: string;
    code: string;
    link: string;
    level: number;
    members: number;
    cap: number;
    weekPoints: number;
    seasonPoints: number;
    totalPoints: number;
    rankSeason: number;
    stormPct: number;
    stormUntil: number;
    buffPct: number;
    buffUntil: number;
    flag: string | null;
    owner: boolean;
    chat: string | null;
    top: { id: number; name: string; points: number; level: number }[];
  };
  friends: {
    link: string;
    total: number;
    qualified: number;
    list: { id: number; name: string; level: number; qualified: boolean; taps: number }[];
    milestones: { n: number; label: string; done: boolean }[];
  };
  rankSeason: number;
}

export function present(user: User, now: number): FullDTO {
  const clan = user.clanId ? getClan(user.clanId) : null;
  const today = utcDay(now);
  const cap = energyCap(user, now);
  const perTap = tapValue(user, clan, now);
  const hour = Math.round(passivePerHour(user) * boostMult(user, clan, now));
  const comboIds = dailyCombo(today, dailySalt());
  const refillCount = user.data.refillDay === today ? user.data.refillCount : 0;
  const offer = currentOffer(now);
  const ownedPass = hasPass(user, now);
  const passLevel = passLevelFromXp(user.data.passXp);
  const tracks = Array.from({ length: 30 }, (_, index) => {
    const level = index + 1;
    return { level, free: FREE_TRACK[level] ?? null, paid: PAID_TRACK[level] ?? null };
  });
  const starPrice = starMtapPrice(user.data.starMtap);
  const mtapCapped = user.data.multitap >= maxMultitap(user.level);
  const products = listProducts({ user, clan, clanDirty: false }, now);

  return {
    now,
    channelUrl: config().channelUrl,
    me: {
      id: user.id,
      name: user.firstName,
      username: user.username,
      coins: user.coins,
      level: user.level,
      xp: user.data.xp,
      xpNeed: xpNeed(user.level),
      energy: user.data.energy,
      energyMax: cap,
      regenMs: regenIntervalMs(user),
      multitap: user.data.multitap,
      perTap,
      tapCardsPct: Math.round(tapCardFraction(user) * 100),
      boost: boostMult(user, clan, now),
      skin: user.skinId,
      badge: bestBadge(user.data.badges),
      frame: user.data.frameUntil > now || user.data.frameUntil === 0 ? user.data.frame : null,
      nameColor: user.data.nameColor,
      tankTokens: user.data.tankTokens,
      createdAt: user.createdAt,
      tapCount: user.data.tapCount,
    },
    streak: {
      day: user.data.streakDay,
      claimedToday: user.data.streakLast === today,
      canSave: canSaveStreak(user, now),
      freezes: user.data.freezes.length,
      rewards: [1, 2, 3, 4, 5, 6, 7].map((day) => {
        const reward = streakReward(day);
        const extra = [reward.token ? "жетон бака" : "", reward.x2min ? `x2 ${reward.x2min} мин` : "", reward.frame ? "рамка" : ""]
          .filter(Boolean)
          .join(", ");
        return { day, coins: reward.coins, extra };
      }),
    },
    passive: { bank: user.data.passiveBank, perHour: hour, capHours: passiveCapMs(user, now) / 3_600_000 },
    timers: {
      x2Until: user.data.x2Until,
      autopilotUntil: user.data.autopilotUntil,
      autotapUntil: user.data.autotapUntil,
      autotapPausedMs: user.data.autotapPauseLeft,
    },
    clanBuff: {
      stormUntil: clan?.data.stormUntil ?? 0,
      stormPct: clan && clan.data.stormUntil > now ? clan.data.stormPct : 0,
      buffUntil: clan?.data.buffUntil ?? 0,
      buffPct: clan && clan.data.buffUntil > now ? clan.data.buffPct : 0,
    },
    refill: { price: refillPrice(refillCount), show: cap > 0 && user.data.energy / cap < 0.3, count: refillCount },
    daily: {
      codeUnlocked: user.level >= 5,
      codeDone: user.data.codeDay === today,
      codeReward: codeReward(user.level),
      combo: comboIds.map((id) => ({
        id,
        name: cardById(id)?.name ?? id,
        done: cardsTouchedToday(user, [id], today),
      })),
      comboDone: user.data.comboDay === today,
      comboReward: comboReward(user.level),
    },
    pass: {
      seasonId: user.seasonId,
      endsAt: seasonEndsAt(now),
      owned: ownedPass,
      level: passLevel,
      xpInto: user.data.passXp % 80,
      xpPerLevel: 80,
      claimedFree: user.data.passClaimedFree,
      claimedPaid: user.data.passClaimedPaid,
      tracks,
    },
    upgrades: {
      multitap: {
        level: user.data.multitap,
        cost: mtapCapped ? null : multitapCost(user.data.multitap),
        capped: mtapCapped,
        starPrice: mtapCapped ? null : starPrice,
        starReadyAt: user.data.starMtapAt ? user.data.starMtapAt + 6 * 3_600_000 : 0,
      },
      energy: {
        level: user.data.energyLevel,
        cost: user.data.energyLevel >= 40 ? null : energyUpgradeCost(user.data.energyLevel),
        nextCap: 2000 + 250 * user.data.energyLevel + 20 * (user.level - 1),
      },
      regen: {
        level: user.data.regenLevel,
        cost: user.data.regenLevel >= 20 ? null : regenUpgradeCost(user.data.regenLevel),
      },
    },
    categories: CATEGORIES.map((category) => ({
      id: category.id,
      name: category.name,
      blurb: category.blurb,
      minLevel: category.minLevel,
      locked: user.level < category.minLevel,
      cards: CARDS.filter((card) => card.category === category.id).map((card) => {
        const level = cardLevel(user, card.id);
        const locked = user.level < Math.max(category.minLevel, card.minLevel);
        return {
          id: card.id,
          name: card.name,
          kind: card.kind,
          level,
          max: card.maxLevel,
          effect: level > 0 ? cardEffect(card, level) : "ещё не открыта",
          next: cardEffect(card, level + 1),
          cost: locked || level >= card.maxLevel ? null : cardUpgradeCost(card.price, level),
          locked,
          minLevel: card.minLevel,
        };
      }),
    })),
    skins: SKINS.map((skin) => ({
      id: skin.id,
      name: skin.name,
      blurb: skin.blurb,
      filter: skin.filter,
      price: skin.price,
      currency: skin.currency,
      rarity: skin.rarity,
      owned: user.data.skins.includes(skin.id),
      equipped: user.skinId === skin.id,
      locked: user.level < skin.minLevel,
      minLevel: skin.minLevel,
      shop: skin.shop,
    })),
    products,
    newbie:
      !user.data.newbieBought && now - user.createdAt <= 72 * 3_600_000
        ? { available: true, until: user.createdAt + 72 * 3_600_000 }
        : null,
    offer: offer && !user.data.offers.includes(offer.id) ? { id: offer.id, title: offer.title, description: offer.description, stars: offer.stars, until: offer.endsAt } : null,
    clan: clan
      ? {
          id: clan.id,
          name: clan.name,
          code: clan.code,
          link: `https://t.me/${config().botUsername}?startapp=clan_${clan.code}`,
          level: clan.level,
          members: countClanMembers(clan.id),
          cap: clanMemberCap(clan.level),
          weekPoints: clan.weekPoints,
          seasonPoints: clan.seasonPoints,
          totalPoints: clan.totalPoints,
          rankSeason: clanRank(clan, "season"),
          stormPct: clan.data.stormUntil > now ? clan.data.stormPct : 0,
          stormUntil: clan.data.stormUntil,
          buffPct: clan.data.buffUntil > now ? clan.data.buffPct : 0,
          buffUntil: clan.data.buffUntil,
          flag: clan.data.flag,
          owner: clan.ownerId === user.id,
          chat: clan.data.chatUsername ? `@${clan.data.chatUsername}` : clan.data.chatTitle,
          top: listClanMembers(clan.id)
            .map((member) => ({
              id: member.id,
              name: member.name,
              level: member.level,
              points: clan.data.contributions[String(member.id)] ?? 0,
            }))
            .sort((a, b) => b.points - a.points)
            .slice(0, 30),
        }
      : null,
    friends: {
      link: referralLink(user.id),
      total: countReferrals(user.id),
      qualified: countQualified(user.id),
      list: listFriends(user.id).map((friend) => ({
        id: friend.id,
        name: friend.name,
        level: friend.level,
        qualified: friend.qualified,
        taps: friend.taps,
      })),
      milestones: [
        { n: 5, label: "Значок улья", done: user.data.badges.includes("hive") },
        { n: 10, label: "Рамка друзей", done: user.data.frames.includes("friends") },
        { n: 25, label: "Окрас «Проводник»", done: user.data.skins.includes("conductor") },
      ],
    },
    rankSeason: soloRank(user, "season"),
  };
}

function xpNeed(level: number): number {
  return Math.floor(2000 * Math.pow(level, 1.55));
}

export interface LiteDTO {
  now: number;
  me: {
    coins: number;
    level: number;
    xp: number;
    xpNeed: number;
    energy: number;
    energyMax: number;
    regenMs: number;
    perTap: number;
    tapCount: number;
    tankTokens: number;
    multitap: number;
    boost: number;
  };
  passive: { bank: number; perHour: number; capHours: number };
  timers: FullDTO["timers"];
  clanBuff: FullDTO["clanBuff"];
  refill: FullDTO["refill"];
  streak: { day: number; claimedToday: boolean; canSave: boolean; freezes: number };
  gained: { taps: number; coins: number; perTap: number };
}

export function presentLite(user: User, gained: { accepted: number; coins: number; perTap: number }, now: number): LiteDTO {
  const full = present(user, now);
  return {
    now,
    me: {
      coins: full.me.coins,
      level: full.me.level,
      xp: full.me.xp,
      xpNeed: full.me.xpNeed,
      energy: full.me.energy,
      energyMax: full.me.energyMax,
      regenMs: full.me.regenMs,
      perTap: full.me.perTap,
      tapCount: full.me.tapCount,
      tankTokens: full.me.tankTokens,
      multitap: full.me.multitap,
      boost: full.me.boost,
    },
    passive: full.passive,
    timers: full.timers,
    clanBuff: full.clanBuff,
    refill: full.refill,
    streak: {
      day: full.streak.day,
      claimedToday: full.streak.claimedToday,
      canSave: full.streak.canSave,
      freezes: full.streak.freezes,
    },
    gained: { taps: gained.accepted, coins: gained.coins, perTap: gained.perTap },
  };
}
