import { Inject, Injectable } from '@nestjs/common';
import { normalizeText, type RoomState } from '@basta/shared';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { requireRule } from '../game/errors.js';
type Transaction = Prisma.TransactionClient;
const json = (v: unknown) => JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue;
@Injectable()
export class RoomRepository {
  constructor(@Inject(PrismaService) private readonly db: PrismaService) {}
  async find(code: string) {
    const row = await this.db.room.findUnique({ where: { code } });
    requireRule(row, 'ROOM_NOT_FOUND', 'La sala no existe. Revisa el código.');
    requireRule(
      row.expiresAt.getTime() > Date.now(),
      'ROOM_EXPIRED',
      'La sala caducó. Crea una nueva.',
    );
    return row.state as unknown as RoomState;
  }
  async create(state: RoomState, creationKey: string) {
    await this.db.$transaction(async (tx) => {
      await tx.room.create({
        data: {
          id: state.id,
          code: state.code,
          hostParticipantId: state.hostId,
          phase: state.phase,
          revision: state.revision,
          capacity: state.settings.capacity,
          expiresAt: new Date(state.expiresAt),
          state: json(state),
          creationKey,
        },
      });
      await this.persist(tx, state, null);
    });
    return state;
  }
  async created(key: string) {
    const room = await this.db.room.findUnique({ where: { creationKey: key } });
    return room?.state as unknown as RoomState | undefined;
  }
  async transact(code: string, fn: (s: RoomState, tx: Transaction) => Promise<void> | void) {
    return this.db.$transaction(
      async (tx) => {
        const rows = await tx.$queryRaw<
          { id: string }[]
        >`SELECT id FROM "Room" WHERE code = ${code} FOR UPDATE`;
        requireRule(rows.length, 'ROOM_NOT_FOUND', 'La sala no existe.');
        const row = await tx.room.findUniqueOrThrow({ where: { id: rows[0]!.id } });
        requireRule(row.expiresAt.getTime() > Date.now(), 'ROOM_EXPIRED', 'La sala caducó.');
        const state = row.state as unknown as RoomState;
        const before = structuredClone(state);
        await fn(state, tx);
        if (JSON.stringify(state) !== JSON.stringify(before)) await this.persist(tx, state, before);
        return state;
      },
      { timeout: 20000, maxWait: 10000 },
    );
  }
  private async persist(tx: Transaction, s: RoomState, before: RoomState | null) {
    await tx.room.update({
      where: { id: s.id },
      data: {
        hostParticipantId: s.hostId,
        phase: s.phase,
        revision: s.revision,
        capacity: s.settings.capacity,
        expiresAt: new Date(s.expiresAt),
        state: json(s),
      },
    });
    for (const m of s.members) {
      const prior = before?.members.find((p) => p.id === m.id);
      if (JSON.stringify(m) === JSON.stringify(prior)) continue;
      const data = {
        roomId: s.id,
        guestIdentityId: m.guestId,
        nickname: m.nickname,
        normalizedNickname: normalizeText(m.nickname),
        slotNumber: m.slot,
        isReady: m.ready,
        isConnected: m.connected,
        joinedAt: new Date(m.joinedAt),
        lastSeenAt: new Date(m.lastSeenAt),
        leftAt: m.left ? new Date() : null,
      };
      await tx.participant.upsert({
        where: { id: m.id },
        create: { id: m.id, ...data },
        update: data,
      });
    }
    if (JSON.stringify(s.reservations) !== JSON.stringify(before?.reservations)) {
      await tx.reservedSlot.deleteMany({ where: { roomId: s.id } });
      if (s.reservations.length)
        await tx.reservedSlot.createMany({
          data: s.reservations.map((r) => ({
            roomId: s.id,
            slotNumber: r.slot,
            preferredName: r.nickname,
            claimantId: r.claimantId,
            approved: r.approved,
          })),
        });
    }
    const game = {
      roomId: s.id,
      status: s.phase,
      configuredRoundCount: s.settings.rounds,
      roundDurationSeconds: s.settings.roundSeconds,
      currentRound: s.rounds.length,
    };
    await tx.game.upsert({
      where: { id: s.gameId },
      create: { id: s.gameId, ...game },
      update: game,
    });
    if (
      s.gameId !== before?.gameId ||
      JSON.stringify(s.categories) !== JSON.stringify(before?.categories)
    ) {
      await tx.gameCategory.deleteMany({ where: { gameId: s.gameId } });
      await tx.gameCategory.createMany({
        data: s.categories.map((c, order) => ({ gameId: s.gameId, categoryId: c.id, order })),
      });
    }
    for (const r of s.rounds) {
      const previous = before?.rounds.find((v) => v.id === r.id);
      if (
        JSON.stringify(r) === JSON.stringify(previous) &&
        s.phase === before?.phase &&
        s.endsAt === before?.endsAt
      )
        continue;
      const data = {
        gameId: s.gameId,
        number: r.number,
        pickerId: r.pickerId,
        letter: r.letter,
        status: r === s.rounds.at(-1) ? s.phase : 'ROUND_RESULTS',
        answeringStartsAt: r.answeringStartsAt ? new Date(r.answeringStartsAt) : null,
        answeringEndsAt: r.answeringEndsAt ? new Date(r.answeringEndsAt) : null,
        reviewEndsAt: r.reviewEndsAt ? new Date(r.reviewEndsAt) : null,
        revision: s.revision,
      };
      await tx.round.upsert({ where: { id: r.id }, create: { id: r.id, ...data }, update: data });
      for (const e of r.entries) {
        if (JSON.stringify(e) === JSON.stringify(previous?.entries.find((v) => v.id === e.id)))
          continue;
        const a = {
          roundId: r.id,
          categoryId: e.categoryId,
          participantId: e.participantId,
          rawText: e.text,
          normalizedText: normalizeText(e.text),
          canonicalEntityId: e.canonical,
          version: e.version,
          draftUpdatedAt: new Date(e.updatedAt),
          status: e.verdict,
          invalidReason: e.reason,
        };
        await tx.answer.upsert({ where: { id: e.id }, create: { id: e.id, ...a }, update: a });
        for (const v of e.votes) {
          await tx.answerVote.upsert({
            where: {
              answerId_voterParticipantId: { answerId: e.id, voterParticipantId: v.voterId },
            },
            create: {
              answerId: e.id,
              voterParticipantId: v.voterId,
              verdict: v.valid,
              reason: v.reason,
              updatedAt: new Date(),
            },
            update: { verdict: v.valid, reason: v.reason, updatedAt: new Date() },
          });
        }
        if (e.verdict !== 'PENDING') {
          const j = {
            verdict: e.verdict,
            resolverId: e.resolvedBy,
            reason: e.reason,
            judgedAt: new Date(),
            revision: s.revision,
          };
          await tx.answerJudgment.upsert({
            where: { answerId: e.id },
            create: { answerId: e.id, ...j },
            update: j,
          });
        }
      }
      for (const score of r.scores) {
        const v = {
          score: score.total,
          uniqueCount: score.uniqueCount,
          validCount: score.validCount,
          revision: s.revision,
        };
        await tx.roundScore.upsert({
          where: { roundId_participantId: { roundId: r.id, participantId: score.participantId } },
          create: { roundId: r.id, participantId: score.participantId, ...v },
          update: v,
        });
      }
    }
    const events = s.events.filter((e) => e.revision > (before?.revision ?? -1));
    if (events.length)
      await tx.auditEvent.createMany({
        data: events.map((e) => ({
          roomId: s.id,
          actorId: e.actorId,
          type: e.type,
          payload: json(e.payload),
          createdAt: new Date(e.at),
          revision: e.revision,
        })),
      });
  }
  async codes() {
    return (
      await this.db.room.findMany({
        where: { expiresAt: { gt: new Date() } },
        select: { code: true },
      })
    ).map((r) => r.code);
  }
  async cleanup() {
    await this.db.room.deleteMany({ where: { expiresAt: { lt: new Date() } } });
    await this.db.guestIdentity.deleteMany({
      where: { expiresAt: { lt: new Date() }, participants: { none: {} } },
    });
  }
}
