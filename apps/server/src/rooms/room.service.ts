import { Inject, Injectable } from '@nestjs/common';
import { createHash, randomInt, randomUUID } from 'node:crypto';
import { type Command, type RoomState } from '@basta/shared';
import { Prisma } from '../generated/prisma/client.js';
import { RoomRepository } from './room.repository.js';
import { GameEngine } from '../game/engine.service.js';
import { DrawService } from '../draws/draw.service.js';
import { requireRule } from '../game/errors.js';
@Injectable()
export class RoomService {
  constructor(
    @Inject(RoomRepository) public readonly repo: RoomRepository,
    @Inject(GameEngine) public readonly engine: GameEngine,
    @Inject(DrawService) private readonly draw: DrawService,
  ) {}
  async create(guestId: string, c: Extract<Command, { type: 'room:create' }>) {
    const key = `${guestId}:${c.clientMutationId}`;
    const old = await this.repo.created(key);
    if (old) return old;
    for (let attempt = 0; attempt < 10; attempt++) {
      const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      const code = Array.from({ length: 6 }, () => alphabet[randomInt(alphabet.length)]).join('');
      const now = Date.now(),
        id = randomUUID(),
        hostId = randomUUID();
      const state: RoomState = {
        id,
        code,
        hostId,
        gameId: randomUUID(),
        phase: 'LOBBY',
        phaseStartedAt: now,
        endsAt: null,
        revision: 0,
        expiresAt: now + Number(process.env.ROOM_TTL_HOURS ?? 24) * 3600000,
        settings: c.settings,
        members: [
          {
            id: hostId,
            guestId,
            nickname: c.nickname,
            slot: 1,
            ready: false,
            connected: false,
            joinedAt: now,
            lastSeenAt: now,
            left: false,
          },
        ],
        reservations: [],
        categories: this.draw.categories(c.settings.disabledCategories),
        rounds: [],
        pickerBag: [],
        usedLetters: [],
        events: [],
        pausedAt: null,
      };
      try {
        return await this.repo.create(state, key);
      } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
          const found = await this.repo.created(key);
          if (found) return found;
          continue;
        }
        throw e;
      }
    }
    throw new Error('No se pudo generar un código único.');
  }
  async join(guestId: string, c: Extract<Command, { type: 'room:join' }>) {
    return this.repo.transact(c.code, (s) => {
      const member = s.members.find((m) => m.guestId === guestId && !m.left);
      if (member) return;
      this.engine.join(s, guestId, c.nickname, Date.now(), c.desiredSlot);
      s.expiresAt = Date.now() + Number(process.env.ROOM_TTL_HOURS ?? 24) * 3600000;
      this.engine.rounds.audit(s, 'room:member-joined', null, { nickname: c.nickname }, Date.now());
    });
  }
  async resume(code: string, guestId: string) {
    return this.repo.transact(code, (s) => {
      this.engine.member(s, guestId);
      this.engine.rounds.advance(s, Date.now());
    });
  }
  async connection(code: string, guestId: string, connected: boolean) {
    return this.repo.transact(code, (s) => {
      const m = this.engine.member(s, guestId);
      if (m.connected === connected) return;
      m.connected = connected;
      m.lastSeenAt = Date.now();
      this.engine.rounds.audit(
        s,
        connected ? 'room:connected' : 'room:disconnected',
        m.id,
        {},
        Date.now(),
      );
    });
  }
  async command(code: string, guestId: string, c: Command) {
    return this.repo.transact(code, async (s, tx) => {
      const m = this.engine.member(s, guestId);
      requireRule('clientMutationId' in c, 'INVALID_COMMAND', 'Falta el identificador de acción.');
      const key = { roomId: s.id, guestId, mutationId: c.clientMutationId };
      const hash = createHash('sha256').update(JSON.stringify(c)).digest('hex');
      const old = await tx.mutation.findUnique({ where: { roomId_guestId_mutationId: key } });
      if (old) {
        requireRule(
          old.requestHash === hash,
          'MUTATION_CONFLICT',
          'No reutilices el mismo identificador para una acción diferente.',
        );
        return;
      }
      this.engine.apply(s, m, c, Date.now());
      await tx.mutation.create({ data: { ...key, requestHash: hash } });
    });
  }
}
