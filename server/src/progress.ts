import crypto from "node:crypto";
import { FREE_TRACK, PAID_TRACK, SKINS, cardById, skinById } from "./catalog.js";
import { config } from "./config.js";
import {
  ACHIEVEMENTS,
  BOX_EVERY,
  DAY,
  TASKS,
  boostMult,
  canSaveStreak,
  cardUpgradeCost,
  clanLevelFromTotal,
  clanMemberCap,
  codeReward,
  comboReward,
  TAP_BURST,
  consumeTapTokens,
  dailyCode,
  dailyCombo,
  energyCap,
  energyUpgradeCost,
  hasPass,
  maxMultitap,
  multitapCost,
  nextStreakDay,
  passiveCapMs,
  passivePerHour,
  passLevelFromXp,
  rarityFromRoll,
  regenEnergy,
  regenUpgradeCost,
  seasonId,
  shardsOnDuplicate,
  skinMods,
  skinUpgradeCoins,
  skinUpgradeShards,
  streakReward,
  tapValue,
  utcDay,
  weekId,
  xpToAdvance,
} from "./economy.js";
import { GameError } from "./errors.js";
import {
  countClanMembers,
  countFp,
  countQualified,
  deleteClan,
  freshData,
  getClan,
  getClanByCode,
  getLink,
  getUser,
  insertClan,
  insertUser,
  listClanMemberIds,
  listClans,
  metaGet,
  metaSet,
  saveClan,
  saveUser,
  staleClanCount,
  clearLink,
} from "./store.js";
import type { Clan, User } from "./types.js";

export interface Ctx {
  user: User;
  clan: Clan | null;
  clanDirty: boolean;
}

export interface TapResult {
  accepted: number;
  coins: number;
  perTap: number;
  crits: number;
  combo: number;
  boxes: number;
  levelUp: boolean;
}

export interface DropInfo {
  id: string;
  name: string;
  rarity: string;
  duplicate: boolean;
  shards: number;
  filter: string;
  accessory: string;
  backdrop: string;
}

export function ctxFor(user: User): Ctx {
  return { user, clan: user.clanId ? getClan(user.clanId) : null, clanDirty: false };
}

export function commit(ctx: Ctx): void {
  saveUser(ctx.user);
  if (ctx.clan && ctx.clanDirty) saveClan(ctx.clan);
}

export function dailySalt(): string {
  if (config().dailyCodeSalt) return config().dailyCodeSalt;
  const existing = metaGet("daily_salt");
  if (existing) return existing;
  const salt = crypto.randomBytes(24).toString("hex");
  metaSet("daily_salt", salt);
  return salt;
}

export function grantXp(user: User, amount: number): void {
  if (amount <= 0) return;
  user.data.xp += amount;
  while (user.level < 500) {
    const need = xpToAdvance(user.level);
    if (user.data.xp < need) break;
    user.data.xp -= need;
    user.level += 1;
    if (user.level === 5 && !user.data.level5Granted) {
      user.data.level5Granted = true;
      user.data.bonusEnergy += 250;
    }
    if (user.level >= 30 && !user.data.veteranGranted) {
      user.data.veteranGranted = true;
      giveSkin(user, "veteran");
      if (!user.data.badges.includes("veteran")) user.data.badges.push("veteran");
    }
    if (user.level === 10) giveSkin(user, "berry");
    if (user.level === 20) giveSkin(user, "storm");
  }
}

/** play: тап и пассив. reward: дейли/код/комбо. soft: рефералка. stars: пакеты за Stars, без опыта. */
export function credit(user: User, amount: number, mode: "play" | "reward" | "soft" | "stars"): void {
  amount = Math.floor(amount);
  if (amount <= 0) return;
  user.coins += amount;
  if (mode === "play" || mode === "reward" || mode === "soft") grantXp(user, amount);
  if (mode === "play" || mode === "reward") {
    user.seasonScore += amount;
    user.data.weekScore += amount;
  }
}

export function extendTimer(user: User, key: "x2Until" | "autopilotUntil", ms: number, now: number): void {
  const current = user.data[key];
  user.data[key] = (current > now ? current : now) + ms;
  if (key === "autopilotUntil" && current <= now) user.data.autopilotAt = now;
}

export function addAutotap(user: User, ms: number, now: number): void {
  if (user.data.autotapUntil > now) {
    user.data.autotapUntil += ms;
    return;
  }
  user.data.autotapPauseLeft = Math.min(3 * 3_600_000, user.data.autotapPauseLeft + ms);
  if (!user.data.autotapPauseSince) user.data.autotapPauseSince = now;
}

