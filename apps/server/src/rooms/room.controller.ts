import { Controller, Get, HttpException, Inject, Param, Req } from '@nestjs/common';
import type { Request } from 'express';
import { codeSchema } from '@basta/shared';
import { AuthService } from '../auth/auth.service.js';
import { RoomRepository } from './room.repository.js';
import { DomainError, requireRule } from '../game/errors.js';
@Controller('api/rooms')
export class RoomController {
  private readonly attempts = new Map<string, { at: number; count: number }>();
  constructor(
    @Inject(AuthService) private readonly auth: AuthService,
    @Inject(RoomRepository) private readonly repo: RoomRepository,
  ) {}
  @Get(':code') async preview(@Param('code') code: string, @Req() req: Request) {
    try {
      const now = Date.now(),
        key = req.ip ?? 'unknown',
        previous = this.attempts.get(key);
      const bucket = previous && now - previous.at < 60000 ? previous : { at: now, count: 0 };
      bucket.count++;
      this.attempts.set(key, bucket);
      if (this.attempts.size > 10000)
        for (const [ip, value] of this.attempts)
          if (now - value.at > 60000) this.attempts.delete(ip);
      requireRule(bucket.count <= 40, 'RATE_LIMIT', 'Demasiados intentos. Espera un minuto.');
      await this.auth.authenticate(req.headers.cookie);
      const parsed = codeSchema.safeParse(code);
      requireRule(parsed.success, 'INVALID_INPUT', 'Código de sala inválido.');
      const state = await this.repo.find(parsed.data);
      const members = state.members.filter((m) => !m.left),
        capacity = state.settings.capacity ?? 7;
      return {
        code: state.code,
        phase: state.phase,
        memberCount: members.length,
        capacity,
        slots: Array.from({ length: capacity }, (_, i) => i + 1)
          .filter((slot) => !members.some((m) => m.slot === slot))
          .map((slot) => ({
            slot,
            reservedName: state.reservations.find((r) => r.slot === slot)?.nickname ?? null,
          })),
      };
    } catch (error) {
      if (error instanceof DomainError)
        throw new HttpException(
          { code: error.code, message: error.message },
          error.code === 'RATE_LIMIT'
            ? 429
            : error.code === 'SESSION_EXPIRED'
              ? 401
              : error.code === 'ROOM_NOT_FOUND'
                ? 404
                : 400,
        );
      throw new HttpException(
        { code: 'SERVER_ERROR', message: 'No se pudo consultar la sala.' },
        503,
      );
    }
  }
}
