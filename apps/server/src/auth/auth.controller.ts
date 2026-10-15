import { Controller, Get, Inject, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
@Controller('api')
export class AuthController {
  constructor(
    @Inject(AuthService) private readonly auth: AuthService,
    @Inject(PrismaService) private readonly db: PrismaService,
  ) {}
  @Get('session') async session(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const { guest, cookie } = await this.auth.bootstrap(req.headers.cookie);
    if (cookie) res.setHeader('Set-Cookie', cookie);
    res.setHeader('Cache-Control', 'no-store');
    return { id: guest.id, expiresAt: guest.expiresAt };
  }
  @Get('health') async health() {
    await this.db.$queryRaw`SELECT 1`;
    return { status: 'ok', serverNow: Date.now() };
  }
}
@Controller()
export class HealthController {
  constructor(@Inject(PrismaService) private readonly db: PrismaService) {}
  @Get('health') async health() {
    await this.db.$queryRaw`SELECT 1`;
    return { status: 'ok' };
  }
}
