import assert from "node:assert/strict";
import test from "node:test";
import { freshData } from "../src/store.js";
import type { User } from "../src/types.js";
import {
  SEASON_EPOCH,
  leagueOf,
  rarityFromRoll,
  shardsOnDuplicate,
  cardUpgradeCost,
  clanMemberCap,
  codeReward,
  comboReward,
  consumeTapTokens,
  currentOffer,
  dailyCode,
  dailyCombo,
  energyCap,
  energyUpgradeCost,
  multitapCost,
  refillPrice,
  seasonId,
  tapValue,
  utcDay,
  weekId,
  xpToAdvance,
  canSaveStreak,
  maxMultitap,
} from "../src/economy.js";

function user(now: number, patch: Partial<User> = {}): User {
  return {
    id: 1,
    username: null,
    firstName: "Мишка",
    coins: 0,
    level: 1,
    seasonScore: 0,
    seasonId: seasonId(now),
    clanId: null,
    referrerId: null,
    createdAt: now,
    skinId: "classic",
    refOk: false,
    deviceFp: null,
    data: freshData(now),
    ...patch,
  };
}

test("опыт на уровень 1 равен 2000, на 5 близок к таблице", () => {
  assert.equal(xpToAdvance(1), 2000);
  const fifth = xpToAdvance(5);
  assert.ok(fifth > 23_000 && fifth < 26_000, String(fifth));
});

test("бак: база, апгрейд и уровень", () => {
  const now = Date.parse("2026-11-24T12:00:00Z");
  const fresh = user(now);
  assert.equal(energyCap(fresh, now), 2000);
  fresh.data.energyLevel = 2;
  assert.equal(energyCap(fresh, now), 2250);
  fresh.level = 3;
  assert.equal(energyCap(fresh, now), 2250 + 40);
});

test("цены апгрейдов и бака звёздами", () => {
  assert.equal(energyUpgradeCost(1), 800);
  assert.equal(multitapCost(1), 1000);
  assert.equal(cardUpgradeCost(500, 0), 500);
  assert.ok(cardUpgradeCost(500, 1) > 500);
  assert.equal(refillPrice(0), 25);
  assert.equal(refillPrice(7), 25);
  assert.equal(refillPrice(8), 50);
  assert.equal(refillPrice(12), 100);
});

test("ведро тапов: всплеск 16 и дальше 12 в секунду", () => {
  const state = { tokens: 16, at: 0 };
  assert.equal(consumeTapTokens(state, 0, 100), 16);
  assert.equal(consumeTapTokens(state, 1000, 100), 12);
  const steady = { tokens: 16, at: 0 };
  let total = 0;
  for (let second = 0; second < 10; second++) total += consumeTapTokens(steady, second * 1000, 12);
  assert.equal(total, 120);
});

test("тап учитывает мультитап, карты и x2", () => {
  const now = Date.parse("2026-11-24T12:00:00Z");
  const bear = user(now);
  assert.equal(tapValue(bear, null, now), 1);
  bear.data.multitap = 12;
  assert.equal(tapValue(bear, null, now), 12);
  bear.data.cards.softtap = { level: 10, day: "2026-11-24", dayLevels: 1 };
  assert.equal(tapValue(bear, null, now), Math.floor(12 * 1.5));
  bear.data.x2Until = now + 1000;
  assert.equal(tapValue(bear, null, now), Math.floor(12 * 1.5 * 2));
});

test("неделя начинается в понедельник, сезон от понедельника", () => {
  assert.equal(new Date(SEASON_EPOCH).getUTCDay(), 1);
  const tuesday = Date.parse("2026-11-24T15:00:00Z");
  assert.equal(weekId(tuesday), "2026-11-23");
  assert.equal(utcDay(tuesday), "2026-11-24");
  assert.equal(typeof seasonId(tuesday), "number");
});

test("код дня стабильный, комбо из трёх карт", () => {
  assert.equal(dailyCode("2026-11-24", "salt"), dailyCode("2026-11-24", "salt"));
  assert.equal(dailyCode("2026-11-24", "salt").length, 4);
  assert.notEqual(dailyCode("2026-11-24", "salt"), dailyCode("2026-11-25", "salt"));
  const combo = dailyCombo("2026-11-24", "salt");
  assert.equal(new Set(combo).size, 3);
});

test("награды кода и комбо и потолок мультитапа", () => {
  assert.equal(codeReward(1), 12_000);
  assert.equal(codeReward(40), 70_000);
  assert.equal(comboReward(2), 31_000);
  assert.equal(maxMultitap(12), 15);
  assert.equal(clanMemberCap(1), 30);
  assert.equal(clanMemberCap(13), 150);
});

test("окно спасения серии — сутки после пропуска", () => {
  const now = Date.parse("2026-11-24T12:00:00Z");
  const bear = user(now);
  bear.data.streakDay = 4;
  bear.data.streakLast = "2026-11-23";
  assert.equal(canSaveStreak(bear, now), false);
  bear.data.streakLast = "2026-11-22";
  assert.equal(canSaveStreak(bear, now), true);
  bear.data.streakLast = "2026-11-21";
  assert.equal(canSaveStreak(bear, now), false);
});

test("плюшевый бокс: шансы и осколки, лиги по недельному мёду", () => {
  assert.equal(rarityFromRoll(0), "common");
  assert.equal(rarityFromRoll(5499), "common");
  assert.equal(rarityFromRoll(5500), "rare");
  assert.equal(rarityFromRoll(9499), "epic");
  assert.equal(rarityFromRoll(9899), "legendary");
  assert.equal(rarityFromRoll(9900), "mythic");
  assert.equal(shardsOnDuplicate("common"), 1);
  assert.equal(shardsOnDuplicate("mythic"), 16);
  assert.equal(leagueOf(0).id, "bronze");
  assert.equal(leagueOf(5_000).id, "silver");
  assert.equal(leagueOf(400_000).id, "diamond");
});

test("лимитированный набор попадает в среду и субботу", () => {
  const wednesday = Date.parse("2026-11-25T18:00:00Z");
  const offer = currentOffer(wednesday);
  assert.ok(offer);
  assert.match(offer!.id, /^night-/);
  assert.equal(offer!.stars, 200);
  const tuesday = Date.parse("2026-11-24T18:00:00Z");
  assert.equal(currentOffer(tuesday), null);
});