function ensureUserClock(user: User, now: number): void {
  const sid = seasonId(now);
  if (user.seasonId !== sid) {
    user.seasonId = sid;
    user.seasonScore = 0;
    user.data.passXp = 0;
    user.data.passClaimedFree = 0;
    user.data.passClaimedPaid = 0;
  }
  const wid = weekId(now);
  if (user.data.weekId !== wid) {
    user.data.weekId = wid;
    user.data.weekScore = 0;
  }
  user.data.freezes = user.data.freezes.filter((f) => f.exp > now);
  if (user.data.frameUntil > 0 && user.data.frameUntil <= now) {
    user.data.frame = null;
    user.data.frameUntil = 0;
  }
  if (hasPass(user, now) && user.data.passFreezeWeek !== wid) {
    user.data.passFreezeWeek = wid;
    user.data.freezes.unshift({ exp: now + 7 * DAY });
  }
}

function addClanPoints(ctx: Ctx, amount: number): void {
  if (!ctx.clan || amount <= 0) return;
  ctx.clan.weekPoints += amount;
  ctx.clan.seasonPoints += amount;
  const key = String(ctx.user.id);
  ctx.clan.data.contributions[key] = (ctx.clan.data.contributions[key] ?? 0) + amount;
  ctx.clanDirty = true;
}

function addReferralCut(user: User, amount: number, now: number): void {
  if (!user.referrerId || user.data.reviewFlag) return;
  if (now - user.createdAt > 14 * DAY) return;
  user.data.refFrac += amount * 0.1;
  const whole = Math.floor(user.data.refFrac);
  if (whole <= 0) return;
  user.data.refFrac -= whole;
  const ref = getUser(user.referrerId);
  if (!ref) return;
  ensureUserClock(ref, now);
  credit(ref, whole, "soft");
  saveUser(ref);
}

function applyMilestones(ref: User, qualified: number): void {
  if (qualified >= 5 && !ref.data.badges.includes("hive")) ref.data.badges.push("hive");
  if (qualified >= 10 && !ref.data.frames.includes("friends")) ref.data.frames.push("friends");
  if (qualified >= 25) giveSkin(ref, "conductor");
}

export function qualifyReferral(user: User, now: number): void {
  if (user.refOk || !user.referrerId || user.data.reviewFlag) return;
  if (user.level < 3 || user.data.tapCount < 500) return;
  user.refOk = true;
  const ref = getUser(user.referrerId);
  if (!ref) return;
  ensureUserClock(ref, now);
  credit(ref, 5000, "soft");
  applyMilestones(ref, countQualified(ref.id) + 1);
  saveUser(ref);
}

export function maybeRollover(now: number): void {
  const wid = weekId(now);
  const sid = seasonId(now);
  if (staleClanCount(wid, sid) === 0) return;
  const clans = listClans();
  const prev = weekId(now - 7 * DAY);
  const ranked = clans.filter((c) => c.weekId === prev && c.weekPoints > 0).sort((a, b) => b.weekPoints - a.weekPoints);
  const rewarded = new Set<number>();
  const monday = Date.parse(`${wid}T00:00:00Z`);
  ranked.forEach((clan, index) => {
    const rank = index + 1;
    rolloverClan(clan, wid, sid);
    if (rank === 1) {
      clan.data.buffPct = 10;
      clan.data.buffUntil = monday + 12 * 3_600_000;
      clan.data.flag = "gold";
    } else if (rank <= 3) {
      clan.data.buffPct = 5;
      clan.data.buffUntil = monday + 8 * 3_600_000;
      clan.data.flag = "silver";
    } else if (ranked.length > 0 && rank / ranked.length <= 0.1) {
      clan.data.flag = "top10";
    }
    rewarded.add(clan.id);
    saveClan(clan);
  });
  for (const clan of clans) {
    if (rewarded.has(clan.id)) continue;
    if (clan.weekId !== wid || clan.seasonId !== sid) {
      rolloverClan(clan, wid, sid);
      saveClan(clan);
    }
  }
}

function rolloverClan(clan: Clan, wid: string, sid: number): void {
  if (clan.weekId !== wid) {
    clan.totalPoints += clan.weekPoints;
    clan.level = clanLevelFromTotal(clan.totalPoints);
    clan.weekPoints = 0;
    clan.weekId = wid;
    clan.data.contributions = {};
  }
  if (clan.seasonId !== sid) {
    clan.seasonPoints = 0;
    clan.seasonId = sid;
  }
}

