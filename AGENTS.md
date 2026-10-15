# AGENTS.md — Basta Futbolero Multijugador

> Instrucciones **obligatorias** para Codex y agentes de desarrollo que trabajen en este repositorio. Este documento es la especificación funcional, visual, técnica, arquitectónica, de seguridad y de calidad del producto. Léelo completo antes de editar código.

## 0. MISIÓN Y DEFINICIÓN DE TERMINADO

Construir desde cero una aplicación web llamada **BASTA FUTBOLERO** para jugar Basta/Stop temático de fútbol **en línea, en tiempo real y multidispositivo**, con **2 a 7 participantes humanos por sala**. Cada jugador entra con su nombre, comparte una sala por código o enlace, presencia un sorteo rápido de letras, completa individualmente las **mismas siete categorías** con palabras que empiecen por la letra sorteada, y obtiene **0, 10 o 20 puntos por categoría** según validez y coincidencias de respuestas.

**No entregar un prototipo estático ni un mockup.** El resultado mínimo es una aplicación realmente operativa entre pestañas y dispositivos distintos, con un backend conectado, lobby, temporizadores autoritativos, turnos de sorteo, registro de respuestas, revisión de validez, puntuación, rondas, reconexión y cierre de partida. Los tests deben cubrir la lógica crítica; la interfaz debe ser profesional, responsive y fiel a las referencias.

**Lenguaje del producto:** interfaz, documentación y mensajes de validación en español. Código/identificadores técnicos pueden estar en inglés. No usar contenido de marcas o clubes protegido innecesariamente (logos oficiales no necesarios); usar texto y símbolos neutros.

**Importante:** Las capturas ilustran el estilo, **no** definen la lógica online. Nunca mostrar las respuestas de los rivales antes del fin del tiempo de edición. Los resultados compartidos sí presentan las respuestas de todos.

## 1. REFERENCIAS DE DISEÑO Y OBJETIVO VISUAL

Si existen en el proyecto, inspeccionar estas referencias:
- `src/docs/references/tablero-referencia.png`: tabla tipo estadio oscuro, encabezados en mayúsculas, nombre de cada participante en primera columna, varias categorías en columnas y filas alternadas. Pequeño indicador de ronda y letra en extremo superior izquierdo.
- `src/docs/references/lobby-referencia.png`: tarjeta compacta oscura con el rótulo `VESTÍBULO PRIVADO`, un código grande de sala de cinco caracteres, texto de invitación y botón ancho `Copiar enlace de invitación`.

 NO necesitar una copia pixel-perfect ni copiar los nombres ficticios de la captura; reproducir la identidad visual, jerarquía, densidad de la tabla, proporciones y contraste.

### 1.1 Sistema visual
- Estética deportiva / gaming elegante, oscura, sobria: negro verdoso `#07120F`, verde profundo `#0D211A`, superficie `#101C18`, verde de borde `#254534`, blanco roto `#F2F5F1`, gris apagado `#A5B0AA`, amarillo lima / dorado para el acento principal `#D8E76A` y el resultado de la letra.
- Tokens CSS centralizados en `src/styles/tokens.css`; no dispersar colores mágicos por todos los componentes.
- Tipografía: títulos impactantes condensados y en negrita (por ejemplo, `Barlow Condensed` con fallback local), textos legibles (`Inter`/sistema). Cargar tipografías con estrategia de fallback; el juego funciona sin red para tipografías.
- Tablero con separadores muy finos, encabezados fijos, filas alternadas de contraste sutil y destacado de la fila del usuario. Diseño espacial similar a la primera captura: pantalla ancha llena de tablero, no una tarjeta diminuta centrada.
- Acentos verdes discretos, una letra sorteada grande y protagonista, temporizador visible, transiciones pulidas, estados hover/focus/pressed, skeletons y estados vacíos reales.
- Evitar gradientes excesivos, partículas pesadas, efectos estroboscópicos, emojis repetitivos o una interfaz genérica de panel administrativo.
- Animaciones con GSAP donde aportan valor, especialmente el sorteo, revelación de letra, transiciones de fase, puntos y celebración final. Respetar `prefers-reduced-motion` y ofrecer un modo de movimiento reducido.
- Vista desktop: tabla de 7 categorías, hasta 7 filas, barra de partida y espacio visual para el cronómetro. Vista smartphone: mantener acceso al **mismo tablero**, usar desplazamiento horizontal con primera columna sticky y ofrecer además una vista de edición tipo formulario de 7 categorías (conmutador `Mi tablero`/`Tabla completa`) para que los inputs se puedan usar sin zoom. La identidad del tablero/categorías/estado no cambia entre vistas.

### 1.2 Pantallas obligatorias
1. **Inicio / registro:** título `BASTA FUTBOLERO`, formulario de nombre del jugador anfitrión; configuración de cantidad (2–7) o modo `Automático por jugadores registrados`; vista de hasta siete casillas de jugador con estados `Vacío`, `Reservado`, `Conectado`, `Listo`, similar conceptualmente al registro del juego anterior. No fingir que siete casillas rellenadas equivalen a siete dispositivos conectados.
2. **Crear/unirse:** botones `Crear sala privada` y `Unirme a una sala`, campo para código, pantalla accesible por URL de invitación `...?room=ABCDE` o `/sala/ABCDE`. Al abrir enlace, solicita nombre de invitado o reanuda sesión.
3. **Lobby privado:** código grande de 5–6 caracteres, copiar invitación, participantes con avatar inicial/color, indicadores de conexión y listo, anfitrión distinguido, opciones de partidas, hasta 7 plazas, contador `n/7`, botón de inicio con validaciones y mensajes explícitos.
4. **Pre-ronda de sorteo:** overlay de pantalla grande compartido con título de ronda; selector visual rápido de letras; nombre del jugador elegido aleatoriamente para oprimir `PARAR`; todos ven la animación, solo el elegido tiene botón habilitado.
5. **Revelación sincronizada:** animación GSAP que escribe `LA LETRA ES:` y muestra la letra final; cuenta regresiva **3 → 2 → 1**, claramente legible y sincronizada antes de entrar al tablero.
6. **Tablero de ronda:** encabezados de siete categorías compartidas, fila para cada jugador, letra fijada, cronómetro, progreso personal 0/7, acción `BASTA`/`Terminé` (reglas precisadas abajo), inputs solo editables por propietario durante la ronda.
7. **Revisión / adjudicación:** tablero con respuestas reveladas, marcas de vacías, duplicadas, aceptadas y rechazadas; fase para votar/deliberar validez, tratamiento de reclamaciones, puntos provisionales y cerrados, explicación de por qué una respuesta vale 0, 10 o 20.
8. **Marcador y siguiente ronda:** clasificación acumulada, puntos obtenidos en la ronda, categorías acertadas, letra sorteada, siguiente jugador encargado del sorteo, botones del anfitrión.
9. **Resultados finales:** podio/tabla, empate, desglose por rondas y categorías, opción de revancha con nueva sala o nueva partida con el mismo grupo conectado; salir.
10. **Estados alternativos:** sala inexistente/caducada/llena, expulsión, error de servidor, pérdida temporal de conexión, anfitrión desconectado, sin quorum, empate, no participantes, ronda cancelada.

## 2. STACK Y ARQUITECTURA ESTRICTOS

Mantener el stack solicitado en el cliente: **Vite + Vue 3 + TypeScript**, `<script setup lang="ts">`, Composition API, `<style scoped>` o clases coherentes. Añadir:

