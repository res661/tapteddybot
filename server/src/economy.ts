import crypto from "node:crypto";
import { CARDS, type CardDef } from "./catalog.js";
import type { Clan, User } from "./types.js";

export const DAY = 86_400_000;
export const SEASON_MS = 14 * DAY;
/** Понедельник 00:00 UTC, от него считаются сезоны по 14 дней. */
export const SEASON_EPOCH = Date.parse("2026-01-05T00:00:00Z");
export const TAP_RATE = 12;
export const TAP_BURST = 16;
export const REGEN_MIN_MS = 1200;
export const STAR_MTAP_PRICES = [50, 100, 150, 250, 400] as const;

export function utcDay(now: number): string {
  return new Date(now).toISOString().slice(0, 10);
}

export function shiftDay(day: string, delta: number): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) + delta * DAY).toISOString().slice(0, 10);
}

export function weekId(now: number): string {
  const d = new Date(now);
  const midnight = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  const sinceMon = (d.getUTCDay() + 6) % 7;
  return new Date(midnight - sinceMon * DAY).toISOString().slice(0, 10);
}

export function seasonId(now: number): number {
  return Math.floor((now - SEASON_EPOCH) / SEASON_MS);
}

export function seasonEndsAt(now: number): number {
  return SEASON_EPOCH + (seasonId(now) + 1) * SEASON_MS;
}

export function xpToAdvance(level: number): number {
  return Math.floor(2000 * Math.pow(level, 1.55));
}

export function energyUpgradeCost(level: number): number {
  return Math.floor(800 * Math.pow(1.45, level - 1));
}

export function multitapCost(level: number): number {
  return Math.floor(1000 * Math.pow(1.55, level - 1));
}

export function regenUpgradeCost(level: number): number {
  return Math.floor(700 * Math.pow(1.42, level - 1));
}

export function cardUpgradeCost(basePrice: number, currentLevel: number): number {
  return Math.floor(basePrice * Math.pow(1.32, currentLevel));
}

export function refillPrice(countToday: number): number {
  if (countToday >= 12) return 100;
  if (countToday >= 8) return 50;
  return 25;
}

export function starMtapPrice(bought: number): number | null {
  if (bought < 0 || bought >= STAR_MTAP_PRICES.length) return null;
  return STAR_MTAP_PRICES[bought];
}

export function maxMultitap(level: number): number {
  return 3 + level;
}

export function cardLevel(user: User, id: string): number {
  return user.data.cards[id]?.level ?? 0;
}

export function hasPass(user: User, now: number): boolean {
  return user.data.passSeason !== 0 && user.data.passSeason === seasonId(now);
}

export function energyCap(user: User, now: number): number {
  let bonus = user.data.bonusEnergy;
  if (user.data.seasonEnergyBonusSeason === seasonId(now)) bonus += user.data.seasonEnergyBonus;
  let extra = 0;
  for (const card of CARDS) {
    if (card.kind === "energy") extra += card.base * cardLevel(user, card.id);
  }
  return 2000 + 250 * (user.data.energyLevel - 1) + 20 * (user.level - 1) + bonus + extra;
}

export function tapCardFraction(user: User): number {
  let sum = 0;
  for (const card of CARDS) {
    if (card.kind === "tap") sum += (card.base / 100) * cardLevel(user, card.id);
  }
  return Math.min(3, sum);
}

export function regenCardFraction(user: User): number {
  let sum = 0;
  for (const card of CARDS) {
    if (card.kind === "regen") sum += (card.base / 100) * cardLevel(user, card.id);
  }
  return sum;
}

export function passivePerHour(user: User): number {
  let sum = 0;
  for (const card of CARDS) {
    if (card.kind === "income") sum += card.base * cardLevel(user, card.id);
  }
  return sum;
}

export function boostMult(user: User, clan: Clan | null, now: number): number {
  const x2 = user.data.x2Until > now ? 2 : 1;
  const pass = hasPass(user, now) ? 1.2 : 1;
  let clanAdd = 0;
  if (clan && clan.data.stormUntil > now) clanAdd += clan.data.stormPct / 100;
  if (clan && clan.data.buffUntil > now) clanAdd += clan.data.buffPct / 100;
  return x2 * pass * (1 + clanAdd);
}

export function tapValue(user: User, clan: Clan | null, now: number): number {
  const raw = user.data.multitap * (1 + tapCardFraction(user)) * boostMult(user, clan, now);
  return Math.max(1, Math.floor(raw));
}

export function regenIntervalMs(user: User): number {
  let rate = 0.5 * (1 + 0.04 * (user.data.regenLevel - 1));
  rate *= 1 + regenCardFraction(user);
  return Math.max(REGEN_MIN_MS, Math.round(1000 / rate));
}

export function passiveCapMs(user: User, now: number): number {
  return (hasPass(user, now) ? 8 : 3) * 3_600_000;
}

export interface TokenState {
  tokens: number;
  at: number;
}