function accrueBank(ctx: Ctx, now: number): void {
  const data = ctx.user.data;
  if (!data.passiveAt) data.passiveAt = now;
  const cap = passiveCapMs(ctx.user, now);
  const elapsed = Math.max(0, now - data.passiveAt);
  const room = Math.max(0, cap - data.passiveBankedMs);
  const slice = Math.min(room, elapsed);
  const perHour = passivePerHour(ctx.user) * boostMult(ctx.user, ctx.clan, now);
  const total = data.passiveFrac + perHour * (slice / 3_600_000);
  const whole = Math.floor(total);
  data.passiveBank += whole;
  data.passiveFrac = total - whole;
  data.passiveBankedMs += slice;
  data.passiveAt = now;
}

function rollDailyTasks(user: User, now: number): void {
  const today = utcDay(now);
  if (user.data.taskDay === today) return;
  user.data.taskDay = today;
  user.data.taskTaps = 0;
  user.data.taskBestCombo = 0;
  user.data.taskStreak = false;
  user.data.taskUpgrade = false;
  user.data.taskClaimed = [];
}

export function applyTapCount(ctx: Ctx, requested: number, now: number, opts: { ignoreBucket?: boolean; skipRegen?: boolean; combo?: boolean }): TapResult {
  const empty = { accepted: 0, coins: 0, perTap: tapValue(ctx.user, ctx.clan, now), crits: 0, combo: ctx.user.data.combo ?? 0, boxes: 0, levelUp: false };
  if (!opts.skipRegen) regenEnergy(ctx.user, now);
  let accepted = Math.max(0, Math.floor(requested));
  if (!opts.ignoreBucket) {
    const state = { tokens: ctx.user.data.tapTokens, at: ctx.user.data.tapTokensAt };
    accepted = consumeTapTokens(state, now, accepted);
    ctx.user.data.tapTokens = state.tokens;
    ctx.user.data.tapTokensAt = state.at;
  }
  const affordable = Math.min(accepted, ctx.user.data.energy);
  if (!opts.ignoreBucket && accepted > affordable) {
    ctx.user.data.tapTokens = Math.min(TAP_BURST, ctx.user.data.tapTokens + (accepted - affordable));
  }
  accepted = affordable;
  if (accepted <= 0) return empty;
  rollDailyTasks(ctx.user, now);
  const useCombo = opts.combo !== false;
  if (useCombo && now - (ctx.user.data.comboAt || 0) > 2500) ctx.user.data.combo = 0;
  const critChance = skinMods(ctx.user).crit;
  let coins = 0;
  let crits = 0;
  let perTap = 1;
  for (let i = 0; i < accepted; i++) {
    if (useCombo) {
      ctx.user.data.combo += 1;
      ctx.user.data.comboAt = now;
      if (ctx.user.data.combo > ctx.user.data.bestCombo) ctx.user.data.bestCombo = ctx.user.data.combo;
      if (ctx.user.data.combo > ctx.user.data.taskBestCombo) ctx.user.data.taskBestCombo = ctx.user.data.combo;
    }
    perTap = tapValue(ctx.user, ctx.clan, now);
    const crit = critChance > 0 && Math.random() < critChance;
    if (crit) crits += 1;
    coins += crit ? perTap * 3 : perTap;
  }
  const levelBefore = ctx.user.level;
  ctx.user.data.energy -= accepted;
  ctx.user.data.tapCount += accepted;
  ctx.user.data.taskTaps += accepted;
  ctx.user.data.energySpentMod += accepted;
  const cap = Math.max(1, energyCap(ctx.user, now));
  const chunks = Math.floor(ctx.user.data.energySpentMod / cap);
  if (chunks > 0) {
    ctx.user.data.passXp += chunks * 10;
    ctx.user.data.energySpentMod -= chunks * cap;
  }
  const boxesBefore = ctx.user.data.boxCharges;
  ctx.user.data.boxProgress += accepted;
  while (ctx.user.data.boxProgress >= BOX_EVERY && ctx.user.data.boxCharges < 5) {
    ctx.user.data.boxProgress -= BOX_EVERY;
    ctx.user.data.boxCharges += 1;
  }
  credit(ctx.user, coins, "play");
  addClanPoints(ctx, coins);
  addReferralCut(ctx.user, coins, now);
  return {
    accepted,
    coins,
    perTap,
    crits,
    combo: ctx.user.data.combo,
    boxes: ctx.user.data.boxCharges - boxesBefore,
    levelUp: ctx.user.level > levelBefore,
  };
}

