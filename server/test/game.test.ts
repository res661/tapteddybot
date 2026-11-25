import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { Server } from "node:http";
import { after, before, describe, test } from "node:test";

let server: Server;
let base = "";
let token = "";

async function api(pathname: string, body?: unknown, bearer = token): Promise<{ status: number; json: Record<string, any> }> {
  const response = await fetch(`${base}${pathname}`, {
    method: body ? "POST" : "GET",
    headers: {
      "content-type": "application/json",
      ...(bearer ? { authorization: `Bearer ${bearer}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = (await response.json()) as Record<string, any>;
  return { status: response.status, json };
}

before(async () => {
  process.env.DEV_MODE = "1";
  process.env.SESSION_SECRET = "test-secret";
  process.env.BOT_TOKEN = "123456:TEST_TOKEN";
  process.env.BOT_USERNAME = "TapTeddy_bot";
  process.env.DAILY_CODE_SALT = "salt";
  process.env.NODE_ENV = "test";
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tapteddy-"));
  const db = path.join(dir, "game.sqlite");
  const { initDb } = await import("../src/store.js");
  initDb(db);
  const { createApp } = await import("../src/app.js");
  const app = createApp();
  server = await new Promise<Server>((resolve) => {
    const listening = app.listen(0, "127.0.0.1", () => resolve(listening));
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("no port");
  base = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
});

describe("игра", { concurrency: 1 }, () => {
test("dev-сессия, тапы, обрезка автокликера и повтор пачки", async () => {
  const session = await api("/api/session", { devId: 10001, name: "Мишка" }, "");
  assert.equal(session.status, 200);
  token = session.json.token as string;
  assert.equal(session.json.state.me.energy, 2000);
  assert.equal(session.json.state.me.perTap, 1);
  assert.equal(session.json.state.me.level, 1);

  const first = await api("/api/sync", { taps: 10, batchId: "batch-1", active: true });
  assert.equal(first.status, 200);
  assert.equal(first.json.gained.taps, 10);
  assert.equal(first.json.me.coins, 10);
  assert.equal(first.json.me.energy, 1990);

  const burst = await api("/api/sync", { taps: 40, batchId: "batch-2", active: true });
  assert.ok(burst.json.gained.taps < 40);
  assert.ok(burst.json.gained.taps <= 16);
  assert.ok(burst.json.me.energy >= 0);

  const replay = await api("/api/sync", { taps: 10, batchId: "batch-1", active: true });
  assert.equal(replay.json.gained.taps, 0);
  assert.equal(replay.json.me.coins, burst.json.me.coins);
});

test("мёд из набора за звёзды не даёт опыт, возврат забирает остаток", async () => {
  const session = await api("/api/session", { devId: 30003, name: "Новичок" }, "");
  const bearer = session.json.token as string;
  const bought = await api("/api/action", { type: "dev_buy", sku: "newbie" }, bearer);
  assert.equal(bought.status, 200, JSON.stringify(bought.json));
  assert.equal(bought.json.state.me.level, 1);
  assert.equal(bought.json.state.me.xp, 0);
  assert.ok(bought.json.state.me.coins >= 20_000);
  assert.ok(bought.json.state.skins.some((skin: { id: string; owned: boolean }) => skin.id === "firstden" && skin.owned));

  const { database, tx } = await import("../src/store.js");
  const { refundPurchase } = await import("../src/stars.js");
  const paid = database().prepare(`SELECT charge_id FROM purchases WHERE user_id = ? AND sku = ?`).get(30003, "newbie") as { charge_id: string };
  assert.ok(paid?.charge_id);
  await tx(() => refundPurchase(paid.charge_id, Date.now()));
  const state = await api("/api/state", undefined, bearer);
  assert.equal(state.json.state.me.coins, 0);
  assert.equal(state.json.state.newbie, null);
});

test("реферал получает приветствие, а пригласивший — бонус после 3 уровня и 500 тапов", async () => {
  const host = await api("/api/state");
  const before = host.json.state.me.coins as number;
  const friend = await api("/api/session", { devId: 20002, name: "Друг", startParam: "ref_10001" }, "");
  assert.equal(friend.status, 200, JSON.stringify(friend.json));
  assert.equal(friend.json.state.me.level, 2);
  assert.ok(friend.json.state.me.coins >= 2000);

  const { tx, saveUser } = await import("../src/store.js");
  const { mustUser, qualifyReferral } = await import("../src/progress.js");
  await tx(() => {
    const user = mustUser(20002);
    user.level = 3;
    user.data.tapCount = 500;
    qualifyReferral(user, Date.now());
    saveUser(user);
  });
  const after = await api("/api/state");
  assert.ok(after.json.state.me.coins >= before + 5000);
  assert.equal(after.json.state.friends.qualified, 1);
});

test("initData логинит игрока Telegram", async () => {
  const now = Date.now();
  const fields = {
    auth_date: String(Math.floor(now / 1000)),
    user: JSON.stringify({ id: 777, first_name: "Телеграм" }),
  };
  const pairs = Object.entries(fields)
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([key, value]) => `${key}=${value}`);
  const secret = crypto.createHmac("sha256", "WebAppData").update(process.env.BOT_TOKEN!).digest();
  const hash = crypto.createHmac("sha256", secret).update(pairs.join("\n")).digest("hex");
  const initData = new URLSearchParams({ ...fields, hash }).toString();
  const session = await api("/api/session", { initData }, "");
  assert.equal(session.status, 200, JSON.stringify(session.json));
  assert.equal(session.json.state.me.id, 777);
  assert.equal(session.json.dev, false);
});

test("дубликат окраса даёт осколки, бокс тратит заряд", async () => {
  const { tx, saveUser } = await import("../src/store.js");
  const { mustUser, giveSkin, openBox } = await import("../src/progress.js");
  await tx(() => {
    const user = mustUser(10001);
    assert.equal(giveSkin(user, "honey"), true);
    assert.equal(giveSkin(user, "honey"), false);
    assert.ok(user.data.skinState.honey.shards >= 1);
    user.data.boxCharges = 1;
    const drop = openBox(user);
    assert.equal(user.data.boxCharges, 0);
    assert.ok(drop.id);
    saveUser(user);
  });
});

test("без dev-режима браузер не входит", async () => {
  process.env.DEV_MODE = "0";
  const denied = await api("/api/session", { devId: 5 }, "");
  assert.equal(denied.status, 401);
  process.env.DEV_MODE = "1";
});
});
