import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import {
  CATEGORIES,
  DEFAULT_SETTINGS,
  normalizeText,
  canonicalKey,
  startsWithLetter,
  scoreRound,
  roundTotals,
  ranking,
  bastaDeadline,
  remainingSeconds,
  commandSchema,
  nicknameSchema,
  type Entry,
  type RoomState,
  type Command,
} from '@basta/shared';
import { DrawService } from '../apps/server/src/draws/draw.service.js';
import { RoundService } from '../apps/server/src/rounds/round.service.js';
import { ReviewService } from '../apps/server/src/review/review.service.js';
import { ScoringService } from '../apps/server/src/scoring/scoring.service.js';
import { GameEngine } from '../apps/server/src/game/engine.service.js';
import { project } from '../apps/server/src/rooms/projection.js';
export function fixture(count = 3) {
  const draw = new DrawService(),
    review = new ReviewService(),
    rounds = new RoundService(draw, review),
    scoring = new ScoringService(),
    engine = new GameEngine(draw, rounds, review, scoring);
  const members = Array.from({ length: count }, (_, i) => ({
    id: randomUUID(),
    guestId: randomUUID(),
    nickname: `Jugador ${i}`,
    slot: i + 1,
    ready: true,
    connected: true,
    joinedAt: 1000 + i,
    lastSeenAt: 1000,
    left: false,
  }));
  const s: RoomState = {
    id: randomUUID(),
    code: 'ABC234',
    hostId: members[0]!.id,
    gameId: randomUUID(),
    phase: 'LOBBY',
    phaseStartedAt: 1000,
    endsAt: null,
    revision: 0,
    expiresAt: 9999999999999,
    settings: structuredClone(DEFAULT_SETTINGS),
    members,
    reservations: [],
    categories: draw.categories([]),
    rounds: [],
    pickerBag: [],
    usedLetters: [],
    events: [],
    pausedAt: null,
  };
  return { draw, review, rounds, scoring, engine, s };
}
function e(participantId: string, categoryId: string, text: string, valid = true): Entry {
  return {
    id: randomUUID(),
    participantId,
    categoryId,
    text,
    version: 1,
    updatedAt: 1000,
    verdict: valid ? 'VALID' : 'INVALID',
    reason: '',
    canonical: null,
    votes: [],
    appealed: false,
    resolvedBy: null,
    evidence: null,
  };
}
const cat = (id: string) => CATEGORIES.find((c) => c.id === id)!;
function apply(
  f: ReturnType<typeof fixture>,
  type: Command['type'],
  payload: Record<string, unknown> = {},
  actor = 0,
  now = 2000,
) {
  f.engine.apply(
    f.s,
    f.s.members[actor]!,
    commandSchema.parse({ type, ...payload, clientMutationId: randomUUID() }),
    now,
  );
}
export const cases: [string, () => void][] = [
  [
    'normaliza Unicode, acentos, puntuación exterior y espacios sin fusionar apellidos',
    () => {
      assert.equal(normalizeText('  ¡Ángel   MUÑOZ! '), 'angel munoz');
      assert.equal(normalizeText('Ｒｕｂｅｎ'), 'ruben');
      assert.notEqual(
        canonicalKey('Ronaldo', 'PERSON'),
        canonicalKey('Cristiano Ronaldo', 'PERSON'),
      );
      assert.notEqual(canonicalKey('Xavi', 'PERSON'), canonicalKey('Xabi', 'PERSON'));
    },
  ],
  [
    'aliases explícitos unen entidades, pero la inicial se comprueba antes',
    () => {
      assert.equal(canonicalKey('Leo Messi', 'PERSON'), canonicalKey('Lionel Messi', 'PERSON'));
      assert.equal(canonicalKey('CR7', 'PERSON'), canonicalKey('Cristiano Ronaldo', 'PERSON'));
      assert.equal(canonicalKey('Barça', 'CLUB'), canonicalKey('FC Barcelona', 'CLUB'));
      assert.equal(
        canonicalKey('México', 'NATIONAL_TEAM'),
        canonicalKey('Selección de México', 'NATIONAL_TEAM'),
      );
      assert.equal(startsWithLetter('Lionel Messi', 'M'), false);
      assert.equal(startsWithLetter('El Milan', 'M'), true);
      assert.equal(startsWithLetter('Real Madrid', 'M'), false);
      assert.equal(startsWithLetter('FC Barcelona', 'B'), false);
    },
  ],
  [
    'nombres vacíos y controles se rechazan; nombres Unicode válidos se aceptan',
    () => {
      assert.equal(nicknameSchema.safeParse('  ').success, false);
      assert.equal(nicknameSchema.safeParse('Ana\u0000').success, false);
      assert.equal(nicknameSchema.safeParse('A'.repeat(25)).success, false);
      assert.equal(nicknameSchema.safeParse('  Rubén  ').success, true);
    },
  ],
  [
    '0 vacío, inválido e inicial incorrecta; 10 duplicados; 20 únicos',
    () => {
      const rows = [
        e('a', 'player', 'Messi'),
        e('b', 'player', 'messi'),
        e('c', 'player', 'Mbappé'),
        e('d', 'player', ''),
        e('e', 'player', 'Modric', false),
        e('f', 'player', 'Ronaldo'),
      ];
      assert.deepEqual(
        scoreRound(rows, [cat('player')], 'M').map((e) => e.points),
        [10, 10, 20, 0, 0, 0],
      );
    },
  ],
  [
    'tres o más coincidencias válidas valen 10 para cada persona',
    () => {
      assert.deepEqual(
        scoreRound(
          ['a', 'b', 'c', 'd'].map((id) => e(id, 'player', 'Messi')),
          [cat('player')],
          'M',
        ).map((e) => e.points),
        [10, 10, 10, 10],
      );
    },
  ],
  [
    'invalidar un duplicado transforma el otro en único de 20',
    () => {
      assert.deepEqual(
        scoreRound(
          [e('a', 'player', 'Messi'), e('b', 'player', 'Messi', false)],
          [cat('player')],
          'M',
        ).map((e) => e.points),
        [20, 0],
      );
    },
  ],
  [
    'repetición propia conserva la columna izquierda, aun con entradas desordenadas',
    () => {
      const rows = [e('a', 'southamerican_club', 'Boca Juniors'), e('a', 'club', 'Boca Juniors')];
      const scores = scoreRound(rows, [cat('club'), cat('southamerican_club')], 'B');
      assert.deepEqual(
        scores.map((e) => e.points),
        [20, 0],
      );
      assert.equal(scores[1]!.scoreReason, 'Repetido por ti');
    },
  ],
  [
    'persona entre entrenador/jugador y país/selección comparten tipo',
    () => {
      assert.deepEqual(
        scoreRound(
          [e('a', 'coach', 'Xavi'), e('a', 'player', 'Xavi')],
          [cat('coach'), cat('player')],
          'X',
        ).map((e) => e.points),
        [20, 0],
      );
      assert.deepEqual(
        scoreRound(
          [e('a', 'world_cup_country', 'Argentina'), e('a', 'national_team', 'Argentina')],
          [cat('world_cup_country'), cat('national_team')],
          'A',
        ).map((e) => e.points),
        [20, 0],
      );
    },
  ],
  [
    'duplicados solo se comparan en la misma categoría; reutilización en otra ronda permitida',
    () => {
      const values = [e('a', 'player', 'Messi'), e('b', 'legend', 'Messi')];
      assert.deepEqual(
        scoreRound(values, [cat('player'), cat('legend')], 'M').map((e) => e.points),
        [20, 20],
      );
      assert.equal(scoreRound([e('a', 'player', 'Messi')], [cat('player')], 'M')[0]!.points, 20);
    },
  ],
  [
    'aliases no excusan una inicial incorrecta',
    () => {
      const scores = scoreRound(
        [e('a', 'player', 'Leo Messi'), e('b', 'player', 'Lionel Messi')],
        [cat('player')],
        'L',
      );
      assert.deepEqual(
        scores.map((e) => e.points),
        [10, 10],
      );
      assert.deepEqual(
        scoreRound(
          [e('a', 'player', 'Leo Messi'), e('b', 'player', 'Lionel Messi')],
          [cat('player')],
          'M',
        ).map((e) => e.points),
        [0, 0],
      );
    },
  ],
  [
    'siete categorías suman 140; anulaciones reducen máximo y no crean duplicados',
    () => {
      const categories = Array.from({ length: 7 }, (_, i) => ({ ...cat('player'), id: `c${i}` }));
      const scores = scoreRound(
        categories.map((c, i) => e('a', c.id, `M nombre ${i}`)),
        categories,
        'M',
      );
      assert.equal(roundTotals(scores, ['a'])[0]!.total, 140);
      assert.equal(
        roundTotals(
          scoreRound(
            categories.map((c, i) => e('a', c.id, `M nombre ${i}`)),
            categories,
            'M',
            ['c0'],
          ),
          ['a'],
        )[0]!.total,
        120,
      );
    },
  ],
  [
    'catálogo incluye 48 categorías y sorteo siempre elige 7 únicas equilibradas',
    () => {
      assert.equal(CATEGORIES.length, 48);
      const draw = new DrawService();
      for (let i = 0; i < 100; i++) {
        const cats = draw.categories([]);
        assert.equal(new Set(cats.map((c) => c.id)).size, 7);
        assert.ok(cats.filter((c) => c.difficulty === 'GENERAL').length >= 2);
        assert.ok(cats.filter((c) => c.difficulty === 'SPECIFIC').length >= 2);
      }
      assert.throws(() => draw.categories(CATEGORIES.map((c) => c.id)));
    },
  ],
  [
    'bolsa del selector no repite hasta que todos tuvieron turno',
    () => {
      const f = fixture(7);
      for (let cycle = 0; cycle < 3; cycle++) {
        const ids = Array.from({ length: 7 }, () => f.draw.picker(f.s));
        assert.equal(new Set(ids).size, 7);
      }
    },
  ],
  [
    'letras sin repetir hasta agotar el conjunto y aviso del nuevo ciclo',
    () => {
      const f = fixture();
      f.s.settings.letters = ['M', 'A', 'R'];
      assert.equal(new Set(Array.from({ length: 3 }, () => f.draw.letter(f.s))).size, 3);
      f.draw.letter(f.s);
      assert.equal(f.s.usedLetters.length, 1);
      assert.equal(f.s.events.at(-1)!.type, 'draw:letter-cycle-reset');
    },
  ],
  [
    'BASTA no amplía el plazo base y los contadores usan timestamps absolutos',
    () => {
      assert.equal(bastaDeadline(1000, 6000), 6000);
      assert.equal(bastaDeadline(1000, 60000), 11000);
      assert.equal(remainingSeconds(12345, 2345), 10);
      assert.equal(remainingSeconds(1000, 2000), 0);
    },
  ],
  [
    'automático ignora reservas y exige humanos listos; fijo exige capacidad completa',
    () => {
      const f = fixture(2);
      f.s.reservations.push({ slot: 3, nickname: 'Reservado', claimantId: null, approved: false });
      apply(f, 'game:start');
      assert.equal(f.s.rounds[0]!.entries.length, 14);
      const fixed = fixture(2);
      fixed.s.settings.capacity = 4;
      assert.throws(() => apply(fixed, 'game:start'), /Faltan/);
      const notReady = fixture(2);
      notReady.s.members[1]!.ready = false;
      assert.throws(() => apply(notReady, 'game:start'), /listos/);
    },
  ],
  [
    'no crea jugadores al reclamar una reserva sin aprobación del anfitrión',
    () => {
      const f = fixture(2);
      f.s.reservations.push({ slot: 3, nickname: 'Invitado', claimantId: null, approved: false });
      const m = f.engine.join(f.s, randomUUID(), 'Invitado', 2000, 3);
      assert.equal(m.ready, false);
      assert.throws(
        () =>
          f.engine.apply(
            f.s,
            m,
            commandSchema.parse({
              type: 'room:ready',
              ready: true,
              clientMutationId: randomUUID(),
            }),
            2001,
          ),
        /aprobar/,
      );
      apply(f, 'room:approve-claim', { slot: 3, approve: true });
      f.engine.apply(
        f.s,
        m,
        commandSchema.parse({ type: 'room:ready', ready: true, clientMutationId: randomUUID() }),
        2002,
      );
      assert.equal(m.ready, true);
    },
  ],
  [
    'rechaza STOP ajeno, doble STOP y letra inventada; una única letra canónica',
    () => {
      const f = fixture();
      apply(f, 'game:start');
      const r = f.s.rounds[0]!;
      const picker = f.s.members.findIndex((m) => m.id === r.pickerId),
        other = (picker + 1) % 3;
      assert.throws(() => apply(f, 'draw:stop', { roundId: r.id }, other), /elegido/);
      apply(f, 'draw:stop', { roundId: r.id }, picker);
      const letter = r.letter;
      assert.throws(() => apply(f, 'draw:stop', { roundId: r.id }, picker), /detuvo/);
      assert.equal(r.letter, letter);
      assert.equal(
        commandSchema.safeParse({
          type: 'draw:stop',
          roundId: r.id,
          letter: 'M',
          clientMutationId: randomUUID(),
        }).success,
        false,
      );
    },
  ],
  [
    'recuperación avanza revelación, countdown y plazo vencido sin extender la ronda',
    () => {
      const f = fixture();
      apply(f, 'game:start');
      f.rounds.stop(f.s, 2000);
      const at = f.s.rounds[0]!.answeringStartsAt!,
        end = f.s.rounds[0]!.originalEndsAt!;
      f.rounds.advance(f.s, at);
      assert.equal(f.s.phase, 'ANSWERING');
      assert.equal(f.s.endsAt, end);
      f.rounds.advance(f.s, end + 1000);
      assert.equal(f.s.phase, 'REVIEW');
      assert.equal(f.s.endsAt, end + 45000);
      assert.throws(
        () =>
          apply(
            f,
            'answers:save-draft',
            {
              roundId: f.s.rounds[0]!.id,
              categoryId: f.s.categories[0]!.id,
              text: 'M prueba',
              previousVersion: 0,
            },
            0,
            end + 1001,
          ),
        /terminó/,
      );
    },
  ],
  [
    'snapshots esconden textos ajenos y guest IDs antes del bloqueo, luego revelan',
    () => {
      const f = fixture();
      apply(f, 'game:start');
      f.rounds.stop(f.s, 2000);
      const r = f.s.rounds[0]!;
      f.rounds.advance(f.s, r.answeringStartsAt!);
      r.entries[7]!.text = 'TEXTO PRIVADO DEL RIVAL';
      const privateView = project(f.s, f.s.members[0]!.id, true);
      assert.equal(JSON.stringify(privateView).includes('TEXTO PRIVADO DEL RIVAL'), false);
      assert.equal(JSON.stringify(privateView).includes(f.s.members[1]!.guestId), false);
      f.rounds.lock(f.s, 3000);
      assert.equal(
        JSON.stringify(project(f.s, f.s.members[0]!.id, true)).includes('TEXTO PRIVADO DEL RIVAL'),
        true,
      );
    },
  ],
  [
    'no admite propietario ajeno, puntuación ni estado en payload de borrador',
    () => {
      const base = {
        type: 'answers:save-draft',
        roundId: randomUUID(),
        categoryId: 'player',
        text: 'Messi',
        previousVersion: 0,
        clientMutationId: randomUUID(),
      };
      for (const forged of [{ participantId: randomUUID() }, { score: 20 }, { phase: 'REVIEW' }])
        assert.equal(commandSchema.safeParse({ ...base, ...forged }).success, false);
    },
  ],
  [
    'versiones de borrador detectan escrituras concurrentes y Terminé bloquea solo su fila',
    () => {
      const f = fixture();
      apply(f, 'game:start');
      f.rounds.stop(f.s, 2000);
      const r = f.s.rounds[0]!;
      f.rounds.advance(f.s, r.answeringStartsAt!);
      const payload = {
        roundId: r.id,
        categoryId: f.s.categories[0]!.id,
        text: 'M prueba',
        previousVersion: 0,
      };
      apply(f, 'answers:save-draft', payload, 0, r.answeringStartsAt! + 1);
      assert.throws(
        () => apply(f, 'answers:save-draft', payload, 0, r.answeringStartsAt! + 2),
        /otra conexión/,
      );
      apply(f, 'answers:submit', { roundId: r.id }, 0, r.answeringStartsAt! + 3);
      assert.equal(f.s.phase, 'ANSWERING');
      assert.throws(
        () =>
          apply(
            f,
            'answers:save-draft',
            { ...payload, previousVersion: 1 },
            0,
            r.answeringStartsAt! + 4,
          ),
        /Terminé/,
      );
    },
  ],
  [
    'mayoría, empate, apelación y moderador temporal sin voto propio',
    () => {
      const f = fixture(3);
      f.s.categories = [
        cat('player'),
        ...f.s.categories.filter((c) => c.id !== 'player').slice(0, 6),
      ];
      apply(f, 'game:start');
      f.s.rounds[0]!.letter = 'M';
      const r = f.s.rounds[0]!;
      r.entries[0]!.text = 'Messi';
      f.rounds.lock(f.s, 3000);
      const answerId = r.entries[0]!.id;
      assert.throws(() => apply(f, 'review:vote', { answerId, valid: true }, 0, 3001), /propia/);
      apply(f, 'review:vote', { answerId, valid: true }, 1, 3001);
      assert.equal(r.entries[0]!.verdict, 'VALID');
      apply(f, 'review:vote', { answerId, valid: false }, 2, 3002);
      assert.equal(r.entries[0]!.verdict, 'DISPUTED');
      assert.throws(
        () => apply(f, 'review:resolve', { answerId, valid: true, reason: 'Es jugador' }, 0, 3003),
        /autor/,
      );
      apply(
        f,
        'review:resolve',
        { answerId, valid: true, reason: 'Es futbolista profesional' },
        1,
        3003,
      );
      assert.equal(r.entries[0]!.verdict, 'VALID');
      apply(f, 'review:appeal', { answerId, reason: 'Necesitamos deliberar' }, 2, 3004);
      assert.equal(r.entries[0]!.verdict, 'DISPUTED');
    },
  ],
  [
    'anulación solo por unanimidad, scores idempotentes y categorías estables entre rondas',
    () => {
      const f = fixture(3);
      apply(f, 'game:start');
      const ids = f.s.categories.map((c) => c.id);
      const r = f.s.rounds[0]!;
      r.letter = 'M';
      f.rounds.lock(f.s, 3000);
      const categoryId = ids[0]!;
      apply(f, 'review:annul-propose', { roundId: r.id, categoryId }, 0, 3001);
      apply(f, 'review:annul-vote', { roundId: r.id, categoryId, approve: true }, 1, 3002);
      assert.equal(r.annulled.length, 0);
      apply(f, 'review:annul-vote', { roundId: r.id, categoryId, approve: true }, 2, 3003);
      assert.deepEqual(r.annulled, [categoryId]);
      apply(f, 'review:finish', {}, 0, 3004);
      assert.equal(f.s.phase, 'ROUND_RESULTS');
      const totals = JSON.stringify(r.scores);
      f.scoring.publish(f.s, r);
      assert.equal(JSON.stringify(r.scores), totals);
      apply(f, 'game:next-round', {}, 0, 3005);
      assert.deepEqual(
        f.s.categories.map((c) => c.id),
        ids,
      );
      assert.equal(f.s.rounds.length, 2);
      assert.throws(() => apply(f, 'game:next-round', {}, 0, 3006));
    },
  ],
  [
    'ranking ordena puntos, únicas y válidas; empate final explícito',
    () => {
      const f = fixture();
      f.rounds.start(f.s, 2000);
      const r = f.s.rounds[0]!;
      r.scores = [
        { participantId: 'a', total: 100, uniqueCount: 4, validCount: 5 },
        { participantId: 'b', total: 100, uniqueCount: 3, validCount: 6 },
        { participantId: 'c', total: 100, uniqueCount: 4, validCount: 5 },
      ];
      const result = ranking([r], ['a', 'b', 'c']);
      assert.deepEqual(
        result.map((v) => [v.participantId, v.rank]),
        [
          ['a', 1],
          ['c', 1],
          ['b', 3],
        ],
      );
    },
  ],
  [
    'transferencia determinista del anfitrión respeta gracia y no elimina puntos',
    () => {
      const f = fixture();
      f.s.members[0]!.connected = false;
      f.s.members[0]!.lastSeenAt = 2000;
      f.engine.transfer(f.s, 29999);
      assert.equal(f.s.hostId, f.s.members[0]!.id);
      f.engine.transfer(f.s, 32001);
      assert.equal(f.s.hostId, f.s.members[1]!.id);
    },
  ],
  [
    'pausa autorizada desplaza plazos explícitamente; reconexión normal no los cambia',
    () => {
      const f = fixture();
      apply(f, 'game:start');
      const end = f.s.endsAt!;
      apply(f, 'game:pause', { paused: true }, 0, 2500);
      f.rounds.advance(f.s, end + 1000);
      assert.equal(f.s.phase, 'SELECTING_SPINNER');
      apply(f, 'game:pause', { paused: false }, 0, 5000);
      assert.equal(f.s.endsAt, end + 2500);
    },
  ],
  [
    'rehúsa nuevas incorporaciones a una partida iniciada y nombres normalizados duplicados',
    () => {
      const f = fixture();
      assert.throws(() => f.engine.join(f.s, randomUUID(), 'jugador 0', 2000), /nombre/);
      apply(f, 'game:start');
      assert.throws(() => f.engine.join(f.s, randomUUID(), 'Otro jugador', 2001), /comenzó/);
    },
  ],
  [
    'puntos definitivos nunca se publican mientras exista un dictamen pendiente',
    () => {
      const f = fixture();
      f.rounds.start(f.s, 2000);
      const r = f.s.rounds[0]!;
      r.letter = 'M';
      r.entries[0]!.text = 'M prueba';
      f.rounds.lock(f.s, 3000);
      apply(f, 'review:finish', {}, 0, 3001);
      assert.equal(f.s.phase, 'REVIEW');
      assert.equal(r.scores.length, 0);
      assert.equal(r.entries[0]!.verdict, 'DISPUTED');
    },
  ],

  [
    'adjudicación explícita verifica 0/10/20 y rechaza puntuaciones incompatibles',
    () => {
      const f = fixture(2);
      f.s.categories = [
        CATEGORIES.find((c) => c.id === 'player')!,
        ...f.s.categories.filter((c) => c.id !== 'player').slice(0, 6),
      ];
      f.rounds.start(f.s, 2000);
      const r = f.s.rounds[0]!;
      r.letter = 'M';
      const e = r.entries.find(
        (e) => e.participantId === f.s.members[1]!.id && e.categoryId === 'player',
      )!;
      e.text = 'Messi';
      f.rounds.lock(f.s, 3000);
      assert.throws(
        () =>
          apply(f, 'review:award', { answerId: e.id, points: 10, reason: 'Quiero diez' }, 0, 3001),
        /20 puntos/,
      );
      assert.equal(e.verdict, 'PENDING');
      apply(
        f,
        'review:award',
        { answerId: e.id, points: 20, reason: 'Respuesta única y válida' },
        0,
        3002,
      );
      assert.equal(e.verdict, 'VALID');
      apply(f, 'review:finish', {}, 0, 3003);
      assert.equal(r.scores.find((p) => p.participantId === e.participantId)!.total, 20);
    },
  ],
  [
    'corregir canonicalización reclasifica repeticiones y exige revisar entidades liberadas',
    () => {
      const f = fixture(2);
      f.s.categories = [
        CATEGORIES.find((c) => c.id === 'player')!,
        CATEGORIES.find((c) => c.id === 'legend')!,
        ...f.s.categories.filter((c) => !['player', 'legend'].includes(c.id)).slice(0, 5),
      ];
      f.rounds.start(f.s, 2000);
      const r = f.s.rounds[0]!;
      r.letter = 'M';
      const first = r.entries.find(
          (e) => e.participantId === f.s.members[1]!.id && e.categoryId === 'player',
        )!,
        second = r.entries.find(
          (e) => e.participantId === f.s.members[1]!.id && e.categoryId === 'legend',
        )!;
      first.text = 'Messi';
      second.text = 'Messi';
      f.rounds.lock(f.s, 3000);
      assert.equal(second.reason, 'Repetido por ti');
      apply(
        f,
        'review:resolve',
        {
          answerId: first.id,
          valid: true,
          reason: 'Se refería a otra persona',
          canonical: 'Messi distinto',
        },
        0,
        3001,
      );
      assert.equal(second.verdict, 'PENDING');
      assert.equal(second.reason, 'Requiere nueva revisión tras corrección de alias');
    },
  ],
  [
    'BASTA y revisión conservan deadlines explícitos para persistencia e historial',
    () => {
      const f = fixture(2);
      f.rounds.start(f.s, 2000);
      f.rounds.stop(f.s, 3000);
      const r = f.s.rounds[0]!;
      f.rounds.advance(f.s, r.answeringStartsAt!);
      r.entries[0]!.text = 'M';
      f.rounds.basta(f.s, f.s.members[0]!.id, r.answeringStartsAt! + 1000);
      assert.equal(r.answeringEndsAt, f.s.endsAt);
      assert.ok(r.answeringEndsAt! < r.originalEndsAt!);
      f.rounds.advance(f.s, r.answeringEndsAt!);
      assert.equal(r.reviewEndsAt, r.answeringEndsAt! + 45000);
    },
  ],
  [
    'snapshots de revisión incluyen puntos provisionales y razones, sin sumarlos al ranking',
    () => {
      const f = fixture(2);
      f.rounds.start(f.s, 2000);
      const r = f.s.rounds[0]!;
      r.letter = 'M';
      r.entries[0]!.text = 'M prueba';
      f.rounds.lock(f.s, 3000);
      const visible = project(f.s, f.s.members[0]!.id, true);
      assert.equal(visible.round!.scoredEntries.length, 14);
      assert.equal(
        visible.ranking.every((p) => p.total === 0),
        true,
      );
      assert.equal(visible.round!.scoredEntries[0]!.scoreReason, 'Pendiente de dictamen');
    },
  ],
  [
    'identidad por caracteres visibles y reintento de cierre no duplica estado',
    () => {
      assert.equal(nicknameSchema.safeParse('😀').success, false);
      assert.equal(nicknameSchema.safeParse('😀😀').success, true);
      assert.equal(nicknameSchema.safeParse('😀'.repeat(24)).success, true);
      const f = fixture();
      apply(f, 'game:end', { reason: 'Error de prueba' });
      assert.throws(() => apply(f, 'game:end', { reason: 'Otro cierre' }), /cerrada/);
    },
  ],
  [
    'salir del resultado final no borra al ganador ni reasigna la clasificación',
    () => {
      const f = fixture(2);
      f.rounds.start(f.s, 2000);
      const r = f.s.rounds[0]!;
      r.scores = [
        { participantId: f.s.members[0]!.id, total: 20, uniqueCount: 1, validCount: 1 },
        { participantId: f.s.members[1]!.id, total: 0, uniqueCount: 0, validCount: 0 },
      ];
      f.s.phase = 'FINAL_RESULTS';
      f.s.members[0]!.left = true;
      const view = project(f.s, f.s.members[1]!.id, true);
      assert.equal(view.ranking[0]!.participantId, f.s.members[0]!.id);
      assert.equal(view.members.find((m) => m.id === f.s.members[0]!.id)?.left, true);
    },
  ],
];