function runAutopilot(ctx: Ctx, now: number): void {
  const until = ctx.user.data.autopilotUntil;
  if (until <= 0) return;
  let t = ctx.user.data.autopilotAt;
  if (t <= 0) t = Math.min(now, until);
  const end = Math.min(now, until);
  let steps = 0;
  while (t + 60_000 <= end && steps < 3000) {
    t += 60_000;
    steps += 1;
    const before = ctx.user.data.energy;
    regenEnergy(ctx.user, t);
    const gained = ctx.user.data.energy - before;
    const cap = energyCap(ctx.user, t);
    let spend = gained;
    if (gained <= 0 && ctx.user.data.energy >= cap) spend = ctx.user.data.energy;
    if (spend > 0) applyTapCount(ctx, spend, t, { ignoreBucket: true, skipRegen: true, combo: false });
  }
  ctx.user.data.autopilotAt = t;
  if (now >= until) ctx.user.data.autopilotUntil = 0;
}

function runAutotap(ctx: Ctx, now: number): void {
  const data = ctx.user.data;
  if (data.autotapPauseLeft > 0 && data.autotapPauseSince > 0 && now - data.autotapPauseSince > 3 * 3_600_000) {
    data.autotapPauseLeft = 0;
    data.autotapPauseSince = 0;
  }
  const fresh = now - data.autotapLastClient < 5_000;
  if (!fresh && data.autotapUntil > now) {
    data.autotapPauseLeft = Math.min(3 * 3_600_000, data.autotapPauseLeft + (data.autotapUntil - now));
    data.autotapUntil = 0;
    if (!data.autotapPauseSince) data.autotapPauseSince = now;
    return;
  }
  if (fresh && data.autotapPauseLeft > 0 && data.autotapUntil <= now) {
    data.autotapUntil = now + data.autotapPauseLeft;
    data.autotapPauseLeft = 0;
    data.autotapPauseSince = 0;
    data.autotapLastTick = now;
  }
  if (!(data.autotapUntil > now && fresh)) return;
  const from = data.autotapLastTick || now;
  const end = Math.min(now, data.autotapUntil);
  const n = Math.min(80, Math.floor(Math.max(0, end - from) / 1000 * 8));
  if (n > 0) {
    applyTapCount(ctx, n, now, { ignoreBucket: true });
    data.autotapLastTick = from + Math.ceil((n / 8) * 1000);
  } else if (data.autotapLastTick === 0) {
    data.autotapLastTick = now;
  }
  if (data.autotapUntil <= now) data.autotapUntil = 0;
}

export function prepare(ctx: Ctx, now: number, opts?: { active?: boolean }): void {
  ensureUserClock(ctx.user, now);
  rollDailyTasks(ctx.user, now);
  if (opts?.active) ctx.user.data.autotapLastClient = now;
  runAutopilot(ctx, now);
  regenEnergy(ctx.user, now);
  accrueBank(ctx, now);
  runAutotap(ctx, now);
}

export function syncUser(userId: number, input: { taps: number; batchId: string; active: boolean }, now: number): TapResult {
  maybeRollover(now);
  const user = mustUser(userId);
  const ctx = ctxFor(user);
  const duplicate = Boolean(input.batchId) && user.data.batches.includes(input.batchId);
  prepare(ctx, now, { active: input.active });
  let gained: TapResult = { accepted: 0, coins: 0, perTap: tapValue(user, ctx.clan, now), crits: 0, combo: user.data.combo ?? 0, boxes: 0, levelUp: false };
  const manual = !duplicate && input.taps > 0 && ctx.user.data.autotapUntil <= now;
  if (manual) {
    const taps = Math.max(0, Math.min(40, Math.floor(input.taps)));
    gained = applyTapCount(ctx, taps, now, {});
    if (input.batchId) {
      user.data.batches.push(input.batchId.slice(0, 64));
      if (user.data.batches.length > 40) user.data.batches.splice(0, user.data.batches.length - 40);
    }
  }
  qualifyReferral(user, now);
  commit(ctx);
  return gained;
}

export function mustUser(id: number): User {
  const user = getUser(id);
  if (!user) throw new GameError("Игрок не найден", 404);
  return user;
}

function spend(user: User, amount: number): void {
  if (user.coins < amount) throw new GameError("Не хватает мёда");
  user.coins -= amount;
}

export function buyUpgrade(ctx: Ctx, kind: "multitap" | "energy" | "regen"): void {
  const user = ctx.user;
  if (kind === "multitap") {
    if (user.data.multitap >= maxMultitap(user.level)) throw new GameError("Дальше мультитап откроется с уровнем");
    const cost = multitapCost(user.data.multitap);
    spend(user, cost);
    user.data.multitap += 1;
    user.data.taskUpgrade = true;
    return;
  }
  if (kind === "energy") {
    if (user.data.energyLevel >= 40) throw new GameError("Бак прокачан до потолка");
    const cost = energyUpgradeCost(user.data.energyLevel);
    spend(user, cost);
    user.data.energyLevel += 1;
    user.data.taskUpgrade = true;
    return;
  }
  if (user.data.regenLevel >= 20) throw new GameError("Реген прокачан до потолка");
  const cost = regenUpgradeCost(user.data.regenLevel);
  spend(user, cost);
  user.data.regenLevel += 1;
  user.data.taskUpgrade = true;
}

