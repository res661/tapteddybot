import type { CardKind } from "./types.js";

export interface CardDef {
  id: string;
  category: "den" | "toys" | "picnic" | "rare";
  name: string;
  kind: CardKind;
  /** Доход/час на 1 уровне, либо % за уровень (тап и реген), либо бак за уровень. */
  base: number;
  price: number;
  minLevel: number;
  maxLevel: number;
}

export interface CategoryDef {
  id: CardDef["category"];
  name: string;
  blurb: string;
  minLevel: number;
}

export const CATEGORIES: CategoryDef[] = [
  { id: "den", name: "Берлога", blurb: "Дом, где мёд копится сам", minLevel: 1 },
  { id: "toys", name: "Игрушки", blurb: "Мастерская на чердаке", minLevel: 10 },
  { id: "picnic", name: "Пикник", blurb: "Поляна за городом", minLevel: 15 },
  { id: "rare", name: "Редкое", blurb: "То, чего нет в обычной лавке", minLevel: 20 },
];

type Row = [string, string, CardKind, number, number, number];

function cards(category: CardDef["category"], rows: Row[]): CardDef[] {
  return rows.map(([id, name, kind, base, price, minLevel]) => ({
    id,
    category,
    name,
    kind,
    base,
    price,
    minLevel,
    maxLevel: kind === "income" ? 15 : 10,
  }));
}

export const CARDS: CardDef[] = [
  ...cards("den", [
    ["pillow", "Подушка", "income", 200, 500, 1],
    ["softtap", "Мягкая лапа", "tap", 5, 900, 2],
    ["honeyjar", "Банка мёда", "income", 320, 900, 2],
    ["blanket", "Плед", "income", 480, 1600, 3],
    ["warmpaw", "Тёплая лапа", "tap", 5, 1400, 3],
    ["lamp", "Ночник", "regen", 8, 1800, 4],
    ["cocoa", "Какао", "income", 700, 2800, 4],
    ["rug", "Коврик", "income", 980, 4500, 5],
    ["hug", "Объятие", "energy", 40, 3200, 5],
    ["fireplace", "Камин", "income", 1400, 7500, 6],
    ["tale", "Сказка", "income", 1900, 12000, 8],
    ["moon", "Луна за окном", "income", 2600, 20000, 10],
  ]),
  ...cards("toys", [
    ["ball", "Мячик", "income", 440, 2500, 10],
    ["blocks", "Кубики", "tap", 5, 4000, 10],
    ["train", "Паровозик", "income", 700, 4000, 10],
    ["drum", "Барабан", "income", 1050, 6500, 11],
    ["topspin", "Юла", "regen", 8, 5000, 11],
    ["paints", "Краски", "income", 1500, 10000, 12],
    ["kite", "Воздушный змей", "income", 2100, 16000, 13],
    ["builder", "Конструктор", "energy", 40, 8000, 12],
    ["car", "Машинка", "income", 3000, 25000, 14],
    ["robot", "Робот", "income", 4200, 40000, 16],
    ["book", "Книжка", "income", 5600, 60000, 18],
    ["doll", "Кукла", "income", 7500, 90000, 20],
  ]),
  ...cards("picnic", [
    ["basket", "Корзинка", "income", 800, 8000, 15],
    ["thermos", "Термос", "tap", 5, 15000, 15],
    ["berries", "Ягоды", "income", 1300, 12000, 15],
    ["lemonade", "Лимонад", "income", 1900, 18000, 16],
    ["lantern", "Фонарик", "regen", 8, 18000, 16],
    ["guitar", "Гитара", "income", 2800, 28000, 17],
    ["meadow", "Плед на траве", "income", 3900, 40000, 18],
    ["campfire", "Костёр", "energy", 40, 22000, 17],
    ["marshmallow", "Зефир", "income", 5500, 60000, 19],
    ["compass", "Компас", "income", 7500, 90000, 20],
    ["tent", "Палатка", "income", 10000, 130000, 22],
    ["fireflies", "Светлячки", "income", 14000, 180000, 24],
  ]),
  ...cards("rare", [
    ["button", "Золотая пуговица", "income", 1600, 30000, 20],
    ["crown", "Корона", "tap", 5, 50000, 20],
    ["velvet", "Бархат", "income", 2500, 45000, 21],
    ["amber", "Янтарная лапа", "income", 3800, 70000, 22],
    ["medal", "Медаль", "income", 5500, 100000, 23],
    ["orchestra", "Оркестр", "income", 8000, 150000, 24],
    ["throne", "Трон", "income", 11000, 220000, 25],
    ["legendtap", "Легенда тапа", "tap", 5, 80000, 24],
    ["constellation", "Созвездие", "income", 16000, 320000, 26],
    ["emperor", "Император", "income", 22000, 450000, 28],
    ["keeper", "Хранитель", "income", 30000, 650000, 30],
    ["eternity", "Вечность", "income", 42000, 900000, 32],
  ]),
];

