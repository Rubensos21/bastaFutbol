# Reglas de Basta Futbolero

## Antes de jugar

Participan entre 2 y 7 humanos, cada uno con nombre único de 2–24 caracteres visibles y su dispositivo. Crear siete casillas o reservar apodos no crea siete jugadores. Una reserva necesita conexión y aprobación del anfitrión. En cantidad fija deben estar todos los jugadores configurados, conectados y listos; en automático deben estar listos todos los miembros y ser al menos dos.

El servidor selecciona siete categorías distintas y equilibradas para la partida. El anfitrión puede volver a sortearlas antes de empezar. El mismo conjunto y orden permanece durante todas las rondas. El catálogo contiene 48 categorías; sus definiciones se pueden consultar en el lobby y tablero.

Valores iniciales: 5 rondas, 90 segundos por ronda, BASTA habilitado. Se admiten 3/5/7/10 rondas y 60/90/120/180 segundos. Las letras recomendadas son A B C D E F G H I J L M N O P R S T U V Z. El anfitrión puede personalizarlas; no existe una garantía automática de que cada categoría sea fácil con cada letra.

## Sorteo y tiempo

Antes de cada ronda se elige quién puede pulsar PARAR mediante una bolsa aleatoria: nadie repite antes de que los demás hayan tenido oportunidad. La ruleta del navegador es decorativa. La letra definitiva la decide el servidor al aceptar el primer PARAR; los demás jugadores no pueden detenerla y un doble toque no la cambia.

La ruleta se detiene automáticamente tras 15 segundos. Un selector desconectado dispone de 10 segundos de gracia para regresar; se reasigna si existe otro elegible. Luego todos ven LA LETRA ES y 3 → 2 → 1. Los inputs se abren según el mismo plazo del servidor.

No se repite letra hasta agotar el conjunto configurado. Al agotarlo se registra un aviso de nuevo ciclo. Las categorías permanecen iguales aunque cambie la letra.

## Escribir y llamar BASTA

Escribe una respuesta por categoría, hasta 80 caracteres. Se permite corregir y borrar hasta el cierre. Cada persona ve solo sus textos; puede consultar el conteo de progreso de los demás. La matriz es compartida pero cada fila tiene su propietario. En móvil también existe Mi tablero con siete campos, sin cambiar las categorías.

BASTA requiere al menos una respuesta y deja **como máximo 10 segundos** a todos. Si quedaban seis segundos, siguen quedando seis; jamás amplía el tiempo. Solo cuenta el primer BASTA. El anfitrión puede desactivar este corte desde el lobby.

Terminé confirma y bloquea únicamente tu fila. No corta el tiempo de los demás. No se utiliza cierre inmediato por unanimidad de envíos en esta versión; el deadline compartido continúa.

Los borradores se guardan localmente y se sincronizan. Si existe conflicto entre dispositivos se muestran ambas versiones para decidir cuál reenviar mientras el plazo esté abierto. Un texto que no llegó antes del cierre no se acepta posteriormente por cambiar el reloj local.

## Inicial, aliases y no repetir entidades

La respuesta debe empezar por la letra sorteada. Se ignoran El, La, Los, Las y The al inicio bajo la política del juego. No se eliminan Real ni FC. En casos grises el grupo usa la revisión humana; un alias no excusa una inicial distinta.

La comparación ignora mayúsculas, acentos, espacios repetidos y puntuación exterior. Para colisiones se equipara ñ/n; no se borran apellidos o prefijos interiores. No se fusionan automáticamente Ronaldo y Cristiano Ronaldo ni Xavi y Xabi. Aliases explícitos: Leo Messi/Lionel Messi, CR7/Cristiano Ronaldo, Barça/FC Barcelona, Real Madrid CF/Real Madrid, México/Selección de México.

Un mismo jugador no puede repetir una persona, club o selección en distintas categorías de su propia ronda. Prevalece la columna más a la izquierda; las posteriores valen 0. Jugador y Entrenador comparten identidad de persona; País de Mundial y Selección comparten identidad de selección nacional. La primera aparición no vacía reserva esa entidad aunque su pertenencia a esa categoría sea rechazada; esto mantiene la prioridad visual determinista. Las categorías anuladas no reservan entidades.

Se puede reutilizar una entidad en otra ronda. Coincidencias entre jugadores solo se comparan dentro de la misma categoría y ronda. La revisión puede corregir la identidad canónica con motivo y se recalculan las colisiones.

## Cómo se interpreta una categoría