- **Frontend:** Vue Router, Pinia, GSAP, Socket.IO Client, Zod (validación de contratos/formularios), CSS moderno propio. Elegir un solo conjunto de iconos ligeros si se necesita. Usar TypeScript estricto; no `any` arbitrarios.
- **Backend obligatorio para multijugador real:** **Node.js + NestJS (TypeScript) + Socket.IO**. Puertas de enlace WebSocket, servicios de dominio separados y endpoints HTTP para salud y bootstrap si ayudan. La lógica de los partidos vive en el servidor y no confía en el navegador.
- **Persistencia:** PostgreSQL + Prisma ORM. Migraciones reales, datos semilla y esquema versionado. Las salas deben ser recuperables tras reinicio según política de expiración.
- **Opcional, no requerido para la primera versión:** Redis + adaptador Socket.IO y locks distribuidos si se escala a múltiples instancias. **No implementar múltiples réplicas sin estrategia para coherencia de estado, timers, deduplicación de eventos y pub/sub.** La versión inicial corre en una instancia de backend.
- **Monorepo pnpm** si la estructura actual lo permite: paquetes del cliente, servidor y contratos compartidos. Si ya hay Vite creado, adaptar sin eliminar automáticamente archivos útiles.
- **Tests:** Vitest para utilidades y cliente; Jest o Vitest compatible con NestJS para servidor; Supertest y clientes Socket.IO reales para integración; Playwright para E2E.
- **Herramientas:** ESLint, Prettier, `pnpm` workspace, `.env.example`, scripts de migración/seed, Docker Compose para PostgreSQL, README claro.
- Versiones de paquetes: elegir versiones estables y compatibles disponibles al implementar. No copiar versiones antiguas sin verificar. Registrar versiones en lockfile.

### 2.1 Estructura esperada

```text
basta-futbolero/
├── AGENTS.md
├── README.md
├── package.json
├── pnpm-workspace.yaml
├── pnpm-lock.yaml
├── docker-compose.yml
├── .env.example
├── .gitignore
├── docs/
│   ├── references/
│   │   ├── tablero-referencia.png
│   │   └── lobby-referencia.png
│   ├── architecture.md
│   └── game-rules.md
├── apps/
│   ├── web/
│   │   ├── index.html
│   │   ├── vite.config.ts
│   │   ├── src/
│   │   │   ├── main.ts
│   │   │   ├── App.vue
│   │   │   ├── router/
│   │   │   ├── stores/                 # auth/session, lobby, game, ui
│   │   │   ├── composables/            # useSocket, useCountdown, useGsap, etc.
│   │   │   ├── components/
│   │   │   │   ├── common/             # modal, button, input, banners, toast
│   │   │   │   ├── lobby/              # room code, roster, invite, settings
│   │   │   │   ├── draw/               # LetterRoulette, LetterReveal, Countdown
│   │   │   │   ├── board/              # Matrix, CategoryHeader, PlayerRow, MyForm
│   │   │   │   ├── review/             # EntryReview, Ballot, ScoreBreakdown
│   │   │   │   └── results/            # Leaderboard, Podium
│   │   │   ├── views/                  # Home, Join, Lobby, Game, Results, NotFound
│   │   │   ├── services/               # REST/socket wrapper
│   │   │   ├── styles/                 # tokens, reset, layout, animations
│   │   │   ├── utils/                  # display helpers, local draft sync
│   │   │   └── tests/
│   │   └── public/
│   └── server/
│       ├── src/
│       │   ├── main.ts
│       │   ├── app.module.ts
│       │   ├── auth/                  # invitado, sesión, guardias
│       │   ├── rooms/                 # crear/unirse/ready/host/expiración
│       │   ├── gateway/               # eventos de socket, autorización
│       │   ├── catalog/               # categorías y reglas
│       │   ├── draws/                 # asignación de selector y letras
│       │   ├── rounds/                # máquina de estados, reloj, respuestas
│       │   ├── review/                # veredictos, votaciones, impugnaciones
│       │   ├── scoring/               # normalización, colisiones, cálculo
│       │   ├── game/                  # progreso, ranking, finalización
│       │   ├── prisma/
│       │   ├── jobs/                  # deadlines autoritativos/recovery
│       │   └── tests/
│       └── prisma/
│           ├── schema.prisma
│           ├── migrations/
│           └── seed.ts
└── packages/
    └── shared/
        └── src/
            ├── constants/
            ├── schemas/              # Zod con DTOs para cliente/servidor
            ├── types/
            ├── categories/           # catálogo y metadatos tipados
            └── scoring/              # algoritmos puros sin dependencias de DB
```

No inventar imports que no existan. Evitar componentes monolíticos: separar presentación, sockets y lógica. No guardar reglas críticas exclusivamente en Pinia. Compilar/verificar el workspace completo en cada hito.

## 3. IDENTIDAD, REGISTRO Y PARTICIPACIÓN (MÁXIMO SIETE)

### 3.1 Formulario inicial
- Permitir al anfitrión escribir su apodo (obligatorio, 2–24 caracteres visibles), elegir el tamaño de sala 2–7 o `Automático (jugadores conectados y listos)`.
- Mostrar **7 plazas visuales**, numeradas, con campos de nombres o slots. Slots vacíos **NO cuentan como jugadores**. Admitir apodos preparados por el anfitrión como reservas, pero nadie pasa a `ACTIVO` sin haber reclamado su plaza y conectado su dispositivo.
- Modalidad **cantidad fija**: por ejemplo, `5 jugadores`; solo cinco plazas pueden estar ocupadas; botón iniciar solo cuando hay cinco participantes distintos, conectados y listos (el anfitrión también listo). Modalidad **automática**: se inicia con todos los participantes conectados/listos y de nombre no vacío; mínimo 2 y máximo 7. No crear jugadores fantasma.
- Al ingresar desde enlace, el invitado introduce su propio nombre (no se necesita cuenta ni registro por email), selecciona plaza libre o reclama la plaza reservada para su apodo con confirmación del anfitrión. La reserva no permite suplantación automática; el anfitrión puede aprobar/rechazar.
- Nombres únicos por sala tras normalización visual (`Ruben` y `ruben` no pueden duplicarse). Prohibir nombres vacíos / solo espacios, longitud excesiva y contenido de control; escapar siempre en render.
- Identidad por **sesión de invitado con token firmado/opaco y expiración**, asociado a un `participantId` en el backend. Preferir cookie `HttpOnly`, `Secure` en producción y same-site según despliegue. No usar nombre, código o `socket.id` como única autenticación. La sesión debe reconectar y seguir siendo propietaria de sus respuestas; no permitir escribir en la fila de otros.
- Persistir sesión de sala de forma adecuada para F5 y corte de Internet. El nombre persistente se mantiene al reconectar; no duplicar jugadores cuando hay varios sockets/tabs con el mismo participante. Definir política explícita de conexión única de escritura por participante para evitar sobrescrituras.
- Anfitrión: primer creador de sala. Puede editar capacidad antes de empezar, retirar una reserva, expulsar miembros antes de partida, iniciar, continuar, cerrar votación, dar puntos a cada particpante (0, 10, 20), pausar o finalizar por error. Si sale permanentemente, transferir privilegios de forma determinista al participante conectado más antiguo o permitir sustitución controlada; notificarlo. Durante desconexión corta, mantener el estado y temporizadores del servidor.
- Nadie puede unirse como participante en medio de una partida ya iniciada. Sí puede **reconectar** un participante existente. Modo espectador es opcional y debe ser solo lectura, nunca consumir las siete plazas.

### 3.2 Código de lobby e invitaciones
- Generar código impredecible y legible de **5–6 caracteres alfanuméricos mayúsculos** usando RNG seguro del servidor, evitando caracteres confusos cuando sea posible (`0/O`, `1/I`). Comprobar unicidad entre salas activas en la BD, reintentar si colisiona.
- URL configurable basada en el origen real, p. ej. `https://ejemplo.com/sala/5UBN8`, sin localhost incrustado en producción. Botón `Copiar enlace de invitación` con API Clipboard y fallback accesible si falla.
- Código validado, límites de intentos, mensajes claros para sala inexistente, llena, bloqueada, finalizada o caducada. No exponer tokens en el link compartible.
- Sala privada de invitación, **no indexada** y con UUID interno que no se expone como credencial. El código permite localizar la sala, **no** autoriza cambios de estado sin una sesión válida.
- Pantalla lobby inspirada en la captura: `LOBBY PRIVADO`, código destacado, `Comparte el enlace. Cuando todos estén dentro, comienza el anfitrión. Hasta 7 jugadores.`, botón ancho de copiar, roster, estado `Conectado/Listo`, acciones host, configuración de duración/rondas.

## 4. CATÁLOGO DE CATEGORÍAS Y SELECCIÓN DE LAS SIETE

