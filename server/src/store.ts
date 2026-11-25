import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { weekId } from "./economy.js";
import type { Clan, ClanData, Grant, Purchase, User, UserData } from "./types.js";

let db: DatabaseSync | null = null;
let chain: Promise<unknown> = Promise.resolve();

const SCHEMA = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;
PRAGMA busy_timeout = 5000;

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  username TEXT,
  first_name TEXT NOT NULL,
  coins INTEGER NOT NULL DEFAULT 0,
  level INTEGER NOT NULL DEFAULT 1,
  season_score INTEGER NOT NULL DEFAULT 0,
  season_id INTEGER NOT NULL DEFAULT 0,
  clan_id INTEGER,
  referrer_id INTEGER,
  created_at INTEGER NOT NULL,
  skin_id TEXT NOT NULL DEFAULT 'classic',
  ref_ok INTEGER NOT NULL DEFAULT 0,
  device_fp TEXT,
  autopilot_until INTEGER NOT NULL DEFAULT 0,
  data_json TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_users_season ON users(season_id, season_score DESC);
CREATE INDEX IF NOT EXISTS idx_users_level ON users(level DESC);
CREATE INDEX IF NOT EXISTS idx_users_clan ON users(clan_id);
CREATE INDEX IF NOT EXISTS idx_users_ref ON users(referrer_id);
CREATE INDEX IF NOT EXISTS idx_users_fp ON users(device_fp);
CREATE INDEX IF NOT EXISTS idx_users_auto ON users(autopilot_until);

CREATE TABLE IF NOT EXISTS clans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  owner_id INTEGER NOT NULL,
  level INTEGER NOT NULL DEFAULT 1,
  week_points INTEGER NOT NULL DEFAULT 0,
  week_id TEXT NOT NULL,
  season_points INTEGER NOT NULL DEFAULT 0,
  season_id INTEGER NOT NULL DEFAULT 0,
  total_points INTEGER NOT NULL DEFAULT 0,
  data_json TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_clans_season ON clans(season_id, season_points DESC);
CREATE INDEX IF NOT EXISTS idx_clans_level ON clans(level DESC, total_points DESC);

