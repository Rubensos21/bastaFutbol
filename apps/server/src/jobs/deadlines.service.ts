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
    this.timer = setInterval(() => void this.tick(), 250);
  }
  async tick() {
    if (this.busy) return;
    this.busy = true;
    try {
      for (const code of await this.rooms.repo.codes()) {
        const initial = await this.rooms.repo.find(code);
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
        const updated = await this.rooms.repo.transact(code, (s) => {
          this.rooms.engine.transfer(s, now);
          if (disconnectedPicker) this.rooms.engine.rounds.reassignPicker(s, now);
          this.rooms.engine.rounds.advance(s, now);
        });
        if (updated.revision !== initial.revision) await this.gateway.publish(updated);
      }
      if (++this.ticks % 240 === 0) await this.rooms.repo.cleanup();
    } catch (e) {
      this.log.error(e instanceof Error ? e.message : 'Error de recuperación');
    } finally {
      this.busy = false;
    }
  }
  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }
}
