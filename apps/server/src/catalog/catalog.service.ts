import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { ALIASES, CATEGORIES, normalizeText } from '@basta/shared';
import { PrismaService } from '../prisma/prisma.service.js';
@Injectable()
export class CatalogService implements OnModuleInit {
  constructor(@Inject(PrismaService) private readonly db: PrismaService) {}
  async onModuleInit() {
    const aliases = await this.db.alias.findMany();
    for (const item of aliases) {
      if (ALIASES[item.entityKind])
        ALIASES[item.entityKind]![normalizeText(item.alias)] = normalizeText(item.canonicalKey);
    }
    const categories = await this.db.category.findMany();
    if (categories.length < 40)
      throw new Error('Ejecuta pnpm db:seed antes de iniciar: faltan categorías en PostgreSQL.');
    for (const category of CATEGORIES) {
      const persisted = categories.find((c) => c.id === category.id);
      if (persisted) category.enabled = persisted.enabled;
    }
  }
}