- «Jugó en X o Y»: basta integrar profesionalmente uno de los dos clubes indicados.
- «Jugó en X y Y»: requiere fútbol profesional en ambos países/lugares, aunque sea en temporadas distintas.
- «Campeón»: integró la plantilla inscrita ganadora de la competición indicada. No exige disputar la final salvo que la categoría lo diga.
- «País que jugó un Mundial»: selección que disputó alguna fase final de la Copa Mundial masculina absoluta.
- «Balón de Oro, Bota de Oro o Puskás»: cualquiera de los tres premios internacionales, no los tres a la vez.
- «Jugó con Messi/Cristiano Ronaldo»: compartió plantilla profesional o de selección absoluta.
- Categorías subjetivas: el grupo acuerda el criterio y vota; el servidor no presenta una opinión como una verdad deportiva.

## Revisión colectiva

El cierre revela las respuestas a todos los miembros. Vacío, inicial incorrecta, repetición propia y anulación se invalidan por reglas estructurales. Un texto no se considera válido simplemente por existir.

Las demás respuestas pasan por una votación de 45 segundos. Cada participante vota respuestas ajenas y puede cambiar su voto durante la ventana. La mayoría simple de votos emitidos determina un dictamen provisional. En dos jugadores, el único voto del rival cuenta como dictamen provisional.

Empate, falta de votos o impugnación dejan DISPUTED. Para resolver, el anfitrión indica Válida/Inválida y un motivo visible. Si es autor de la respuesta, decide el siguiente miembro conectado más antiguo que no sea autor. Esto permite moderación también en dos jugadores sin autovalidación. Se puede adjuntar una prueba HTTPS; nunca se ejecuta ni se descarga automáticamente.

Los textos originales no se editan durante la revisión. Alias y decisiones quedan registrados. Una apelación puede cambiar la validez antes de publicar y modificar también los puntos de otro jugador que antes coincidía. No se publican resultados oficiales mientras una respuesta computable carezca de dictamen.

El moderador puede solicitar explícitamente 0/10/20 con motivo. El servidor acepta solamente el valor compatible con la validez y colisiones recalculadas; no permite inventar puntos. Después de publicar el resultado la ronda queda cerrada y las decisiones no se vuelven a editar.

Si una categoría es impracticable con la letra, el anfitrión propone anularla solo en esa ronda. Todos los participantes deben aprobar. Todos reciben 0 y el máximo de ronda se reduce 20 puntos. La letra no se cambia después de la revelación.

## Puntos y clasificación

| Condición                                                            |           Puntos |
| -------------------------------------------------------------------- | ---------------: |
| Vacío, inválido, inicial incorrecta, repetido por ti o anulado       |                0 |
| Válido y coincidente con al menos otro válido en esa misma categoría | 10 para cada uno |
| Válido y único en esa categoría                                      |               20 |

No hay puntos por velocidad, por completar toda la fila o por pulsar BASTA. Siete categorías permiten hasta 140 puntos por ronda, menos las anulaciones.

Ejemplos:

- M/Jugador: Messi, messi y Mbappé válidos → 10, 10 y 20.
- A/Jugador argentino: Agüero, Agüero y vacío → 10, 10 y 0, si se confirma validez.
- R/Club: Real Madrid y River Plate válidos → 20 y 20.
- B: Boca Juniors en Club y Club sudamericano de la misma fila → la segunda aparición vale 0.
- M/Jugador mexicano: Messi → 0 porque no cumple esa categoría, aunque la inicial coincida.
- Si se invalida uno de dos Messi en la misma columna, el restante pasa de 10 a 20.

Se ordena por total acumulado, luego número de respuestas de 20, luego categorías válidas. Si todo coincide, se declara empate con la misma posición. No hay un criterio oculto basado en quién se conectó primero.

## Continuar, cerrar y reconectar

El anfitrión publica el marcador y continúa hasta completar las rondas. El siguiente sorteo asigna otro responsable según la bolsa y conserva categorías. El resultado final muestra clasificación e historial por rondas/categorías. La revancha prepara una nueva partida con el mismo grupo y nuevos estados Listo, categorías y puntos.

Recargar conserva la identidad mediante cookie y devuelve el estado vigente. Las conexiones cortas no borran respuestas, puntos ni deadlines. Los miembros nuevos no pueden entrar a una partida iniciada; los existentes sí pueden reconectar. Dos pestañas de la misma sesión son un solo jugador; la última que reanuda tiene el control.

El anfitrión dispone de 30 segundos de gracia al desconectarse. Después el miembro conectado más antiguo toma el control. Las pausas y cierres por error son intervenciones explícitas, visibles y auditadas. Una ronda cancelada no se puntúa. Si no quedan dos participantes conectados, el anfitrión no puede iniciar la siguiente ronda.
