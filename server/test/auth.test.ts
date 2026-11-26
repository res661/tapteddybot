import assert from "node:assert/strict";
import crypto from "node:crypto";
import test from "node:test";
import { signSession, validateInitData, verifySession } from "../src/auth.js";

function makeInit(botToken: string, fields: Record<string, string>): string {
  const pairs = Object.entries(fields)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, value]) => `${key}=${value}`);
  const secret = crypto.createHmac("sha256", "WebAppData").update(botToken).digest();
  const hash = crypto.createHmac("sha256", secret).update(pairs.join("\n")).digest("hex");
  return new URLSearchParams({ ...fields, hash }).toString();
}

test("initData проходит проверку и отвергает подмену", () => {
  const token = "123456:TEST_TOKEN";
  const now = Date.parse("2026-11-24T12:00:00Z");
  const init = makeInit(token, {
    auth_date: String(Math.floor(now / 1000)),
    query_id: "AAE",
    user: JSON.stringify({ id: 42, first_name: "Миша", username: "misha" }),
  });
  const parsed = validateInitData(init, token, now);
  assert.ok(parsed);
  assert.equal(parsed!.user.id, 42);
  assert.equal(parsed!.user.first_name, "Миша");
  const tampered = init.replace("42", "43");
  assert.equal(validateInitData(tampered, token, now), null);
  assert.equal(validateInitData(init, "other:token", now), null);
});

test("старый initData не принимается", () => {
  const token = "123456:TEST_TOKEN";
  const now = Date.parse("2026-11-24T12:00:00Z");
  const init = makeInit(token, {
    auth_date: String(Math.floor(now / 1000) - 90_000),
    user: JSON.stringify({ id: 7, first_name: "Old" }),
  });
  assert.equal(validateInitData(init, token, now), null);
});

test("сессионный токен подписывается и не подделывается", () => {
  process.env.SESSION_SECRET = "test-secret";
  const token = signSession("dev", 10001, 60_000);
  const session = verifySession(token);
  assert.ok(session);
  assert.equal(session!.userId, 10001);
  assert.equal(session!.kind, "dev");
  assert.equal(verifySession(token.slice(0, -2) + "aa"), null);
});
