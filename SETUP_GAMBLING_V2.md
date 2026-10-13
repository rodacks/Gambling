# Configurar GAMBLING V2.0

La integración está implementada, pero este repositorio no incluye credenciales ni un proyecto externo conectado. Las pruebas SQL se ejecutan con PostgreSQL embebido (PGlite); no sustituyen una prueba de correo, OAuth o despliegue real.

## 1. Ejecutar ahora, sin servicios externos

Requiere Node.js 22 o superior y npm. Desde esta carpeta:

```powershell
npm install
npm run dev
```

Abre http://localhost:3000. Sin variables de Supabase, se conservan los seis juegos y el guardado V1 local (`gambling:v1`). El saldo local no se importa al servidor. No se muestran clasificaciones ficticias como oficiales.

Para explorar cuentas, insignias, avatares, perfiles y rankings sin autenticar a nadie:

```powershell
npm run dev:demo
```

Detén primero el otro servidor, o usa `npm run dev:demo -- --port 3001`. Desde «Cuenta», elige «Simular cuenta original» o «Continuar con Google · DEMO». El primer perfil original comienza con 10.000; el de Google con 5.000. Salir y volver a la misma sesión conserva el progreso. La DEMO no almacena contraseñas, no envía correos y no contacta con Google. Sus ocho rivales son explícitamente ficticios. Sus claves `gambling:demo:v2:*` están separadas del guardado V1.

La DEMO requiere **ambos** `NODE_ENV=development` y `NEXT_PUBLIC_DEMO_MODE=true`. Un build de producción ignora esa bandera: nunca activa demostración por falta de credenciales. Reinicia Next después de cambiar variables públicas; se incorporan al bundle durante la compilación.

## 2. Crear Supabase

1. Crea un proyecto Supabase nuevo. Guarda de forma privada su contraseña de base de datos.
2. En la configuración de API, copia la URL del proyecto y la clave pública **publishable**. Para este servidor, copia también la clave **service_role** desde las claves heredadas del proyecto. La clave service role nunca debe llegar al cliente.
3. Copia `.env.example` a `.env.local` y completa:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://TU_PROYECTO.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=TU_CLAVE_PUBLICA
SUPABASE_SERVICE_ROLE_KEY=TU_CLAVE_SERVICE_ROLE_PRIVADA
NEXT_PUBLIC_DEMO_MODE=false
```

`.env.local` está ignorado por Git. Solo las dos variables públicas llevan `NEXT_PUBLIC_`. Nunca añadas ese prefijo a la clave de servicio. No pegues secretos en código, capturas, registros o documentación.

## 3. Aplicar la migración antes de registrar usuarios

Ejecuta íntegramente `supabase/migrations/202610130001_gambling_v2.sql` en el SQL Editor de Supabase. Es una migración transaccional de una sola aplicación sobre un proyecto nuevo. Alternativamente, con Supabase CLI instalado y tu proyecto vinculado, usa `supabase db push`.

La migración crea perfiles, origen inmutable de cuenta, preferencias, estado económico, operaciones idempotentes, movimientos, bonos, sesiones, resultados, récords, límites de solicitudes y vistas públicas. También instala los triggers sobre `auth.users` y las funciones RPC exclusivas del servidor.

No deshabilites RLS para corregir un error. Comprueba que todas las tablas tienen RLS y que `anon`/`authenticated` no pueden modificar saldos, recompensas, insignias ni récords. La lectura de perfiles propios está limitada por `auth.uid()`. Las vistas `public_players` y `public_rankings` se ejecutan intencionadamente con permisos del propietario y exponen únicamente columnas públicas seleccionadas; nunca `user_id`, correo, tokens, mazo o evidencia privada.

Esta migración inicial no importa cuentas Auth preexistentes ni progreso local. Si se aplica a un proyecto con usuarios ya registrados, hace falta una migración de datos revisada para inicializarlos; no borres sus cuentas. Recomendado: un proyecto nuevo para esta instalación.

## 4. Activar Email Auth y verificación

En Authentication → Providers activa Email y **Confirm email**. No desactives la confirmación en producción. Configura la política de contraseña de Supabase para exigir al menos 12 caracteres, mayúsculas, minúsculas y números; el formulario aplica la misma validación, pero la política del proveedor protege las llamadas directas a Auth.

El formulario envía `username` en los metadatos de registro. Un índice único, además de la comprobación visual de disponibilidad, impide nombres duplicados sin distinguir mayúsculas. Los nombres se normalizan a minúsculas y admiten 3–20 letras ASCII, números o guion bajo. Una colisión concurrente puede aparecer como error de creación de usuario: elige otro nombre.

El trigger guarda el proveedor inicial desde los metadatos de aplicación de Auth, que el usuario no puede editar. Solo una cuenta nacida con `email` y correo confirmado obtiene el bono original de 5.000. El trigger usa el mismo bloqueo de cuenta que las apuestas y una restricción única por recompensa. El modal solamente guarda su acuse de recibo.

## 5. URLs permitidas

En Authentication → URL Configuration establece la Site URL de desarrollo como `http://localhost:3000`. Añade a Redirect URLs:

