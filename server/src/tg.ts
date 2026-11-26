import { config } from "./config.js";
import { GameError } from "./errors.js";

interface TgResponse<T> {
  ok: boolean;
  description?: string;
  result?: T;
}

export async function tg<T = unknown>(method: string, body: Record<string, unknown>, timeoutMs = 20_000): Promise<T> {
  const token = config().botToken;
  if (!token) throw new GameError("Бот не настроен", 503);
  let response: Response;
  try {
    response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch {
    throw new GameError("Telegram не ответил", 502);
  }
  const json = (await response.json()) as TgResponse<T>;
  if (!json.ok) {
    console.error("[tg]", method, json.description ?? response.status);
    throw new GameError(json.description || "Ошибка Telegram", 502);
  }
  return json.result as T;
}

export interface VerifiedChat {
  id: number;
  title: string;
  username: string | null;
  type: string;
}

export async function assertChatAdmin(chat: string, userId: number): Promise<VerifiedChat> {
  const trimmed = chat.trim();
  const chatId = /^-?\d+$/.test(trimmed) ? Number(trimmed) : trimmed.startsWith("@") ? trimmed : `@${trimmed}`;
  try {
    const info = await tg<{ id: number; title?: string; username?: string; type: string }>("getChat", { chat_id: chatId });
    if (!["channel", "supergroup", "group"].includes(info.type)) throw new GameError("Нужен канал или группа");
    const member = await tg<{ status: string }>("getChatMember", { chat_id: info.id, user_id: userId });
    if (member.status !== "creator" && member.status !== "administrator") {
      throw new GameError("Нужны права админа в этом чате");
    }
    return { id: Number(info.id), title: info.title ?? trimmed, username: info.username ?? null, type: info.type };
  } catch (error) {
    if (error instanceof GameError && !/telegram|chat not found|forbidden|bot/i.test(error.message)) throw error;
    throw new GameError("Не вижу этот чат. Добавь бота админом и пришли @username канала или группы");
  }
}
