# Análisis de las referencias

Se inspeccionaron íntegramente `src/docs/references/lobby-referencia.png` y `tablero-referencia.png`.

El lobby de referencia es una tarjeta oscura y compacta, con rótulo pequeño espaciado, código grande de alta legibilidad, invitación breve y un botón que ocupa el ancho disponible. La implementación conserva esta jerarquía dentro de un panel lateral y agrega roster/configuración. La captura dice seis jugadores; se usa el límite funcional obligatorio de siete.

El tablero tiene fondo negro verdoso, bordes muy finos, encabezados de tipografía gruesa, nombres en la primera columna y celdas amplias. Las filas alternan negros y verdes sutiles. Se conserva la matriz extensa, la densidad y el contraste. Las categorías de la captura son ejemplos: el tablero utiliza las siete categorías realmente seleccionadas por el servidor.

Los tokens están centralizados en `apps/web/src/styles/tokens.css`, accesibles también mediante `src/styles/tokens.css`. Se usan las ocho tonalidades principales solicitadas, superficies alternadas, estados textuales además de color y bordes de foco visibles. La tipografía se instala desde Fontsource para funcionar sin solicitudes a Google Fonts; Impact/Arial Narrow y fuentes de sistema son fallback.

En 1440 px se presenta la matriz de ocho columnas, con nombre sticky y header sticky. En 375 px la matriz permanece accesible mediante scroll horizontal y existe el conmutador Mi tablero/Tabla completa. Los campos del formulario móvil usan tamaño de fuente de 16 px y botones de altura táctil. Los nombres largos pueden envolver y las definiciones se abren mediante controls de teclado/touch.

La ruleta y revelación usan GSAP con limpieza de timeline/intervalos. Movimiento reducido reemplaza la ruleta rápida por un signo estático y revela directamente; se respeta tanto la preferencia del sistema como el ajuste manual en Ayuda. El modal de ayuda usa dialog nativo, Escape y restitución del foco.

No se realizaron capturas del producto ni inspección visual en navegador en esta sesión: faltan dependencias para ejecutar el frontend. Las capturas de la suite Playwright son artefactos previstos al ejecutar pruebas reales, no evidencia ya obtenida.