export function buyCard(ctx: Ctx, cardId: string, now: number): void {
  const card = cardById(cardId);
  if (!card) throw new GameError("Нет такой карты");
  const user = ctx.user;
  if (user.level < card.minLevel) throw new GameError(`Карта откроется на ${card.minLevel} уровне`);
  const current = user.data.cards[cardId]?.level ?? 0;
  if (current >= card.maxLevel) throw new GameError("Карта на максимуме");
  const cost = cardUpgradeCost(card.price, current);
  spend(user, cost);
  const today = utcDay(now);
  const prev = user.data.cards[cardId];
  const sameDay = prev?.day === today;
  user.data.cards[cardId] = {
    level: current + 1,
    day: today,
    dayLevels: (sameDay ? prev?.dayLevels ?? 0 : 0) + 1,
  };
  user.data.taskUpgrade = true;
}

export function claimStreak(ctx: Ctx, now: number): void {
  const user = ctx.user;
  const today = utcDay(now);
  if (user.data.streakLast === today) throw new GameError("Сегодняшняя награда уже у тебя");
  const day = nextStreakDay(user, now);
  const reward = streakReward(day);
  credit(user, reward.coins, "reward");
  if (reward.token) user.data.tankTokens = Math.min(5, user.data.tankTokens + 1);
  if (reward.x2min) extendTimer(user, "x2Until", reward.x2min * 60_000, now);
  if (reward.frame) {
    if (!user.data.frames.includes("week")) user.data.frames.push("week");
    user.data.frame = "week";
    user.data.frameUntil = now + 7 * DAY;
  }
  if ((day === 3 || day === 7) && user.data.boxCharges < 5) user.data.boxCharges += 1;
  user.data.taskStreak = true;
  user.data.passXp += 100;
  user.data.streakDay = day;
  user.data.streakLast = today;
}

export function saveStreak(ctx: Ctx, now: number): void {
  const user = ctx.user;
  if (!canSaveStreak(user, now)) throw new GameError("Серию уже не спасти, она начнётся заново");
  const freeze = user.data.freezes.sort((a, b) => a.exp - b.exp)[0];
  if (!freeze) throw new GameError("Нет заморозки");
  user.data.freezes = user.data.freezes.filter((item) => item !== freeze);
  user.data.streakLast = shiftDaySafe(utcDay(now));
}

function shiftDaySafe(today: string): string {
  return new Date(Date.parse(`${today}T00:00:00Z`) - DAY).toISOString().slice(0, 10);
}

export function claimBank(ctx: Ctx, now: number): number {
  accrueBank(ctx, now);
  const bank = ctx.user.data.passiveBank;
  if (bank <= 0) throw new GameError("Пока копилка пустая");
  ctx.user.data.passiveBank = 0;
  ctx.user.data.passiveFrac = 0;
  ctx.user.data.passiveBankedMs = 0;
  ctx.user.data.passiveAt = now;
  credit(ctx.user, bank, "play");
  addClanPoints(ctx, bank);
  addReferralCut(ctx.user, bank, now);
  return bank;
}

export function submitCode(ctx: Ctx, code: string, now: number): number {
  const user = ctx.user;
  if (user.level < 5) throw new GameError("Утренний код откроется на 5 уровне");
  const today = utcDay(now);
  if (user.data.codeDay === today) throw new GameError("Код дня уже принят");
  const expected = dailyCode(today, dailySalt());
  const got = code.trim().toUpperCase().replace(/\s+/g, "");
  if (got !== expected) throw new GameError("Не тот код");
  const reward = codeReward(user.level);
  credit(user, reward, "reward");
  user.data.passXp += 80;
  user.data.codeDay = today;
  return reward;
}

export function claimCombo(ctx: Ctx, now: number): number {
  const user = ctx.user;
  const today = utcDay(now);
  if (user.data.comboDay === today) throw new GameError("Комбо уже забрано");
  const ids = dailyCombo(today, dailySalt());
  for (const id of ids) {
    const card = user.data.cards[id];
    if (!card || card.day !== today || card.dayLevels < 1) {
      const name = cardById(id)?.name ?? id;
      throw new GameError(`Подними сегодня карту «${name}»`);
    }
  }
  const reward = comboReward(user.level);
  credit(user, reward, "reward");
  extendTimer(user, "x2Until", 15 * 60_000, now);
  user.data.passXp += 80;
  user.data.comboDay = today;
  return reward;
}

