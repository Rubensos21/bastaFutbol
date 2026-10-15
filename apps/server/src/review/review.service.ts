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
      round.entries.map((e) => ({ ...e, verdict: 'VALID' as const })),
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
          round.entries.map((e) => ({ ...e, verdict: 'VALID' as const })),
          state.categories,
          round.letter!,
          round.annulled,
        ).find((e) => e.id === entry.id)?.scoreReason !== 'Repetido por ti',
      'STRUCTURAL_INVALID',
      'Una entrada vacía, con inicial incorrecta, repetida o anulada vale 0.',
    );
  }
  refreshStructural(state: RoomState, round: RoundState) {
    const scores = scoreRound(
      round.entries.map((e) => ({ ...e, verdict: 'VALID' as const })),
      state.categories,
      round.letter!,
      round.annulled,
    );
    for (const e of round.entries) {
      const derived = scores.find((s) => s.id === e.id)!;
      if (derived.points === 0) {
        e.verdict = 'INVALID';
        e.reason = derived.scoreReason;
      } else if (
        ['Repetido por ti', 'Anulado', 'No comienza con la letra', 'Vacío'].includes(e.reason)
      ) {
        e.verdict = 'PENDING';
        e.reason = 'Requiere nueva revisión tras corrección de alias';
        e.resolvedBy = null;
        e.votes = [];
      }
    }
  }
  closeVotes(round: RoundState) {
    for (const entry of round.entries)
      if (entry.verdict === 'PENDING' || entry.votes.length) this.tally(entry);
  }
}
