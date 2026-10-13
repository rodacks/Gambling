# GAMBLING · V2.0

Un casino virtual y un laboratorio de habilidad, completamente gratuito. Todas las monedas son ficticias: no existen compras, depósitos, retiros ni premios con valor económico.

## Iniciar

V2 añade cuentas Supabase (correo y Google), bono original único, insignia dorada, 13 avatares, biografía, perfiles públicos y rankings de los seis juegos. Conserva las reglas y los coches de V1. Jitterclick y Precision comienzan con el primer clic; Precision añade sensibilidad para su puntero virtual opcional.

Sin servicios configurados, `npm run dev` conserva el guardado local V1. `npm run dev:demo` permite explorar perfiles ficticios de desarrollo sin autenticar a nadie; nunca se activa en producción. La economía online usa el servidor y PostgreSQL, sin importar saldos locales.

Consulta [SETUP_GAMBLING_V2.md](SETUP_GAMBLING_V2.md) para configurar credenciales, migración, SMTP y Google. La conexión externa queda pendiente de configuración y prueba real.

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
src/lib/v2/             Auth, perfiles, validación de acciones y motor del servidor
src/components/v2/      Cuenta, avatares, insignias, rankings y perfiles públicos
src/app/api/            API privada de juego y proyecciones públicas
supabase/migrations/    Esquema PostgreSQL, RLS y funciones transaccionales
tests/                 Pruebas unitarias de reglas y economía
tests/browser/         Pruebas de interfaz con Playwright
tests/browser-v2/      Flujos DEMO, perfiles, rankings y controles V2
```

Se utiliza Next.js, React, TypeScript, Tailwind CSS 4, Motion y Lucide. El diseño específico del juego vive en CSS propio. El modo local y la DEMO no necesitan servicios externos; las cuentas oficiales requieren Supabase.

El estado se guarda en `gambling:v1`. Web Locks serializa las escrituras entre pestañas; cada operación lee el último estado y persiste antes de actualizar la interfaz. Un identificador por ronda hace que liquidaciones repetidas sean inocuas. Las apuestas abiertas se conservan al recargar para evitar perder la partida o cobrar otra apuesta. Los errores de lectura o escritura son visibles y no se sobrescriben silenciosamente los guardados dañados. Se puede reiniciar desde Ajustes con confirmación.

El puerto local es un origen seguro para Web Crypto y Web Locks. Para acceder desde un móvil físico a un servidor remoto usa **HTTPS**: HTTP sobre una IP de red puede bloquear estas APIs. La sincronización se limita a pestañas del mismo navegador y origen. Cambiar de puerto o navegador crea un progreso independiente.

En modo local y DEMO, reloj, estado y resultados son manipulables desde el navegador. En modo online, `src/lib/v2/server-engine.ts` ejecuta el motor desde las rutas de `src/app/api/`; PostgreSQL serializa operaciones y almacena los récords. Los controles de habilidad verifican plausibilidad, sin prometer inmunidad frente a automatización. Véase la guía V2 para el modelo de confianza.

## Verificación

```sh
npm test
npm run typecheck
npm run build
npm run test:e2e
npm run test:e2e:demo
```

Las pruebas de navegador usan Microsoft Edge instalado en Windows y levantan servidores aislados (local en 3002, DEMO en 3001), sin reutilizar el que estés usando. Para otro sistema, cambia `channel: 'msedge'` en las configuraciones Playwright por tu navegador, o elimina `channel` e instala Chromium con `npx playwright install chromium`.

Las pruebas cubren reglas de ases/naturales, pagos y cero de ruleta, distribución ponderada de carreras, movimientos de saldo, bonus de 24 horas, premios de habilidad, serialización, partidas jugables, recarga, escrituras entre pestañas y diseño móvil. Las capturas de revisión se generan en `artifacts/` (no versionadas).

V2 añade pruebas de la migración real con PostgreSQL embebido, elegibilidad y concesión única del bono original, permisos RLS, revisiones concurrentes, aislamiento de datos privados, orden de récords, evidencia de habilidad y protección de API con Auth simulado. Las integraciones externas necesitan una comprobación real tras configurar las credenciales; no se consideran verificadas por las pruebas DEMO.

## Alcance

Sin seguros, divisiones ni doblar en blackjack. No hay partidas multijugador en tiempo real; V2 añade perfiles y rankings compartidos al conectar Supabase. Las estadísticas de velocidad/resistencia de los coches son descriptivas: la probabilidad publicada es el peso real usado para elegir el ganador. El resultado se calcula antes de animar para garantizar que el coche que cruza primero coincide con el pago.
