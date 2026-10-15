# Basta Futbolero

Juego privado de Basta/Stop futbolero para **2–7 personas**, desde navegadores y dispositivos distintos. Vue 3 + Vite + TypeScript, Pinia, Router y GSAP; NestJS + Socket.IO; PostgreSQL + Prisma 7. El navegador nunca decide letras, deadlines, propietarios o puntos.

**Estado de verificación:** el código del flujo completo está implementado, pero todavía **no se considera una entrega terminada**. En el entorno de desarrollo sin DNS ni PostgreSQL se ejecutaron las pruebas del núcleo, la compilación del paquete compartido y el análisis de componentes. La compilación del workspace, migraciones ejecutadas, integración real, E2E y comprobación visual siguen pendientes. Consulta [el informe reproducible](docs/verification.md). No se sustituyó el backend por mocks.

## Arranque local

Necesitas Node 24 LTS, pnpm 10 o superior, acceso al registro npm y Docker Compose, o una instalación de PostgreSQL. No necesitas servicios de pago.

```bash
pnpm install
cp apps/server/.env.example apps/server/.env
cp apps/web/.env.example apps/web/.env
# Edita SESSION_SECRET: mínimo 32 caracteres aleatorios.
# Por ejemplo: node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
pnpm db:up
pnpm db:generate
pnpm db:migrate
pnpm db:seed
pnpm dev
```

Abre `http://localhost:5173`. La API escucha en `3001`; `GET /health` y `GET /api/health` verifican PostgreSQL. Vite reenvía `/api` y `/socket.io` a la API, por lo que la sesión funciona mediante cookie HttpOnly del mismo origen.

La primera instalación completa debe generar y versionar el **nuevo `pnpm-lock.yaml`**. El lock de la plantilla original se conserva únicamente como `docs/scaffold-pnpm-lock.yaml`; no representa las dependencias nuevas. No uses `--frozen-lockfile` hasta completar esta instalación y revisar el lock generado.

Sin Docker, `pnpm db:local` ofrece PostgreSQL real mediante el paquete opcional `embedded-postgres`; requiere descargar sus binarios durante la instalación. Usa el directorio persistente `.local-postgres`. Esta alternativa no se ha ejecutado aquí. También puedes instalar PostgreSQL y crear el usuario `basta` y la base `basta_futbolero` con los valores de `.env.example`.

## Probar dos navegadores y un teléfono

1. Abre el navegador normal, crea la sala y marca **Estoy listo**.
2. Abre un perfil distinto o incógnito, entra con el enlace, introduce otro apodo y marca **Estoy listo**. Dos pestañas del mismo perfil comparten identidad: la última pestaña que reanuda la sala tiene el control de escritura.
3. En LAN, agrega el origen real a `FRONTEND_ORIGIN`, por ejemplo `http://localhost:5173,http://192.168.1.20:5173`. Reinicia la API. Desde el teléfono abre `http://192.168.1.20:5173`. El proxy permite mantener vacías `VITE_API_URL` y `VITE_SOCKET_URL`.
4. El anfitrión comienza. Solo la persona asignada puede pulsar **PARAR**. Todos reciben la misma letra y el countdown 3–2–1. Durante la ronda cada persona escribe en su propia fila; los textos de los demás están filtrados en el servidor.
5. **BASTA** deja hasta 10 segundos; **Terminé** bloquea solamente la propia fila. Voten las respuestas reveladas, resuelvan pendientes y publiquen puntos antes de seguir.

Vite ya usa `--host 0.0.0.0`. Permite el puerto 5173 en el firewall exclusivamente en una LAN de confianza. No compartas `localhost` con otro dispositivo. Las casillas vacías y las reservas sin reclamar no cuentan como jugadores.

## Comandos de calidad

```bash
pnpm lint
pnpm typecheck
pnpm test:unit
pnpm test:core
pnpm build
```

`test:core` ejecuta las mismas reglas usadas por la suite Vitest con el runner de Node, útil cuando solamente TypeScript y Zod están disponibles. Node 24 o superior es necesario para su loader síncrono. `check:source` analiza SFCs y sintaxis TS; **no reemplaza** `typecheck`, `build` o E2E.