export function equipSkin(user: User, skinId: string): void {
  if (!skinById(skinId)) throw new GameError("Нет такого окраса");
  if (!user.data.skins.includes(skinId)) throw new GameError("Этот окрас ещё не твой");
  user.skinId = skinId;
}

export function buySkinCoins(user: User, skinId: string): void {
  const skin = skinById(skinId);
  if (!skin || skin.currency !== "coins" || !skin.shop) throw new GameError("Этот окрас не продаётся за мёд");
  if (user.data.skins.includes(skinId)) throw new GameError("Окрас уже куплен");
  if (user.level < skin.minLevel) throw new GameError(`Окрас откроется на ${skin.minLevel} уровне`);
  spend(user, skin.price);
  giveSkin(user, skinId);
  user.skinId = skinId;
  user.data.taskUpgrade = true;
}

export function useTankToken(user: User, now: number): void {
  if (user.data.tankTokens <= 0) throw new GameError("Нет жетонов бака");
  user.data.tankTokens -= 1;
  regenEnergy(user, now);
  user.data.energy = energyCap(user, now);
  user.data.energyAt = now;
}

function applyFreeReward(user: User, level: number, now: number): void {
  if (!(level in FREE_TRACK)) return;
  if (level === 1) credit(user, 2000, "reward");
  if (level === 5) {
    if (!user.data.frames.includes("passfree")) user.data.frames.push("passfree");
    if (!user.data.frame) user.data.frame = "passfree";
  }
  if (level === 10) credit(user, 10_000, "reward");
  if (level === 15) {
    user.data.seasonEnergyBonus += 100;
    user.data.seasonEnergyBonusSeason = seasonId(now);
  }
  if (level === 20) credit(user, 25_000, "reward");
  if (level === 25) giveSkin(user, "cream");
  if (level === 30 && !user.data.badges.includes("lvl30")) user.data.badges.push("lvl30");
}

function applyPaidReward(user: User, level: number, now: number): void {
  if (!(level in PAID_TRACK)) return;
  if (level === 1) credit(user, 15_000, "stars");
  if (level === 3) user.data.freezes.push({ exp: now + 7 * DAY });
  if (level === 5) giveSkin(user, "maple");
  if (level === 10) user.data.tankTokens = Math.min(5, user.data.tankTokens + 2);
  if (level === 12) extendTimer(user, "autopilotUntil", 6 * 3_600_000, now);
  if (level === 15) giveSkin(user, "legend");
  if (level === 25) user.data.nameColor = user.data.nameColor ?? "honey";
  if (level === 30) {
    if (!user.data.badges.includes("season")) user.data.badges.push("season");
    credit(user, 50_000, "stars");
  }
}

export function claimPass(user: User, now: number): void {
  const level = passLevelFromXp(user.data.passXp);
  const owned = hasPass(user, now);
  let got = 0;
  while (user.data.passClaimedFree < level) {
    user.data.passClaimedFree += 1;
    applyFreeReward(user, user.data.passClaimedFree, now);
    got += 1;
  }
  if (owned) {
    while (user.data.passClaimedPaid < level) {
      user.data.passClaimedPaid += 1;
      applyPaidReward(user, user.data.passClaimedPaid, now);
      got += 1;
    }
  }
  if (got === 0) throw new GameError("Пока нечего забирать");
}

function cleanName(name: string): string {
  const trimmed = name.replace(/\s+/g, " ").trim();
  if (trimmed.length < 3 || trimmed.length > 32) throw new GameError("Название клана: от 3 до 32 символов");
  if (/[\u0000-\u001f]/.test(trimmed)) throw new GameError("В названии лишние символы");
  return trimmed;
}

function newCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.randomBytes(6);
  let code = "";
  for (let i = 0; i < 6; i++) code += alphabet[bytes[i]! % alphabet.length];
  return code;
}

export interface ChatLink {
  chatId: number | null;
  chatUsername: string | null;
  chatTitle: string | null;
}

