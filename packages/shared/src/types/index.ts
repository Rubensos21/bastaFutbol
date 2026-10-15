import type { Category } from '../categories/catalog.js';
import type { Phase } from '../constants/index.js';
export interface Settings {
  capacity: number | null;
  rounds: 3 | 5 | 7 | 10;
  roundSeconds: 60 | 90 | 120 | 180;
  bastaEnabled: boolean;
  letters: string[];
  disabledCategories: string[];
}
export interface Member {
  id: string;
  guestId: string;
  nickname: string;
  slot: number;
  ready: boolean;
  connected: boolean;
  joinedAt: number;
  lastSeenAt: number;
  left: boolean;
}
export interface Reservation {
  slot: number;
  nickname: string;
  claimantId: string | null;
  approved: boolean;
}
export type Verdict = 'PENDING' | 'VALID' | 'INVALID' | 'DISPUTED';
export interface Vote {
  voterId: string;
  valid: boolean;
  reason: string;
}
export interface Entry {
  id: string;
  participantId: string;
  categoryId: string;
  text: string;
  version: number;
  updatedAt: number;
  verdict: Verdict;
  reason: string;
  canonical: string | null;
  votes: Vote[];
  appealed: boolean;
  resolvedBy: string | null;
  evidence: string | null;
  /** Puntos forzados explícitamente por el anfitrión vía review:award. Cuando está definido
   *  y la entrada no tiene error estructural, scoreRound usa este valor en lugar de calcular
   *  por duplicados (0 = inválida, 10 = forzado duplicada, 20 = forzado única). */
  hostPoints?: 0 | 10 | 20;
}
export interface ScoredEntry extends Entry {
  points: 0 | 10 | 20;
  scoreReason: string;
  canonicalKey: string;
  duplicates: number;
}
export interface PlayerScore {
  participantId: string;
  total: number;
  uniqueCount: number;
  validCount: number;
  rank?: number;
}
export interface RoundState {
  id: string;
  number: number;
  pickerId: string;
  letter: string | null;
  answeringStartsAt: number | null;
  originalEndsAt: number | null;
  answeringEndsAt: number | null;
  reviewEndsAt: number | null;
  bastaBy: string | null;
  submitted: string[];
  entries: Entry[];
  annulled: string[];
  annulVotes: Record<string, string[]>;
  scores: PlayerScore[];
  scoredEntries: ScoredEntry[];
  cancelled: boolean;
}
export interface Audit {
  type: string;
  actorId: string | null;
  at: number;
  revision: number;
  payload: Record<string, unknown>;
}
export interface RoomState {
  id: string;
  code: string;
  hostId: string;
  gameId: string;
  phase: Phase;
  phaseStartedAt: number;
  endsAt: number | null;
  revision: number;
  expiresAt: number;
  settings: Settings;
  members: Member[];
  reservations: Reservation[];
  categories: Category[];
  rounds: RoundState[];
  pickerBag: string[];
  usedLetters: string[];
  events: Audit[];
  pausedAt: number | null;
}
export interface Snapshot {
  code: string;
  hostId: string;
  meId: string;
  writable: boolean;
  phase: Phase;
  phaseStartedAt: number;
  endsAt: number | null;
  revision: number;
  serverNow: number;
  settings: Settings;
  members: Omit<Member, 'guestId'>[];
  reservations: Reservation[];
  categories: Category[];
  round: RoundState | null;
  history: RoundState[];
  ranking: PlayerScore[];
  progress: Record<string, number>;
  events: Audit[];
  pausedAt: number | null;
}
export type Ack<T = Snapshot> =
  | { ok: true; data: T; revision: number }
  | { ok: false; error: { code: string; message: string } };

export interface RoomPreview {
  code: string;
  phase: Phase;
  capacity: number;
  memberCount: number;
  slots: { slot: number; reservedName: string | null }[];
}