export function cardById(id: string): CardDef | undefined {
  return CARDS.find((c) => c.id === id);
}

export type Rarity = "common" | "rare" | "epic" | "legendary" | "mythic";
export type Accessory = "none" | "bow" | "crown" | "scarf" | "glasses" | "halo" | "star" | "flower" | "moon" | "honey" | "cape" | "bell" | "leaf" | "heart" | "patch" | "hood";
export type Backdrop = "none" | "glow" | "dots" | "rings" | "night" | "snow" | "honey" | "aurora" | "plaid";

export interface SkinBonus {
  tap: number;
  energy: number;
  regen: number;
  crit: number;
  offline: number;
}

export interface SkinDef {
  id: string;
  name: string;
  blurb: string;
  filter: string;
  currency: "free" | "coins" | "stars" | "reward";
  price: number;
  minLevel: number;
  rarity: Rarity;
  shop: boolean;
  accessory: Accessory;
  backdrop: Backdrop;
  bonus: SkinBonus;
  drop: boolean;
}

const Z: SkinBonus = { tap: 0, energy: 0, regen: 0, crit: 0, offline: 0 };

function skin(
  id: string,
  name: string,
  blurb: string,
  filter: string,
  rarity: Rarity,
  accessory: Accessory,
  backdrop: Backdrop,
  bonus: Partial<SkinBonus>,
  opts: { coins?: number; stars?: number; reward?: boolean; drop?: boolean; minLevel?: number } = {},
): SkinDef {
  const currency = opts.reward ? "reward" : opts.stars ? "stars" : opts.coins ? "coins" : "free";
  return {
    id,
    name,
    blurb,
    filter,
    currency,
    price: opts.stars ?? opts.coins ?? 0,
    minLevel: opts.minLevel ?? 1,
    rarity,
    shop: currency === "free" || currency === "coins" || currency === "stars",
    accessory,
    backdrop,
    bonus: { ...Z, ...bonus },
    drop: Boolean(opts.drop),
  };
}