/** Ведро: запас 16, пополнение 12/сек. Пачка тапов за долгое отсутствие не копится выше 16. */
export function consumeTapTokens(state: TokenState, now: number, requested: number): number {
  const elapsed = Math.max(0, now - state.at);
  const regen = (elapsed / 1000) * TAP_RATE;
  state.tokens = Math.min(TAP_BURST, state.tokens + regen);
  const take = Math.max(0, Math.min(Math.floor(requested), Math.floor(state.tokens)));
  state.tokens -= take;
  state.at = now;
  return take;
}

export function regenEnergy(user: User, now: number): void {
  const cap = energyCap(user, now);
  if (user.data.energy >= cap) {
    user.data.energy = cap;
    user.data.energyAt = now;
    return;
  }
  const interval = regenIntervalMs(user);
  const elapsed = Math.max(0, now - user.data.energyAt);
  const gained = Math.floor(elapsed / interval);
  if (gained <= 0) return;
  const next = Math.min(cap, user.data.energy + gained);
  const used = next - user.data.energy;
  user.data.energy = next;
  user.data.energyAt = next >= cap ? now : user.data.energyAt + used * interval;
}

export interface StreakReward {
  coins: number;
  token?: boolean;
  x2min?: number;
  frame?: boolean;
}

export function streakReward(day: number): StreakReward {
  switch (day) {
    case 1:
      return { coins: 500 };
    case 2:
      return { coins: 1000 };
    case 3:
      return { coins: 2000, token: true };
    case 4:
      return { coins: 3500 };
    case 5:
      return { coins: 5000 };
    case 6:
      return { coins: 8000 };
    case 7:
      return { coins: 15000, x2min: 30, frame: true };
    default:
      return { coins: 0 };
  }
}

export function canSaveStreak(user: User, now: number): boolean {
  if (!user.data.streakLast || user.data.streakDay <= 0) return false;
  const today = utcDay(now);
  if (user.data.streakLast === today || user.data.streakLast === shiftDay(today, -1)) return false;
  const last = Date.parse(`${user.data.streakLast}T00:00:00Z`);
  return now >= last + 2 * DAY && now < last + 3 * DAY;
}

export function nextStreakDay(user: User, now: number): number {
  if (!user.data.streakLast) return 1;
  const yesterday = shiftDay(utcDay(now), -1);
  if (user.data.streakLast === yesterday) return user.data.streakDay >= 7 ? 1 : user.data.streakDay + 1;
  return 1;
}

export function codeReward(level: number): number {
  return Math.min(70_000, 10_000 + 2_000 * level);
}

export function comboReward(level: number): number {
  return 25_000 + 3_000 * level;
}

export function clanLevelFromTotal(points: number): number {
  return Math.min(13, 1 + Math.floor(points / 300_000));
}

export function clanMemberCap(level: number): number {
  return Math.min(150, 30 + 10 * (level - 1));
}

export function passLevelFromXp(xp: number): number {
  return Math.min(30, Math.floor(xp / 80));
}

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function dailyCode(day: string, salt: string): string {
  const hash = crypto.createHmac("sha256", salt).update(`code:${day}`).digest();
  let out = "";
  for (let i = 0; i < 4; i++) out += ALPHABET[hash[i]! % ALPHABET.length];
  return out;
}

export function dailyCombo(day: string, salt: string): string[] {
  const ids = CARDS.filter((c) => c.category === "den" && c.kind === "income").map((c) => c.id);
  const hash = crypto.createHmac("sha256", salt).update(`combo:${day}`).digest();
  const picked: string[] = [];
  for (let i = 0; i < hash.length && picked.length < 3; i++) {
    const id = ids[hash[i]! % ids.length]!;
    if (!picked.includes(id)) picked.push(id);
  }
  return picked;
}

export interface LiveOffer {
  id: string;
  title: string;
  description: string;
  stars: number;
  startsAt: number;
  endsAt: number;
}

export function currentOffer(now: number): LiveOffer | null {
  const monday = Date.parse(`${weekId(now)}T00:00:00Z`);
  const windows: LiveOffer[] = [
    {
      id: `night-${utcDay(monday + 2 * DAY)}`,
      title: "Ночная смена",
      description: "Автопилот на 6 часов и 2 жетона полного бака. Состав фиксированный.",
      stars: 200,
      startsAt: monday + 2 * DAY + 16 * 3_600_000,
      endsAt: monday + 2 * DAY + 16 * 3_600_000 + DAY,
    },
    {
      id: `rush-${utcDay(monday + 5 * DAY)}`,
      title: "Рывок сезона",
      description: "x2 на 8 часов и 50 000 мёда. Мёд из набора не даёт опыт и не идёт в сезон.",
      stars: 175,
      startsAt: monday + 5 * DAY + 10 * 3_600_000,
      endsAt: monday + 5 * DAY + 10 * 3_600_000 + DAY,
    },
  ];
  return windows.find((w) => now >= w.startsAt && now < w.endsAt) ?? null;
}

export function incomeCards(): CardDef[] {
  return CARDS.filter((c) => c.kind === "income");
}
