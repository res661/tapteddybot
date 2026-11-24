export type CardKind = "income" | "tap" | "regen" | "energy";

export interface CardProgress {
  level: number;
  day: string;
  dayLevels: number;
}

export interface Freeze {
  exp: number;
}

export interface UserData {
  xp: number;
  energy: number;
  energyAt: number;
  bonusEnergy: number;
  seasonEnergyBonus: number;
  seasonEnergyBonusSeason: number;
  multitap: number;
  energyLevel: number;
  regenLevel: number;
  tapCount: number;
  passiveBank: number;
  passiveFrac: number;
  passiveBankedMs: number;
  passiveAt: number;
  streakDay: number;
  streakLast: string | null;
  freezes: Freeze[];
  paidFreezeWeek: string;
  paidFreezeCount: number;
  passFreezeWeek: string;
  welcomeGranted: boolean;
  refStarsPaid: boolean;
  refFrac: number;
  badges: string[];
  frames: string[];
  frame: string | null;
  frameUntil: number;
  nameColor: string | null;
  passSeason: number;
  passXp: number;
  passClaimedFree: number;
  passClaimedPaid: number;
  tapTokens: number;
  tapTokensAt: number;
  x2Until: number;
  autopilotUntil: number;
  autopilotAt: number;
  autotapUntil: number;
  autotapPauseLeft: number;
  autotapPauseSince: number;
  autotapLastClient: number;
  autotapLastTick: number;
  clanJoinedAt: number;
  clanLeftAt: number;
  tankTokens: number;
  refillDay: string;
  refillCount: number;
  starMtap: number;
  starMtapAt: number;
  newbieBought: boolean;
  energySpentMod: number;
  comboDay: string | null;
  codeDay: string | null;
  weekId: string;
  weekScore: number;
  reviewFlag: boolean;
  batches: string[];
  cards: Record<string, CardProgress>;
  skins: string[];
  offers: string[];
  level5Granted: boolean;
  veteranGranted: boolean;
}

export interface User {
  id: number;
  username: string | null;
  firstName: string;
  coins: number;
  level: number;
  seasonScore: number;
  seasonId: number;
  clanId: number | null;
  referrerId: number | null;
  createdAt: number;
  skinId: string;
  refOk: boolean;
  deviceFp: string | null;
  data: UserData;
}

export interface ClanData {
  chatId: number | null;
  chatUsername: string | null;
  chatTitle: string | null;
  stormPct: number;
  stormUntil: number;
  stormDay: string;
  stormCount: number;
  buffPct: number;
  buffUntil: number;
  flag: string | null;
  createdAt: number;
  contributions: Record<string, number>;
}

export interface Clan {
  id: number;
  code: string;
  name: string;
  ownerId: number;
  level: number;
  weekPoints: number;
  weekId: string;
  seasonPoints: number;
  seasonId: number;
  totalPoints: number;
  data: ClanData;
}

export type Grant =
  | { op: "coins"; amount: number }
  | { op: "energy"; before: number; taps: number }
  | { op: "multitap" }
  | { op: "x2"; ms: number }
  | { op: "autopilot"; ms: number }
  | { op: "autotap"; ms: number }
  | { op: "skin"; id: string }
  | { op: "pass"; season: number }
  | { op: "freeze"; exp: number }
  | { op: "tokens"; n: number }
  | { op: "frame"; id: string }
  | { op: "color"; id: string }
  | { op: "badge"; id: string }
  | { op: "storm" }
  | { op: "passxp"; amount: number }
  | { op: "offer"; id: string }
  | { op: "newbie" };

export interface Purchase {
  id: number;
  userId: number;
  sku: string;
  stars: number;
  payload: string;
  chargeId: string | null;
  status: "pending" | "paid" | "refunded" | "failed";
  grants: Grant[];
  meta: Record<string, unknown>;
  title: string;
  createdAt: number;
  paidAt: number | null;
}
