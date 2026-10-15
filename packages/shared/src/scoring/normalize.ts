import type { EntityKind } from '../categories/catalog.js';
export function normalizeText(text: string): string {
  return text
    .normalize('NFKC')
    .trim()
    .replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLocaleLowerCase('es')
    .replace(/\s+/g, ' ');
}
export const articleless = (text: string) =>
  normalizeText(text).replace(/^(el|la|los|las|the)\s+/u, '');
export const startsWithLetter = (text: string, letter: string) =>
  articleless(text).startsWith(normalizeText(letter));
export const ALIASES: Record<string, Record<string, string>> = {
  PERSON: { 'leo messi': 'lionel messi', cr7: 'cristiano ronaldo' },
  CLUB: { barca: 'fc barcelona', 'real madrid cf': 'real madrid' },
  NATIONAL_TEAM: { 'seleccion de mexico': 'mexico', 'seleccion de argentina': 'argentina' },
};
export function canonicalKey(text: string, kind: EntityKind, override?: string | null): string {
  const normal = articleless(override ?? text);
  return `${kind}:${ALIASES[kind]?.[normal] ?? normal}`;
}
