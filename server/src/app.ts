import fs from "node:fs";
import path from "node:path";
import express, { type NextFunction, type Request, type Response } from "express";
import { verifySession } from "./auth.js";
import { perform, type GameAction } from "./actions.js";
import { config, repoRoot } from "./config.js";
import { GameError } from "./errors.js";
import { signSession, validateInitData } from "./auth.js";
import { commit, ctxFor, loginUser, mustUser, prepare, syncUser, type ChatLink } from "./progress.js";
import { clanBoard, clanRank, getClan, soloBoard, soloRank, tx } from "./store.js";
import { grantDevPurchase, openInvoice } from "./stars.js";
import { assertChatAdmin, tg } from "./tg.js";
import { present, presentLite } from "./view.js";

interface Authed {
  userId: number;
  kind: "tma" | "dev";
}

type AuthedRequest = Request & Authed;

const hits = new Map<string, { n: number; t: number }>();

function limit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const row = hits.get(key);
  if (!row || now - row.t > windowMs) {
    hits.set(key, { n: 1, t: now });
    return true;
  }
  row.n += 1;
  return row.n <= max;
}

function asyncRoute(fn: (req: AuthedRequest, res: Response) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req as AuthedRequest, res)).catch(next);
  };
}

function auth(req: Request, res: Response, next: NextFunction): void {
  const header = req.header("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  const session = token ? verifySession(token) : null;
  if (!session) {
    res.status(401).json({ error: "Нужна сессия" });
    return;
  }
  (req as AuthedRequest).userId = session.userId;
  (req as AuthedRequest).kind = session.kind;
  next();
}

function readAction(body: Record<string, unknown>): GameAction {
  const type = String(body.type ?? "");
  switch (type) {
    case "upgrade": {
      const kind = String(body.kind ?? "");
      if (kind !== "multitap" && kind !== "energy" && kind !== "regen") throw new GameError("Нет такого улучшения");
      return { type, kind };
    }
    case "card":
      return { type, cardId: String(body.cardId ?? "") };
    case "streak":
    case "save_streak":
    case "claim_passive":
    case "combo":
    case "use_token":
    case "claim_pass":
    case "clan_leave":
      return { type };
    case "code":
      return { type, code: String(body.code ?? "") };
    case "equip":
      return { type, skinId: String(body.skinId ?? "") };
    case "buy_skin":
    case "upgrade_skin":
      return { type, skinId: String(body.skinId ?? "") };
    case "open_box":
    case "claim_achievement":
      return { type };
    case "claim_task":
      return { type, taskId: String(body.taskId ?? "") };
    case "clan_join":
      return { type, code: String(body.code ?? "") };
    default:
      throw new GameError("Неизвестное действие");
  }
}

export function createApp(): express.Express {
  const app = express();
  app.disable("x-powered-by");
  app.use((_req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "no-referrer");
    next();
  });
  app.use(express.json({ limit: "32kb" }));

  app.get("/health", (_req, res) => {
    res.json({ ok: true, name: "tapteddy" });
  });

  app.post("/api/session", async (req, res, next) => {
    try {
      const ip = req.ip || req.socket.remoteAddress || "local";
      if (!limit(`session:${ip}`, 30, 60_000)) throw new GameError("Слишком много попыток входа", 429);
      const body = (req.body ?? {}) as Record<string, unknown>;
      const fp = typeof body.fp === "string" ? body.fp.slice(0, 128) : null;
      const now = Date.now();
      const cfg = config();
      const result = await tx(() => {
        if (typeof body.initData === "string" && body.initData.length > 0) {
          const parsed = validateInitData(body.initData, cfg.botToken, now);
          if (!parsed) throw new GameError("Сессия Telegram не прошла проверку", 401);
          const user = loginUser({
            id: parsed.user.id,
            firstName: parsed.user.first_name?.slice(0, 64) || "Игрок",
            username: parsed.user.username ?? null,
            kind: "tma",
            startParam: parsed.startParam,
            fp,
            now,
          });
          return { token: signSession("tma", user.id), dev: false, state: present(user, now) };
        }
        if (!cfg.devMode) throw new GameError("Открой игру внутри Telegram", 401);
        const devId = Math.floor(Number(body.devId ?? 10001));
        if (!Number.isFinite(devId) || devId < 1 || devId > 9_000_000_000_000) throw new GameError("Некорректный dev-аккаунт");
        const user = loginUser({
          id: devId,
          firstName: typeof body.name === "string" && body.name.trim() ? body.name.trim().slice(0, 64) : "Мишка",
          username: null,
          kind: "dev",
          startParam: typeof body.startParam === "string" ? body.startParam.slice(0, 64) : null,
          fp,
          now,
        });
        return { token: signSession("dev", user.id), dev: true, state: present(user, now) };
      });
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/state", auth, asyncRoute(async (req, res) => {
    const now = Date.now();
    const state = await tx(() => {
      const user = mustUser(req.userId);
      const ctx = ctxFor(user);
      prepare(ctx, now, { active: true });
      commit(ctx);
      return present(user, now);
    });
    res.json({ state, dev: req.kind === "dev" && config().devMode });
  }));

  app.post("/api/sync", auth, asyncRoute(async (req, res) => {
    if (!limit(`sync:${req.userId}`, 80, 10_000)) throw new GameError("Слишком часто", 429);
    const body = (req.body ?? {}) as Record<string, unknown>;
    const taps = Math.max(0, Math.min(40, Math.floor(Number(body.taps ?? 0))));
    const batchId = typeof body.batchId === "string" ? body.batchId.slice(0, 64) : "";
    const active = Boolean(body.active);
    const now = Date.now();
    const lite = await tx(() => {
      const gained = syncUser(req.userId, { taps: Number.isFinite(taps) ? taps : 0, batchId, active }, now);
      return presentLite(mustUser(req.userId), gained, now);
    });
    res.json(lite);
  }));

  app.post("/api/action", auth, asyncRoute(async (req, res) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    if (body.type === "dev_buy") {
      if (req.kind !== "dev" || !config().devMode) throw new GameError("Тестовая покупка выключена", 403);
      const sku = String(body.sku ?? "");
      const levels = body.levels == null ? undefined : Math.floor(Number(body.levels));
      const now = Date.now();
      await tx(() => {
        grantDevPurchase(req.userId, sku, levels ? { levels } : {}, now);
      });
      const state = await tx(() => present(mustUser(req.userId), Date.now()));
      res.json({ state, message: "Тестовая покупка прошла" });
      return;
    }
    if (body.type === "clan_create") {
      const rawChat = typeof body.chat === "string" ? body.chat.trim() : "";
      let chat: ChatLink | null = null;
      if (rawChat) {
        if (config().botToken) {
          const info = await assertChatAdmin(rawChat, req.userId);
          chat = { chatId: info.id, chatUsername: info.username, chatTitle: info.title };
        } else if (config().devMode) {
          chat = { chatId: null, chatUsername: rawChat.replace(/^@/, ""), chatTitle: rawChat };
        } else {
          throw new GameError("Бот не настроен", 503);
        }
      }
      const name = String(body.name ?? "");
      const result = await tx(() => perform(req.userId, { type: "clan_create", name, chat }));
      res.json(result);
      return;
    }
    const action = readAction(body);
    const result = await tx(() => perform(req.userId, action));
    res.json(result);
  }));

  app.post("/api/invoice", auth, asyncRoute(async (req, res) => {
    if (!config().botToken) throw new GameError("Платежи недоступны: не задан BOT_TOKEN", 503);
    const body = (req.body ?? {}) as Record<string, unknown>;
    const sku = String(body.sku ?? "");
    const levels = body.levels == null ? undefined : Math.floor(Number(body.levels));
    const now = Date.now();
    const opened = await tx(() => openInvoice(req.userId, sku, levels ? { levels } : {}, now));
    const url = await tg<string>("createInvoiceLink", {
      title: opened.quote.title,
      description: opened.quote.description,
      payload: opened.purchase.payload,
      currency: "XTR",
      prices: [{ label: opened.quote.title, amount: opened.quote.stars }],
    });
    res.json({ url, stars: opened.quote.stars, title: opened.quote.title });
  }));

  app.get("/api/leaderboard", auth, asyncRoute(async (req, res) => {
    const board = req.query.board === "clan" ? "clan" : "solo";
    const scope = req.query.scope === "all" ? "all" : "season";
    const now = Date.now();
    const payload = await tx(() => {
      const user = mustUser(req.userId);
      const ctx = ctxFor(user);
      prepare(ctx, now);
      commit(ctx);
      if (board === "solo") {
        const rows = soloBoard(scope, user.seasonId).map((row, index) => ({
          rank: index + 1,
          id: row.id,
          name: row.name,
          score: row.score,
          level: row.level,
          skin: row.skinId,
          frame: row.frame,
          nameColor: row.nameColor,
          badge: row.badges[0] ?? null,
          me: row.id === user.id,
        }));
        return { board, scope, meRank: soloRank(user, scope), rows };
      }
      const mine = user.clanId ? getClan(user.clanId) : null;
      const rows = clanBoard(scope, user.seasonId).map((clan, index) => ({
        rank: index + 1,
        id: clan.id,
        name: clan.name,
        score: scope === "season" ? clan.seasonPoints : clan.level,
        level: clan.level,
        flag: clan.data.flag,
        me: clan.id === user.clanId,
      }));
      return { board, scope, meRank: mine ? clanRank(mine, scope) : null, rows };
    });
    res.json(payload);
  }));

  const dist = path.resolve(repoRoot(), "web/dist");
  if (config().production && fs.existsSync(path.join(dist, "index.html"))) {
    app.use(express.static(dist, { index: false, maxAge: "1h" }));
    app.get("*", (req, res, next) => {
      if (req.path.startsWith("/api") || req.path === "/health") return next();
      res.setHeader("Cache-Control", "no-cache");
      res.sendFile(path.join(dist, "index.html"));
    });
  }

  app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (error instanceof GameError) {
      res.status(error.status).json({ error: error.message });
      return;
    }
    console.error("[http]", error);
    res.status(500).json({ error: "Внутренняя ошибка" });
  });

  return app;
}