### 4.1 Reglas fundamentales
- No se necesita almacenar todas las posibles respuestas para sortear el tablero. Mantener el **catálogo de categorías** en `packages/shared/src/categories/catalog.ts` como fuente de verdad inicial (y/o cargarlo con un seed de `categories` en PostgreSQL). Ofrecer ID/slug estable, texto mostrado, breve explicación, `entityKind`, modo de validez y estado activo. No duplicar la lista en frontend y backend.
- El **servidor** elige exactamente **7 categorías distintas por partida/lobby** usando muestreo sin reemplazo y RNG seguro. Se guardan ordenadas como `roomCategory`/`gameCategory` en BD **antes de la primera ronda**. Todos los jugadores reciben el mismo arreglo, con el mismo orden, para todas las rondas de **esa partida**; nunca se sortean 7 en cada navegador.
- Permitir al anfitrión `Volver a sortear categorías` **solo antes de iniciar**. Repartir una selección equilibrada por tipos (mínimo categorías objetivas generales y mínimo categorías específicas futboleras, evitando una lista completa de categorías casi imposibles); algoritmo determinista dadas las siete categorías elegidas y persisted order.
- El catálogo puede crecer sin migrar estructura (solo nueva semilla/configuración). Usar siete IDs únicos y una restricción de unicidad `(gameId, categoryId)` y `(gameId, order)`.
- Letras y categorías son entidades diferentes. En cada ronda cambia la **letra**; las 7 categorías permanecen iguales durante toda la partida (a menos que sea una **nueva partida/rematch**).
- Las respuestas deben **comenzar con la letra** adjudicada. Aplicar política de artículos y prefijos clara y visible: ignorar `El/La/Los/Las/The` iniciales si forman parte de un nombre formal común, pero no quitar `Real` o `FC` arbitrariamente; aliases autorizados documentados. Antes de invalidar casos grises, mostrar revisión humana.

### 4.2 Catálogo mínimo obligatorio

Añadir estos elementos, con IDs estables y explicaciones cortas a nivel de datos (no reducirlos a categorías genéricas):

| ID sugerido | Categoría visible | Tipo previsto | Validación |
|---|---|---|---|
| `player` | Jugador | PERSON | Objetiva |
| `coach` | Entrenador | PERSON | Objetiva |
| `club` | Club | CLUB | Objetiva |
| `goal_guarantee` | Jugador con gol seguro | PERSON | Subjetiva |
| `big_games` | Jugador de partidos importantes | PERSON | Subjetiva |
| `barca_or_madrid` | Jugó en Barça o Real Madrid | PERSON | Objetiva |
| `chivas_or_america` | Jugó en Chivas o América | PERSON | Objetiva |
| `cruzazul_or_america` | Jugó en Cruz Azul o América | PERSON | Objetiva |
| `europe_and_mexico` | Jugó en Europa y México | PERSON | Objetiva |
| `england_and_spain` | Jugó en Inglaterra y España | PERSON | Objetiva |
| `world_cup_country` | País que jugó un Mundial | COUNTRY | Objetiva |
| `elegant_player` | Jugador elegante | PERSON | Subjetiva |
| `overrated_club` | Club sobrevalorado | CLUB | Subjetiva |
| `future_ballon_dor` | Posible ganador del Balón de Oro | PERSON | Subjetiva |
| `national_team` | Selección | NATIONAL_TEAM | Objetiva |
| `champions_winner` | Jugador campeón de Champions League | PERSON | Objetiva |
| `world_cup_winner` | Jugador campeón del Mundial | PERSON | Objetiva |
| `colombian_player` | Jugador colombiano | PERSON | Objetiva |
| `argentine_player` | Jugador argentino | PERSON | Objetiva |
| `mexican_player` | Jugador mexicano | PERSON | Objetiva |
| `spanish_player` | Jugador español | PERSON | Objetiva |
| `chilean_player` | Jugador chileno | PERSON | Objetiva |
| `legend` | Leyenda del fútbol | PERSON | Subjetiva |
| `major_award` | Ganó Balón de Oro, Bota de Oro o Puskás | PERSON | Objetiva |

Aclarar en ayuda: `O` entre clubes significa que basta jugar en uno de los dos; `y` entre países significa jugar profesionalmente en **ambos**, no necesariamente en la misma temporada; `campeón` significa haber formado parte de la plantilla ganadora bajo criterio definido y documentado. `País que jugó un Mundial` significa una selección nacional que disputó alguna edición de la fase final de la Copa Mundial masculina absoluta; se puede cambiar/expandir después, pero documentar cuál se usa. Premios `Balón de Oro / Bota de Oro / Puskás` admiten cualquiera de los tres, sin requerir ganar todos. `Subjetiva` requiere revisión humana: nunca declarar automáticamente verdad deportiva por heurística.

### 4.3 Categorías adicionales (agregar como mínimo 16)

Agregar como parte del catálogo las siguientes, con tipos adecuados y modo de validez:
- Portero.
- Defensa.
- Mediocampista.
- Delantero.
- Capitán de selección.
- Jugador que disputó una final de Mundial.
- Campeón de Copa Libertadores.
- Campeón de Liga MX.
- Jugó en al menos tres clubes profesionales.
- Jugó en Premier League.
- Jugó en LaLiga.
- Jugó en Serie A.
- Club campeón de Champions.
- Club mexicano.
- Club sudamericano.
- Selección campeona de Copa América.
- Jugador que jugó con Messi.
- Jugador que jugó con Cristiano Ronaldo.
- Ídolo de un club.
- Fichaje histórico.
- Mejor primer/prime de un jugador (nombre del jugador, criterio subjetivo).
- Mejor entrenador de la historia (nombre del entrenador, subjetiva).
- Jugador zurdo.
- Jugador con un dorsal histórico.

No agregar categorías ilegibles o ambiguas sin definición. Permitir desactivar categorías por facilidad sin eliminar el catálogo. La selección equilibrada debe contemplar la dificultad del alfabeto.

### 4.4 Letras válidas y letras difíciles
- Configurar un conjunto de letras jugables desde el servidor. Por defecto `A–Z` sin `Ñ` y con exclusión configurable de `K`, `W`, `X`, `Y` si están demasiado difíciles para la colección; la UI debe mostrar la lista real. No fingir que se puede llenar cualquier combinación de nacionalidad y letra.
- Evitar automáticamente combinaciones imposibles mediante una política documentada: preferiblemente elegir letras de un conjunto básico recomendado (`A, B, C, D, E, F, G, H, I, J, L, M, N, O, P, R, S, T, U, V, Z`) configurable por anfitrión; al no haber diccionario exhaustivo, **no afirmar** que una combinación es imposible/posible con certeza.
- No repetir letra durante una partida hasta agotar el conjunto; si hay más rondas que letras, reiniciar el ciclo informándolo.
- Si una categoría resultase impracticable para una letra durante el juego, el anfitrión puede iniciar una votación unánime para anular esa categoría **solo en esa ronda**; todos reciben 0 puntos en esa categoría y el máximo de la ronda baja consecuentemente. Registrar anulación en el historial. No cambiar unilateralmente la letra después de revelar respuestas.

## 5. CICLO DEL JUEGO Y MÁQUINA DE ESTADOS EN EL SERVIDOR

Implementar fases tipadas y un motor de transiciones en servidor (no simples `setTimeout` del frontend). Estados sugeridos:

```text
LOBBY
  -> STARTING (lock roster y 7 categorías persistidas)
  -> SELECTING_SPINNER (elegir encargado del botón PARAR)
  -> LETTER_REVEAL (letra definitiva emitida a todos)
  -> COUNTDOWN (3, 2, 1)
  -> ANSWERING (tablero editable y timer)
  -> ANSWERS_LOCKED (se cierra edición; se guardan finales)
  -> REVIEW (se revelan respuestas, se vota validez)
  -> SCORING (cálculo server-side, estado de puntos)
  -> ROUND_RESULTS
  -> [SELECTING_SPINNER para siguiente ronda | FINAL_RESULTS]
  -> FINISHED
```

Transiciones válidas por tipo y rol, idempotentes con control transaccional. No permitir omitir fases o ejecutar `finalizar` dos veces. Cada fase lleva `startedAt`, `endsAt` cuando aplique, `version`/`revision`, y motivo de transición. Persistir cambios de fase y deadlines; al reiniciar proceso calcular qué fase corresponde y ejecutar recuperación determinista. Reconciliar en cada reconexión enviando snapshot íntegro.

