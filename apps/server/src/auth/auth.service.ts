import { Inject, Injectable } from '@nestjs/common';
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service.js';
import { requireRule } from '../game/errors.js';
@Injectable()
export class AuthService {
  constructor(@Inject(PrismaService) private readonly db: PrismaService) {}
  private secret() {
    const secret = process.env.SESSION_SECRET;
    requireRule(
      secret && secret.length >= 32,
      'CONFIG_ERROR',
      'Configura SESSION_SECRET con al menos 32 caracteres.',
    );
    return secret;
  }
  private signature(value: string) {
    return createHmac('sha256', this.secret()).update(value).digest('hex');
  }
  cookieValue(header?: string) {
    const value = header
      ?.split(';')
      .map((x) => x.trim())
      .find((x) => x.startsWith('basta_session='))
      ?.slice(14);
    return value;
  }
  async authenticate(header?: string) {
    const value = this.cookieValue(header);
    requireRule(value, 'SESSION_EXPIRED', 'Tu sesión caducó. Vuelve al inicio.');
    const [token, sig] = value.split('.');
    requireRule(token && sig && /^[a-f0-9]{64}$/.test(sig), 'SESSION_EXPIRED', 'Sesión inválida.');
    const expected = this.signature(token);
    requireRule(
      timingSafeEqual(Buffer.from(sig), Buffer.from(expected)),
      'SESSION_EXPIRED',
      'Sesión inválida.',
    );
    const guest = await this.db.guestIdentity.findUnique({
      where: { sessionHash: createHash('sha256').update(token).digest('hex') },
    });
    requireRule(
      guest && guest.expiresAt.getTime() > Date.now(),
      'SESSION_EXPIRED',
      'Tu sesión caducó. Vuelve al inicio.',
    );
    return guest;
  }
  async bootstrap(header?: string) {
    try {
      const guest = await this.authenticate(header);
      return { guest, cookie: null };
    } catch {
      const production = process.env.NODE_ENV === 'production';
      const token = randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 7 * 86400000);
      const guest = await this.db.guestIdentity.create({
        data: { sessionHash: createHash('sha256').update(token).digest('hex'), expiresAt },
      });
      return {
        guest,
        cookie: `basta_session=${token}.${this.signature(token)}; HttpOnly; Path=/; SameSite=${
          production ? 'None' : 'Lax'
        }; Max-Age=604800${production ? '; Secure' : ''}`,
      };
    }
  }
}
