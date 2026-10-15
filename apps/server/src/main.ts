import 'reflect-metadata';
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
async function bootstrap() {
  if ((process.env.SESSION_SECRET?.length ?? 0) < 32)
    throw new Error('SESSION_SECRET debe tener al menos 32 caracteres.');
  if (process.env.NODE_ENV === 'production') {
    const origins = process.env.FRONTEND_ORIGIN?.split(',');
    if (
      !origins?.length ||
      origins.some((origin) => new URL(origin).protocol !== 'https:') ||
      !process.env.PUBLIC_APP_URL ||
      new URL(process.env.PUBLIC_APP_URL).protocol !== 'https:'
    )
      throw new Error('Producción requiere FRONTEND_ORIGIN y PUBLIC_APP_URL explícitos con HTTPS.');
  }
  const app = await NestFactory.create(AppModule);
  app.enableCors({
    origin: (process.env.FRONTEND_ORIGIN ?? 'http://localhost:5173').split(','),
    credentials: true,
  });
  app.enableShutdownHooks();
  await app.listen(Number(process.env.PORT ?? 3001), '0.0.0.0');
}
void bootstrap();
