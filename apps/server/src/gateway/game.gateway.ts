import { Inject, Logger } from '@nestjs/common';
import {
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { commandSchema, type Ack, type RoomState } from '@basta/shared';
import { AuthService } from '../auth/auth.service.js';
import { RoomService } from '../rooms/room.service.js';
import { DomainError, requireRule } from '../game/errors.js';
import { project } from '../rooms/projection.js';
import { ZodError } from 'zod';
interface SessionSocket {
  guestId: string;
  code?: string;
  memberId?: string;
  expiresAt: number;
}
@WebSocketGateway({
  cors: {
    origin: (process.env.FRONTEND_ORIGIN ?? 'http://localhost:5173').split(','),
    credentials: true,
  },
  maxHttpBufferSize: 16384,
})
export class GameGateway implements OnGatewayInit, OnGatewayDisconnect {
  @WebSocketServer() server!: Server;
  private readonly log = new Logger('GameGateway');
  private readonly sessions = new Map<string, SessionSocket>();
  private readonly writers = new Map<string, string>();
  private readonly rates = new Map<string, { count: number; at: number }>();
  constructor(
    @Inject(AuthService) private readonly auth: AuthService,
    @Inject(RoomService) private readonly rooms: RoomService,
  ) {}
  afterInit(server: Server) {
    server.use(async (socket: Socket, next: (error?: Error) => void) => {
      try {
        const origin = socket.handshake.headers.origin;
        if (origin)
          requireRule(
            (process.env.FRONTEND_ORIGIN ?? 'http://localhost:5173').split(',').includes(origin),
            'ORIGIN_FORBIDDEN',
            'Origen no permitido.',
          );
        const guest = await this.auth.authenticate(socket.handshake.headers.cookie);
        this.sessions.set(socket.id, { guestId: guest.id, expiresAt: guest.expiresAt.getTime() });
        next();
      } catch {
        next(new Error('SESSION_EXPIRED'));
      }
    });
  }
  private rate(key: string, limit: number) {
    const now = Date.now(),
      old = this.rates.get(key);
    const bucket = old && now - old.at < 60000 ? old : { count: 0, at: now };
    bucket.count++;
    this.rates.set(key, bucket);
    requireRule(bucket.count <= limit, 'RATE_LIMIT', 'Demasiados intentos. Espera un minuto.');
    if (this.rates.size > 10000)
      for (const [k, b] of this.rates) if (now - b.at > 60000) this.rates.delete(k);
  }
  @SubscribeMessage('clock:ping') ping() {
    return { serverNow: Date.now() };
  }
  @SubscribeMessage('command') async command(
    @ConnectedSocket() socket: Socket,
    @MessageBody() payload: unknown,
  ): Promise<Ack> {
    try {
      const guest = await this.auth.authenticate(socket.handshake.headers.cookie);
      const session = this.sessions.get(socket.id);
      requireRule(session && session.guestId === guest.id, 'SESSION_EXPIRED', 'Tu sesión caducó.');
      this.rate(`guest:${guest.id}`, 400);
      const c = commandSchema.parse(payload);
      let state: RoomState;
      if (['room:create', 'room:join'].includes(c.type))
        this.rate(`join:${socket.handshake.address}`, 40);
      if (c.type === 'room:create') state = await this.rooms.create(guest.id, c);
      else if (c.type === 'room:join') state = await this.rooms.join(guest.id, c);
      else if (c.type === 'room:resume') state = await this.rooms.resume(c.code, guest.id);
      else {
        requireRule(session.code && session.memberId, 'NOT_MEMBER', 'Entra a una sala primero.');
        requireRule(
          this.writers.get(session.memberId) === socket.id,
          'READ_ONLY',
          'Otra pestaña tiene el control. Recarga aquí para recuperarlo.',
        );
        state = await this.rooms.command(session.code, guest.id, c);
      }
      const member =
        c.type === 'room:leave'
          ? state.members.find((m) => m.guestId === guest.id)!
          : this.rooms.engine.member(state, guest.id);
      if (['room:create', 'room:join', 'room:resume'].includes(c.type)) {
        if (session.code && session.code !== state.code) {
          await this.detach(socket, session);
        }
        session.code = state.code;
        session.memberId = member.id;
        this.writers.set(member.id, socket.id);
        await socket.join(state.id);
        state = await this.rooms.connection(state.code, guest.id, true);
      }
      await this.publish(state);
      return {
        ok: true,
        data: project(state, member.id, this.writers.get(member.id) === socket.id),
        revision: state.revision,
      };
    } catch (error) {
      if (error instanceof DomainError)
        return { ok: false, error: { code: error.code, message: error.message } };
      if (error instanceof ZodError)
        return {
          ok: false,
          error: { code: 'INVALID_INPUT', message: error.issues[0]?.message ?? 'Datos inválidos.' },
        };
      this.log.error(
        JSON.stringify({
          event: 'command:error',
          socketId: socket.id,
          errorType: error instanceof Error ? error.name : 'Error desconocido',
        }),
      );
      return {
        ok: false,
        error: {
          code: 'SERVER_ERROR',
          message: 'No se pudo guardar la acción. Reintenta; tu borrador local se conserva.',
        },
      };
    }
  }
  async publish(state: RoomState) {
    for (const [socketId, session] of this.sessions) {
      if (session.code !== state.code || !session.memberId) continue;
      const socket = this.server.sockets.sockets.get(socketId);
      if (!socket) continue;
      if (session.expiresAt <= Date.now()) {
        socket.emit('room:error', {
          code: 'SESSION_EXPIRED',
          message: 'Tu sesión caducó. Vuelve al inicio.',
        });
        socket.disconnect(true);
        continue;
      }
      const member = state.members.find((m) => m.id === session.memberId && !m.left);
      if (!member) {
        socket.emit('room:error', {
          code: 'REMOVED',
          message: 'Saliste de la sala o el anfitrión retiró tu plaza.',
        });
        session.code = undefined;
        session.memberId = undefined;
        await socket.leave(state.id);
        continue;
      }
      socket.emit(
        'room:snapshot',
        project(state, member.id, this.writers.get(member.id) === socketId),
      );
    }
  }
  private async detach(socket: Socket, session: SessionSocket) {
    if (!session.code || !session.memberId) return;
    const other = [...this.sessions].filter(
      ([id, s]) =>
        id !== socket.id && s.memberId === session.memberId && this.server.sockets.sockets.has(id),
    );
    if (this.writers.get(session.memberId) === socket.id) {
      if (other.length) this.writers.set(session.memberId, other.at(-1)![0]);
      else this.writers.delete(session.memberId);
    }
    try {
      const state = await this.rooms.connection(session.code, session.guestId, other.length > 0);
      await this.publish(state);
    } catch {
      /* Una sala caducada no requiere actualizar conexión. */
    }
  }
  async handleDisconnect(socket: Socket) {
    const s = this.sessions.get(socket.id);
    if (s) await this.detach(socket, s);
    this.sessions.delete(socket.id);
  }
}
