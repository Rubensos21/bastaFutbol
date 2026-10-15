import { z } from 'zod';
export interface LocalDraft {
  text: string;
  sequence: number;
  updatedAt: number;
  previousVersion: number;
}
const draftsSchema = z.record(
  z.string().max(60),
  z
    .object({
      text: z.string().max(80),
      sequence: z.number().int().nonnegative(),
      updatedAt: z.number().nonnegative(),
      previousVersion: z.number().int().nonnegative(),
    })
    .strict(),
);
export function draftKey(guest: string, room: string, round: string) {
  return `basta:draft:${guest}:${room}:${round}`;
}
export function readDrafts(key: string): Record<string, LocalDraft> {
  try {
    const result = draftsSchema.safeParse(JSON.parse(localStorage.getItem(key) ?? '{}'));
    return result.success ? result.data : {};
  } catch {
    return {};
  }
}
export function writeDrafts(key: string, drafts: Record<string, LocalDraft>) {
  try {
    localStorage.setItem(key, JSON.stringify(drafts));
  } catch {
    /* Navegación privada o cuota: se mantiene el borrador en memoria. */
  }
}
