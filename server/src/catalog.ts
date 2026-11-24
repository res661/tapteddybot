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

export interface SkinDef {
  id: string;
  name: string;
  blurb: string;
  filter: string;
  currency: "free" | "coins" | "stars" | "reward";
  price: number;
  minLevel: number;
  rarity: "common" | "rare" | "legend" | "special";
  shop: boolean;
}

export const SKINS: SkinDef[] = [
  { id: "classic", name: "Классика", blurb: "Тот самый мишка", filter: "", currency: "free", price: 0, minLevel: 1, rarity: "common", shop: true },
  { id: "honey", name: "Медовый", blurb: "Тёплый карамельный оттенок", filter: "sepia(0.55) saturate(1.8) brightness(1.08)", currency: "coins", price: 5000, minLevel: 1, rarity: "common", shop: true },
  { id: "cream", name: "Сливочный", blurb: "Светлая плюшевая шубка", filter: "brightness(1.45) saturate(0.35) sepia(0.25)", currency: "coins", price: 8000, minLevel: 2, rarity: "common", shop: true },
  { id: "cocoa", name: "Какао", blurb: "Тёмный вечерний мех", filter: "brightness(0.48) saturate(0.7) sepia(0.45)", currency: "coins", price: 15000, minLevel: 3, rarity: "common", shop: true },
  { id: "cherry", name: "Вишня", blurb: "Румяный плюш", filter: "hue-rotate(-38deg) saturate(1.9) brightness(1.05)", currency: "coins", price: 25000, minLevel: 5, rarity: "common", shop: true },
  { id: "forest", name: "Хвойный", blurb: "Лесной оттенок", filter: "hue-rotate(58deg) saturate(1.2) brightness(0.92)", currency: "coins", price: 40000, minLevel: 8, rarity: "common", shop: true },
  { id: "night", name: "Полночь", blurb: "Почти тень", filter: "brightness(0.38) contrast(1.2) sepia(0.35)", currency: "coins", price: 80000, minLevel: 10, rarity: "common", shop: true },
  { id: "firstden", name: "Первая берлога", blurb: "Из набора новичка", filter: "sepia(0.12) saturate(1.25) brightness(1.08)", currency: "reward", price: 0, minLevel: 1, rarity: "special", shop: false },
  { id: "gold", name: "Золотой", blurb: "Только вид. К мёду не прибавляет", filter: "sepia(0.62) saturate(1.75) brightness(1.12)", currency: "stars", price: 50, minLevel: 1, rarity: "common", shop: true },
  { id: "royal", name: "Королевский", blurb: "Редкий окрас без бонуса к доходу", filter: "hue-rotate(-10deg) saturate(1.3) contrast(1.05) brightness(1.04)", currency: "stars", price: 150, minLevel: 15, rarity: "rare", shop: true },
  { id: "legend", name: "Легенда сезона", blurb: "Сезонный окрас. Силы не даёт", filter: "saturate(1.5) hue-rotate(-14deg) brightness(1.06)", currency: "stars", price: 350, minLevel: 1, rarity: "legend", shop: true },
  { id: "maple", name: "Кленовый", blurb: "Награда платной дорожки", filter: "hue-rotate(-6deg) sepia(0.35) saturate(1.4) brightness(1.05)", currency: "reward", price: 0, minLevel: 1, rarity: "rare", shop: false },
  { id: "conductor", name: "Проводник", blurb: "За 25 друзей, которые играют", filter: "hue-rotate(14deg) saturate(1.2) brightness(1.04)", currency: "reward", price: 0, minLevel: 1, rarity: "special", shop: false },
  { id: "veteran", name: "Ветеран", blurb: "Открывается на 30 уровне", filter: "sepia(0.4) contrast(1.08) hue-rotate(-8deg)", currency: "reward", price: 0, minLevel: 30, rarity: "special", shop: false },
];

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
