import { config } from "./config.js";
import { GameError } from "./errors.js";
import { dailyCode, utcDay } from "./economy.js";
import { dailySalt, parseClan, parseRef } from "./progress.js";
import { getPurchaseByCharge, setLink, tx } from "./store.js";
import { assertPayable, fulfillPurchase, refundPurchase } from "./stars.js";
import { tg } from "./tg.js";

interface TgUser {
  id: number;
  first_name?: string;
  username?: string;
}

interface Update {
  update_id: number;
  message?: {
    text?: string;
    from?: TgUser;
    chat?: { id: number };
    successful_payment?: {
      currency: string;
      total_amount: number;
      invoice_payload: string;
      telegram_payment_charge_id: string;
    };
  };
  pre_checkout_query?: {
    id: string;
    from: TgUser;
    currency: string;
    total_amount: number;
    invoice_payload: string;
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isAdmin(id: number): boolean {
  return config().adminIds.includes(id);
}

async function reply(chatId: number, text: string, withButton = false): Promise<void> {
  const extra: Record<string, unknown> = {};
  const url = config().webappUrl;
  if (withButton && url.startsWith("https://")) {
    extra.reply_markup = { inline_keyboard: [[{ text: "Играть", web_app: { url } }]] };
  }
  await tg("sendMessage", { chat_id: chatId, text, ...extra });
}

async function handle(update: Update): Promise<void> {
  if (update.pre_checkout_query) {
    const query = update.pre_checkout_query;
    let error = "Счёт устарел";
    let ok = false;
    try {
      await tx(() => assertPayable(query.invoice_payload, query.total_amount, query.from.id, Date.now()));
      ok = true;
    } catch (err) {
      error = err instanceof GameError ? err.message : "Не вышло подтвердить оплату";
    }
    await tg("answerPreCheckoutQuery", ok ? { pre_checkout_query_id: query.id, ok: true } : { pre_checkout_query_id: query.id, ok: false, error_message: error.slice(0, 200) });
    return;
  }

  const message = update.message;
  if (!message?.from || !message.chat) return;
  const from = message.from;
  if (message.successful_payment) {
    const pay = message.successful_payment;
    if (pay.currency !== "XTR") return;
    try {
      const purchase = await tx(() => fulfillPurchase(pay.invoice_payload, pay.telegram_payment_charge_id, from.id, pay.total_amount, Date.now()));
      console.log("[pay] оплачено", purchase.userId, purchase.sku, purchase.stars, purchase.chargeId);
      await reply(message.chat.id, `Оплата прошла: ${purchase.title}. Если товар не появился, открой игру ещё раз или напиши /paysupport.`);
    } catch (error) {
      console.error("[pay] выдача", error instanceof Error ? error.message : error);
      await reply(message.chat.id, "Звёзды дошли, но выдать товар сразу не получилось. Напиши /paysupport, разберёмся.");
    }
    return;
  }

  const text = (message.text ?? "").trim();
  if (!text) return;
  const [command, arg] = text.split(/\s+/, 2);

  if (command === "/start") {
    const ref = parseRef(arg);
    const clan = parseClan(arg);
    if (ref || clan) await tx(() => setLink(from.id, ref, clan));
    const tail = config().webappUrl.startsWith("https://") ? "Жми «Играть»." : `Локальный адрес: ${config().webappUrl}`;
    await reply(message.chat.id, `Привет, ${from.first_name ?? "друг"}! Это TapTeddy: тапай мишку, копи мёд, зови друзей.\n\nТвой Telegram id: ${from.id}\n${tail}`, true);
    return;
  }
  if (command === "/help") {
    await reply(
      message.chat.id,
      "Тапай мишку, пока есть энергия. Мёд уходит в прокачку и карты. Энергия сама возвращается.\nСерия — раз в сутки. Код дня публикует канал. Друзей зови ссылкой из вкладки «Друзья».\nЗвёзды покупают время и окрасы, не место в топе. Случайных ящиков нет.",
      true,
    );
    return;
  }
  if (command === "/paysupport") {
    const support = config().supportUsername ? `@${config().supportUsername}` : "этот чат";
    await reply(
      message.chat.id,
      `Оплата идёт звёздами Telegram, их получает владелец бота. Вывода мёда нет.\n\nЕсли звёзды списались, а товар не пришёл — напиши в ${support}. Укажи дату, сумму и, если есть, id платежа.\nВозврат делаем целым платежом: снимаем неиспользованные жетоны и таймеры. Мёд из набора забираем только если он ещё на балансе.`,
    );
    if (config().adminIds.length > 0) {
      for (const admin of config().adminIds) {
        if (admin === from.id) continue;
        await tg("sendMessage", { chat_id: admin, text: `paysupport от ${from.id}${from.username ? ` @${from.username}` : ""}` }).catch(() => undefined);
      }
    }
    return;
  }
  if (command === "/dailycode") {
    if (!isAdmin(from.id)) {
      await reply(message.chat.id, "Код дня публикуется в канале. Вводить его нужно в игре.");
      return;
    }
    const code = await tx(() => dailyCode(utcDay(Date.now()), dailySalt()));
    await reply(message.chat.id, `Код дня (UTC): ${code}`);
    return;
  }
  if (command === "/refund") {
    if (!isAdmin(from.id)) {
      await reply(message.chat.id, "Эта команда только для владельца.");
      return;
    }
    if (!arg) {
      await reply(message.chat.id, "Формат: /refund <telegram_payment_charge_id>");
      return;
    }
    const purchase = await tx(() => getPurchaseByCharge(arg));
    if (!purchase || purchase.status !== "paid" || !purchase.chargeId) {
      await reply(message.chat.id, "Оплаченный счёт с таким id не найден.");
      return;
    }
    try {
      await tg("refundStarPayment", { user_id: purchase.userId, telegram_payment_charge_id: purchase.chargeId });
      await tx(() => refundPurchase(purchase.chargeId!, Date.now()));
      await reply(message.chat.id, `Возврат отправлен, товар откатился где это возможно. Игрок ${purchase.userId}, ${purchase.stars}⭐.`);
    } catch (error) {
      console.error("[refund]", error instanceof Error ? error.message : error);
      await reply(message.chat.id, "Telegram не принял возврат. Смотри лог сервера.");
    }
    return;
  }

  await reply(message.chat.id, "Я открываю игру. Команды: /help и /paysupport.", true);
}

async function setup(): Promise<void> {
  try {
    await tg("setMyCommands", {
      commands: [
        { command: "start", description: "Открыть TapTeddy" },
        { command: "help", description: "Как играть" },
        { command: "paysupport", description: "Помощь по оплате Stars" },
      ],
    });
    if (config().webappUrl.startsWith("https://")) {
      await tg("setChatMenuButton", { menu_button: { type: "web_app", text: "Играть", web_app: { url: config().webappUrl } } });
    }
    console.log("[bot] команды обновлены");
  } catch (error) {
    console.error("[bot] не удалось записать команды", error instanceof Error ? error.message : error);
  }
}

async function loop(): Promise<void> {
  let offset = 0;
  console.log("[bot] long polling");
  for (;;) {
    try {
      const updates = await tg<Update[]>("getUpdates", { offset, timeout: 50, allowed_updates: ["message", "pre_checkout_query"] }, 60_000);
      for (const update of updates) {
        offset = update.update_id + 1;
        try {
          await handle(update);
        } catch (error) {
          console.error("[bot] update", error instanceof Error ? error.message : error);
        }
      }
    } catch (error) {
      console.error("[bot] poll", error instanceof Error ? error.message : error);
      await sleep(2000);
    }
  }
}

export function startBot(): void {
  if (!config().botToken) {
    console.log("[bot] BOT_TOKEN пустой, опрос Telegram выключен");
    return;
  }
  void setup();
  void loop();
}