### 5.1 Configuración de partida
- Default: **5 rondas**, duración de respuesta **90 segundos**. Host puede elegir 3/5/7/10 rondas y 60/90/120/180 segundos antes del inicio; valores estrictamente validados.
- **7 categorías por partida** compartidas. **2 a 7 jugadores activos** (solo conectados, listos y con nombre). Todos comienzan con 0 puntos. Máximo 140 puntos por ronda (7 × 20); máximo teórico según rondas, si no hay anulaciones.
- Todos los tiempos y puntuaciones se controlan en servidor, nunca por el reloj del dispositivo como fuente de verdad.

### 5.2 Selección del jugador que oprime PARAR
- Antes de **cada** ronda, el backend asigna aleatoriamente uno de los participantes activos a la tarea de detener el sorteo. Mostrar claramente `LE TOCA A <NOMBRE> PARAR LA RULETA`.
- Sorteo justo sin privilegios del host. Implementar **bolsa aleatoria por ciclos**: barajar los IDs elegibles, elegir uno por ronda y no repetir hasta que todos los elegibles hayan tenido oportunidad; al agotar, barajar otra vez. Esto sigue siendo aleatorio por ronda entre quienes todavía no salieron, y mejora la equidad.
- Si el participante asignado se desconecta antes del sorteo: esperar una gracia breve (p. ej. 10 segundos) y reasignar al siguiente elegible; informar a todos. Si nadie apto para detener, automatizar tras timeout, sin bloquear la partida.
- Todos los clientes muestran letras alternándose a velocidad rápida, de forma **puramente visual**. El botón `PARAR` **solo se habilita** al participante elegido y únicamente durante el estado `SELECTING_SPINNER`.
- Definir timeout de sorteo (p. ej. 15 segundos); si no oprime a tiempo, el servidor detiene automáticamente y lo anuncia.
- La letra definitiva la decide el **servidor**, al aceptar de manera atómica el primer `draw:stop`. Puede seleccionar con RNG seguro al detenerse, animando el navegador hasta el resultado. La letra rápida local es decorativa; no asumir que por latencia corresponde exactamente al fotograma presionado.
- No aceptar letras inventadas desde cliente, solicitudes repetidas, llamadas de alguien no autorizado, ni cambios de letra después de persistirse. Doble toque, reconexión o dos sockets de la misma identidad no cambian la elección.

### 5.3 Animación sincronizada GSAP
1. Todos entran en overlay `RULETA DE LETRAS`; ticker grande A–Z con cambios rápidos cada ~50–85 ms (respetando reducción de movimiento).
2. Aparece responsable de presionar `PARAR`; para él botón gigante habilitado con estado de foco y accesibilidad, para otros texto `Esperando a <NOMBRE>...`.
3. Al recibir `draw:stopped` con `letter` y `serverTimestamp`, **detener el ticker**, secuencia GSAP de desaceleración visual, etiqueta `LA LETRA ES:` y letra centrada muy grande (`clamp(6rem, 20vw, 17rem)`), luces/acento discretos, opcional vibración/haptics solo si el navegador lo permite y el usuario lo habilitó.
4. Mostrar **3 → 2 → 1** (un segundo real por valor) sobre la misma pantalla o bajo la letra; temporización autoritativa enviada por backend. Los clientes que llegan tarde avanzan al estado correcto en lugar de reproducir los tres segundos completos fuera de sincronía.
5. Solo cuando `now >= answeringStartsAt` en la referencia de tiempo del servidor se habilitan inputs y se muestra el tablero. Animar transición de overlay a la tabla.
6. Cancelar correctamente timelines/intervalos en desmontaje y cambio de fase; evitar fugas, duplicación en HMR y loops visibles al reconectar.
7. Para `prefers-reduced-motion`, sustituir ticker vertiginoso por alternancia lenta o un estado estático y revelación directa.

### 5.4 Ronda de respuestas y BASTA
- Cada jugador ve siete entradas con **las siete mismas categorías, mismo orden, misma letra y mismo `endsAt`**. Una respuesta por categoría. Permitir escribir, borrar y corregir mientras la ronda esté abierta.
- Guardar borradores localmente (por sesión/room/round) **y sincronizar de manera incremental al servidor** con debounce corto (~250–500 ms), para que caída de red no borre progreso. No transmitir borradores de una persona a los demás; un evento global solo puede mostrar conteo de casillas completadas.
- Al regresar tras reconexión, reconciliar `serverRevision`, borrador confirmado y borrador local más reciente sin machacar texto silenciosamente; la política de conflicto se documenta y prioriza último cambio autorizado dentro del plazo.
- **Regla de fin propuesta y explícita (configurable):** `BASTA` se puede pulsar al llenar al menos una respuesta. Cuando el servidor acepta el **primer BASTA** de la ronda, todos reciben aviso y se abre un periodo final fijo de **10 segundos** (si queda menos del tiempo original, prevalece el final más cercano, nunca se extiende el plazo). Se evita que alguien corte la ronda instantáneamente antes de que los demás puedan escribir. El host puede desactivar el corte anticipado para usar siempre todo el tiempo.
- Un jugador puede usar `Terminé` para enviar anticipadamente sin llamar BASTA cuando esté habilitado ese modo; dejar clara la diferencia. Ningún botón permite editar después de `ANSWERS_LOCKED`.
- Al llegar `endsAt`, cerrar entradas servidor-side, consolidar último borrador válido de cada participante, imputar `''` para entradas vacías, emitir evento de bloqueo y pasar a revisión. Un dispositivo con reloj mal ajustado o tab suspendida no amplía el tiempo.
- `BASTA` idempotente y validado contra el estado y la identidad. Si todos envían antes, se puede cerrar de inmediato tras una confirmación de flujo configurable (no antes de hacer consistente la persistencia).

## 6. REGLAS DE RESPUESTAS, VALIDEZ Y NO REPETIR ENTIDADES

### 6.1 Reglas básicas por respuesta
Una respuesta cuenta únicamente si:
1. Fue enviada por su propietario y dentro del tiempo.
2. No está vacía (tras trim y limpieza).
3. Empieza con la letra activa según reglas de nombre/alias documentadas.
4. Pertenece realmente a la categoría (validación humana, asistida o diccionario confiable cuando exista).
5. No es una repetición prohibida de la **misma entidad dentro del tablero de un mismo jugador**.

Las respuestas inválidas por cualquiera de las condiciones reciben 0 y deben mostrar el motivo (`Vacío`, `No comienza con la letra`, `No cumple la categoría`, `Repetido por ti`, `Anulado`).

### 6.2 Prohibición de repetir una misma entidad personal o colectiva
**Un mismo participante no puede usar dos veces el mismo jugador, entrenador, club o selección/país en una ronda**, aunque aparezca en categorías distintas. Ejemplos:
- `Lionel Messi` en `Jugador` y también en `Jugador argentino`: **no permitido**; solo la primera aparición puede quedar válida.
- `Xavi` en `Jugador` y `Entrenador`: considerar la **misma persona** (`PERSON`) si el nombre se refiere al mismo individuo.
- `Real Madrid` en `Club` y `Club campeón de Champions`: misma entidad `CLUB`, segunda aparición inválida.
- `Argentina` en `País que jugó un Mundial` y `Selección`: tratar selección/país correspondientes como la misma entidad canónica de fútbol nacional (con distinción si en el futuro hay categorías de geografía, documentar).
- **Regla de desempate intrausuario:** si una entidad aparece varias veces, prevalece el valor en la categoría **más a la izquierda** en el tablero (menor `order`) y las posteriores reciben 0. Aplicar antes de calcular duplicados entre jugadores. Mostrar advertencia inmediata al escribir, pero el servidor recalcula y es autoridad final.
- No prohibir reutilizar nombres en **otra ronda**, salvo que una regla futura explícita lo indique.
- La igualdad de entidades se basa en `entityKind + canonicalKey` y una tabla configurable de aliases. Los humanos pueden corregir un alias no conocido en fase revisión. No usar fuzzy matching automático agresivo para invalidar personas diferentes con apellidos similares.