```text
http://localhost:3000/auth/callback
http://localhost:3000/auth/callback?next=/auth/reset
http://localhost:3000/auth/reset
```

Si utilizas otro puerto, añade sus URLs exactas. Para producción cambia Site URL por `https://tu-dominio` y añade las tres rutas equivalentes HTTPS. Evita comodines amplios en producción. El callback solo permite volver a `/` o `/auth/reset`, nunca a una URL arbitraria.

## 6. SMTP y plantillas de correo

Configura SMTP propio en Supabase para enviar a usuarios reales. El servicio de correo predeterminado de desarrollo tiene restricciones de destinatarios y envío; no es una configuración de producción. Configura el dominio remitente y los registros que pida tu proveedor SMTP.

Para que la confirmación funcione también cuando el enlace se abre en otro navegador, usa `TokenHash` en la plantilla **Confirm signup**:

```html
<a
  href="{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&amp;type=signup"
  >Confirmar mi cuenta GAMBLING</a
>
```

En **Reset password**:

```html
<a
  href="{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&amp;type=recovery"
  >Restablecer mi contraseña</a
>
```

El callback verifica el token con Supabase, crea la sesión en cookies y abre el editor de contraseña para `recovery`. También admite el flujo PKCE con `code`, utilizado por OAuth y las plantillas estándar dentro del navegador que inició el flujo. Los enlaces son temporales y de un solo uso. Configura caducidad y límites de Auth según tu política. Comprueba enlaces caducados, reutilizados y recuperación desde otro dispositivo.

## 7. Preparar Google Cloud

1. Crea o selecciona un proyecto en Google Cloud.
2. Configura la pantalla de consentimiento OAuth, nombre GAMBLING, correo de soporte, dominios y usuarios de prueba mientras la aplicación esté en testing.
3. Crea credenciales OAuth de tipo **Web application**.
4. En Authorized redirect URIs registra la URL que muestra Supabase para Google, normalmente `https://TU_PROYECTO.supabase.co/auth/v1/callback`. Esta es la URL de Google hacia Supabase; no es `/auth/callback` de Next.
5. Configura los orígenes web autorizados que corresponden al entorno local y al dominio HTTPS de producción.
6. Copia Client ID y Client Secret en Authentication → Providers → Google de Supabase y activa el proveedor. No coloques el secreto Google en variables públicas ni en el repositorio.

Supabase devuelve finalmente al callback de GAMBLING autorizado en el paso 5. Un alta nueva por Google crea automáticamente un nombre único, avatar Neon Ghost, estadísticas y 5.000 monedas, sin bono original.

## 8. Vincular identidades

Activa **manual identity linking** en las opciones avanzadas de Auth si quieres usar «Vincular Google» en el perfil. El botón utiliza `linkIdentity` sobre la sesión existente, no crea otra cuenta de juego. Supabase puede vincular automáticamente identidades verificadas con el mismo correo según su política. El origen capturado al crear el usuario Auth nunca se recalcula a partir de los proveedores vinculados.

Prueba ambos sentidos: cuenta original que vincula Google conserva bono e insignia; cuenta nacida con Google que añade email no obtiene el bono original. Nunca fusiones manualmente saldos de dos usuarios desde el cliente. Para usuarios con cuentas distintas ya existentes hace falta un proceso administrativo de fusión, fuera de esta versión.

## 9. Sesiones, API y autoridad económica

Las contraseñas solo se entregan al SDK oficial de Supabase Auth. El SDK mantiene la sesión mediante cookies y renovación de tokens. Las rutas privadas llaman a `auth.getUser()` para verificar la identidad con Supabase; nunca aceptan un `user_id` proporcionado por el navegador. Los Route Handlers pueden actualizar las cookies del SDK. No se depende de una comprobación puramente visual para proteger datos.

