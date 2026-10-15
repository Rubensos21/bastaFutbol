import EmbeddedPostgres from 'embedded-postgres';
// PostgreSQL real, instancia local opcional para equipos sin Docker. Los binarios se descargan al instalar.
const pg = new EmbeddedPostgres({
  databaseDir: '.local-postgres',
  user: 'basta',
  password: 'basta_dev',
  port: 5432,
  persistent: true,
});
await pg.initialise();
await pg.start();
try {
  await pg.createDatabase('basta_futbolero');
} catch {
  /* Ya existe en un directorio persistente. */
}
console.log('PostgreSQL disponible en 127.0.0.1:5432. Ctrl+C para detener.');
let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  await pg.stop();
  process.exit(0);
}
process.on('SIGINT', () => void stop());
process.on('SIGTERM', () => void stop());
