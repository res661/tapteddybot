import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export function repoRoot(): string {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
}

function loadEnvFile(): void {
  const file = path.join(repoRoot(), ".env");
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

loadEnvFile();

function intList(raw: string | undefined): number[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n) && n > 0);
}

export function config() {
  const databaseRaw = process.env.DATABASE_PATH ?? "./data/tapteddy.sqlite";
  return {
    botToken: process.env.BOT_TOKEN?.trim() ?? "",
    botUsername: (process.env.BOT_USERNAME ?? "TapTeddy_bot").replace(/^@/, ""),
    webappUrl: (process.env.WEBAPP_URL ?? "http://localhost:5173").replace(/\/$/, ""),
    channelUrl: process.env.CHANNEL_URL?.trim() ?? "",
    port: Number(process.env.PORT ?? 3000),
    databasePath: path.isAbsolute(databaseRaw) ? databaseRaw : path.resolve(repoRoot(), databaseRaw),
    sessionSecret: process.env.SESSION_SECRET?.trim() ?? "",
    devMode: process.env.DEV_MODE === "1",
    adminIds: intList(process.env.ADMIN_IDS),
    supportUsername: (process.env.SUPPORT_USERNAME ?? "").replace(/^@/, ""),
    dailyCodeSalt: process.env.DAILY_CODE_SALT?.trim() ?? "",
    production: process.env.NODE_ENV === "production",
  };
}

export function sessionSecret(): string {
  const cfg = config();
  if (cfg.sessionSecret) return cfg.sessionSecret;
  if (cfg.botToken) return `sess:${cfg.botToken}`;
  if (cfg.devMode) return "dev-only-secret-not-for-production";
  throw new Error("Задай SESSION_SECRET");
}
