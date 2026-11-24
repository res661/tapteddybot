import crypto from "node:crypto";
import { sessionSecret } from "./config.js";
import { GameError } from "./errors.js";

export interface TgUser {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  language_code?: string;
}

export interface InitData {
  user: TgUser;
  authDate: number;
  startParam: string | null;
}

function timingEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length || left.length === 0) return false;
  return crypto.timingSafeEqual(left, right);
}

/** Проверка initData мини-приложения: HMAC-SHA256 с ключом HMAC("WebAppData", bot_token). */
export function validateInitData(initData: string, botToken: string, now = Date.now(), maxAgeSec = 86_400): InitData | null {
  if (!initData || !botToken) return null;
  let params: URLSearchParams;
  try {
    params = new URLSearchParams(initData);
  } catch {
    return null;
  }
  const hash = params.get("hash");
  if (!hash) return null;
  const pairs: string[] = [];
  for (const [key, value] of params.entries()) {
    if (key === "hash") continue;
    pairs.push(`${key}=${value}`);
  }
  pairs.sort();
  const secret = crypto.createHmac("sha256", "WebAppData").update(botToken).digest();
  const calc = crypto.createHmac("sha256", secret).update(pairs.join("\n")).digest("hex");
  if (!timingEqual(calc, hash)) return null;
  const authDate = Number(params.get("auth_date"));
  if (!Number.isFinite(authDate)) return null;
  const age = now / 1000 - authDate;
  if (age > maxAgeSec || age < -60) return null;
  const rawUser = params.get("user");
  if (!rawUser) return null;
  let user: TgUser;
  try {
    user = JSON.parse(rawUser) as TgUser;
  } catch {
    return null;
  }
  if (!user || typeof user.id !== "number" || !Number.isFinite(user.id) || user.id <= 0) return null;
  return { user, authDate, startParam: params.get("start_param") };
}

export interface SessionToken {
  kind: "tma" | "dev";
  userId: number;
  exp: number;
}

export function signSession(kind: "tma" | "dev", userId: number, ttlMs = 7 * 86_400_000): string {
  const exp = Date.now() + ttlMs;
  const body = `${kind}.${userId}.${exp}`;
  const sig = crypto.createHmac("sha256", sessionSecret()).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function verifySession(token: string): SessionToken | null {
  const parts = token.split(".");
  if (parts.length !== 4) return null;
  const [kind, idRaw, expRaw, sig] = parts;
  if ((kind !== "tma" && kind !== "dev") || !idRaw || !expRaw || !sig) return null;
  const body = `${kind}.${idRaw}.${expRaw}`;
  const expected = crypto.createHmac("sha256", sessionSecret()).update(body).digest("base64url");
  if (!timingEqual(expected, sig)) return null;
  const exp = Number(expRaw);
  const userId = Number(idRaw);
  if (!Number.isFinite(exp) || exp < Date.now()) return null;
  if (!Number.isFinite(userId) || userId <= 0) return null;
  return { kind, userId, exp };
}

export function requireDev(kind: "tma" | "dev", devMode: boolean): void {
  if (!devMode || kind !== "dev") throw new GameError("Тестовая покупка выключена", 403);
}
