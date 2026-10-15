import { scoreRound, roundTotals, type RoomState, type RoundState } from '@basta/shared';
import { requireRule } from '../game/errors.js';
export class ScoringService {
  recalculate(state: RoomState, round: RoundState) {
    const preview = scoreRound(round.entries, state.categories, round.letter!, round.annulled);
    round.scoredEntries = preview;
    round.scores = roundTotals(
      preview,
      state.members.filter((m) => !m.left).map((m) => m.id),
    );
  }
  publish(state: RoomState, round: RoundState) {
    const preview = scoreRound(round.entries, state.categories, round.letter!, round.annulled);
    requireRule(
      preview.every((e) => e.scoreReason !== 'Pendiente de dictamen'),
      'UNRESOLVED_ANSWERS',
      'Resuelve las respuestas pendientes o impugnadas antes de publicar.',
    );
    round.scoredEntries = preview;
    round.scores = roundTotals(
      preview,
      state.members.filter((m) => !m.left).map((m) => m.id),
    );
  }
}
