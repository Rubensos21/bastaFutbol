import {
  startsWithLetter,
  scoreRound,
  type Entry,
  type RoomState,
  type RoundState,
} from '@basta/shared';
import { requireRule } from '../game/errors.js';
export class ReviewService {
  structural(state: RoomState, round: RoundState) {
    const preview = scoreRound(
      round.entries.map((e) => ({ ...e, verdict: 'VALID' as const, hostPoints: undefined })),
      state.categories,
      round.letter!,
      round.annulled,
    );
    for (const entry of round.entries) {
      const score = preview.find((s) => s.id === entry.id)!;
      if (score.points === 0) {
        entry.verdict = 'INVALID';
        entry.reason = score.scoreReason;
      } else {
        entry.verdict = 'PENDING';
        entry.reason = 'Requiere revisión humana';
      }
    }
  }
  tally(entry: Entry) {
    if (
      entry.resolvedBy ||
      entry.appealed ||
      ['Vacío', 'No comienza con la letra', 'Repetido por ti', 'Anulado'].includes(entry.reason)
    )
      return;
    const yes = entry.votes.filter((v) => v.valid).length,
      no = entry.votes.length - yes;
    entry.verdict = yes === no ? 'DISPUTED' : yes > no ? 'VALID' : 'INVALID';
    entry.reason =
      yes === no ? 'Empate o ausencia de votos' : `Votación: ${yes} a favor, ${no} en contra`;
  }
  moderator(state: RoomState, entry: Entry): string | null {
    const host = state.members.find((m) => m.id === state.hostId && m.connected && !m.left);
    if (host && host.id !== entry.participantId) return host.id;
    return (
      state.members
        .filter((m) => m.connected && !m.left && m.id !== entry.participantId)
        .sort((a, b) => a.joinedAt - b.joinedAt || a.id.localeCompare(b.id))[0]?.id ?? null
    );
  }
  votable(state: RoomState, entry: Entry, round: RoundState) {
    requireRule(
      entry.text.trim() &&
        startsWithLetter(entry.text, round.letter!) &&
        !round.annulled.includes(entry.categoryId) &&
        scoreRound(
          round.entries.map((e) => ({ ...e, verdict: 'VALID' as const, hostPoints: undefined })),
          state.categories,
          round.letter!,
          round.annulled,
        ).find((e) => e.id === entry.id)?.scoreReason !== 'Repetido por ti',
      'STRUCTURAL_INVALID',
      'Una entrada vacía, con inicial incorrecta, repetida o anulada vale 0.',
    );
  }
  refreshStructural(state: RoomState, round: RoundState) {
    // Simular con verdict=VALID y sin hostPoints para detectar exclusivamente errores estructurales
    // (vacío, inicial incorrecta, repetición propia, categoría anulada), sin que los valores
    // de adjudicación del anfitrión interfieran en el cálculo de colisiones estructurales.
    const scores = scoreRound(
      round.entries.map((e) => ({ ...e, verdict: 'VALID' as const, hostPoints: undefined })),
      state.categories,
      round.letter!,
      round.annulled,
    );
    for (const e of round.entries) {
      const derived = scores.find((s) => s.id === e.id)!;
      if (derived.points === 0) {
        // La entrada tiene un error estructural: siempre vale 0 sin importar hostPoints.
        // Limpiamos hostPoints porque ya no puede aplicar a una entrada estructuralmente inválida.
        e.verdict = 'INVALID';
        // Preservar el motivo explícito del host si ya adjudicó esta entrada.
        if (!e.resolvedBy) e.reason = derived.scoreReason;
        e.hostPoints = undefined;
      } else if (
        ['Repetido por ti', 'Anulado', 'No comienza con la letra', 'Vacío'].includes(e.reason)
      ) {
        // Era un error estructural pero ahora es válida (p.ej. alias corregido).
        // Pasa a revisión humana; si el host ya había adjudicado, se preserva hostPoints.
        e.verdict = 'PENDING';
        e.reason = 'Requiere nueva revisión tras corrección de alias';
        e.resolvedBy = null;
        e.votes = [];
        // hostPoints se conserva si ya existía — el host no necesita re-adjudicar.
      }
      // Si la entrada no tenía error estructural y ya estaba resuelta (resolvedBy != null),
      // no tocamos verdict ni hostPoints: el host ya tomó una decisión explícita.
    }
  }
  closeVotes(round: RoundState) {
    for (const entry of round.entries)
      if (entry.verdict === 'PENDING' || entry.votes.length) this.tally(entry);
  }
}