### 6.3 Normalización para comparar textos
Crear utilidades puras compartidas y bien probadas:
- `trim`; normalización Unicode `NFKC` para compatibilidad cuando sea apropiado; comparar con diacríticos insensibles, equivalencias `á/a`, `ñ/n` **solo para colisiones** si el conjunto de nombres admite ese criterio, plegado de mayúsculas, espacios múltiples y puntuación exterior.
- Evitar eliminar letras significativas, apellidos, o prefijos del medio del nombre; no confundir `Ronaldo` con `Cristiano Ronaldo` sin alias explícito.
- Tabla de aliases base configurable para nombres comunes como `Leo Messi`/`Lionel Messi`, `CR7`/`Cristiano Ronaldo`, `Barça`/`FC Barcelona`, `Real Madrid CF`/`Real Madrid`, `México`/`Selección de México`. **No garantizar reconocimiento completo**: usar confirmación/manual cuando haya duda.
- Distinguir `normalizedText` (colisión textual), `canonicalEntityId` opcional (identidad corregida en revisión) y `validityStatus`. Una corrección manual debe disparar recálculo de repetición y duplicados de forma determinista y visible.
- Comparar respuestas duplicadas **solo dentro de la misma categoría y la misma ronda**. `Lionel Messi` en `Jugador` de una persona no colisiona con `Jugador argentino` de otra por ser columnas distintas.

### 6.4 Validación de conocimiento futbolero
- No inventar una verificación automática 100% fiable de todos los futbolistas/clubes/categorías. Una base de datos **no es imprescindible para sortear categorías**, pero **sí lo sería un catálogo muy completo más fuentes o revisión humana** para juzgar todas las respuestas automáticamente.
- **MVP funcional:** revisión colectiva con categorías objetivas y subjetivas, votaciones, motivo y decisión registrada. Respuesta que falla letra, está vacía o repite entidad puede marcarse inválida automáticamente; pertenencia semántica real se vota o la confirma el host con transparencia. Nunca declarar válida por el mero hecho de tener texto.
- Categorías objetivas: por defecto `PENDIENTE` en la etapa de revisión si no existe coincidencia en un diccionario curado. Categorías subjetivas siempre pasan por evaluación de los demás participantes. Si hay fixtures validados y fuente fiable, se pueden precalificar con indicación `Verificado` y permitir impugnación.
- Interfaz de revisión clara: lista de todas las respuestas por categoría, edición bloqueada, marcar `Válida`, `Inválida`, `Impugnar`, motivo opcional, opción de alias. Un jugador **no vota su propia respuesta**; de esta manera el resultado representa el juicio de otros.
- **Política concreta del MVP:** 45 segundos de revisión/votación (editable si todos acuerdan), mayoría simple de votos emitidos por otros participantes elegibles; si hay empate, ausencia de votos o apelación, queda `DISPUTED` y el anfitrión puede resolverlo de forma **explícita y visible para todos** con motivo. Si el anfitrión es autor de la respuesta, en un empate debe decidir el siguiente participante conectado no autor (moderador temporal) para evitar autovalidación. Con dos jugadores siempre debe ser posible resolver, aceptando voto único del rival como decisión provisional y habilitando apelación/decisión conjunta si hay disputa; registrar eventos en historial. Nunca sumar puntos definitivos de entradas sin dictamen.
- Evitar que otros jugadores alteren, borren o aprueben sin registro los textos originales. Persistir estado, recuentos y decisiones. Una respuesta impugnada muestra su historial de resolución.
- Permitir añadir enlace de prueba opcional en revisión, como información no ejecutable, validando esquema `https`. **No scrapear la web ni depender de APIs externas** para que la sala funcione.
- Explicar en ayuda qué se considera válido para categorías de opinión y establecer criterio compartido con el grupo.

## 7. SISTEMA DE PUNTUACIÓN — EXACTAMENTE 0 / 10 / 20

**La puntuación se calcula en el servidor después de determinar validez y unicidad.** No introducir bonus ocultos por velocidad, letras, completar el tablero o presionar BASTA. El marcador de toda ronda es la suma de los puntos de sus siete categorías.

| Condición final de una entrada | Puntos |
|---|---:|
| Vacía, fuera de tiempo, no empieza por la letra, no aplica a la categoría, repetición propia o inválida | **0** |
| Respuesta válida que coincide (tras normalización/alias aprobado) con la de **al menos otra persona en esa misma categoría** | **10** para cada persona válida que la respondió |
| Respuesta válida, **única entre todos los jugadores válidos en esa categoría** | **20** |

- Ejemplo: 4 jugadores responden `Messi`, `messi`, `Ronaldo`, vacío a `Jugador` y ambos nombres cumplen la letra (caso teórico): resultados `10`, `10`, `20`, `0`. En una partida real el backend primero comprueba que empiezan por la **letra activa**; la ilustración no habilita ignorar la letra.
- Si tres participantes anotan exactamente la misma respuesta válida, **cada uno recibe 10**, no se reparten diez en total.
- Si solo uno escribe algo en esa columna y es válido, obtiene **20**.
- Si una respuesta se invalida en revisión, recalcular los puntos de **todos** los participantes de esa categoría (un duplicado antes de revisión puede transformarse en único con 20).
- Antes de publicar resultados oficiales, validar que todas las entradas tienen dictamen y que las repeticiones intrausuario se han resuelto.
- Cada fila del panel de revisión debe mostrar `respuesta original`, `respuesta canónica`, `validez`, `coincidencias`, `puntos` y `motivo` accesible.
- Calcular puntuación de ronda y acumulado usando una función pura `scoreRound(entries, judgments, categoryIds)` con orden estable e idempotencia. No confiar en puntos enviados por el navegador.
- El ranking se ordena por total descendente, después por número de respuestas únicas de 20 puntos, después por número de categorías válidas y por último empate declarado si persiste (sin desempate secreto). Guardar el resultado por ronda para auditoría.

### 7.1 Ejemplos de aceptación concretos
1. Letra `M`, categoría `Jugador`: Ana `Messi`, Beto `messi`, Ceci `Mbappé` => **10, 10, 20** si todos son válidos; con aliases configurados, `Leo Messi` y `Lionel Messi` cuentan como duplicados solo si también cumplen la letra, por lo que la inicial **debe** revisarse antes de colisión.
2. Letra `A`, categoría `Jugador argentino`: Ana `Agüero`, Beto `Agüero`, Ceci vacío => **10, 10, 0** si Agüero validado.
3. Letra `R`, categoría `Club`: Ana `Real Madrid`, Beto `River Plate` => **20, 20** si válidos.
4. Letra `B`: Ana escribe `Boca Juniors` en `Club` y `Club sudamericano`; la segunda aparición recibe **0** como repetición propia, independientemente de su validez futbolística.
5. Letra `M`, categoría `Jugador mexicano`: `Messi` es **0** por no pertenecer a la categoría, aunque empieza con M.
6. Dos entradas idénticas inválidas **no** se pagan a 10; ambas quedan **0**.
7. Apelar `Válida` a `Inválida` debe actualizar score individual, score de otros duplicados, ranking y datos persistidos una sola vez.

## 8. MODELO DE DATOS PERSISTENTE

Crear el esquema Prisma con claves UUID y relaciones/índices reales (ajustar nombres si ayuda a mantener coherencia). Entidades sugeridas:

1. `GuestIdentity` (`id`, `sessionHash` o relación de sesión, `createdAt`, `lastSeenAt`); no guardar tokens en claro.
2. `Room` (`id`, `code unique`, `hostParticipantId`, `status`, `mode`, `capacity nullable`, `maxPlayers=7`, `createdAt`, `expiresAt`, `revision`, settings serializadas validadas).
3. `Participant` (`id`, `roomId`, `guestIdentityId`, `nickname`, `normalizedNickname`, `slotNumber`, `isReady`, `isConnected`, `lastSeenAt`, `joinedAt`, `leftAt`, `isEliminated?` no necesario; índice único por sala/apodo y slot).
4. `ReservedSlot` (si se necesitan nombres precreados por host, con `roomId`, `slotNumber`, `preferredName`, estado y reclamación aprobada).
5. `Category` (`id/slug`, `label`, `description`, `entityKind`, `validationMode`, `difficulty`, `enabled`).
6. `Game` (`id`, `roomId`, `status`, `configuredRoundCount`, `roundDurationSeconds`, `currentRound`, `createdAt`, `finishedAt`, `revision`).
7. `GameCategory` (`gameId`, `categoryId`, `order` con unicidad).
8. `Round` (`id`, `gameId`, `number`, `status`, `selectedPickerParticipantId`, `letter`, `spinnerEndsAt`, `revealAt`, `countdownEndsAt`, `answeringStartsAt`, `answeringEndsAt`, `reviewEndsAt`, `reviewResolution`, `createdAt`, `closedAt`, `revision`).
9. `Answer` (`id`, `roundId`, `categoryId`, `participantId`, `rawText`, `normalizedText`, `canonicalEntityId?`, `draftUpdatedAt`, `submittedAt`, `status`, `invalidReason`, `isFinal`, `version`), unicidad por `(roundId, categoryId, participantId)`.
10. `AnswerVote` (`answerId`, `voterParticipantId`, `verdict`, `reason`, `createdAt`, `updatedAt`) con voto único por votante/respuesta.
11. `AnswerJudgment` (`answerId unique`, `finalVerdict`, `resolverParticipantId/null`, `reason`, `source`, `judgedAt`, `revision`).
12. `RoundScore` (`roundId`, `participantId`, `score`, `uniqueCount`, `validCount`, `computedAt`, `revision`) y opcional `AnswerScore` para desglose por columna.
13. `GameScore` o derivación transaccional del acumulado para ranking sin incoherencias.
14. `GameEvent` / `AuditEvent` (`gameId/roomId`, `actorId`, `type`, `payload`, `createdAt`, `revision`) para depurar transiciones, BASTA, asignaciones, votación y puntuación.

