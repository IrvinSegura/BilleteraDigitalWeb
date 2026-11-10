# Billetera Digital — web

Front en React + TypeScript + Vite para la API de la billetera digital
[BilleteraDigital](https://github.com/IrvinSegura/BilleteraDigital-).
Tailwind, CSS 4, componentes de shadcn sobre Base UI, TanStack Query, React Hook Form + Zod y Recharts. Temas claro y oscuro, del
teléfono al escritorio.

## Capturas

Tomadas de la app corriendo en local con personas de demostración (`docs/screenshots`). Abre la lista de cada sección para ver el resto.

### Clientes

| | |
| --- | --- |
| ![Inicio del cliente](docs/screenshots/customer-dashboard.png) | ![Una billetera y sus movimientos](docs/screenshots/customer-wallet.png) |
| Inicio: saldo, entradas y salidas del mes, gráfica del saldo y actividad reciente | Una billetera: gráfica del saldo, movimientos, filtros, CSV y estado de cuenta |
| ![Enviar dinero, paso de confirmación](docs/screenshots/customer-send.png) | ![Estados de cuenta con el calendario de fechas](docs/screenshots/customer-statements.png) |
| Envío: la transferencia se revisa antes de salir | Estados de cuenta: el periodo se elige en un calendario, con atajos |

<details>
<summary>Más pantallas del cliente (11)</summary>

| | |
| --- | --- |
| ![Inicio de sesión](docs/screenshots/auth-login.png) | ![Un movimiento](docs/screenshots/customer-movement.png) |
| Inicio de sesión | Un movimiento, con su folio, comprobante y "reportar un problema" |
| ![Comprobante de un movimiento](docs/screenshots/customer-receipt.png) | ![Cobrar con un código QR](docs/screenshots/customer-request.png) |
| Su comprobante, para imprimir, guardar como PDF o compartir como imagen | Cobrar: un enlace de pago y un código QR |
| ![Diálogo de retiro](docs/screenshots/customer-withdraw.png) | ![Cuentas bancarias](docs/screenshots/customer-bank-accounts.png) |
| Retiro: verificación de identidad y el periodo de espera de una cuenta bancaria nueva | Cuentas bancarias (CLABE) para retiros |
| ![Configuración de la cuenta](docs/screenshots/customer-settings.png) | ![Chat de soporte](docs/screenshots/customer-support.png) |
| Mi cuenta: perfil, doble factor, sesiones, identidad, avisos por correo y contraseña | Soporte: primero el bot, después una persona |
| ![Inicio en tema oscuro](docs/screenshots/customer-dashboard-dark.png) | <img src="docs/screenshots/customer-phone.png" alt="Inicio en un teléfono" width="260"> |
| Tema oscuro | En un teléfono, con la barra de pestañas |
| <img src="docs/screenshots/customer-phone-support.png" alt="Chat de soporte en un teléfono" width="260"> |  |
| Soporte en un teléfono |  |

</details>

### Agentes de soporte

| | |
| --- | --- |
| ![Bandeja de soporte](docs/screenshots/support-inbox.png) | ![Un caso de soporte](docs/screenshots/support-case.png) |
| Bandeja: la cola, las cifras del agente y sus casos | Un caso: encabezado y acciones, las operaciones del cliente y lo escalado, y luego el chat |
| ![Pestaña del cliente en un caso](docs/screenshots/support-customer.png) | ![Tickets escalados](docs/screenshots/support-escalated.png) |
| La situación del cliente, incluida su identidad | Escalados: lo que el agente pasó a administración |

<details>
<summary>Más pantallas de soporte (4)</summary>

| | |
| --- | --- |
| ![Pestaña de historial de un caso](docs/screenshots/support-history.png) | ![Pestaña de notas de un caso](docs/screenshots/support-notes.png) |
| Los casos anteriores del cliente | Notas para el equipo, que el cliente nunca ve |
| ![Sugerir una respuesta al bot](docs/screenshots/support-teach.png) | ![Cerrar un caso con un motivo](docs/screenshots/support-resolve.png) |
| Enseñarle una respuesta al bot | Cerrar un caso con su motivo |

</details>

### Administradores

| | |
| --- | --- |
| ![Inicio de administración](docs/screenshots/admin-home.png) | ![Un usuario en la consola](docs/screenshots/admin-users.png) |
| Inicio: dinero, operaciones y clientes del periodo, y lo que espera a un administrador | Un usuario: cuenta, doble factor, bloqueo y billeteras (ajustar, congelar) |
| ![Tickets de soporte](docs/screenshots/admin-tickets.png) | ![Casos de soporte](docs/screenshots/admin-support.png) |
| Tickets escalados por soporte | Soporte: la cola, cómo terminan los casos y cada caso |

<details>
<summary>Más pantallas de administración (10)</summary>

| | |
| --- | --- |
| ![Ajustes de saldo](docs/screenshots/admin-adjustments.png) | ![Un ajuste en espera de aprobación](docs/screenshots/admin-adjustment.png) |
| Ajustes de saldo | Uno grande espera a un segundo administrador |
| ![Equipo de soporte](docs/screenshots/admin-support-team.png) | ![Bot de soporte](docs/screenshots/admin-support-bot.png) |
| Soporte: las cifras de cada agente | Soporte: lo que el bot no supo responder y las sugerencias de los agentes |
| ![Billeteras](docs/screenshots/admin-wallets.png) | ![Operaciones](docs/screenshots/admin-operations.png) |
| Billeteras por estado | Operaciones: los últimos 7 días, lo pendiente y búsqueda por id |
| ![Conciliaciones](docs/screenshots/admin-reconciliations.png) | ![Libro mayor](docs/screenshots/admin-ledger.png) |
| Conciliaciones del libro mayor | Libro mayor: las cuentas del sistema por moneda |
| ![Proveedor de pagos](docs/screenshots/admin-payments.png) | ![Bitácora de auditoría](docs/screenshots/admin-audit.png) |
| Proveedor de pagos: su saldo contra los libros, y sus movimientos | Bitácora de auditoría, filtrada por acción, fechas, actor y objetivo |

</details>

## Correr en local

1. Arranca la API (en el repo del back): `docker compose up -d` y luego `./mvnw spring-boot:run`. Escucha en
   `http://localhost:8080`; Mailpit muestra los correos que envía en `http://localhost:8025`.
2. Aquí: `npm install`, luego `npm run dev` y abre `http://localhost:3000`.

El servidor de desarrollo usa el puerto 3000 porque los enlaces de los correos de la API (`/verify-email`,
`/reset-password`) y la página de regreso del pago (`/deposits/return`) apuntan ahí. Redirige `/api` a la API
(`API_PROXY_TARGET`, por defecto `http://localhost:8080`), así que el navegador solo habla con su propio origen: no hay
que configurar CORS y la cookie de renovación `SameSite=Strict` funciona.

Las variables están descritas en `.env.example`. Para usar valores propios en tu máquina, cópialo como
`.env.development.local` (git lo ignora); sin él, la app funciona igual.

## Módulos

| Ruta | Qué hace |
| --- | --- |
| `/login`, `/register`, `/forgot-password`, `/reset-password`, `/verify-email`, `/confirm-email-change` | Inicio de sesión con paso de doble factor, registro, restablecimiento de contraseña y enlaces de correo (confirmar una dirección nueva cierra todas las sesiones) |
| `/change-password` | Donde se queda una cuenta nueva del equipo hasta que reemplaza la contraseña temporal que recibió por correo |
| `/` | Tarjeta de saldo, entradas y salidas del mes (sumadas por la API), gráfica del saldo de 7, 30 o 90 días, actividad reciente y lista de pendientes de la cuenta |
| `/wallets`, `/wallets/:id` | Una billetera por moneda (MXN, USD), movimientos con la otra persona y el concepto, filtrados por fechas, tipo, dirección y texto (persona, concepto o folio), exportación a CSV |
| `/wallets/:id/statement` | El estado de cuenta de un mes (saldo inicial y final, cada movimiento), para imprimir o descargar como PDF |
| `/statements` | Todos los estados de cuenta en un lugar: el periodo de cada billetera de un vistazo, su PDF y un PDF general con todas las billeteras. El periodo es el último mes, los últimos tres meses o fechas elegidas en un calendario (`DateRangePicker`): dos meses lado a lado (uno en el teléfono), atajos (mes completo anterior, últimos 7, 30 o 90 días, lo que va del año), nada antes del primer registro del usuario, después de hoy ni de más de 366 días, también con teclado; solo cuenta al aplicarlo. Los PDF se generan en el navegador con jsPDF (que se carga solo al descargar uno): encabezado de la tabla en cada página, folio y números de página |
| `/wallets/:id/receipts/:transactionId` | El comprobante de un movimiento: imprimir o PDF, o compartir como imagen PNG (menú de compartir o descarga) |
| Diálogos de Depositar / Enviar / Retirar | Se abren desde cualquier lugar; cada movimiento de dinero lleva su propio `Idempotency-Key`. Enviar ofrece destinatarios recientes y dice de quién es el correo antes de confirmar; enviar y retirar muestran lo que aún permite el límite diario |
| Diálogo de Cobrar, `/send` | Un enlace de pago y un código QR (`/send?to=&amount=&currency=&concept=`) que abre el diálogo de envío del pagador ya lleno para revisarlo; no se guarda nada |
| `/bank-accounts` | Cuentas CLABE para retiros por SPEI (con dígito verificador validado y el periodo de espera de 24 h a la vista), cada una con un nombre opcional que elige el dueño |
| `/notifications` | Avisos con filtro de no leídos; los nuevos llegan en vivo (ver abajo). Borrar uno, o todos los leídos |
| `/settings` | Nombre y teléfono, verificación del correo, qué avisos llegan también por correo, sesiones activas (cerrar una o todas las demás), cambio de contraseña, app de autenticación (QR + códigos de recuperación), cambio de correo (enlace a la dirección nueva), una copia en JSON de los datos de la cuenta y cierre de la cuenta (solo sin saldo y sin nada pendiente) |
| `/settings/identity` | Verificación de identidad con la INE: sus datos, las fotos de frente y reverso y una selfie, que revisa un administrador; retirar dinero la requiere |
| `/support` | Chat con soporte: un bot que responde desde los archivos Markdown de la API y luego una persona. Archivos (JPG, PNG, WebP, PDF, MP4 de hasta 20 MB) y una encuesta cuando lo atendió un agente. Mientras está con una persona, el chat se vuelve a leer cada 3 s. "Reportar un problema" en un movimiento lo abre con ese movimiento indicado (`?wallet=&movement=`), y el reporte va directo a una persona |
| `/support/inbox` | Agentes de soporte (rol `SUPPORT`): la cola (quién espera, cuántos son urgentes, la espera más larga), sus propias cifras de los últimos 30 días (casos, cerrados, primera respuesta, calificación de la encuesta) y sus casos, con búsqueda por nombre o folio y filtro de abiertos o cerrados. Un interruptor de disponibilidad pausa los casos nuevos sin soltar el que se está atendiendo; un caso nuevo avisa con un sonido y, si el navegador lo permite, con una notificación de escritorio (se recuerda en este navegador) |
| `/support/inbox/:id` | Un caso en su propia página: un encabezado con el cliente, su estado, la urgencia (un problema con dinero va primero en la cola), el folio y las acciones (enseñarle al bot, devolverlo a la cola, pasarlo a un compañero, cerrarlo con un motivo: resuelto, solo información, escalado, sin respuesta, duplicado u otro). Debajo, pestañas con la situación del cliente (incluida su identidad, solo mientras está abierto), sus operaciones para escalar una como ticket (o un problema que no es de dinero: acceso a la cuenta, identidad), sus casos anteriores y las notas del equipo, que el cliente nunca ve; luego el chat con todo lo dicho al bot, los archivos y las respuestas guardadas. Su notificación abre el caso |
| `/support/escalated` | Lo que el agente pasó a los administradores desde cualquiera de sus casos, abierto o resuelto, con lo que se hizo y un enlace al caso. El menú cuenta los abiertos, y llega un aviso cuando se resuelve uno |
| `/admin` | Inicio: el dinero de los clientes, el dinero movido, las operaciones y los clientes nuevos del periodo (7, 30 o 90 días) frente al anterior; lo que espera a un administrador (identidades por revisar, tickets abiertos, ajustes por aprobar, movimientos del proveedor sin conciliar); dinero movido por día, si los libros y el proveedor cuadran, clientes nuevos por día, cuentas y billeteras por estado, soporte y la actividad más reciente |
| `/admin/identity`, `/admin/identity/:id` | Las INE que enviaron los clientes, por estado: ver sus datos y fotos, y aprobarlas o rechazarlas con un motivo que el cliente recibe |
| `/admin/tickets`, `/admin/tickets/:id` | Los tickets que escaló soporte, para resolverlos con lo que se hizo (o con un ajuste de saldo); el cliente y el agente reciben un aviso |
| `/admin/adjustments`, `/admin/adjustments/:id` | Abonos y cargos manuales a una billetera, con un motivo, iniciados desde la billetera de un usuario o desde un ticket. Por encima del límite de la API esperan a un segundo administrador, que los aprueba o rechaza; quien lo pidió no puede aprobarlo, pero sí retirarlo |
| `/admin/*` | Usuarios (filtrados por estado y tipo, incluido hacer a alguien agente de soporte y crear cuentas del equipo, cuyo dueño recibe por correo su rol, su dirección y una contraseña temporal: nadie más la ve, y debe cambiarla al iniciar sesión) y billeteras (conteos y listas filtradas por estado, guardadas en la dirección), operaciones (los totales de los últimos 7 días, lo que sigue pendiente y búsqueda por id), conciliaciones, libro mayor, proveedor de pagos, soporte (la cola y cómo terminan los casos, cada caso con su encuesta, motivo de cierre y notas; las cifras de cada agente; y lo que el bot no supo responder, con las sugerencias de los agentes para agregarlo a su conocimiento) y bitácora de auditoría (administradores con doble factor activo) |
| Cualquier otra dirección | Una página de "no encontrado" con el camino al inicio |
| Campos de búsqueda | Usuarios, operaciones, bitácora de auditoría y movimientos muestran hasta 6 coincidencias mientras escribes (`SuggestInput`); el campo de destinatario solo busca entre personas a las que ya se les pagó, así que no puede revelar quién tiene cuenta |

El personal (administradores y agentes de soporte) no maneja dinero: no ve billeteras, envíos, cuentas bancarias,
estados de cuenta ni el chat de clientes, y al entrar llega a su consola (`/admin` o `/support/inbox`).

En una computadora, el menú lateral se puede ocultar con el botón de arriba a la izquierda, para cualquier rol, y así
dejarle todo el ancho a la página; el navegador lo recuerda. En los teléfonos se usan el botón de menú y la barra de
pestañas de abajo.

El código vive por funcionalidad en `src/features/*`; las piezas compartidas están en `src/components`, `src/lib` y
`src/api`.

## Cómo habla con la API

Cada llamada envía como `Accept-Language` el idioma que muestra la app, y una app con sesión iniciada lo guarda en la
cuenta cada vez que cambia, para que los correos lleguen en ese idioma.

- `src/api/schema.d.ts` se genera del documento OpenAPI de la API; vuelve a generarlo con `npm run api:generate`
  (con la API corriendo) cada vez que cambien sus endpoints.
- `src/api/client.ts` es el cliente tipado (`openapi-fetch`). Las llamadas pasan por `unwrap`, que lanza un `ApiError`
  con el `code` de error de la API; `errorMessage` lo convierte en un mensaje en el idioma de la app.
- Las sesiones usan el modo navegador de la API (`X-Session-Mode: cookie`): el token de acceso vive solo en memoria y
  el de renovación en una cookie `HttpOnly`. Al recargar, la sesión se recupera con `/api/v1/auth/refresh`; un 401 en
  cualquier llamada renueva el token una vez y reintenta, y si la API no responde se muestra una pantalla para
  reintentar en lugar de cerrar la sesión.
- Los endpoints de administración necesitan una sesión iniciada con un código de doble factor; activar el doble factor
  cierra la sesión para que el siguiente inicio lo pida.
- Las notificaciones nuevas llegan por un flujo de eventos del servidor (`/api/v1/notifications/stream`), leído con
  `fetch` porque `EventSource` no puede enviar el token de acceso (`src/features/notifications/live.ts`). Cada una
  actualiza la bandeja, los saldos y los movimientos, con un aviso emergente para lo que el usuario no hizo él mismo.
  El flujo se reconecta cuando el servidor lo cierra y espera más después de cada fallo; una pestaña oculta lo suelta.
  Mientras está conectado, la campana consulta cada cinco minutos en lugar de cada 30 segundos.

## Instalación y uso sin conexión

- La app se puede instalar (`public/manifest.webmanifest`, íconos en `public/icons`). En los builds, un service worker
  (`public/sw.js`) guarda la app misma: las páginas desde la red con la última como respaldo, y los archivos con hash
  desde la caché. Nunca guarda respuestas de la API.
- Si se abre sin conexión, la app muestra los últimos datos que vio el usuario (billeteras, movimientos,
  notificaciones) con un aviso de cuándo se guardaron, y se recarga cuando vuelve la conexión. Esa copia está en
  `localStorage` (`src/auth/offline-snapshot.ts`), no guarda tokens, caduca a los siete días y se borra al cerrar
  sesión, al cerrarse por inactividad o cuando la sesión expira.

## Seguridad

- Sesiones: token de acceso solo en memoria y token de renovación en una cookie `HttpOnly`, `Secure`, `SameSite=Strict`
  que la API acepta solo con el encabezado `X-Session-Mode` (sin CSRF).
- Diez minutos sin actividad en ninguna pestaña muestran un aviso de un minuto y luego cierran la sesión
  (`src/auth/IdleGuard.tsx`).
- Cerrar sesión en una pestaña la cierra en todas; iniciar sesión deja que las pestañas en espera tomen la sesión
  (`src/auth/session-sync.ts`).
- Un depósito solo redirige a un checkout `https` en un host conocido del proveedor (`src/features/money/checkout-url.ts`).
- `npm run build` escribe los encabezados de producción (CSP con el hash del script de tema en línea, HSTS,
  `frame-ancestors 'none'`, nosniff, Referrer-Policy, Permissions-Policy) en `dist/_headers` (Netlify, Cloudflare
  Pages) y en `dist/nginx-security-headers.conf` (nginx: agrégalo con `include` en el bloque `server`).
  `npm run preview` sirve el build con ellos en `http://localhost:4173`. Vuelve a hacer el build después de cambiar el
  script en línea de `index.html`: su hash cambia. Ver `security-headers.ts`.
- `npm audit --omit=dev` no reporta nada. `npm audit` todavía lista avisos moderados y bajos solo en herramientas de
  build (`minimatch` dentro de `openapi-typescript` y del CLI de `shadcn`, `deepmerge` en `shadcn`): ninguno llega al
  bundle, y sus correcciones rompen esas herramientas o aún no existen, así que esperan a nuevas versiones.

## Errores y monitoreo

- Una pantalla que falla al renderizar muestra una pantalla de error en lugar de una página en blanco: hay un límite
  de errores alrededor de toda la app y otro alrededor de la página de cada layout, así que la navegación sigue
  funcionando e ir a otra página limpia el error (`src/components/ErrorBoundary.tsx`).
- Una pestaña que quedó abierta durante una nueva versión pide fragmentos de pantallas que ya no existen; se recarga
  una vez para tomar la nueva versión y luego ofrece un botón para recargar en lugar de quedarse en un ciclo
  (`src/lib/chunk-reload.ts`).
- Los errores van a Sentry cuando `VITE_SENTRY_DSN` tiene valor (vacío lo apaga). El SDK se carga en su propio
  fragmento después del arranque, y solo con un DSN. No se envía nada que identifique: ni usuario, cookies, query
  strings, fragmentos de la URL (tokens de los correos), cuerpos ni la salida de la consola (`src/lib/monitoring.ts`).
  El build agrega el origen de ingesta del DSN al `connect-src` de la CSP; define `VITE_APP_VERSION` (por ejemplo, el
  SHA del commit) para que cada reporte diga de qué build viene.

## Pruebas

- `npm test`: pruebas unitarias y de componentes con Vitest y Testing Library (`src/**/*.test.ts(x)`);
  `npm run test:coverage` agrega un reporte de cobertura.
- `npm run test:e2e`: flujos de punta a punta con Playwright (`e2e/`) contra la API local y Mailpit, que deben estar
  corriendo (ver *Correr en local*); arranca el servidor de desarrollo si no está arriba. Cada prueba crea sus propios
  usuarios por la API, verificados con el enlace del correo y, cuando hace falta, con una app de autenticación, así
  que las corridas son independientes. La API limita las peticiones de autenticación por dirección y todas las
  pruebas vienen de localhost: las rechazadas se reenvían después de una pausa (`e2e/support/fixtures.ts`), así que
  una corrida completa tarda cerca de un minuto. `npm run test:e2e:ui` abre el modo UI de Playwright.
- `e2e/accessibility.spec.ts` revisa las pantallas y diálogos principales con axe (WCAG 2.1 A y AA).
- `e2e/admin.spec.ts` crea su administrador poniendo el rol en la base de datos (la API no tiene un endpoint para eso),
  con `docker exec` sobre el contenedor de PostgreSQL del back: `E2E_DB_CONTAINER` (por defecto
  `billeterra-digital-postgres-1`), `E2E_DB_NAME` (`wallet`) y `E2E_DB_USER` (`wallet_owner`) lo apuntan a otro lado.
- `e2e/support.spec.ts` crea su agente de la misma forma. Cualquier agente libre puede tomar su caso, así que primero
  vuelve clientes a los agentes de corridas anteriores y cierra los casos que dejaron en la cola (solo cuentas de
  prueba).
- `e2e/identity.spec.ts` (una INE enviada desde la configuración y luego aprobada y rechazada en la consola) y
  `e2e/adjustments.spec.ts` (un abono aplicado de inmediato, uno grande aprobado por un segundo administrador y una
  solicitud retirada) crean sus administradores de la misma forma. La API acepta cada CURP y clave de elector una sola
  vez, así que cada corrida genera unas nuevas y válidas, y las fotos son PNG creados en la prueba
  (`e2e/support/identity.ts`).
- Las pruebas unitarias comparten ayudas en `src/test`: `stubApi()` (una API falsa detrás de `fetch`; importa el código
  a probar después de llamarla), el mock de `auth` con `testUser()`, `renderWithProviders`/`renderDialog` y datos de
  prueba comunes.
- `e2e/offline.spec.ts` necesita el service worker, que solo tiene el build: córrela con `npm run build`, luego
  `npm run preview` y `E2E_PREVIEW=1 E2E_BASE_URL=http://localhost:4173 npm run test:e2e -- offline`.
- El CI (`.github/workflows/ci.yml`) corre el linter, el build con revisión de tipos y las pruebas unitarias en cada
  pull request. Las pruebas de punta a punta necesitan la API, así que se corren en local.

## Despliegue

Sirve la app desde el mismo sitio de la API (mismo origen, o el mismo proxy inverso) y deja `VITE_API_URL` vacío. Si
la API está en otro origen, debe estar en el mismo sitio (por ejemplo, `app.example.com` y `api.example.com`): pon su
dirección en `VITE_API_URL` y agrega el origen de esta app a `CORS_ALLOWED_ORIGINS` de la API. Pon la dirección de
esta app en `wallet.notifications.email.app-url` y `wallet.payments.return-url` de la API. Pon en
`VITE_SUPPORT_EMAIL` el correo que atiende a quienes no pueden iniciar sesión: el chat de soporte necesita una sesión,
así que la página de inicio de sesión les muestra esta dirección, y la oculta si está vacía. En producción, estas
variables se definen en el CI o en el servidor donde se hace el build.
