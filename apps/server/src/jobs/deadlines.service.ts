import { Inject, Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { RoomService } from '../rooms/room.service.js';
import { GameGateway } from '../gateway/game.gateway.js';
@Injectable()
export class DeadlinesService implements OnModuleInit, OnModuleDestroy {
  private timer: ReturnType<typeof setInterval> | undefined;
  private busy = false;
  private ticks = 0;
  private readonly log = new Logger('Deadlines');
  constructor(
    @Inject(RoomService) private readonly rooms: RoomService,
    @Inject(GameGateway) private readonly gateway: GameGateway,
  ) {}
  async onModuleInit() {
    try {
      for (const code of await this.rooms.repo.codes()) {
        await this.rooms.repo.transact(code, (s) => {
          for (const m of s.members)
            if (m.connected) {
              m.connected = false;
              m.lastSeenAt = Date.now();
              this.rooms.engine.rounds.audit(s, 'room:server-recovery', m.id, {}, Date.now());
            }
          this.rooms.engine.rounds.advance(s, Date.now());
        });
      }
    } catch (e) {
      this.log.warn(
        `Recuperación inicial fallida (DB no disponible): ${e instanceof Error ? e.message : String(e)}`,
      );
    }
    this.timer = setInterval(() => void this.tick(), 250);
  }
  async tick() {
    if (this.busy) return;
    this.busy = true;
    try {
      for (const code of await this.rooms.repo.codes()) {
        const initial = await this.withRetry(() => this.rooms.repo.find(code));
        const now = Date.now();
        const picker = initial.members.find((m) => m.id === initial.rounds.at(-1)?.pickerId);
        const host = initial.members.find((m) => m.id === initial.hostId);
        const due = initial.endsAt !== null && initial.endsAt <= now && !initial.pausedAt;
        const disconnectedPicker =
          initial.phase === 'SELECTING_SPINNER' &&
          !picker?.connected &&
          now - (picker?.lastSeenAt ?? now) >= 10000;
        const hostChange =
          !host?.connected &&
          now - (host?.lastSeenAt ?? 0) >= 30000 &&
          initial.members.some((m) => m.connected && !m.left);
        if (!due && !disconnectedPicker && !hostChange) continue;
        const updated = await this.withRetry(() =>
          this.rooms.repo.transact(code, (s) => {
            this.rooms.engine.transfer(s, now);
            if (disconnectedPicker) this.rooms.engine.rounds.reassignPicker(s, now);
            this.rooms.engine.rounds.advance(s, now);
          }),
        );
        if (updated.revision !== initial.revision) await this.gateway.publish(updated);
      }
      if (++this.ticks % 240 === 0) await this.rooms.repo.cleanup();
    } catch (e) {
      this.log.error(e instanceof Error ? e.message : 'Error de recuperación');
    } finally {
      this.busy = false;
    }
  }
  /** Reintenta la operación hasta 3 veces ante errores de conexión transitorios (P1001, P1017, P1008, ConnectionClosed). */
  private async withRetry<T>(fn: () => Promise<T>, attempts = 3, delayMs = 200): Promise<T> {
    let lastError: unknown;
    for (let i = 0; i < attempts; i++) {
      try {
        return await fn();
      } catch (e) {
        lastError = e;
        const code = (e as { code?: string }).code ?? '';
        const cause = (e as { cause?: { kind?: string } }).cause;
        const isTransient =
          code === 'P1001' || // Can't reach database server
          code === 'P1017' || // Server has closed the connection
          code === 'P1008' || // Operations timed out
          cause?.kind === 'ConnectionClosed' ||
          (e instanceof Error && e.message.includes('Server has closed the connection'));
        if (!isTransient || i === attempts - 1) throw e;
        this.log.warn(`Reintento ${i + 1}/${attempts - 1} tras error de conexión (${cause?.kind ?? (code || 'unknown')})`);
        await new Promise((r) => setTimeout(r, delayMs * 2 ** i));
      }
    }
    throw lastError;
  }
  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }
}
