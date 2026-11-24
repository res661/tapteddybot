import { GameError } from "./errors.js";
import {
  buyCard,
  buySkinCoins,
  buyUpgrade,
  claimBank,
  claimCombo,
  claimPass,
  claimStreak,
  commit,
  createClan,
  ctxFor,
  equipSkin,
  joinClan,
  leaveClan,
  maybeRollover,
  mustUser,
  prepare,
  qualifyReferral,
  saveStreak,
  submitCode,
  useTankToken,
  type ChatLink,
} from "./progress.js";
import { present, type FullDTO } from "./view.js";

export type GameAction =
  | { type: "upgrade"; kind: "multitap" | "energy" | "regen" }
  | { type: "card"; cardId: string }
  | { type: "streak" }
  | { type: "save_streak" }
  | { type: "claim_passive" }
  | { type: "code"; code: string }
  | { type: "combo" }
  | { type: "equip"; skinId: string }
  | { type: "buy_skin"; skinId: string }
  | { type: "use_token" }
  | { type: "claim_pass" }
  | { type: "clan_create"; name: string; chat: ChatLink | null }
  | { type: "clan_join"; code: string }
  | { type: "clan_leave" };

export function perform(userId: number, action: GameAction, now = Date.now()): { state: FullDTO; message: string } {
  maybeRollover(now);
  const user = mustUser(userId);
  const ctx = ctxFor(user);
  prepare(ctx, now, { active: true });
  let message = "Готово";
  switch (action.type) {
    case "upgrade":
      buyUpgrade(ctx, action.kind);
      message = "Прокачано";
      break;
    case "card":
      buyCard(ctx, action.cardId, now);
      message = "Карта стала сильнее";
      break;
    case "streak":
      claimStreak(ctx, now);
      message = "Награда серии у тебя";
      break;
    case "save_streak":
      saveStreak(ctx, now);
      message = "Серия сохранена";
      break;
    case "claim_passive": {
      const bank = claimBank(ctx, now);
      message = `Забрал ${bank} мёда`;
      break;
    }
    case "code": {
      const reward = submitCode(ctx, action.code, now);
      message = `Код принят, +${reward}`;
      break;
    }
    case "combo": {
      const reward = claimCombo(ctx, now);
      message = `Комбо собрано, +${reward}`;
      break;
    }
    case "equip":
      equipSkin(user, action.skinId);
      message = "Окрас надет";
      break;
    case "buy_skin":
      buySkinCoins(user, action.skinId);
      message = "Окрас куплен";
      break;
    case "use_token":
      useTankToken(user, now);
      message = "Бак полон";
      break;
    case "claim_pass":
      claimPass(user, now);
      message = "Награды пропуска забраны";
      break;
    case "clan_create":
      createClan(user, action.name, action.chat, now);
      message = "Клан создан";
      break;
    case "clan_join":
      joinClan(user, action.code, now);
      message = "Добро пожаловать в клан";
      break;
    case "clan_leave":
      leaveClan(user, now);
      message = "Ты вышел из клана";
      break;
    default:
      throw new GameError("Неизвестное действие");
  }
  qualifyReferral(user, now);
  commit(ctx);
  return { state: present(mustUser(userId), now), message };
}