export function createClan(user: User, name: string, chat: ChatLink | null, now: number): Clan {
  if (user.level < 8) throw new GameError("Кланы открываются на 8 уровне");
  if (user.clanId) throw new GameError("Сначала выйди из текущего клана");
  const title = cleanName(name);
  let code = newCode();
  for (let i = 0; i < 5 && getClanByCode(code); i++) code = newCode();
  if (getClanByCode(code)) throw new GameError("Не вышло создать код, попробуй ещё раз");
  const wid = weekId(now);
  const sid = seasonId(now);
  const id = insertClan({
    code,
    name: title,
    ownerId: user.id,
    level: 1,
    weekPoints: 0,
    weekId: wid,
    seasonPoints: 0,
    seasonId: sid,
    totalPoints: 0,
    data: {
      chatId: chat?.chatId ?? null,
      chatUsername: chat?.chatUsername ?? null,
      chatTitle: chat?.chatTitle ?? null,
      stormPct: 0,
      stormUntil: 0,
      stormDay: "",
      stormCount: 0,
      buffPct: 0,
      buffUntil: 0,
      flag: null,
      createdAt: now,
      contributions: {},
    },
  });
  const clan = getClan(id);
  if (!clan) throw new GameError("Клан не сохранился");
  user.clanId = clan.id;
  user.data.clanJoinedAt = now;
  return clan;
}

export function joinClan(user: User, code: string, now: number): Clan {
  if (user.level < 8) throw new GameError("Кланы открываются на 8 уровне");
  if (user.clanId) throw new GameError("Сначала выйди из текущего клана");
  if (user.data.clanLeftAt && now - user.data.clanLeftAt < 2 * 3_600_000) {
    throw new GameError("Подожди 2 часа после выхода из клана");
  }
  const clan = getClanByCode(code.trim());
  if (!clan) throw new GameError("Клан с таким кодом не найден");
  if (countClanMembers(clan.id) >= clanMemberCap(clan.level)) throw new GameError("В клане больше нет мест");
  user.clanId = clan.id;
  user.data.clanJoinedAt = now;
  return clan;
}

export function leaveClan(user: User, now: number): void {
  if (!user.clanId) throw new GameError("Ты не в клане");
  if (user.data.clanJoinedAt && now - user.data.clanJoinedAt < 2 * 3_600_000) {
    throw new GameError("Выйти можно через 2 часа после входа");
  }
  const clan = getClan(user.clanId);
  const clanId = user.clanId;
  user.clanId = null;
  user.data.clanLeftAt = now;
  if (!clan) return;
  const members = listClanMemberIds(clanId).filter((id) => id !== user.id);
  if (members.length === 0) {
    deleteClan(clanId);
    return;
  }
  if (clan.ownerId === user.id) {
    clan.ownerId = members[0]!;
    saveClan(clan);
  }
}

export function rememberLink(userId: number, startParam: string | null): { refId: number | null; clanCode: string | null } {
  const pending = getLink(userId);
  const refFromParam = parseRef(startParam);
  const clanFromParam = parseClan(startParam);
  return {
    refId: refFromParam ?? pending?.refId ?? null,
    clanCode: clanFromParam ?? pending?.clanCode ?? null,
  };
}

export function parseRef(param: string | null | undefined): number | null {
  if (!param) return null;
  const match = /^ref_(\d+)$/.exec(param.trim());
  if (!match) return null;
  const id = Number(match[1]);
  return Number.isFinite(id) && id > 0 ? id : null;
}

export function parseClan(param: string | null | undefined): string | null {
  if (!param) return null;
  const match = /^clan_([A-Za-z0-9]{4,12})$/.exec(param.trim());
  return match ? match[1]!.toUpperCase() : null;
}

export function loginUser(input: {
  id: number;
  firstName: string;
  username: string | null;
  kind: "tma" | "dev";
  startParam: string | null;
  fp: string | null;
  now: number;
}): User {
  maybeRollover(input.now);
  let user = getUser(input.id);
  const link = rememberLink(input.id, input.startParam);
  if (!user) {
    user = {
      id: input.id,
      username: input.username,
      firstName: input.firstName || "Игрок",
      coins: 0,
      level: 1,
      seasonScore: 0,
      seasonId: seasonId(input.now),
      clanId: null,
      referrerId: null,
      createdAt: input.now,
      skinId: "classic",
      refOk: false,
      deviceFp: input.fp,
      data: freshData(input.now),
    };
    if (link.refId && link.refId !== user.id && getUser(link.refId)) {
      const ref = getUser(link.refId);
      if (ref && ref.referrerId !== user.id) user.referrerId = link.refId;
    }
    if (input.fp) {
      if (countFp(input.fp) >= 2) user.data.reviewFlag = true;
      if (user.referrerId) {
        const ref = getUser(user.referrerId);
        if (ref?.deviceFp && ref.deviceFp === input.fp) user.data.reviewFlag = true;
      }
    }
    if (user.referrerId && !user.data.reviewFlag) {
      user.data.welcomeGranted = true;
      credit(user, 2000, "soft");
      extendTimer(user, "x2Until", 15 * 60_000, input.now);
    }
    insertUser(user);
  } else {
    user.firstName = input.firstName || user.firstName;
    user.username = input.username;
    if (input.fp) user.deviceFp = input.fp;
  }
  if (link.clanCode && !user.clanId) {
    try {
      joinClan(user, link.clanCode, input.now);
    } catch {
      /* ссылка клана не должна ломать вход */
    }
  }
  clearLink(user.id);
  const ctx = ctxFor(user);
  prepare(ctx, input.now, { active: true });
  qualifyReferral(user, input.now);
  commit(ctx);
  return user;
}

