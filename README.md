# GAMBLING · V1.0

Un casino virtual y un laboratorio de habilidad, completamente gratuito. Todas las monedas son ficticias: no existen compras, depósitos, retiros ni premios con valor económico.

## Iniciar

Requiere Node.js 22.12 o posterior (verificado con Node 24).

```sh
npm install
npm run dev
```

Abre **http://localhost:3000**. En PowerShell, si la política bloquea `npm.ps1`, usa `npm.cmd install` y `npm.cmd run dev`.

Producción local:

```sh
npm run build
npm start
```

## Qué incluye

- Blackjack con una baraja de 52 cartas, as flexible, natural 3:2, empate y crupier que se planta en 17 suave.
- Midnight Run: seis coches, selección ponderada con probabilidades publicadas, animación de ocho segundos y clasificación final.
- Ruleta europea: números 0–36, color, paridad, docenas, fichas acumulables, deshacer y apostar todo.
- Jitterclick de 10 segundos, reacción con salida anticipada y precisión de 20 segundos con objetivos progresivamente más pequeños.
- Saldo inicial de 5.000 y bonus de 5.000 cada 24 horas, disponible inicialmente.
- Medallas, premios de primera conquista, experiencia, niveles, logros, perfil editable y estadísticas.
- Guardado automático, sesiones de casino reanudables, sonido sintetizado y animaciones reducidas.
- Diseño para ordenador, teclado, mouse y pantalla táctil.

## Economía y reglas

El motor reserva la apuesta al empezar y devuelve el retorno al terminar. Los retornos incluyen la apuesta original: ganar a 1:1 devuelve 2×; un natural devuelve 2,5×; un pleno de ruleta devuelve 36×. Los pagos se redondean a 0,01 moneda.

Ganado y perdido acumulan el **resultado neto de cada partida**. Las monedas de bienvenida y bonificación se contabilizan como regalos y se excluyen del beneficio de juegos. El registro de movimientos muestra apuestas y devoluciones por separado. Las estadísticas conservan los totales; el historial retiene 60 partidas y 100 movimientos recientes.

Cada Skill Game paga solo el nivel más alto logrado: 20 / 40 / 65 / 90 monedas, más 100 por cada medalla que se obtiene por primera vez. Alcanzar Diamante desde cero paga 490; repetirlo paga 90. La tabla visible incluye los bonos pendientes y se fija al empezar. Los desafíos son gratuitos incluso con saldo cero. Cambiar a otra pestaña o recargar interrumpe una sesión de habilidad sin recompensa; al recargar se ofrece cerrarla.

Se obtienen 35 XP por resultados con ganancia y 15 XP en los demás casos; cada 250 XP se sube de nivel. El nivel nunca cambia las probabilidades.

## Arquitectura

```text
src/app/                Next.js App Router, estilos y metadatos
src/components/         Club, perfil, controles y proveedor de estado
src/components/games/   Interfaz y animación de cada juego
src/lib/config.ts       Recompensas, dificultades y configuración
src/lib/engine.ts       Transiciones, economía, estadísticas y validación
src/lib/blackjack.ts    Reglas independientes de blackjack
src/lib/roulette.ts     Reglas y pagos de ruleta
src/lib/racing.ts       Probabilidades y trayectoria de los corredores
src/lib/random.ts       Web Crypto, rechazo de sesgos y Fisher–Yates
src/lib/storage.ts      Interfaz SaveRepository y adaptador LocalStorage
tests/                 Pruebas unitarias de reglas y economía
tests/browser/         Pruebas de interfaz con Playwright
```

Se utiliza Next.js, React, TypeScript, Tailwind CSS 4, Motion y Lucide. El diseño específico del juego vive en CSS propio. No se necesitan servicios externos, claves ni cuentas.

El estado se guarda en `gambling:v1`. Web Locks serializa las escrituras entre pestañas; cada operación lee el último estado y persiste antes de actualizar la interfaz. Un identificador por ronda hace que liquidaciones repetidas sean inocuas. Las apuestas abiertas se conservan al recargar para evitar perder la partida o cobrar otra apuesta. Los errores de lectura o escritura son visibles y no se sobrescriben silenciosamente los guardados dañados. Se puede reiniciar desde Ajustes con confirmación.

El puerto local es un origen seguro para Web Crypto y Web Locks. Para acceder desde un móvil físico a un servidor remoto usa **HTTPS**: HTTP sobre una IP de red puede bloquear estas APIs. La sincronización se limita a pestañas del mismo navegador y origen. Cambiar de puerto o navegador crea un progreso independiente.

Esta versión es local y no ofrece protección antitrampas: reloj, estado y resultados pueden modificarse desde el navegador. Para migrar a cuentas, implementa `SaveRepository` en el servidor y traslada allí el motor, reloj, RNG y validación de partidas.

## Verificación

```sh
npm test
npm run typecheck
npm run build
npm run test:e2e
```

Las pruebas de navegador usan Microsoft Edge instalado en Windows y levantan el servidor automáticamente si no está disponible. Para otro sistema, cambia `channel: 'msedge'` en `playwright.config.ts` por tu navegador, o elimina `channel` e instala Chromium con `npx playwright install chromium`.

Las pruebas cubren reglas de ases/naturales, pagos y cero de ruleta, distribución ponderada de carreras, movimientos de saldo, bonus de 24 horas, premios de habilidad, serialización, partidas jugables, recarga, escrituras entre pestañas y diseño móvil. Las capturas de revisión se generan en `artifacts/` (no versionadas).

## Alcance

Sin seguros, divisiones ni doblar en blackjack. No hay multijugador ni cuentas; los logros son personales. Las estadísticas de velocidad/resistencia de los coches son descriptivas: la probabilidad publicada es el peso real usado para elegir el ganador. El resultado se calcula antes de animar para garantizar que el coche que cruza primero coincide con el pago.