export const SKINS: SkinDef[] = [
  skin("classic", "Классика", "Тот самый мишка", "", "common", "none", "none", {}),
  skin("honey", "Медовый", "Карамель на лапах", "sepia(.55) saturate(1.8) brightness(1.08)", "common", "honey", "honey", { tap: 0.01 }, { coins: 4000 }),
  skin("cream", "Сливочный", "Светлый плюш", "brightness(1.45) saturate(.35) sepia(.25)", "common", "bow", "glow", { offline: 0.02 }, { coins: 6000, minLevel: 2 }),
  skin("cocoa", "Какао", "Тёмный вечерний мех", "brightness(.48) saturate(.7) sepia(.45)", "common", "patch", "plaid", { energy: 12 }, { coins: 8000, minLevel: 3 }),
  skin("ribbon", "Бантик", "Праздничная лента", "saturate(1.15) brightness(1.05)", "common", "bow", "dots", { tap: 0.012 }, { drop: true }),
  skin("patch", "Заплатка", "Любимая штопка", "sepia(.2) contrast(1.05)", "common", "patch", "plaid", { regen: 0.012 }, { drop: true }),
  skin("cookie", "Печенька", "Крошки на животе", "sepia(.35) saturate(1.3)", "common", "heart", "honey", { offline: 0.015 }, { drop: true }),
  skin("denim", "Джинс", "Курточка с заплаткой", "hue-rotate(18deg) saturate(.7) brightness(.95)", "common", "hood", "dots", { energy: 18 }, { coins: 10000, minLevel: 4 }),
  skin("sand", "Песочный", "Пляж и тёплый бок", "sepia(.25) brightness(1.12) saturate(.8)", "common", "flower", "glow", { regen: 0.01 }, { drop: true }),
  skin("button", "Пуговица", "Одна блестящая", "contrast(1.08)", "common", "bell", "dots", { crit: 0.004 }, { drop: true }),
  skin("cherry", "Вишня", "Румяный плюш", "hue-rotate(-38deg) saturate(1.9)", "rare", "bow", "glow", { tap: 0.02 }, { coins: 25000, minLevel: 5 }),
  skin("forest", "Хвойный", "Лесной оттенок", "hue-rotate(58deg) saturate(1.15)", "rare", "leaf", "dots", { regen: 0.02 }, { coins: 30000, minLevel: 6 }),
  skin("berry", "Ягодный", "Сок на носу", "hue-rotate(-20deg) saturate(1.6)", "rare", "flower", "glow", { crit: 0.01 }, { drop: true }),
  skin("sailor", "Морячок", "Полоска и воротник", "hue-rotate(12deg) saturate(.85)", "rare", "scarf", "rings", { energy: 40 }, { drop: true }),
  skin("mint", "Мятный", "Прохладный плюш", "hue-rotate(80deg) saturate(.9) brightness(1.05)", "rare", "leaf", "glow", { offline: 0.03 }, { coins: 35000, minLevel: 8 }),
  skin("dusk", "Сумерки", "Сиреневый вечер", "hue-rotate(-8deg) brightness(.8) saturate(1.2)", "rare", "moon", "night", { tap: 0.018 }, { drop: true }),
  skin("plum", "Слива", "Глубокий фиолет", "hue-rotate(-55deg) saturate(1.3) brightness(.9)", "rare", "heart", "glow", { crit: 0.012 }, { drop: true }),
  skin("copper", "Медь", "Тёплый металл", "sepia(.7) saturate(1.5) hue-rotate(-8deg)", "rare", "bell", "rings", { energy: 45 }, { stars: 50, minLevel: 4 }),
  skin("night", "Полночь", "Почти тень", "brightness(.38) contrast(1.2) sepia(.3)", "epic", "moon", "night", { tap: 0.03 }, { stars: 120, minLevel: 8 }),
  skin("royal", "Королевский", "Мантия и корона", "hue-rotate(-12deg) saturate(1.35) contrast(1.05)", "epic", "crown", "rings", { energy: 70 }, { stars: 150, minLevel: 10 }),
  skin("gold", "Золотой", "Блеск без случайности", "sepia(.75) saturate(1.9) brightness(1.12)", "epic", "crown", "honey", { tap: 0.025, crit: 0.008 }, { stars: 100, minLevel: 6 }),
  skin("maple", "Кленовый", "Осенний пропуск", "hue-rotate(-6deg) sepia(.4) saturate(1.45)", "epic", "leaf", "glow", { offline: 0.04 }, { reward: true }),
  skin("storm", "Гроза", "Искра в шерсти", "contrast(1.25) saturate(1.1) brightness(.85)", "epic", "star", "rings", { regen: 0.03 }, { drop: true }),
  skin("aurora", "Сияние", "Северное полотно", "hue-rotate(40deg) saturate(1.5) brightness(1.05)", "epic", "halo", "aurora", { crit: 0.018 }, { drop: true }),
  skin("legend", "Легенда", "Сезонный блеск", "saturate(1.55) hue-rotate(-14deg) brightness(1.06)", "legendary", "crown", "aurora", { tap: 0.04 }, { stars: 350, minLevel: 12 }),
  skin("conductor", "Проводник", "За друзей, которые играют", "hue-rotate(14deg) saturate(1.25)", "legendary", "scarf", "rings", { offline: 0.05 }, { reward: true }),
  skin("emperor", "Император", "Тяжёлая мантия", "sepia(.45) contrast(1.15) saturate(1.2)", "legendary", "cape", "rings", { energy: 110 }, { stars: 400, minLevel: 15 }),
  skin("phoenix", "Феникс", "Тёплое перо", "sepia(.35) saturate(1.8) hue-rotate(-18deg) brightness(1.08)", "legendary", "halo", "glow", { crit: 0.028 }, { drop: true }),
  skin("myth", "Миф", "Шёпот плюша", "contrast(1.2) saturate(1.4) hue-rotate(20deg)", "mythic", "halo", "aurora", { tap: 0.05, crit: 0.02 }, { drop: true }),
  skin("cosmos", "Космос", "Звёзды на животе", "hue-rotate(200deg) saturate(.7) brightness(.75) contrast(1.15)", "mythic", "star", "night", { regen: 0.04, offline: 0.05 }, { stars: 800, minLevel: 20 }),
  skin("firstden", "Первая берлога", "Из набора новичка", "sepia(.15) saturate(1.25) brightness(1.08)", "epic", "heart", "honey", { tap: 0.02, offline: 0.02 }, { reward: true }),
  skin("veteran", "Ветеран", "30 уровень", "sepia(.4) contrast(1.08) hue-rotate(-8deg)", "legendary", "hood", "night", { tap: 0.03, energy: 40 }, { reward: true, minLevel: 30 }),
];