**Restricciones imprescindibles:** capacidad <= 7 verificada al agregar miembro dentro de transacción; códigos únicos; `active playerId` no repetido en partida; orden de siete categorías único; exactamente siete `GameCategory` antes de iniciar; índices para `roomCode`, `roundId`, `gameId`; integridad referencial. Las operaciones que cambian roster/sorteo/puntos han de ser transaccionales y seguras ante concurrencia.

**Caducidad:** salas en lobby sin actividad pueden caducar tras 24 h; partidas finalizadas permanecen consultables 7 días (configurable) y después un job de limpieza las elimina de forma documentada. No almacenar datos personales innecesarios.

## 9. CONTRATO DE SOCKETS Y CONSISTENCIA

Definir contratos tipados y validados con Zod en `packages/shared`. Puede ajustarse nomenclatura, pero cubrir estas operaciones:

**Cliente → servidor**
- `room:create` `{ nickname, capacityMode, capacity?, config?, clientMutationId }`.
- `room:join` `{ code, nickname, desiredSlot?, clientMutationId }`.
- `room:resume` `{ code }` usando identidad/session, sin confiar en participantId arbitrario.
- `room:ready` `{ ready, clientMutationId }`.
- `room:update-settings` `{ rounds, roundSeconds, bastaEnabled, clientMutationId }` solo anfitrión.
- `room:reserve-slot`, `room:claim-slot`, `room:approve-claim`, `room:kick`, `room:leave` con roles validados.
- `game:start` `{ clientMutationId }`, solo anfitrión.
- `draw:stop` `{ roundId, clientMutationId }`, solo selector elegido.
- `answers:save-draft` `{ roundId, categoryId, text, previousVersion, clientMutationId }` propietario autenticado.
- `answers:submit` `{ roundId, clientMutationId }`.
- `round:call-basta` `{ roundId, clientMutationId }`.
- `review:vote` `{ answerId, verdict, reason?, clientMutationId }` sujeto a fase/permisos.
- `review:resolve` `{ answerId, verdict, reason, clientMutationId }` permiso excepcional auditado.
- `review:finish`, `game:next-round`, `game:end`, `game:rematch` solo rol correcto.

**Servidor → cliente**
- `room:snapshot` con roster, host, plazas, settings, estado, categorías solo cuando deban conocerse, revisión global, timestamps del servidor.
- `room:member-joined`, `room:member-left`, `room:ready-updated`, `room:host-changed`.
- `game:started` / `game:phase-changed` con snapshot canónico, `phaseStartedAt`, `phaseEndsAt`, `serverNow`.
- `draw:picker-assigned`, `draw:stopped` con letra canónica y tiempos.
- `round:progress` (solo número completado por jugador, no texto privado), `round:basta-called`, `round:locked`.
- `review:opened`, `review:vote-updated`, `review:judgment-updated`, `review:completed`.
- `scores:published`, `game:finished`, `room:error` con códigos enumerados y textos seguros.

Protocolos:
- ACK estructurado `{ ok: true, data, revision } | { ok: false, error: { code, message } }`.
- Incluir `clientMutationId` en acciones críticas para **idempotencia** y deduplicación; `revision` monotónica en snapshots/eventos. No aplicar evento antiguo sobre estado nuevo.
- Sala Socket.IO interna por `roomId`. Autenticación/guardias en **cada** evento; nunca confiar en code y participantId de payload como autorización.
- `serverNow` para estimar offset de reloj del cliente con ping periódico; render del contador a 1 Hz fluido y ajustar por drift, sin reconstruir el cronómetro desde cero cada render.
- Al reconectar, solicitar **snapshot completo** del estado canónico (fase, tiempos, letra, categorías, roster, respuestas propias, resultados visibles según fase). Reconexión no debe reiniciar animación o tiempos.
- En la fase de respuestas, **no** enviar el texto de otros jugadores al cliente antes de `ANSWERS_LOCKED`, ni en snapshots ni en eventos. El servidor filtra la proyección de estado según identidad y fase.
- Limitar tamaño del mensaje (longitud de cada entrada p. ej. 80 caracteres) y ritmo de escritura/sockets; debounce y rate limiting para código de invitación y acciones que requieran protección.
- Todas las acciones del host verificadas en backend y auditadas, incluso si un usuario falsifica tráfico WebSocket.

## 10. FRONTEND: EXPERIENCIA Y COMPONENTES

### 10.1 Barra de partida
Siempre visible durante la actividad: logo/título, nombre de sala (opcional), `RONDA x / N`, **letra actual** grande, reloj compartido (`MM:SS`), estado de fase, indicador de conexión y botón de ayuda. Mostrar `n/7` según participantes reales.

### 10.2 Tablero matriz fiel a referencia
- Columnas: primera `JUGADOR`; siguientes 7 encabezados de las categorías elegidas, en mayúsculas y con tooltip de definición. El screenshot muestra encabezados como `JUGADOR`, `PAÍS`, `CLUB MÁS GRANDE`, `JUGADOR MÁS LINDO`, etc.; deben ser **dinámicos** desde el catálogo de esta app, no una copia fija de esos ejemplos.
- Filas: todos los participantes **activos**, 2–7, nombre a la izquierda, máximo ancho apropiado, highlight de la propia fila.
- Durante `ANSWERING`, cada jugador solo puede **editar su fila**. Las demás celdas muestran un indicador genérico `—` o `● Listo` sin filtrar texto. Si la persona escribió, su propia celda muestra `<input>` con conteo apropiado; no permitir input de otro.
- Al iniciar `REVIEW`, sustituir placeholders por las respuestas de todos con indicador de validez, duplicado y puntos. Usar tooltip/modal por celda para detalle, pero nunca depender de color como único código.
- Encabezado sticky al hacer scroll vertical, primera columna sticky al desplazar horizontalmente; tamaños táctiles accesibles en móvil, scrollbars discretas, borde bien visible para foco de teclado.
- No truncar arbitrariamente nombres largos sin una manera de conocer el valor completo. Mostrar hints para definiciones largas.
- En mobile, vista `MI TABLERO`: siete tarjetas/filas editables de una en una o en lista, cada una con nombre de categoría, ejemplo de regla **sin dar respuestas para la letra actual**, input y estado de envío. Mantener conmutador a `TABLA COMPLETA` para consultar matriz y progreso de los demás.
- Datos locales de inputs y servidor sincronizados con `v-model`/store; usar identificadores por categoryId, no posición textual.

### 10.3 Lobby y ruleta
- Código con botón copiar y feedback discreto; `VESTÍBULO PRIVADO` superior; hasta siete avatares con iniciales y colores estables; slots vacíos con invitación `Esperando jugador...`.
- Mostrar si el jugador está listo, si el anfitrión puede iniciar, motivos de bloqueo, cantidad de rondas y duración.
- Ruleta de letras gigante, botón `PARAR` con contraste alto, indicador del jugador elegido y efectos de desaceleración/impacto con GSAP. Foco accesible y ARIA live adecuado (sin anunciar 15 letras por segundo).
- Revelación con `LA LETRA ES:` y countdown 3-2-1 visible en todos los dispositivos.

