import { randomUUID } from 'node:crypto';
import { bastaDeadline, type Phase, type RoomState, type RoundState } from '@basta/shared';
import { DrawService } from '../draws/draw.service.js';
import { ReviewService } from '../review/review.service.js';
export class RoundService {
  constructor(
    private readonly draw: DrawService,
    private readonly review: ReviewService,
  ) {}
  phase(s: RoomState, phase: Phase, at: number, endsAt: number | null, reason: string) {
    s.phase = phase;
    s.phaseStartedAt = at;
    s.endsAt = endsAt;
    this.audit(s, 'phase:changed', null, { phase, reason }, at);
  }
  audit(
    s: RoomState,
    type: string,
    actorId: string | null,
    payload: Record<string, unknown>,
    at: number,
  ) {
    s.revision++;
    s.events.push({ type, actorId, payload, at, revision: s.revision });
  }
  start(s: RoomState, at: number) {
    const round: RoundState = {
      id: randomUUID(),
      number: s.rounds.length + 1,
      pickerId: this.draw.picker(s),
      letter: null,
      answeringStartsAt: null,
      originalEndsAt: null,
      answeringEndsAt: null,
      reviewEndsAt: null,
      bastaBy: null,
      submitted: [],
      entries: [],
      annulled: [],
      annulVotes: {},
      scores: [],
      scoredEntries: [],
      cancelled: false,
    };
    for (const member of s.members.filter((m) => !m.left))
      for (const cat of s.categories)
        round.entries.push({
          id: randomUUID(),
          participantId: member.id,
          categoryId: cat.id,
          text: '',
          version: 0,
          updatedAt: at,
          verdict: 'PENDING',
          reason: '',
          canonical: null,
          votes: [],
          appealed: false,
          resolvedBy: null,
          evidence: null,
        });
    s.rounds.push(round);
    this.phase(s, 'SELECTING_SPINNER', at, at + 15000, 'Nuevo sorteo');
    this.audit(s, 'draw:picker-assigned', null, { pickerId: round.pickerId }, at);
  }
  reassignPicker(s: RoomState, at: number) {
    const r = s.rounds.at(-1)!;
    const current = s.members.find((m) => m.id === r.pickerId);
    if (
      s.phase !== 'SELECTING_SPINNER' ||
      s.pausedAt ||
      current?.connected ||
      at - (current?.lastSeenAt ?? at) < 10000 ||
      !s.members.some((m) => m.connected && !m.left)
    )
      return;
    const previous = r.pickerId;
    r.pickerId = this.draw.picker(s);
    this.audit(
      s,
      'draw:picker-reassigned',
      null,
      { pickerId: r.pickerId, previousPickerId: previous, reason: 'Desconexión del selector' },
      at,
    );
  }
  stop(s: RoomState, at: number, automatic = false) {
    const r = s.rounds.at(-1)!;
    r.letter = this.draw.letter(s);
    r.answeringStartsAt = at + 4500;
    r.originalEndsAt = r.answeringStartsAt + s.settings.roundSeconds * 1000;
    r.answeringEndsAt = r.originalEndsAt;
    this.phase(s, 'LETTER_REVEAL', at, at + 1500, 'Letra decidida por el servidor');
    this.audit(
      s,
      'draw:stopped',
      automatic ? null : r.pickerId,
      { letter: r.letter, automatic, answeringStartsAt: r.answeringStartsAt },
      at,
    );
  }
  basta(s: RoomState, actor: string, now: number) {
    const r = s.rounds.at(-1)!;
    r.bastaBy = actor;
    s.endsAt = bastaDeadline(now, s.endsAt!);
    r.answeringEndsAt = s.endsAt;
    this.audit(s, 'round:basta-called', actor, { endsAt: s.endsAt }, now);
  }
  lock(s: RoomState, at: number) {
    this.phase(s, 'ANSWERS_LOCKED', at, null, 'Fin de edición');
    this.review.structural(s, s.rounds.at(-1)!);
    s.rounds.at(-1)!.reviewEndsAt = at + 45000;
    this.phase(s, 'REVIEW', at, at + 45000, 'Respuestas reveladas');
  }
  advance(s: RoomState, now: number) {
    if (s.pausedAt) return;
    for (let i = 0; i < 8 && s.endsAt !== null && s.endsAt <= now; i++) {
      const at = s.endsAt;
      switch (s.phase) {
        case 'SELECTING_SPINNER':
          this.stop(s, at, true);
          break;
        case 'LETTER_REVEAL':
          this.phase(s, 'COUNTDOWN', at, s.rounds.at(-1)!.answeringStartsAt, '3 → 2 → 1');
          break;
        case 'COUNTDOWN':
          this.phase(s, 'ANSWERING', at, s.rounds.at(-1)!.answeringEndsAt, 'Tablero abierto');
          break;
        case 'ANSWERING':
          this.lock(s, at);
          break;
        case 'REVIEW':
          this.review.closeVotes(s.rounds.at(-1)!);
          s.endsAt = null;
          this.audit(
            s,
            'review:deadline',
            null,
            { reason: 'Resolver empates y apelaciones antes de publicar' },
            at,
          );
          break;
        default:
          s.endsAt = null;
          break;
      }
    }
  }
}