export function noteFriendPurchase(user: User, now: number): void {
  if (!user.referrerId || user.data.refStarsPaid || user.data.reviewFlag) return;
  const ref = getUser(user.referrerId);
  if (!ref) return;
  user.data.refStarsPaid = true;
  ensureUserClock(ref, now);
  credit(ref, 15_000, "soft");
  saveUser(ref);
}

export function giveSkin(user: User, id: string): boolean {
  const def = skinById(id);
  if (!def) return false;
  if (!user.data.skinState) user.data.skinState = {};
  const owned = user.data.skinState[id];
  if (owned) {
    owned.shards += shardsOnDuplicate(def.rarity);
    return false;
  }
  user.data.skinState[id] = { level: 1, shards: 0 };
  if (!user.data.skins.includes(id)) user.data.skins.push(id);
  return true;
}

export function openBox(user: User): DropInfo {
  if (user.data.boxCharges <= 0) throw new GameError("Плюшевый бокс ещё не заряжен");
  user.data.boxCharges -= 1;
  user.data.boxesOpened += 1;
  const rarity = rarityFromRoll(crypto.randomInt(0, 10000));
  let pool = SKINS.filter((item) => item.drop && item.rarity === rarity);
  if (!pool.length) pool = SKINS.filter((item) => item.drop);
  const picked = pool[crypto.randomInt(0, pool.length)];
  if (!picked) throw new GameError("Бокс пуст");
  const fresh = giveSkin(user, picked.id);
  return {
    id: picked.id,
    name: picked.name,
    rarity: picked.rarity,
    duplicate: !fresh,
    shards: fresh ? 0 : shardsOnDuplicate(picked.rarity),
    filter: picked.filter,
    accessory: picked.accessory,
    backdrop: picked.backdrop,
  };
}

export function upgradeSkin(user: User, skinId: string): void {
  const def = skinById(skinId);
  const state = user.data.skinState?.[skinId];
  if (!def || !state) throw new GameError("Сначала получи этот окрас");
  if (state.level >= 10) throw new GameError("Окрас на максимуме");
  const need = skinUpgradeShards(state.level);
  const cost = skinUpgradeCoins(def.rarity, state.level);
  if (state.shards < need) throw new GameError(`Нужно осколков: ${need}`);
  spend(user, cost);
  state.shards -= need;
  state.level += 1;
  user.data.taskUpgrade = true;
}

export function claimTask(user: User, taskId: string, now: number): void {
  rollDailyTasks(user, now);
  const task = TASKS.find((item) => item.id === taskId);
  if (!task) throw new GameError("Нет такого задания");
  if (user.data.taskClaimed.includes(taskId)) throw new GameError("Уже забрано");
  const value = task.kind === "taps" ? user.data.taskTaps : task.kind === "combo" ? user.data.taskBestCombo : task.kind === "streak" ? (user.data.taskStreak ? 1 : 0) : user.data.taskUpgrade ? 1 : 0;
  if (value < task.goal) throw new GameError("Задание ещё не готово");
  user.data.taskClaimed.push(taskId);
  if (task.coins) credit(user, task.coins, "reward");
  if (task.box) user.data.boxCharges = Math.min(5, user.data.boxCharges + task.box);
}

export function claimAchievement(user: User): void {
  let got = 0;
  for (const item of ACHIEVEMENTS) {
    if (user.data.achClaimed.includes(item.id)) continue;
    const value = item.stat === "taps" ? user.data.tapCount : item.stat === "level" ? user.level : item.stat === "skins" ? user.data.skins.length : item.stat === "boxes" ? user.data.boxesOpened : user.clanId ? 1 : 0;
    if (value < item.goal) continue;
    user.data.achClaimed.push(item.id);
    credit(user, item.coins, "reward");
    got += 1;
  }
  if (got === 0) throw new GameError("Пока нечего забирать");
}

export function ownedOffer(user: User, id: string): boolean {
  return user.data.offers.includes(id);
}

export function markOffer(user: User, id: string): void {
  if (!user.data.offers.includes(id)) user.data.offers.push(id);
}

export function cardsTouchedToday(user: User, ids: string[], today: string): boolean {
  return ids.every((id) => {
    const card = user.data.cards[id];
    return Boolean(card && card.day === today && card.dayLevels > 0);
  });
}