### 10.4 Revisión y marcador
- Matriz compartida con semáforo textual `Pendiente`, `Válida`, `Inválida`, `Duplicada`, `Repetida`, `Anulada` y valores +0/+10/+20.
- Panel de votación ágil que no obligue a navegar 49 pantallas: agrupar por categoría y presentar tarjetas compactas con acciones para todos los miembros activos.
- Marcador acumulado por posición y detalle de la ronda; animaciones GSAP de incremento de puntos, preferencia reduce-motion.
- Si jugador pierde conexión, marcar `Desconectado`; no borrar automáticamente puntuación ni textos. Mantener condiciones coherentes del juego si faltan participantes.

### 10.5 Accesibilidad y rendimiento
- Etiquetas asociadas a inputs, orden lógico de tabulación, foco visible, navegación con teclado, diálogos accesibles, anuncios de fase sin ruido, textos de contraste AA cuando aplique.
- No exigir hover en móvil. Tamaños de toque razonables y orientación horizontal opcional; sin scroll forzado del body por overlay.
- Controles deshabilitados siempre muestran la causa (`esperando host`, `no eres el jugador elegido`, etc.).
- Los cronómetros de UI renderizan correctamente en pestaña oculta/suspendida mediante timestamps absolutos; no se desincronizan con intervalos anidados.
- Optimizar rendimiento GSAP: animar transform/opacity, limpiar timeline y listeners en `onUnmounted`/`onScopeDispose`, cancelar al cambiar de fase.

## 11. SERVIDOR: TIEMPOS, CONCURRENCIA Y LÓGICA DE NEGOCIO

- Backend **single authority** para slot, anfitrión, letra, deadlines, respuestas finales y score. No usar estado singleton de memoria como única persistencia; puede haber caches en memoria pero siempre se recuperan desde BD.
- Encapsular en servicios `RoomService`, `DrawService`, `RoundService`, `ReviewService`, `ScoringService` con funciones probables de transacción.
- Garantizar atomicidad del primer `draw:stop` y primer `round:call-basta` mediante transacción/compare-and-set por `roundId/status/version`; los demás reciben respuesta `ALREADY_STOPPED`/`ALREADY_CALLED` sin modificar nada.
- Detectar expiración por `endsAt` desde servidor: scheduler + verificación *on demand* en cada acción/snapshot. El scheduler es un acelerador de transición, no la única protección contra input tardío.
- Al reiniciar el servidor, evaluar salas/rondas en progreso, pasar deadlines vencidos a las fases correctas y emitir snapshots. Si la fase de revisión queda sin moderador, aplicar la política de resolución definida y recuperación por host; no publicar puntuaciones arbitrarias.
- Validar entradas: longitud máxima (p. ej. 80), caracteres Unicode legibles, normalización, nombres hostiles, rate-limit. Nunca insertar HTML del usuario como HTML real (prevenir XSS).
- Errores de dominio tipados (e.g. `ROOM_FULL`, `HOST_ONLY`, `NOT_SELECTED_PICKER`, `ROUND_CLOSED`, `ALREADY_FINALIZED`, `NAME_TAKEN`, `INVALID_CATEGORY`, `SESSION_EXPIRED`). No filtrar stack traces a navegador.
- Si se usan jobs y locks, diseñar recuperabilidad ante mensajes reenviados y pérdida de ACK. Implementar logs estructurados, IDs de request/evento y evitar registrar tokens/sesiones en claro.

## 12. SEGURIDAD Y PRIVACIDAD

- En producción exigir HTTPS/WSS; configurar orígenes/CORS explícitos, cookies seguras y no usar `*` con credenciales.
- Aislar todas las salas en backend: un invitado no lee snapshots ni respuestas de otra sala enviando un `roomId` manipulado. Acceso siempre por sesión/miembro verificado.
- Capacidad <=7 bajo concurrencia; probar dos personas intentando ocupar la última plaza a la vez. Solo una puede entrar.
- Códigos de invitación con entropía suficiente y caducidad; controles anti-fuerza bruta y rate-limit sobre joins y códigos; evitar enumeración abusiva de salas.
- Respuestas de otros **ocultas durante ANSWERING** inclusive en DevTools/network payloads; filtrado real en servidor.
- Impedir que se pueda emitir `review:resolve` sin permiso, que cliente envíe `score`, `letter`, `phase`, o que un jugador altere respuesta ajena.
- Validar y limitar inputs y URLs de pruebas; no ejecutar ni renderizar HTML no confiable; evitar `v-html` para textos de usuarios.
- Escribir `.env.example` con variables públicas y secretos separados, sin credenciales comprometidas en repositorio.
- Preferir SQL parametrizado vía Prisma y dependencias auditadas. Autenticación ligera de invitado ≠ seguridad inexistente.

## 13. ENTORNOS, VARIABLES Y DESPLIEGUE

Proveer `.env.example` y documentar como mínimo:

```dotenv
# Backend
NODE_ENV=development
PORT=3001
DATABASE_URL=postgresql://basta:basta_dev@localhost:5432/basta_futbolero?schema=public
FRONTEND_ORIGIN=http://localhost:5173
SESSION_SECRET=replace-with-long-random-secret
PUBLIC_APP_URL=http://localhost:5173

# Frontend (variables expuestas a navegador; nunca secretos)
VITE_API_URL=http://localhost:3001
VITE_SOCKET_URL=http://localhost:3001
```

Separar claramente variables frontend y backend y proporcionar ejemplos adecuados a `apps/web/.env.example` y `apps/server/.env.example` cuando el monorepo lo requiera. Usar un secreto largo real en despliegue. Docker Compose debe levantar PostgreSQL local con volumen y healthcheck (y opcional servidor/web por perfiles, no obligatorio).

Comandos esperados (adaptarlos al monorepo real):

```bash
pnpm install
cp .env.example .env          # o copiar .env.example por aplicación
pnpm db:up                  # docker compose up -d db
pnpm db:migrate             # prisma migrate dev/deploy según entorno
pnpm db:seed                # catálogo de categorías + aliases esenciales
pnpm dev                    # web y API concurrentes
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm build
```

Proveer `GET /health` en backend y explicación para probar dos navegadores / un móvil. Para jugar entre dispositivos de redes distintas, **desplegar frontend + backend público + PostgreSQL** y configurar HTTPS/WSS y dominio accesible; `localhost` solo funciona en el propio dispositivo. Documentar alternativa LAN para pruebas (`vite --host 0.0.0.0`, firewall, IP privada, API accesible por LAN) con límites de seguridad.

**No afirmar que Vite, localStorage o una web estática bastan para sincronizar celulares.** Tampoco requerir un servicio de pago para arrancar localmente.

## 14. PRUEBAS Y CRITERIOS DE ACEPTACIÓN

### 14.1 Unitarias obligatorias
- Normalización de nombres y respuestas: espacios, puntuación exterior, mayúsculas, diacríticos, alias explícitos y casos que **no** deben fusionarse.
- `scoreRound`: 0 vacío; 0 inválido; 10 duplicado válido; 20 único válido; 10 para 3+ iguales; invalidar uno convierte a otro en 20; sumar 7 categorías.
- Detección de misma entidad repetida entre categorías para el mismo jugador (prioridad columna izquierda) y reutilización permitida en rondas distintas.
- Filtrado de letra inicial y aliases que **no** excusan una inicial distinta sin regla.
- 7 categorías distintas para una partida, persistencia de orden, nunca 8/6 por errores, no cambio entre rondas; barajado del selector sin repeticiones hasta agotar.
- Cronómetro por marcas absolutas, reconexión y caso de BASTA con 10 segundos sin prolongar plazo base.
- Política de desempate de ranking y tratamiento de anulaciones.

