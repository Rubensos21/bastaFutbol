import { randomUUID } from 'node:crypto';
import {
  normalizeText,
  scoreRound,
  type Command,
  type Member,
  type RoomState,
} from '@basta/shared';
import { DrawService } from '../draws/draw.service.js';
import { RoundService } from '../rounds/round.service.js';
import { ReviewService } from '../review/review.service.js';
import { ScoringService } from '../scoring/scoring.service.js';
import { requireRule } from './errors.js';
export class GameEngine {
  constructor(
    private readonly draw: DrawService,
    public readonly rounds: RoundService,
    private readonly review: ReviewService,
    private readonly scoring: ScoringService,
  ) {}
  member(s: RoomState, guestId: string) {
    const m = s.members.find((m) => m.guestId === guestId && !m.left);
    requireRule(m, 'NOT_MEMBER', 'No perteneces a esta sala o fuiste expulsado.');
    return m;
  }
  active(s: RoomState) {
    return s.members.filter((m) => !m.left);
  }
  host(s: RoomState, m: Member) {
    requireRule(s.hostId === m.id, 'HOST_ONLY', 'Solo el anfitrión puede realizar esta acción.');
  }
  lobby(s: RoomState) {
    requireRule(s.phase === 'LOBBY', 'ROOM_LOCKED', 'La partida ya comenzó.');
  }
  transfer(s: RoomState, now: number) {
    const host = s.members.find((m) => m.id === s.hostId && !m.left);
    if (host?.connected || (host && now - host.lastSeenAt < 30000)) return;
    const next = this.active(s)
      .filter((m) => m.connected)
      .sort((a, b) => a.joinedAt - b.joinedAt || a.id.localeCompare(b.id))[0];
    if (next && next.id !== s.hostId) {
      s.hostId = next.id;
      this.rounds.audit(s, 'room:host-changed', null, { hostId: next.id }, now);
    }
  }
  join(s: RoomState, guestId: string, nickname: string, now: number, slot?: number) {
    this.lobby(s);
    const old = s.members.find((m) => m.guestId === guestId);
    requireRule(!old, 'ALREADY_MEMBER', 'Reanuda tu sesión existente.');
    requireRule(
      !this.active(s).some((m) => normalizeText(m.nickname) === normalizeText(nickname)),
      'NAME_TAKEN',
      'Ese nombre ya está en la sala.',
    );
    const capacity = s.settings.capacity ?? 7;
    requireRule(this.active(s).length < capacity, 'ROOM_FULL', 'La sala está llena.');
    const occupied = this.active(s).map((m) => m.slot);
    const reservation = s.reservations.find(
      (r) => r.slot === slot || normalizeText(r.nickname) === normalizeText(nickname),
    );
    const free = Array.from({ length: capacity }, (_, i) => i + 1).find(
      (n) => !occupied.includes(n) && !s.reservations.some((r) => r.slot === n),
    );
    const chosen = slot ?? reservation?.slot ?? free;
    requireRule(
      chosen && chosen <= capacity && !occupied.includes(chosen),
      'SLOT_UNAVAILABLE',
      'Esa plaza no está disponible.',
    );
    const reserved = s.reservations.find((r) => r.slot === chosen);
    requireRule(
      !reserved || normalizeText(reserved.nickname) === normalizeText(nickname),
      'SLOT_RESERVED',
      'Esta plaza está reservada para otro apodo.',
    );
    const m: Member = {
      id: randomUUID(),
      guestId,
      nickname,
      slot: chosen,
      ready: false,
      connected: false,
      joinedAt: now,
      lastSeenAt: now,
      left: false,
    };
    s.members.push(m);
    if (reserved) {
      reserved.claimantId = m.id;
      reserved.approved = false;
    }
    return m;
  }
  apply(s: RoomState, m: Member, c: Command, now: number) {
    this.rounds.advance(s, now);
    this.transfer(s, now);
    const r = s.rounds.at(-1);
    if ('roundId' in c) requireRule(r?.id === c.roundId, 'ROUND_CLOSED', 'La ronda ya cambió.');
    if (s.pausedAt && !['game:pause', 'game:end', 'room:leave'].includes(c.type))
      requireRule(false, 'GAME_PAUSED', 'La partida está pausada por el anfitrión.');
    const reviewing = () =>
      requireRule(
        s.phase === 'REVIEW',
        'INVALID_PHASE',
        'Esta acción solo está disponible durante la revisión.',
      );
    const entry = () => {
      reviewing();
      const e = r?.entries.find((e) => 'answerId' in c && e.id === c.answerId);
      requireRule(e, 'INVALID_ANSWER', 'Respuesta inexistente.');
      return e;
    };
    switch (c.type) {
      case 'room:ready':
        this.lobby(s);
        requireRule(
          !s.reservations.some((v) => v.claimantId === m.id && !v.approved),
          'CLAIM_PENDING',
          'El anfitrión debe aprobar tu plaza reservada.',
        );
        m.ready = c.ready;
        break;
      case 'room:update-settings':
        this.host(s, m);
        this.lobby(s);
        requireRule(
          (c.settings.capacity ?? 7) >=
            Math.max(
              this.active(s).length,
              ...this.active(s).map((m) => m.slot),
              ...s.reservations.map((r) => r.slot),
            ),
          'CAPACITY_OCCUPIED',
          'La capacidad no puede excluir plazas ocupadas o reservadas.',
        );
        s.settings = c.settings;
        s.categories = this.draw.categories(s.settings.disabledCategories);
        for (const member of this.active(s)) member.ready = false;
        break;
      case 'room:reroll':
        this.host(s, m);
        this.lobby(s);
        s.categories = this.draw.categories(s.settings.disabledCategories);
        break;
      case 'room:reserve-slot':
        this.host(s, m);
        this.lobby(s);
        requireRule(
          c.slot <= (s.settings.capacity ?? 7) &&
            !this.active(s).some((p) => p.slot === c.slot) &&
            !s.reservations.some((v) => v.slot === c.slot),
          'SLOT_UNAVAILABLE',
          'Plaza ocupada.',
        );
        requireRule(
          !this.active(s).some((p) => normalizeText(p.nickname) === normalizeText(c.nickname)) &&
            !s.reservations.some((v) => normalizeText(v.nickname) === normalizeText(c.nickname)),
          'NAME_TAKEN',
          'Ese nombre ya está ocupado o reservado.',
        );
        s.reservations.push({
          slot: c.slot,
          nickname: c.nickname,
          claimantId: null,
          approved: false,
        });
        break;
      case 'room:remove-reservation':
        this.host(s, m);
        this.lobby(s);
        s.reservations = s.reservations.filter((v) => v.slot !== c.slot);
        break;
      case 'room:approve-claim': {
        this.host(s, m);
        this.lobby(s);
        const claim = s.reservations.find((v) => v.slot === c.slot && v.claimantId);
        requireRule(claim, 'INVALID_CLAIM', 'No hay reclamación pendiente.');
        if (c.approve) {
          claim.approved = true;
          s.reservations = s.reservations.filter((v) => v !== claim);
        } else {
          const target = s.members.find((p) => p.id === claim.claimantId)!;
          target.left = true;
          target.connected = false;
          claim.claimantId = null;
        }
        break;
      }
      case 'room:kick': {
        this.host(s, m);
        this.lobby(s);
        requireRule(
          c.participantId !== m.id,
          'INVALID_TARGET',
          'Usa Salir para abandonar la sala.',
        );
        const target = this.active(s).find((p) => p.id === c.participantId);
        requireRule(target, 'INVALID_TARGET', 'Participante inexistente.');
        target.left = true;
        target.connected = false;
        break;
      }
      case 'room:leave':
        requireRule(
          ['LOBBY', 'FINAL_RESULTS', 'FINISHED'].includes(s.phase),
          'GAME_IN_PROGRESS',
          'Puedes desconectarte y regresar. Para salir definitivamente, espera al final.',
        );
        m.left = true;
        m.connected = false;
        m.lastSeenAt = 0;
        this.transfer(s, now);
        break;
      case 'game:start': {
        this.host(s, m);
        this.lobby(s);
        const active = this.active(s);
        requireRule(
          active.length >= 2 && active.every((p) => p.connected && p.ready),
          'NO_QUORUM',
          'Se necesitan al menos dos jugadores y todos conectados y listos.',
        );
        requireRule(
          s.settings.capacity === null || active.length === s.settings.capacity,
          'FIXED_CAPACITY',
          'Faltan jugadores para completar la cantidad fija.',
        );
        requireRule(
          s.categories.length === 7 && new Set(s.categories.map((c) => c.id)).size === 7,
          'INVALID_CATEGORIES',
          'La partida necesita siete categorías diferentes.',
        );
        this.rounds.phase(s, 'STARTING', now, null, 'Participantes y categorías cerrados');
        this.rounds.start(s, now);
        break;
      }
      case 'draw:stop':
        requireRule(s.phase === 'SELECTING_SPINNER', 'ALREADY_STOPPED', 'La ruleta ya se detuvo.');
        requireRule(
          r!.pickerId === m.id,
          'NOT_SELECTED_PICKER',
          'Solo el jugador elegido puede parar la ruleta.',
        );
        this.rounds.stop(s, now);
        break;
      case 'answers:save-draft': {
        requireRule(
          s.phase === 'ANSWERING' && s.endsAt! > now,
          'ROUND_CLOSED',
          'El tiempo de edición terminó.',
        );
        requireRule(!r!.submitted.includes(m.id), 'ALREADY_SUBMITTED', 'Ya confirmaste Terminé.');
        const e = r!.entries.find((e) => e.participantId === m.id && e.categoryId === c.categoryId);
        requireRule(e, 'INVALID_CATEGORY', 'Categoría ajena a esta partida.');
        requireRule(
          e.version === c.previousVersion,
          'DRAFT_CONFLICT',
          'Tu respuesta cambió en otra conexión. Se conserva tu texto local; revisa antes de reenviar.',
        );
        e.text = c.text;
        e.version++;
        e.updatedAt = now;
        break;
      }
      case 'answers:submit':
        requireRule(s.phase === 'ANSWERING', 'ROUND_CLOSED', 'La ronda está cerrada.');
        if (!r!.submitted.includes(m.id)) r!.submitted.push(m.id);
        break;
      case 'round:call-basta':
        requireRule(s.phase === 'ANSWERING', 'ROUND_CLOSED', 'El tiempo de edición terminó.');
        requireRule(
          s.settings.bastaEnabled,
          'BASTA_DISABLED',
          'Esta partida utiliza todo el tiempo.',
        );
        requireRule(!r!.bastaBy, 'ALREADY_CALLED', 'Otro jugador ya llamó BASTA.');
        requireRule(
          r!.entries.some((e) => e.participantId === m.id && e.text.trim()),
          'EMPTY_BOARD',
          'Completa al menos una respuesta para llamar BASTA.',
        );
        this.rounds.basta(s, m.id, now);
        break;
      case 'review:vote': {
        const e = entry();
        requireRule(e.participantId !== m.id, 'SELF_VOTE', 'No puedes votar tu propia respuesta.');
        requireRule(
          s.endsAt !== null && now < s.endsAt,
          'VOTING_CLOSED',
          'La votación terminó; solicita una resolución al moderador.',
        );
        this.review.votable(s, e, r!);
        requireRule(
          !e.resolvedBy && !e.appealed,
          'ANSWER_RESOLVED',
          'La respuesta requiere una resolución del moderador.',
        );
        e.votes = e.votes.filter((v) => v.voterId !== m.id);
        e.votes.push({ voterId: m.id, valid: c.valid, reason: c.reason });
        this.review.tally(e);
        this.scoring.recalculate(s, r!);
        break;
      }
      case 'review:appeal': {
        const e = entry();
        this.review.votable(s, e, r!);
        e.appealed = true;
        e.resolvedBy = null;
        e.verdict = 'DISPUTED';
        e.reason = c.reason;
        e.evidence = c.evidence ?? null;
        this.scoring.recalculate(s, r!);
        break;
      }
      case 'review:resolve': {
        const e = entry();
        requireRule(
          this.review.moderator(s, e) === m.id,
          'MODERATOR_ONLY',
          'Decide el anfitrión; si es autor, decide el participante conectado más antiguo que no sea autor.',
        );
        this.review.votable(s, e, r!);
        e.verdict = c.valid ? 'VALID' : 'INVALID';
        e.reason = c.reason;
        e.canonical = c.canonical ?? e.canonical;
        e.appealed = false;
        e.resolvedBy = m.id;
        this.scoring.recalculate(s, r!);
        break;
      }
      case 'review:award': {
        const e = entry();
        this.host(s, m);
        // Adjudicar > 0 puntos a una entrada estructuralmente inválida (vacía, inicial incorrecta,
        // repetida o anulada) no tiene sentido: esos casos siempre valen 0. Sí se permite adjudicar
        // 0 explícitamente para rechazar cualquier entrada con motivo escrito.
        if (c.points > 0) this.review.votable(s, e, r!);
        const verdict = c.points === 0 ? ('INVALID' as const) : ('VALID' as const);
        e.verdict = verdict;
        e.reason = c.reason;
        e.resolvedBy = m.id;
        e.appealed = false;
        e.hostPoints = c.points;
        this.scoring.recalculate(s, r!);
        break;
      }
      case 'review:annul-propose':
        reviewing();
        this.host(s, m);
        requireRule(
          s.categories.some((v) => v.id === c.categoryId),
          'INVALID_CATEGORY',
          'Categoría inexistente.',
        );
        r!.annulVotes[c.categoryId] = [m.id];
        break;
      case 'review:annul-vote':
        reviewing();
        requireRule(
          r!.annulVotes[c.categoryId],
          'NO_PROPOSAL',
          'El anfitrión debe proponer la anulación.',
        );
        r!.annulVotes[c.categoryId] = r!.annulVotes[c.categoryId]!.filter((id) => id !== m.id);
        if (c.approve) r!.annulVotes[c.categoryId]!.push(m.id);
        if (
          this.active(s).every((p) => r!.annulVotes[c.categoryId]!.includes(p.id)) &&
          !r!.annulled.includes(c.categoryId)
        ) {
          r!.annulled.push(c.categoryId);
          for (const e of r!.entries.filter((e) => e.categoryId === c.categoryId)) {
            e.verdict = 'INVALID';
            e.reason = 'Anulado';
          }
        }
        break;
      case 'review:finish':
      case 'scores:publish':
        reviewing();
        this.host(s, m);
        this.review.closeVotes(r!);
        s.endsAt = null;
        {
          const unresolved = scoreRound(r!.entries, s.categories, r!.letter!, r!.annulled).some(
            (e) => e.scoreReason === 'Pendiente de dictamen',
          );
          if (!unresolved) {
            this.scoring.publish(s, r!);
            this.rounds.phase(s, 'SCORING', now, null, 'Puntuación calculada');
            this.rounds.phase(
              s,
              r!.number >= s.settings.rounds ? 'FINAL_RESULTS' : 'ROUND_RESULTS',
              now,
              null,
              'Puntos publicados',
            );
            if (s.phase === 'FINAL_RESULTS')
              s.expiresAt = now + Number(process.env.RESULT_TTL_DAYS ?? 7) * 86400000;
          }
        }
        break;
      case 'game:next-round':
        this.host(s, m);
        requireRule(
          s.phase === 'ROUND_RESULTS',
          'INVALID_PHASE',
          'Publica los resultados antes de continuar.',
        );
        requireRule(
          this.active(s).filter((m) => m.connected).length >= 2,
          'NO_QUORUM',
          'Se necesitan dos jugadores conectados para continuar.',
        );
        this.rounds.start(s, now);
        break;
      case 'game:end':
        this.host(s, m);
        requireRule(s.phase !== 'FINISHED', 'ALREADY_FINALIZED', 'La partida ya está cerrada.');
        if (r && !r.scores.length) r.cancelled = true;
        this.rounds.phase(s, 'FINISHED', now, null, c.reason);
        s.pausedAt = null;
        break;
      case 'game:pause':
        this.host(s, m);
        requireRule(
          ['SELECTING_SPINNER', 'LETTER_REVEAL', 'COUNTDOWN', 'ANSWERING', 'REVIEW'].includes(
            s.phase,
          ),
          'INVALID_PHASE',
          'No se puede pausar esta fase.',
        );
        if (c.paused && !s.pausedAt) s.pausedAt = now;
        else if (!c.paused && s.pausedAt) {
          const delta = now - s.pausedAt;
          if (s.endsAt) s.endsAt += delta;
          if (r?.answeringStartsAt) r.answeringStartsAt += delta;
          if (r?.originalEndsAt) r.originalEndsAt += delta;
          if (r?.answeringEndsAt) r.answeringEndsAt += delta;
          if (r?.reviewEndsAt) r.reviewEndsAt += delta;
          s.pausedAt = null;
        }
        break;
      case 'game:rematch':
        this.host(s, m);
        requireRule(
          ['FINAL_RESULTS', 'FINISHED'].includes(s.phase),
          'INVALID_PHASE',
          'Espera al final de la partida.',
        );
        s.gameId = randomUUID();
        s.rounds = [];
        s.usedLetters = [];
        s.pickerBag = [];
        s.categories = this.draw.categories(s.settings.disabledCategories);
        s.reservations = [];
        for (const p of this.active(s)) p.ready = false;
        s.expiresAt = now + 86400000;
        this.rounds.phase(s, 'LOBBY', now, null, 'Revancha: nueva partida');
        break;
      default:
        requireRule(false, 'INVALID_COMMAND', 'Acción no disponible.');
    }
    if (s.phase === 'REVIEW' && ['review:resolve', 'review:award'].includes(c.type)) {
      this.review.refreshStructural(s, r!);
      this.scoring.recalculate(s, r!);
    }
    if (s.phase === 'LOBBY') s.expiresAt = now + Number(process.env.ROOM_TTL_HOURS ?? 24) * 3600000;
    this.rounds.audit(
      s,
      c.type,
      m.id,
      Object.fromEntries(
        Object.entries(c).filter(([k]) => !['text', 'clientMutationId'].includes(k)),
      ),
      now,
    );
  }
}
