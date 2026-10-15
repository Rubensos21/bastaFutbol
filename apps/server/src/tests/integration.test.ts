import 'reflect-metadata';
import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { NestFactory } from '@nestjs/core';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { io, type Socket } from 'socket.io-client';
import { randomUUID } from 'node:crypto';
import { CATEGORIES, DEFAULT_SETTINGS, type Ack, type Snapshot, type Command } from '@basta/shared';
import { RoomService } from '../rooms/room.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { DeadlinesService } from '../jobs/deadlines.service.js';
interface Client {
  socket: Socket;
  cookie: string;
  state: Snapshot | null;
}
let app: INestApplication, url: string, rooms: RoomService, db: PrismaService;
const clients: Client[] = [],
  codes = new Set<string>();
async function client(cookie?: string): Promise<Client> {
  if (!cookie) {
    const result = await request(app.getHttpServer()).get('/api/session').expect(200);
    cookie = String(result.headers['set-cookie'][0]).split(';')[0]!;
  }
  const socket = io(url, {
    transports: ['websocket'],
    extraHeaders: { Cookie: cookie },
    reconnection: false,
  });
  const value: Client = { socket, cookie, state: null };
  clients.push(value);
  socket.on('room:snapshot', (s: Snapshot) => {
    value.state = s;
  });
  await new Promise<void>((resolve, reject) => {
    socket.once('connect', resolve);
    socket.once('connect_error', reject);
  });
  return value;
}
async function send(
  c: Client,
  type: Command['type'],
  payload: Record<string, unknown> = {},
  mutationId = randomUUID(),
): Promise<Ack> {
  const ack = (await c.socket.timeout(10000).emitWithAck('command', {
    type,
    ...payload,
    ...(type === 'room:resume' ? {} : { clientMutationId: mutationId }),
  })) as Ack;
  if (ack.ok) {
    c.state = ack.data;
    codes.add(ack.data.code);
  }
  return ack;
}
async function ok(
  c: Client,
  type: Command['type'],
  payload: Record<string, unknown> = {},
  mutationId?: string,
) {
  const ack = await send(c, type, payload, mutationId);
  expect(ack.ok, JSON.stringify(ack)).toBe(true);
  if (!ack.ok) throw new Error(ack.error.message);
  return ack.data;
}
async function until(predicate: () => boolean, timeout = 20000) {
  const start = Date.now();
  while (!predicate()) {
    if (Date.now() - start > timeout)
      throw new Error('La condición multijugador no llegó dentro del plazo.');
    await new Promise((r) => setTimeout(r, 30));
  }
}
async function setup(count = 3, capacity: number | null = null) {
  const players = await Promise.all(Array.from({ length: count }, () => client()));
  const allowed = [
    'player',
    'coach',
    'club',
    'world_cup_country',
    'legend',
    'best_coach',
    'best_prime',
  ];
  const state = await ok(players[0]!, 'room:create', {
    nickname: 'Davo',
    settings: {
      ...DEFAULT_SETTINGS,
      capacity,
      rounds: 3,
      letters: ['M'],
      disabledCategories: CATEGORIES.filter((c) => !allowed.includes(c.id)).map((c) => c.id),
    },
  });
  for (const [index, p] of players.entries())
    if (index)
      await ok(p, 'room:join', {
        code: state.code,
        nickname: ['Davo', 'Cobra', 'Teo', 'Beno'][index] ?? `Jugador ${index}`,
      });
  return players;
}
beforeAll(async () => {
  // Nunca borrar ni usar implícitamente la base de desarrollo del usuario.
  if (
    !process.env.TEST_DATABASE_URL ||
    !new URL(process.env.TEST_DATABASE_URL).pathname.endsWith('_test')
  )
    throw new Error(
      'Configura TEST_DATABASE_URL apuntando a una base PostgreSQL con sufijo _test y aplica sus migraciones.',
    );
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
  process.env.SESSION_SECRET = 'secreto-exclusivo-para-las-pruebas-de-integracion-123456789';
  const { AppModule } = await import('../app.module.js');
  const bootstrapDb = new PrismaService();
  for (const category of CATEGORIES)
    await bootstrapDb.category.upsert({
      where: { id: category.id },
      create: category,
      update: category,
    });
  await bootstrapDb.$disconnect();
  app = await NestFactory.create(AppModule, { logger: false });
  await app.listen(0, '127.0.0.1');
  url = await app.getUrl();
  db = app.get(PrismaService);
  rooms = app.get(RoomService);
  for (const category of CATEGORIES)
    await db.category.upsert({ where: { id: category.id }, create: category, update: category });
});
afterAll(async () => {
  for (const c of clients) c.socket.disconnect();
  if (app) {
    app.get(DeadlinesService).onModuleDestroy();
    if (db) for (const code of codes) await db.room.deleteMany({ where: { code } });
    await app.close();
  }
});
describe('NestJS + PostgreSQL + sockets reales', () => {
  it('creación, registro de cuatro humanos, listo y misma sala', async () => {
    const players = await setup(4, 4);
    await until(() => players.every((p) => p.state?.members.length === 4));
    for (const p of players) await ok(p, 'room:ready', { ready: true });
    await ok(players[0]!, 'game:start');
    await until(() => players.every((p) => p.state?.phase === 'SELECTING_SPINNER'));
    expect(new Set(players.map((p) => p.state!.code)).size).toBe(1);
    expect(new Set(players.map((p) => JSON.stringify(p.state!.categories))).size).toBe(1);
    expect(
      await db.gameCategory.count({
        where: { gameId: (await rooms.repo.find(players[0]!.state!.code)).gameId },
      }),
    ).toBe(7);
  });
  it('tres entradas simultáneas disputan la última plaza: solo una entra', async () => {
    const [host] = await setup(1, 2);
    const guests = await Promise.all([client(), client(), client()]);
    const outcomes = await Promise.all(
      guests.map((g, i) =>
        send(g, 'room:join', { code: host!.state!.code, nickname: `Invitado ${i}` }),
      ),
    );
    expect(outcomes.filter((a) => a.ok)).toHaveLength(1);
    expect((await rooms.repo.find(host!.state!.code)).members).toHaveLength(2);
    for (const ack of outcomes.filter((a) => !a.ok))
      if (!ack.ok) expect(ack.error.code).toBe('ROOM_FULL');
  });
  it('capacidad fija requiere dispositivos reales; las reservas no forman jugadores', async () => {
    const [host, guest] = await setup(2, 3);
    await ok(host!, 'room:reserve-slot', { slot: 3, nickname: 'Reserva' });
    await ok(host!, 'room:ready', { ready: true });
    await ok(guest!, 'room:ready', { ready: true });
    const denied = await send(host!, 'game:start');
    expect(denied.ok).toBe(false);
    if (!denied.ok) expect(denied.error.code).toBe('FIXED_CAPACITY');
    expect(host!.state!.members).toHaveLength(2);
  });
  it('STOP autorizado y atómico, privacidad real, F5, BASTA, votos, score y siguiente ronda', async () => {
    const players = await setup();
    const host = players[0]!;
    for (const p of players) await ok(p, 'room:ready', { ready: true });
    const startId = randomUUID();
    await ok(host, 'game:start', {}, startId);
    await ok(host, 'game:start', {}, startId);
    const roundId = host.state!.round!.id;
    const picker = players.find((p) => p.state!.meId === host.state!.round!.pickerId)!;
    const other = players.find((p) => p !== picker)!;
    const forged = await send(other, 'draw:stop', { roundId });
    expect(forged.ok).toBe(false);
    if (!forged.ok) expect(forged.error.code).toBe('NOT_SELECTED_PICKER');
    const stopId = randomUUID();
    const stops = await Promise.all([
      send(picker, 'draw:stop', { roundId }, stopId),
      send(picker, 'draw:stop', { roundId }, stopId),
    ]);
    expect(stops.every((v) => v.ok)).toBe(true);
    await until(() => players.every((p) => p.state?.phase === 'ANSWERING'));
    const deadline = host.state!.endsAt;
    expect(players.every((p) => p.state!.endsAt === deadline)).toBe(true);
    expect(players.every((p) => p.state!.round!.letter === 'M')).toBe(true);
    const saved = await ok(host, 'answers:save-draft', {
      roundId,
      categoryId: 'player',
      text: 'Messi',
      previousVersion: 0,
    });
    const privateText = JSON.stringify(players[1]!.state);
    expect(privateText.includes('Messi')).toBe(false);
    const illegal = await send(players[1]!, 'answers:save-draft', {
      roundId,
      categoryId: 'player',
      text: 'Messi',
      previousVersion: 0,
      participantId: saved.meId,
    });
    expect(illegal.ok).toBe(false);
    const duplicateTab = await client(host.cookie);
    await ok(duplicateTab, 'room:resume', { code: host.state!.code });
    const readonly = await send(host, 'round:call-basta', { roundId });
    expect(readonly.ok).toBe(false);
    if (!readonly.ok) expect(readonly.error.code).toBe('READ_ONLY');
    await ok(host, 'room:resume', { code: host.state!.code });
    duplicateTab.socket.disconnect();
    expect(host.state!.round!.entries.find((e) => e.categoryId === 'player')!.text).toBe('Messi');
    expect(host.state!.endsAt).toBe(deadline);
    await ok(players[1]!, 'answers:save-draft', {
      roundId,
      categoryId: 'player',
      text: 'messi',
      previousVersion: 0,
    });
    await ok(players[2]!, 'answers:save-draft', {
      roundId,
      categoryId: 'player',
      text: 'Mbappé',
      previousVersion: 0,
    });
    const bastaId = randomUUID();
    const called = await ok(host, 'round:call-basta', { roundId }, bastaId);
    await ok(host, 'round:call-basta', { roundId }, bastaId);
    expect(called.endsAt! - called.serverNow).toBeLessThanOrEqual(10000);
    expect(called.endsAt!).toBeLessThanOrEqual(deadline!);
    await until(() => players.every((p) => p.state?.phase === 'REVIEW'));
    expect(players.every((p) => JSON.stringify(p.state).includes('Mbappé'))).toBe(true);
    const late = await send(host, 'answers:save-draft', {
      roundId,
      categoryId: 'player',
      text: 'Maradona',
      previousVersion: 1,
    });
    expect(late.ok).toBe(false);
    for (const entry of host.state!.round!.entries.filter((e) => e.text)) {
      for (const p of players)
        if (p.state!.meId !== entry.participantId)
          await ok(p, 'review:vote', { answerId: entry.id, valid: true });
      const own = players.find((p) => p.state!.meId === entry.participantId)!;
      const self = await send(own, 'review:vote', { answerId: entry.id, valid: true });
      expect(self.ok).toBe(false);
    }
    const publishId = randomUUID();
    const result = await ok(host, 'scores:publish', {}, publishId);
    await ok(host, 'scores:publish', {}, publishId);
    expect(result.round!.scores.map((s) => s.total)).toEqual([10, 10, 20]);
    const categoryIds = result.categories.map((c) => c.id);
    const nextId = randomUUID();
    await ok(host, 'game:next-round', {}, nextId);
    await ok(host, 'game:next-round', {}, nextId);
    expect(host.state!.round!.number).toBe(2);
    expect(host.state!.categories.map((c) => c.id)).toEqual(categoryIds);
    expect((await rooms.repo.find(host.state!.code)).rounds).toHaveLength(2);
  }, 40000);
  it('aislamiento entre salas: código ajeno no permite leer ni escribir', async () => {
    const [a] = await setup(1),
      [b] = await setup(1);
    const denied = await send(a!, 'room:resume', { code: b!.state!.code });
    expect(denied.ok).toBe(false);
    if (!denied.ok) expect(denied.error.code).toBe('NOT_MEMBER');
    expect(a!.state!.code).not.toBe(b!.state!.code);
    const missing = await send(a!, 'room:resume', { code: 'ZZZZZZ' });
    expect(missing.ok).toBe(false);
  });
  it('reconstruye el estado desde PostgreSQL y recupera plazos vencidos', async () => {
    const players = await setup(2);
    const host = players[0]!;
    for (const p of players) await ok(p, 'room:ready', { ready: true });
    await ok(host, 'game:start');
    const code = host.state!.code;
    await rooms.repo.transact(code, (s) => {
      rooms.engine.rounds.stop(s, Date.now() - 100000);
    });
    // Reinicio real de Nest y del cliente Prisma: el proceso de recuperación lee PostgreSQL.
    const cookie = host.cookie;
    for (const client of clients) client.socket.disconnect();
    await new Promise((resolve) => setTimeout(resolve, 100));
    await app.close();
    const { AppModule } = await import('../app.module.js');
    app = await NestFactory.create(AppModule, { logger: false });
    await app.listen(0, '127.0.0.1');
    url = await app.getUrl();
    db = app.get(PrismaService);
    rooms = app.get(RoomService);
    const restored = await client(cookie);
    const recovered = await rooms.repo.find(code);
    expect(recovered.phase).toBe('REVIEW');
    expect(recovered.rounds[0]!.originalEndsAt!).toBeLessThan(Date.now());
    expect((await db.room.findUniqueOrThrow({ where: { code } })).revision).toBe(
      recovered.revision,
    );
    const snapshot = await ok(restored, 'room:resume', { code });
    expect(snapshot.phase).toBe('REVIEW');
  });
});