### 14.2 Integración de servidor con sockets reales
1. Host crea sala con nombre; otro dispositivo entra con código; ambos ven el mismo lobby y contador.
2. Tres entradas simultáneas a la última plaza: solo una es admitida; nunca >7 activos.
3. Modo automático ignora casillas de jugador vacías o reservas sin reclamar; modalidad fija exige número configurado realmente conectado y listo.
4. Selector aleatorio único recibe botón habilitado; otro cliente llama `draw:stop` falsificado y obtiene `NOT_SELECTED_PICKER`.
5. Doble click `PARAR` / dos ACK y dos sockets: letra única, una sola transición, todos reciben el mismo resultado.
6. Cronómetros concordantes (mediante tiempos del servidor), todos pasan al mismo tablero al terminar 3-2-1.
7. Durante ANSWERING el backend no envía el texto privado de rivales; lo revela únicamente en REVIEW.
8. Un socket falsificado intenta guardar respuesta para otro jugador: rechazado.
9. Cambiar borradores, reconectar F5 y seguir escribiendo en la misma fila y con el mismo reloj.
10. BASTA limita a 10 segundos o tiempo restante y no puede resucitar un plazo vencido; envío tardío se rechaza.
11. Votos respetan roles, no se vota respuesta propia, conflictos auditados, cambios de dictamen recalculan score.
12. Siguiente ronda conserva categorías/orden y cambia letra según el sorteo; ranking suma rondas.
13. Reintentar `game:start`, `scores:publish`, `game:next-round` no duplica la partida/ronda/score.
14. Una conexión nueva a otra sala no ve datos de la primera. Código inválido o caducado recibe error claro.
15. Reiniciar backend a mitad del ciclo y reconectar: reconstrucción desde DB, ningún timer se amplía arbitrariamente.

### 14.3 End-to-end manual y automatizado
- Desktop 1440 px: encabezados + matriz similar a referencia, 7 categorías completas y hasta 7 filas, sin colisiones de interfaz.
- Móvil 375 px: lobby, invitación, parar ruleta, countdown, edición de 7 campos, teclado móvil, revisión y marcador utilizables sin zoom.
- Abrir al menos 3 contextos Playwright aislados; registrar tres jugadores, completar el ciclo de ronda real y comprobar scores con letra y respuestas conocidas.
- Contraste razonable, interacciones keyboard-only, foco tras modales, reduced-motion, states offline/online.
- `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` y pruebas de integración/E2E pasan antes de dar por terminado.

## 15. PLAN DE IMPLEMENTACIÓN PARA CODEX (ORDEN OBLIGATORIO)

1. **Inspeccionar repo existente** y assets. No sobrescribir un proyecto ya armado sin revisar. Mostrar diagnóstico breve en la salida de Codex y plan en tareas.
2. Configurar/ajustar monorepo pnpm con web Vite/Vue/TS, NestJS backend, shared types/contracts, herramientas y Docker Compose PostgreSQL.
3. Definir entidades Prisma, migraciones, seed del catálogo de categorías con IDs/definiciones, aliases iniciales, seguridad de sesiones de invitado.
4. Implementar servicio de salas, código e invitación, registro 2–7, modos de capacidad y autorización. Verificar con tests de concurrencia.
5. Implementar motor de juego/transiciones con rondas, roster cerrado y siete categorías por sala; store/snapshots con versiones.
6. Implementar motor de sorteo, elección justa de selector por ronda, STOP atómico, letra y deadlines, GSAP revelación/countdown.
7. Implementar tablero responsive privado, drafts robustos, BASTA y cierre de ronda autoritativo.
8. Implementar revisión/veredictos/votos, canonicalización y puntuación **0/10/20** con reglas de no repetir.
9. Implementar ranking, rondas consecutivas, final, revancha, desconexión/reconexión.
10. Refinar UI conforme a screenshots, accesibilidad, rendimiento y estados de error.
11. Añadir pruebas unitarias + integración sockets + E2E, documentación, `.env.example`; ejecutar checks, corregir fallos reales.

Priorizar **correctitud multijugador y seguridad** sobre animaciones decorativas. No saltarse etapas bajo el pretexto de hacer un demo solo frontend. No generar mocks como solución final. Si una tecnología mencionada no puede ejecutarse en entorno, dejar código real y explicar paso reproducible, sin simular que se probó.

## 16. GUÍA DE REVISIÓN, DECISIONES Y SUPUESTOS

El requerimiento original no especifica cada detalle competitivo. Los defaults de este AGENTS son decisiones explícitas, modificables por configuración y documentadas en `docs/game-rules.md`:
- **Mínimo 2, máximo 7** jugadores humanos; siete casillas visuales no implican siete personas conectadas.
- **7 categorías por partida**, elegidas una vez al iniciar/confirmar el lobby, con igual orden para todos y para todas las rondas.
- **5 rondas de 90s** por defecto, configurables por anfitrión antes de iniciar.
- `BASTA` reduce el tiempo **restante** a máximo 10 segundos; opción desactivable antes de empezar.
- Ruleta de letras cosmética client-side y resolución de letra segura/server-side al parar; respuesta única ante latencia.
- **Votación/revisión** para evitar adjudicaciones falsas, especialmente categorías subjetivas. Las respuestas de rivales permanecen ocultas durante la escritura.
- Repetición propia de entidad en la **misma ronda**: válida solo la primera columna en orden visual; otras 0.
- 0/10/20 por **categoría**, nunca por rapidez. Empate final puede mantenerse como empate.
- Se permite a un jugador que se desconectó reconectar y recuperar su sitio mientras la partida exista, sin ingresar participante nuevo a juego iniciado.

Si encuentras ambigüedad o choque entre requisitos, documentar una decisión pequeña y justificada en `docs/architecture.md`, usar defaults anteriores y mantener el flujo completo operativo. **No cambiar unilateralmente las reglas esenciales** (máximo 7, mismas 7 categorías, sorteo por un jugador aleatorio, 3-2-1, puntuación 0/10/20, no repetir entidad, juego online) ni fingir soporte multijugador sin backend.

## 17. ENTREGABLES FINALES Y DEMOSTRACIÓN REQUERIDA

Antes de informar que el trabajo quedó terminado, entregar:
- Código del cliente, servidor y shared package completamente funcional, sin TODOs bloqueantes ni pantallas falsas.
- README con arquitectura, dependencias, `.env`, migración, seeds, ejecución local, LAN y despliegue externo para varios dispositivos, manual del anfitrión y de invitados.
- `docs/game-rules.md` en español: flujo completo, 2–7 jugadores, categorías, letras, tiempos, BASTA, votos, empatados, 0/10/20, no repetir nombres y ejemplos.
- Migraciones y seed de >=40 categorías; scripts de npm/pnpm funcionales.
- Tests automatizados de servidor y puntuación y E2E de mínimo tres jugadores.
- Capturas o descripción de verificación visual de desktop/mobile si el entorno admite browser; no inventar capturas que no se hicieron.
- Resumen final de los checks ejecutados con resultados **reales**, notas para abrir dos dispositivos en la misma sala y riesgos conocidos.

### Prueba funcional de aceptación (de principio a fin)

1. Host `Davo` crea sala, elige 4 jugadores; ve código tipo `5UBN8` y lo comparte.
2. `Cobra`, `Teo` y `Beno` entran desde tres dispositivos adicionales, cada cual introduce su nombre y pulsa `Listo`. Quedan cuatro conectados en total; tres plazas vacías no juegan.
3. Host inicia: servidor persiste **las mismas siete categorías en el mismo orden** y todos reciben la pantalla de sorteo.
4. Uno de los cuatro es elegido para pulsar `PARAR`; los demás solo observan. Al parar, todos ven **la misma letra** con animación `LA LETRA ES: X` y luego `3, 2, 1`.
5. Los cuatro pasan **simultáneamente** a su tablero; cada uno escribe solo en sus celdas, no ve respuestas contrarias durante el tiempo de escritura. La vista matriz mantiene las cuatro filas.
6. Termina el timer o alguien llama `BASTA`; las respuestas se bloquean en todos los dispositivos.
7. Se revelan las respuestas y se resuelve su validez. Si dos escribieron el mismo valor válido en una misma columna, reciben 10 cada uno; si otro escribió un valor válido único, recibe 20; vacíos/errores/repetidos propios reciben 0.
8. Se publica la tabla de resultados con sumas correctas y revisión por categoría. Se elige un nuevo responsable del sorteo y empieza la ronda siguiente con **las mismas categorías** y una nueva letra.
9. Al completar rondas aparece podio, historial y opción de revancha, todo sincronizado. Recargar cualquier dispositivo durante el proceso restaura su sesión sin reiniciar el reloj.

**No marcar la tarea como completa si falla cualquiera de estos nueve pasos.**
