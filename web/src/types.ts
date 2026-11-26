export type Tab = "tap" | "skins" | "boxes" | "tasks" | "top";

export interface GameState {
  now: number;
  channelUrl: string;
  me: {
    id: number;
    name: string;
    username: string | null;
    coins: number;
    level: number;
    xp: number;
    xpNeed: number;
    energy: number;
    energyMax: number;
    regenMs: number;
    multitap: number;
    perTap: number;
    tapCardsPct: number;
    boost: number;
    skin: string;
    badge: string | null;
    frame: string | null;
    nameColor: string | null;
    tankTokens: number;
    createdAt: number;
    tapCount: number;
    combo: number;
    crit: number;
  };
  streak: {
    day: number;
    claimedToday: boolean;
    canSave: boolean;
    freezes: number;
    rewards: { day: number; coins: number; extra: string }[];
  };
  passive: { bank: number; perHour: number; capHours: number };
  timers: { x2Until: number; autopilotUntil: number; autotapUntil: number; autotapPausedMs: number };
  clanBuff: { stormUntil: number; stormPct: number; buffUntil: number; buffPct: number };
  refill: { price: number; show: boolean; count: number };
  daily: {
    codeUnlocked: boolean;
    codeDone: boolean;
    codeReward: number;
    combo: { id: string; name: string; done: boolean }[];
    comboDone: boolean;
    comboReward: number;
  };
  pass: {
    seasonId: number;
    endsAt: number;
    owned: boolean;
    level: number;
    xpInto: number;
    xpPerLevel: number;
    claimedFree: number;
    claimedPaid: number;
    tracks: { level: number; free: string | null; paid: string | null }[];
  };
  upgrades: {
    multitap: { level: number; cost: number | null; capped: boolean; starPrice: number | null; starReadyAt: number };
    energy: { level: number; cost: number | null; nextCap: number };
    regen: { level: number; cost: number | null };
  };
  categories: {
    id: string;
    name: string;
    blurb: string;
    minLevel: number;
    locked: boolean;
    cards: {
      id: string;
      name: string;
      kind: string;
      level: number;
      max: number;
      effect: string;
      next: string;
      cost: number | null;
      locked: boolean;
      minLevel: number;
    }[];
  }[];
  skins: {
    id: string;
    name: string;
    blurb: string;
    filter: string;
    price: number;
    currency: string;
    rarity: string;
    accessory: string;
    backdrop: string;
    level: number;
    shards: number;
    bonus: string;
    nextBonus: string;
    upgradeCoins: number | null;
    upgradeShards: number | null;
    owned: boolean;
    equipped: boolean;
    locked: boolean;
    minLevel: number;
    shop: boolean;
    drop: boolean;
  }[];
  collection: { owned: number; total: number; pct: number };
  box: { charges: number; progress: number; goal: number; opened: number; odds: { rarity: string; pct: number }[] };
  tasks: { id: string; title: string; goal: number; value: number; done: boolean; claimed: boolean; reward: string }[];
  achievements: { id: string; title: string; goal: number; value: number; done: boolean; claimed: boolean; coins: number }[];
  league: { id: string; name: string; min: number; next: number | null; score: number };
  products: { sku: string; group: string; title: string; description: string; stars: number | null; reason?: string }[];
  newbie: { available: boolean; until: number } | null;
  offer: { id: string; title: string; description: string; stars: number; until: number } | null;
  clan: null | {
    id: number;
    name: string;
    code: string;
    link: string;
    level: number;
    members: number;
    cap: number;
    weekPoints: number;
    seasonPoints: number;
    totalPoints: number;
    rankSeason: number;
    stormPct: number;
    stormUntil: number;
    buffPct: number;
    buffUntil: number;
    flag: string | null;
    owner: boolean;
    chat: string | null;
    top: { id: number; name: string; points: number; level: number }[];
  };
  friends: {
    link: string;
    total: number;
    qualified: number;
    list: { id: number; name: string; level: number; qualified: boolean; taps: number }[];
    milestones: { n: number; label: string; done: boolean }[];
  };
  rankSeason: number;
}

export interface LiteState {
  now: number;
  me: {
    coins: number;
    level: number;
    xp: number;
    xpNeed: number;
    energy: number;
    energyMax: number;
    regenMs: number;
    perTap: number;
    tapCount: number;
    tankTokens: number;
    multitap: number;
    boost: number;
    combo: number;
  };
  passive: GameState["passive"];
  timers: GameState["timers"];
  clanBuff: GameState["clanBuff"];
  refill: GameState["refill"];
  streak: { day: number; claimedToday: boolean; canSave: boolean; freezes: number };
  box: { charges: number; progress: number };
  gained: { taps: number; coins: number; perTap: number; crits: number; combo: number; boxes: number; levelUp: boolean };
}

export interface BoardResponse {
  board: "solo" | "clan";
  scope: "season" | "all";
  meRank: number | null;
  rows: {
    rank: number;
    id: number;
    name: string;
    score: number;
    level: number;
    me?: boolean;
    skin?: string;
    frame?: string | null;
    nameColor?: string | null;
    badge?: string | null;
    flag?: string | null;
  }[];
}
