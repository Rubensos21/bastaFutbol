export const MAX_PLAYERS = 7;
export const BASIC_LETTERS = 'ABCDEFGHIJLMNOPRSTUVZ'.split('');
export const PHASES = [
  'LOBBY',
  'STARTING',
  'SELECTING_SPINNER',
  'LETTER_REVEAL',
  'COUNTDOWN',
  'ANSWERING',
  'ANSWERS_LOCKED',
  'REVIEW',
  'SCORING',
  'ROUND_RESULTS',
  'FINAL_RESULTS',
  'FINISHED',
] as const;
export type Phase = (typeof PHASES)[number];
export const REVEALED_PHASES: Phase[] = [
  'ANSWERS_LOCKED',
  'REVIEW',
  'SCORING',
  'ROUND_RESULTS',
  'FINAL_RESULTS',
  'FINISHED',
];
export const bastaDeadline = (now: number, originalEnd: number) =>
  Math.min(originalEnd, now + 10_000);
export const remainingSeconds = (end: number | null, now: number) =>
  end === null ? 0 : Math.max(0, Math.ceil((end - now) / 1000));