Las pruebas de integración requieren una base independiente con nombre terminado en `_test`; el runner rechaza usar implícitamente la base de desarrollo. Primero créala en PostgreSQL:

```bash
# Después de crear la base basta_futbolero_test:
export TEST_DATABASE_URL='postgresql://basta:basta_dev@localhost:5432/basta_futbolero_test?schema=public'
pnpm db:test:migrate
pnpm test:integration
# pnpm test incluye unitarias, cliente e integración; también requiere TEST_DATABASE_URL.
pnpm test
```

La integración inicia Nest en un puerto libre y utiliza Supertest, cookies auténticas, clientes Socket.IO y PostgreSQL real. Comprueba última plaza concurrente, STOP, privacidad, propietario, control entre pestañas, borradores, BASTA, dictámenes, puntos, idempotencia, aislamiento y un reinicio real de Nest. Limpia solo las salas creadas por sus propias pruebas.

Para E2E, deja `pnpm dev` ejecutándose y prepara Chromium:

```bash
pnpm exec playwright install chromium
pnpm test:e2e
# Alternativa con Chrome instalado, sin descargar Chromium:
CHROME_PATH=/opt/google/chrome/chrome pnpm test:e2e
```

La suite abre tres contextos aislados y completa tres rondas con la letra M, respuestas compartidas/únicas y revisión humana ejercida mediante los controles. Verifica 10/10/20, recarga, resultado final y revancha. Corre a 1440×900 y 375×812. Guarda capturas reales del lobby y del tablero en `test-results/` cuando se ejecute. `E2E_URL` permite apuntar a un servidor de prueba accesible.

## Despliegue público

Para redes distintas necesitas publicar **web + API + PostgreSQL**, con HTTPS/WSS y una única instancia de API. Una web estática por sí sola no sincroniza participantes.

1. Configura PostgreSQL y un secreto nuevo largo; ejecuta migraciones y seed.
2. Compila con `pnpm build`. Sirve `apps/web/dist` con fallback SPA a `index.html`.
3. Arranca la API con `pnpm --filter @basta/server start`, `NODE_ENV=production` y las variables del servidor. `FRONTEND_ORIGIN` debe listar explícitamente orígenes HTTPS; `PUBLIC_APP_URL` debe ser la URL pública HTTPS.
4. Usa un reverse proxy del mismo dominio para `/api` y `/socket.io` hacia Nest, habilitando Upgrade de WebSocket. La API agrega `Secure` a la cookie en producción. El frontend genera invitaciones con el origen real; el enlace nunca incluye tokens.
5. No expongas PostgreSQL a Internet. Docker Compose enlaza el puerto de la BD exclusivamente a loopback.

Si separas frontend y API, configura `VITE_API_URL` y `VITE_SOCKET_URL` y mantén ambos bajo el mismo sitio para las cookies SameSite=Lax. Para dominios de sitios diferentes hará falta ajustar de forma deliberada las cookies y comprobar restricciones del navegador; el despliegue recomendado usa el mismo origen.

No ejecutes varias réplicas de Nest con esta versión: las conexiones y escritor autoritativo se registran por instancia. Redis/pub-sub, locks y coordinación de escritores serían necesarios para escalar.

## Manual breve

**Anfitrión:** configura capacidad automática o fija, 3/5/7/10 rondas y 60/90/120/180 segundos. Puede reservar plazas, aprobar reclamaciones, expulsar antes del inicio y volver a sortear categorías. Cambiar configuración cancela los estados Listo. En partida puede pausar con indicación visible, resolver dictámenes ajenos con motivo, proponer anulación unánime, publicar puntos y continuar. Si su propia respuesta requiere moderación decide otro participante. El cierre por error exige motivo y cancela la ronda sin puntuarla.

**Invitado:** entra con su nombre único, reclama una plaza libre o una reserva de su mismo apodo que el anfitrión debe aprobar. Marca Listo. Puede recargar y reconectar con su cookie mientras no expire la sesión. Una segunda pestaña de la misma identidad no crea una persona adicional.

Lee [las reglas](docs/game-rules.md), [la arquitectura](docs/architecture.md) y [las referencias analizadas](docs/design.md).