`POST /api/game` acepta acciones estrictas, no balances ni resultados finales. Usa el motor V1 en el servidor con `crypto.getRandomValues`. Cada acción lleva un UUID idempotente. `gambling_commit` toma un bloqueo de fila, verifica la revisión y aplica estado, movimiento y resultado en una transacción. Ante concurrencia, la API reevalúa la acción hasta cinco veces. Reutilizar un UUID con otra acción se rechaza. El bono diario se valida también en SQL con el reloj del servidor y las últimas 24 horas.

El mazo y la carta tapada de Blackjack se eliminan del DTO enviado al cliente. Carreras y ruleta reciben su resultado después de reservar la apuesta para poder animarlo; no pueden cambiarlo ni cancelarlo para recuperar la apuesta. El saldo oficial jamás se escribe en LocalStorage ni se toma de una partida local. Perder conexión no activa DEMO ni sustituye el saldo oficial por uno inventado.

`/api/account` permite editar solo nombre, bio y avatar o confirmar la bienvenida. `/api/rankings` pagina 20 entradas hasta 100 y devuelve además la posición propia, incluso fuera del top 100. `/api/players/[id]` usa un UUID público estable distinto del UUID Auth. No existe endpoint de importación de récords ni de reinicio oficial.

## 10. Habilidad y límites de confianza

Jitterclick y Precision se preparan sin consumir tiempo. La primera interacción válida inicia el reloj y cuenta como acción. Reaction conserva espera y señal. Precision admite modo directo mouse/táctil y captura relativa opcional con sensibilidad 0,25–3; Escape libera el cursor. Cambiar de pestaña o perder foco termina el intento sin premio.

El servidor deriva las puntuaciones del registro de acciones: duración, tiempos monotónicos, cadencia, posición de disparos y objetivos generados por el servidor. El campo `score` del navegador no determina el resultado. Sesiones imposibles, demasiado rápidas, con cadencia automatizada o evidencia incompleta se guardan como `flagged`, sin premio ni récord. Solo resultados `verified` alimentan las clasificaciones. Los récords conservan el identificador de reglas; no se mezclan duraciones o modos distintos.

Estas comprobaciones detectan anomalías, **no prueban que juegue una persona**: un navegador controlado puede fabricar evidencia plausible. No se presenta el sistema como invulnerable. Revisa `official_results` con `status='flagged'` desde un entorno administrativo privado; no hay un botón público para aprobarlas. Esta V2 no incluye recompensas reales, compras, depósitos ni retiros. Antes de una operación pública amplia conviene añadir monitorización, retención de evidencias, CAPTCHA de Auth y límites de tráfico en el alojamiento.

## 11. Producción

Configura las tres variables de Supabase en tu alojamiento Next con runtime Node y `NEXT_PUBLIC_DEMO_MODE=false`. Ejecuta:

```powershell
npm run build
npm start
```

Usa HTTPS. Actualiza los dominios autorizados, Site URL, SMTP y Google antes de abrir registros. No caches respuestas Auth/API: llevan `Cache-Control: no-store`. Si falta la clave privada, las operaciones online fallan con un error de configuración; no se simulan. Las partidas locales siguen disponibles para visitantes, claramente separadas de las oficiales.

## 12. Pruebas

```powershell
npm test
npm run typecheck
npm run build
npm run test:e2e
npm run test:e2e:demo
```

Las pruebas de navegador usan Microsoft Edge instalado (`msedge`). Las de V1 arrancan el modo local en 3002; las de V2 arrancan DEMO en 3001, con directorios de compilación aislados. No reutilizan tu servidor abierto ni necesitan Supabase. Las pruebas SQL crean un esquema Auth mínimo para ejecutar la migración real con PGlite; no emulan SMTP ni Google.

Antes de declarar la integración externa verificada, completa en un Supabase de prueba: alta original → correo → login → bono único → salir/entrar; Google nuevo sin bono; vinculación sin duplicación; recuperación de contraseña; partida online en dos pestañas; persistencia desde otro dispositivo; perfil público y ranking; intento directo de modificar tablas con la clave pública. Configurar claves no sustituye esta comprobación.

## Referencias oficiales

- [Clientes SSR de Supabase y cookies](https://supabase.com/docs/guides/auth/server-side/creating-a-client)
- [Contraseñas y recuperación](https://supabase.com/docs/guides/auth/passwords)
- [SMTP](https://supabase.com/docs/guides/auth/auth-smtp)
- [Plantillas de correo](https://supabase.com/docs/guides/auth/auth-email-templates)
- [Google OAuth](https://supabase.com/docs/guides/auth/social-login/auth-google)
- [Vinculación de identidades](https://supabase.com/docs/guides/auth/auth-identity-linking)