export function bonusText(bonus: SkinBonus, level = 1): string {
  const parts: string[] = [];
  const tap = Math.round(bonus.tap * level * 1000) / 10;
  const regen = Math.round(bonus.regen * level * 1000) / 10;
  const crit = Math.round(bonus.crit * level * 1000) / 10;
  const offline = Math.round(bonus.offline * level * 1000) / 10;
  if (tap) parts.push(`+${tap}% тап`);
  if (bonus.energy) parts.push(`+${bonus.energy * level} бак`);
  if (regen) parts.push(`+${regen}% реген`);
  if (crit) parts.push(`+${crit}% крит`);
  if (offline) parts.push(`+${offline}% оффлайн`);
  return parts.length ? parts.join(" · ") : "без бонуса";
}

export function skinById(id: string): SkinDef | undefined {
  return SKINS.find((s) => s.id === id);
}

export const PASS_XP_PER_LEVEL = 80;

export const FREE_TRACK: Record<number, string> = {
  1: "2 000 мёда",
  5: "Рамка",
  10: "10 000 мёда",
  15: "+100 к баку на сезон",
  20: "25 000 мёда",
  25: "Скин «Сливочный»",
  30: "Значок 30 уровня",
};

export const PAID_TRACK: Record<number, string> = {
  1: "15 000 мёда",
  3: "Заморозка серии",
  5: "Редкий скин «Кленовый»",
  10: "2 жетона бака",
  12: "Автопилот на 6 часов",
  15: "Скин «Легенда сезона»",
  25: "Медовый цвет имени",
  30: "Титул сезона и 50 000 мёда",
};

export function cardEffect(card: CardDef, level: number): string {
  const lvl = Math.max(0, level);
  if (card.kind === "income") return `+${card.base * Math.max(1, lvl)}/ч`;
  if (card.kind === "tap") return `+${card.base * Math.max(1, lvl)}% к тапу`;
  if (card.kind === "regen") return `+${card.base * Math.max(1, lvl)}% к регену`;
  return `+${card.base * Math.max(1, lvl)} к баку`;
}