CREATE TABLE IF NOT EXISTS purchases (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  sku TEXT NOT NULL,
  stars INTEGER NOT NULL,
  payload TEXT NOT NULL UNIQUE,
  charge_id TEXT UNIQUE,
  status TEXT NOT NULL,
  grants_json TEXT NOT NULL DEFAULT '[]',
  meta_json TEXT NOT NULL DEFAULT '{}',
  title TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  paid_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_purchases_user ON purchases(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS links (
  user_id INTEGER PRIMARY KEY,
  ref_id INTEGER,
  clan_code TEXT
);

CREATE TABLE IF NOT EXISTS meta (
  k TEXT PRIMARY KEY,
  v TEXT NOT NULL
);
`;

export function initDb(file: string): void {
  if (db) {
    db.close();
    db = null;
  }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  db = new DatabaseSync(file);
  db.exec(SCHEMA);
}

export function database(): DatabaseSync {
  if (!db) throw new Error("База не открыта");
  return db;
}

export function tx<T>(fn: () => T): Promise<T> {
  const run = chain.then(() => {
    const conn = database();
    conn.exec("BEGIN IMMEDIATE");
    try {
      const result = fn();
      conn.exec("COMMIT");
      return result;
    } catch (error) {
      try {
        conn.exec("ROLLBACK");
      } catch {
        /* already rolled back */
      }
      throw error;
    }
  });
  chain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

export function freshData(now: number): UserData {
  return {
    xp: 0,
    energy: 2000,
    energyAt: now,
    bonusEnergy: 0,
    seasonEnergyBonus: 0,
    seasonEnergyBonusSeason: 0,
    multitap: 1,
    energyLevel: 1,
    regenLevel: 1,
    tapCount: 0,
    passiveBank: 0,
    passiveFrac: 0,
    passiveBankedMs: 0,
    passiveAt: now,
    streakDay: 0,
    streakLast: null,
    freezes: [],
    paidFreezeWeek: "",
    paidFreezeCount: 0,
    passFreezeWeek: "",
    welcomeGranted: false,
    refStarsPaid: false,
    refFrac: 0,
    badges: [],
    frames: [],
    frame: null,
    frameUntil: 0,
    nameColor: null,
    passSeason: 0,
    passXp: 0,
    passClaimedFree: 0,
    passClaimedPaid: 0,
    tapTokens: 16,
    tapTokensAt: now,
    x2Until: 0,
    autopilotUntil: 0,
    autopilotAt: 0,
    autotapUntil: 0,
    autotapPauseLeft: 0,
    autotapPauseSince: 0,
    autotapLastClient: 0,
    autotapLastTick: 0,
    clanJoinedAt: 0,
    clanLeftAt: 0,
    tankTokens: 0,
    refillDay: "",
    refillCount: 0,
    starMtap: 0,
    starMtapAt: 0,
    newbieBought: false,
    energySpentMod: 0,
    comboDay: null,
    codeDay: null,
    weekId: weekId(now),
    weekScore: 0,
    reviewFlag: false,
    batches: [],
    cards: {},
    skins: ["classic"],
    skinState: { classic: { level: 1, shards: 0 } },
    combo: 0,
    comboAt: 0,
    bestCombo: 0,
    boxCharges: 0,
    boxProgress: 0,
    boxesOpened: 0,
    taskDay: "",
    taskTaps: 0,
    taskBestCombo: 0,
    taskStreak: false,
    taskUpgrade: false,
    taskClaimed: [],
    achClaimed: [],
    offers: [],
    level5Granted: false,
    veteranGranted: false,
  };
}

function normalizeData(raw: Partial<UserData> | null, now: number): UserData {
  const base = freshData(now);
  const data = { ...base, ...(raw ?? {}) };
  data.cards = raw?.cards ?? {};
  data.skins = raw?.skins?.length ? raw.skins : ["classic"];
  if (!data.skins.includes("classic")) data.skins.unshift("classic");
  data.skinState = { ...(raw?.skinState ?? {}) };
  for (const id of data.skins) {
    if (!data.skinState[id]) data.skinState[id] = { level: 1, shards: 0 };
  }
  if (!data.skinState.classic) data.skinState.classic = { level: 1, shards: 0 };
  data.taskClaimed = Array.isArray(raw?.taskClaimed) ? raw.taskClaimed : [];
  data.achClaimed = Array.isArray(raw?.achClaimed) ? raw.achClaimed : [];
  data.freezes = Array.isArray(raw?.freezes) ? raw.freezes : [];
  data.batches = Array.isArray(raw?.batches) ? raw.batches : [];
  data.badges = Array.isArray(raw?.badges) ? raw.badges : [];
  data.frames = Array.isArray(raw?.frames) ? raw.frames : [];
  data.offers = Array.isArray(raw?.offers) ? raw.offers : [];
  return data;
}

function rowToUser(row: Record<string, unknown>): User {
  let parsed: Partial<UserData> | null = null;
  try {
    parsed = JSON.parse(String(row.data_json)) as Partial<UserData>;
  } catch {
    parsed = null;
  }
  return {
    id: Number(row.id),
    username: row.username == null ? null : String(row.username),
    firstName: String(row.first_name ?? ""),
    coins: Number(row.coins ?? 0),
    level: Number(row.level ?? 1),
    seasonScore: Number(row.season_score ?? 0),
    seasonId: Number(row.season_id ?? 0),
    clanId: row.clan_id == null ? null : Number(row.clan_id),
    referrerId: row.referrer_id == null ? null : Number(row.referrer_id),
    createdAt: Number(row.created_at ?? 0),
    skinId: String(row.skin_id ?? "classic"),
    refOk: Number(row.ref_ok ?? 0) === 1,
    deviceFp: row.device_fp == null ? null : String(row.device_fp),
    data: normalizeData(parsed, Number(row.created_at ?? Date.now())),
  };
}

const USER_SELECT = `SELECT id, username, first_name, coins, level, season_score, season_id, clan_id, referrer_id, created_at, skin_id, ref_ok, device_fp, autopilot_until, data_json FROM users`;

export function getUser(id: number): User | null {
  const row = database().prepare(`${USER_SELECT} WHERE id = ?`).get(id) as Record<string, unknown> | undefined;
  return row ? rowToUser(row) : null;
}

export function insertUser(user: User): void {
  database()
    .prepare(
      `INSERT INTO users (id, username, first_name, coins, level, season_score, season_id, clan_id, referrer_id, created_at, skin_id, ref_ok, device_fp, autopilot_until, data_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      user.id,
      user.username,
      user.firstName,
      user.coins,
      user.level,
      user.seasonScore,
      user.seasonId,
      user.clanId,
      user.referrerId,
      user.createdAt,
      user.skinId,
      user.refOk ? 1 : 0,
      user.deviceFp,
      user.data.autopilotUntil,
      JSON.stringify(user.data),
    );
}

export function saveUser(user: User): void {
  database()
    .prepare(
      `UPDATE users SET username=?, first_name=?, coins=?, level=?, season_score=?, season_id=?, clan_id=?, referrer_id=?, skin_id=?, ref_ok=?, device_fp=?, autopilot_until=?, data_json=? WHERE id=?`,
    )
    .run(
      user.username,
      user.firstName,
      user.coins,
      user.level,
      user.seasonScore,
      user.seasonId,
      user.clanId,
      user.referrerId,
      user.skinId,
      user.refOk ? 1 : 0,
      user.deviceFp,
      user.data.autopilotUntil,
      JSON.stringify(user.data),
      user.id,
    );
}

export function countFp(fp: string): number {
  const row = database().prepare(`SELECT COUNT(*) AS c FROM users WHERE device_fp = ?`).get(fp) as { c: number };
  return Number(row?.c ?? 0);
}

export function countQualified(referrerId: number): number {
  const row = database().prepare(`SELECT COUNT(*) AS c FROM users WHERE referrer_id = ? AND ref_ok = 1`).get(referrerId) as { c: number };
  return Number(row?.c ?? 0);
}

export function countReferrals(referrerId: number): number {
  const row = database().prepare(`SELECT COUNT(*) AS c FROM users WHERE referrer_id = ?`).get(referrerId) as { c: number };
  return Number(row?.c ?? 0);
}

export interface FriendRow {
  id: number;
  name: string;
  username: string | null;
  level: number;
  qualified: boolean;
  taps: number;
}

export function listFriends(referrerId: number, limit = 50): FriendRow[] {
  const rows = database()
    .prepare(
      `SELECT id, first_name, username, level, ref_ok, data_json FROM users WHERE referrer_id = ? ORDER BY created_at DESC LIMIT ?`,
    )
    .all(referrerId, limit) as Record<string, unknown>[];
  return rows.map((row) => {
    let taps = 0;
    try {
      taps = Number((JSON.parse(String(row.data_json)) as UserData).tapCount ?? 0);
    } catch {
      taps = 0;
    }
    return {
      id: Number(row.id),
      name: String(row.first_name ?? "Игрок"),
      username: row.username == null ? null : String(row.username),
      level: Number(row.level ?? 1),
      qualified: Number(row.ref_ok ?? 0) === 1,
      taps,
    };
  });
}

export interface BoardUser {
  id: number;
  name: string;
  username: string | null;
  level: number;
  score: number;
  skinId: string;
  frame: string | null;
  nameColor: string | null;
  badges: string[];
}

function boardFromRow(row: Record<string, unknown>, score: number): BoardUser {
  let frame: string | null = null;
  let nameColor: string | null = null;
  let badges: string[] = [];
  try {
    const data = JSON.parse(String(row.data_json)) as UserData;
    frame = data.frame ?? null;
    nameColor = data.nameColor ?? null;
    badges = data.badges ?? [];
  } catch {
    /* ignore broken cosmetics */
  }
  return {
    id: Number(row.id),
    name: String(row.first_name ?? "Игрок"),
    username: row.username == null ? null : String(row.username),
    level: Number(row.level ?? 1),
    score,
    skinId: String(row.skin_id ?? "classic"),
    frame,
    nameColor,
    badges,
  };
}

export function soloBoard(scope: "season" | "all", season: number): BoardUser[] {
  const rows =
    scope === "season"
      ? (database()
          .prepare(
            `SELECT id, first_name, username, level, season_score, skin_id, data_json FROM users WHERE season_id = ? ORDER BY season_score DESC, level DESC LIMIT 100`,
          )
          .all(season) as Record<string, unknown>[])
      : (database()
          .prepare(
            `SELECT id, first_name, username, level, coins, skin_id, data_json FROM users ORDER BY level DESC, coins DESC LIMIT 100`,
          )
          .all() as Record<string, unknown>[]);
  return rows.map((row) => boardFromRow(row, scope === "season" ? Number(row.season_score ?? 0) : Number(row.level ?? 1)));
}

export function soloRank(user: User, scope: "season" | "all"): number {
  if (scope === "season") {
    const row = database()
      .prepare(`SELECT COUNT(*) AS c FROM users WHERE season_id = ? AND season_score > ?`)
      .get(user.seasonId, user.seasonScore) as { c: number };
    return Number(row?.c ?? 0) + 1;
  }
  const row = database()
    .prepare(`SELECT COUNT(*) AS c FROM users WHERE level > ? OR (level = ? AND coins > ?)`)
    .get(user.level, user.level, user.coins) as { c: number };
  return Number(row?.c ?? 0) + 1;
}

function rowToClan(row: Record<string, unknown>): Clan {
  let data: ClanData;
  try {
    data = JSON.parse(String(row.data_json)) as ClanData;
  } catch {
    data = {
      chatId: null,
      chatUsername: null,
      chatTitle: null,
      stormPct: 0,
      stormUntil: 0,
      stormDay: "",
      stormCount: 0,
      buffPct: 0,
      buffUntil: 0,
      flag: null,
      createdAt: Date.now(),
      contributions: {},
    };
  }
  data.contributions = data.contributions ?? {};
  return {
    id: Number(row.id),
    code: String(row.code),
    name: String(row.name),
    ownerId: Number(row.owner_id),
    level: Number(row.level ?? 1),
    weekPoints: Number(row.week_points ?? 0),
    weekId: String(row.week_id ?? ""),
    seasonPoints: Number(row.season_points ?? 0),
    seasonId: Number(row.season_id ?? 0),
    totalPoints: Number(row.total_points ?? 0),
    data,
  };
}

const CLAN_SELECT = `SELECT id, code, name, owner_id, level, week_points, week_id, season_points, season_id, total_points, data_json FROM clans`;

export function getClan(id: number): Clan | null {
  const row = database().prepare(`${CLAN_SELECT} WHERE id = ?`).get(id) as Record<string, unknown> | undefined;
  return row ? rowToClan(row) : null;
}

export function getClanByCode(code: string): Clan | null {
  const row = database().prepare(`${CLAN_SELECT} WHERE code = ?`).get(code.toUpperCase()) as Record<string, unknown> | undefined;
  return row ? rowToClan(row) : null;
}

export function insertClan(clan: Omit<Clan, "id">): number {
  const info = database()
    .prepare(
      `INSERT INTO clans (code, name, owner_id, level, week_points, week_id, season_points, season_id, total_points, data_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      clan.code,
      clan.name,
      clan.ownerId,
      clan.level,
      clan.weekPoints,
      clan.weekId,
      clan.seasonPoints,
      clan.seasonId,
      clan.totalPoints,
      JSON.stringify(clan.data),
    );
  return Number(info.lastInsertRowid);
}

export function saveClan(clan: Clan): void {
  database()
    .prepare(
      `UPDATE clans SET code=?, name=?, owner_id=?, level=?, week_points=?, week_id=?, season_points=?, season_id=?, total_points=?, data_json=? WHERE id=?`,
    )
    .run(
      clan.code,
      clan.name,
      clan.ownerId,
      clan.level,
      clan.weekPoints,
      clan.weekId,
      clan.seasonPoints,
      clan.seasonId,
      clan.totalPoints,
      JSON.stringify(clan.data),
      clan.id,
    );
}

export function deleteClan(id: number): void {
  database().prepare(`DELETE FROM clans WHERE id = ?`).run(id);
  database().prepare(`UPDATE users SET clan_id = NULL WHERE clan_id = ?`).run(id);
}

export function listClans(): Clan[] {
  const rows = database().prepare(CLAN_SELECT).all() as Record<string, unknown>[];
  return rows.map(rowToClan);
}

export function countClanMembers(clanId: number): number {
  const row = database().prepare(`SELECT COUNT(*) AS c FROM users WHERE clan_id = ?`).get(clanId) as { c: number };
  return Number(row?.c ?? 0);
}

export function listClanMemberIds(clanId: number): number[] {
  const rows = database().prepare(`SELECT id FROM users WHERE clan_id = ? ORDER BY created_at ASC`).all(clanId) as { id: number }[];
  return rows.map((r) => Number(r.id));
}

export interface MemberRow {
  id: number;
  name: string;
  level: number;
}

export function listClanMembers(clanId: number): MemberRow[] {
  const rows = database()
    .prepare(`SELECT id, first_name, level FROM users WHERE clan_id = ? ORDER BY level DESC`)
    .all(clanId) as Record<string, unknown>[];
  return rows.map((row) => ({ id: Number(row.id), name: String(row.first_name ?? "Игрок"), level: Number(row.level ?? 1) }));
}

export function clanBoard(scope: "season" | "all", season: number): Clan[] {
  const rows =
    scope === "season"
      ? (database().prepare(`${CLAN_SELECT} WHERE season_id = ? ORDER BY season_points DESC LIMIT 100`).all(season) as Record<string, unknown>[])
      : (database().prepare(`${CLAN_SELECT} ORDER BY level DESC, total_points DESC LIMIT 100`).all() as Record<string, unknown>[]);
  return rows.map(rowToClan);
}

export function clanRank(clan: Clan, scope: "season" | "all"): number {
  if (scope === "season") {
    const row = database()
      .prepare(`SELECT COUNT(*) AS c FROM clans WHERE season_id = ? AND season_points > ?`)
      .get(clan.seasonId, clan.seasonPoints) as { c: number };
    return Number(row?.c ?? 0) + 1;
  }
  const row = database()
    .prepare(`SELECT COUNT(*) AS c FROM clans WHERE level > ? OR (level = ? AND total_points > ?)`)
    .get(clan.level, clan.level, clan.totalPoints) as { c: number };
  return Number(row?.c ?? 0) + 1;
}

export function staleClanCount(week: string, season: number): number {
  const row = database()
    .prepare(`SELECT COUNT(*) AS c FROM clans WHERE week_id != ? OR season_id != ?`)
    .get(week, season) as { c: number };
  return Number(row?.c ?? 0);
}

export function autopilotUserIds(now: number): number[] {
  const rows = database().prepare(`SELECT id FROM users WHERE autopilot_until > ? LIMIT 500`).all(now) as { id: number }[];
  return rows.map((r) => Number(r.id));
}

export function metaGet(key: string): string | null {
  const row = database().prepare(`SELECT v FROM meta WHERE k = ?`).get(key) as { v: string } | undefined;
  return row ? String(row.v) : null;
}

export function metaSet(key: string, value: string): void {
  database().prepare(`INSERT INTO meta (k, v) VALUES (?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v`).run(key, value);
}

export function getLink(userId: number): { refId: number | null; clanCode: string | null } | null {
  const row = database().prepare(`SELECT ref_id, clan_code FROM links WHERE user_id = ?`).get(userId) as
    | { ref_id: number | null; clan_code: string | null }
    | undefined;
  if (!row) return null;
  return { refId: row.ref_id == null ? null : Number(row.ref_id), clanCode: row.clan_code };
}

export function setLink(userId: number, refId: number | null, clanCode: string | null): void {
  database()
    .prepare(`INSERT INTO links (user_id, ref_id, clan_code) VALUES (?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET ref_id = excluded.ref_id, clan_code = excluded.clan_code`)
    .run(userId, refId, clanCode);
}

export function clearLink(userId: number): void {
  database().prepare(`DELETE FROM links WHERE user_id = ?`).run(userId);
}

export function insertPurchase(p: Omit<Purchase, "id" | "payload" | "chargeId" | "paidAt"> & { payload?: string }): number {
  const info = database()
    .prepare(
      `INSERT INTO purchases (user_id, sku, stars, payload, charge_id, status, grants_json, meta_json, title, created_at, paid_at)
       VALUES (?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, NULL)`,
    )
    .run(
      p.userId,
      p.sku,
      p.stars,
      p.payload ?? `tmp-${Date.now()}-${Math.random()}`,
      p.status,
      JSON.stringify(p.grants ?? []),
      JSON.stringify(p.meta ?? {}),
      p.title,
      p.createdAt,
    );
  const id = Number(info.lastInsertRowid);
  const payload = `td${id}`;
  database().prepare(`UPDATE purchases SET payload = ? WHERE id = ?`).run(payload, id);
  return id;
}

function rowToPurchase(row: Record<string, unknown>): Purchase {
  let grants: Grant[] = [];
  let meta: Record<string, unknown> = {};
  try {
    grants = JSON.parse(String(row.grants_json ?? "[]")) as Grant[];
  } catch {
    grants = [];
  }
  try {
    meta = JSON.parse(String(row.meta_json ?? "{}")) as Record<string, unknown>;
  } catch {
    meta = {};
  }
  return {
    id: Number(row.id),
    userId: Number(row.user_id),
    sku: String(row.sku),
    stars: Number(row.stars),
    payload: String(row.payload),
    chargeId: row.charge_id == null ? null : String(row.charge_id),
    status: String(row.status) as Purchase["status"],
    grants,
    meta,
    title: String(row.title ?? ""),
    createdAt: Number(row.created_at),
    paidAt: row.paid_at == null ? null : Number(row.paid_at),
  };
}

export function getPurchase(id: number): Purchase | null {
  const row = database().prepare(`SELECT * FROM purchases WHERE id = ?`).get(id) as Record<string, unknown> | undefined;
  return row ? rowToPurchase(row) : null;
}

export function getPurchaseByPayload(payload: string): Purchase | null {
  const row = database().prepare(`SELECT * FROM purchases WHERE payload = ?`).get(payload) as Record<string, unknown> | undefined;
  return row ? rowToPurchase(row) : null;
}

export function getPurchaseByCharge(chargeId: string): Purchase | null {
  const row = database().prepare(`SELECT * FROM purchases WHERE charge_id = ?`).get(chargeId) as Record<string, unknown> | undefined;
  return row ? rowToPurchase(row) : null;
}

export function savePurchase(p: Purchase): void {
  database()
    .prepare(`UPDATE purchases SET status=?, charge_id=?, grants_json=?, meta_json=?, paid_at=?, stars=?, title=? WHERE id=?`)
    .run(p.status, p.chargeId, JSON.stringify(p.grants), JSON.stringify(p.meta), p.paidAt, p.stars, p.title, p.id);
}
