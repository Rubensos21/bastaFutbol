import type { Category } from '../categories/catalog.js';
import type { Entry, PlayerScore, RoundState, ScoredEntry } from '../types/index.js';
import { canonicalKey, startsWithLetter } from './normalize.js';
export function scoreRound(
  entries: Entry[],
  categories: Category[],
  letter: string,
  annulled: string[] = [],
): ScoredEntry[] {
  const seen = new Map<string, Set<string>>();
  const scored: ScoredEntry[] = [];
  // La prioridad depende del orden de las columnas, nunca del orden de los mensajes.
  for (const cat of categories)
    for (const entry of entries.filter((e) => e.categoryId === cat.id)) {
      const key = canonicalKey(entry.text, cat.entityKind, entry.canonical);
      const used = seen.get(entry.participantId) ?? new Set<string>();
      seen.set(entry.participantId, used);
      let reason = '';
      if (annulled.includes(cat.id)) reason = 'Anulado';
      else if (!entry.text.trim()) reason = 'Vacío';
      else if (!startsWithLetter(entry.text, letter)) reason = 'No comienza con la letra';
      else if (used.has(key)) reason = 'Repetido por ti';
      else if (entry.verdict !== 'VALID')
        reason = entry.verdict === 'INVALID' ? 'No cumple la categoría' : 'Pendiente de dictamen';
      // Una aparición previa no vacía reserva la entidad incluso si su categoría es inválida.
      if (entry.text.trim() && !annulled.includes(cat.id)) used.add(key);
      scored.push({
        ...entry,
        canonicalKey: key,
        points: reason ? 0 : 20,
        scoreReason: reason || 'Válida y única',
        duplicates: 0,
      });
    }
  for (const item of scored)
    if (item.points) {
      const others = scored.filter(
        (e) =>
          e.categoryId === item.categoryId && e.points > 0 && e.canonicalKey === item.canonicalKey,
      );
      item.duplicates = others.length - 1;
      if (others.length > 1) {
        item.points = 10;
        item.scoreReason = 'Válida y duplicada';
      }
    }
  return scored;
}
export function roundTotals(scored: ScoredEntry[], ids: string[]): PlayerScore[] {
  return ids.map((participantId) => {
    const cells = scored.filter((e) => e.participantId === participantId);
    return {
      participantId,
      total: cells.reduce((s, e) => s + e.points, 0),
      uniqueCount: cells.filter((e) => e.points === 20).length,
      validCount: cells.filter((e) => e.points > 0).length,
    };
  });
}
export function ranking(rounds: RoundState[], ids: string[]): PlayerScore[] {
  const values = ids.map((participantId) =>
    rounds.reduce<PlayerScore>(
      (s, r) => {
        const v = r.scores.find((v) => v.participantId === participantId);
        return {
          participantId,
          total: s.total + (v?.total ?? 0),
          uniqueCount: s.uniqueCount + (v?.uniqueCount ?? 0),
          validCount: s.validCount + (v?.validCount ?? 0),
        };
      },
      { participantId, total: 0, uniqueCount: 0, validCount: 0 },
    ),
  );
  values.sort(
    (a, b) => b.total - a.total || b.uniqueCount - a.uniqueCount || b.validCount - a.validCount,
  );
  let rank = 1;
  return values.map((v, i) => {
    const prev = values[i - 1];
    if (
      prev &&
      (prev.total !== v.total ||
        prev.uniqueCount !== v.uniqueCount ||
        prev.validCount !== v.validCount)
    )
      rank = i + 1;
    return { ...v, rank };
  });
}
