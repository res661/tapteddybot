import { createApp } from "./app.js";
import { startBot } from "./bot.js";
import { config } from "./config.js";
import { commit, ctxFor, maybeRollover, mustUser, prepare } from "./progress.js";
import { autopilotUserIds, initDb, tx } from "./store.js";

const cfg = config();
if (!cfg.devMode && !cfg.sessionSecret && !cfg.botToken) {
  console.error("Задай SESSION_SECRET или BOT_TOKEN");
  process.exit(1);
}
if (cfg.production && cfg.devMode) {
  console.warn("[tapteddy] DEV_MODE=1. Тестовые покупки без звёзд открыты. На бою поставь DEV_MODE=0.");
}

initDb(cfg.databasePath);
const app = createApp();
app.listen(cfg.port, "0.0.0.0", () => {
  console.log(`[tapteddy] слушает 0.0.0.0:${cfg.port}`);
});
startBot();

setInterval(() => {
  void tx(() => {
    const now = Date.now();
    maybeRollover(now);
    for (const id of autopilotUserIds(now)) {
      try {
        const user = mustUser(id);
        const ctx = ctxFor(user);
        prepare(ctx, now);
        commit(ctx);
      } catch (error) {
        console.error("[autopilot]", id, error instanceof Error ? error.message : error);
      }
    }
  }).catch((error) => console.error("[autopilot]", error instanceof Error ? error.message : error));
}, 30_000);
