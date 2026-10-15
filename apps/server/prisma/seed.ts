import 'dotenv/config';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';
import { CATEGORIES, ALIASES } from '@basta/shared';
const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});
try {
  for (const c of CATEGORIES)
    await db.category.upsert({ where: { id: c.id }, create: c, update: c });
  for (const [entityKind, table] of Object.entries(ALIASES))
    for (const [alias, canonicalKey] of Object.entries(table))
      await db.alias.upsert({
        where: { entityKind_alias: { entityKind, alias } },
        create: { entityKind, alias, canonicalKey },
        update: { canonicalKey },
      });
  console.log(`Catálogo sembrado: ${CATEGORIES.length} categorías y aliases explícitos.`);
} finally {
  await db.$disconnect();
}
