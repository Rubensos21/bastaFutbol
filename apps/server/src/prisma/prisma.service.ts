import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger(PrismaService.name);
  constructor() {
    super({
      adapter: new PrismaPg({
        connectionString: process.env.DATABASE_URL,
        // Mantiene conexiones vivas ante idle-timeouts del servidor
        keepAlive: true,
        keepAliveInitialDelayMillis: 10000,
        max: 5,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000,
      }),
    });
  }
  async onModuleInit() {
    // Pre-calienta el pool; si la DB no está disponible aún, lo intenta en silencio
    // y deja que la primera query real lo reintente (con el retry de DeadlinesService)
    try {
      await this.$connect();
    } catch (e) {
      this.log.warn(
        `No se pudo conectar a la base de datos al iniciar: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }
  async onModuleDestroy() {
    await this.$disconnect();
  }
}
