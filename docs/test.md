# Guia de tests y chequeos

Esta guia resume como ejecutar todas las verificaciones disponibles del proyecto y que valida cada una.

## Antes de empezar

1. Instala dependencias:

```bash
npm install
```

2. Si vas a ejecutar `npm run check`, asegúrate de tener configuradas las variables y bindings de Cloudflare, porque ese comando incluye `wrangler deploy --dry-run`.

## Paso a paso

### 1. Ejecutar los tests unitarios

```bash
npm test
```

Que verifica:
- Ejecuta la suite de Vitest.
- Comprueba utilidades, validaciones, rutas protegidas y hooks ya cubiertos por tests.

Los tests cubren dos ubicaciones: `src/**` y `functions/**` (ambas incluidas en el `include` de `vitest.config.ts` — ver sección de cobertura).

Cobertura actual:
- `src/react-app/lib/api.test.ts`: verifica que `apiFetch` agregue `X-Negocio-ID` cuando corresponde, que no lo inyecte cuando `negocioId` está ausente, que dispare el evento global `USAGE_LIMIT_EVENT` cuando el backend responde `429 USAGE_LIMIT_EXCEEDED`, y que un `429 TOO_MANY_REQUESTS` (rate limit de auth) **no** dispare ese evento.
- `src/worker/geminiCache.test.ts`: verifica la función `getOrCreateGeminiCache` (10 tests). Cubre: cache hit cuando el nombre existe y no expiró (no llama a la API de Gemini); cache miss cuando no hay fila en D1; cache miss cuando `gemini_cache_name` es null; cache miss cuando el cache expiró; **cache miss cuando `gemini_cache_expires_at` es null aunque el nombre exista** (nuevo caso — fuerza renovación si el timestamp de expiración está ausente); payload correcto enviado a la API de Gemini (`model: "models/gemini-2.5-flash"`, `systemInstruction`, `ttl: "7200s"`, header `x-goog-api-key`); persistencia del nuevo nombre y `expiresAt` en D1 con los `userId` y `negocioId` correctos; que D1 no se actualiza cuando la API de Gemini responde un error; retorno null ante respuesta no-ok de la API; retorno null ante excepción de red.
- `src/worker/rateLimitAuth.test.ts`: verifica la función `checkRateLimit` (11 tests) y la lógica del validador de origen CORS (6 tests). Para `checkRateLimit`: retorna `true` cuando el count está por debajo del límite, `true` en el boundary exacto, `false` al excederlo en uno, `true` en el primer intento, `true` cuando D1 devuelve null (fail-open), que el IP se guarda como hash SHA-256 de 64 chars hex y no como texto plano, que el mismo IP produce el mismo hash, que IPs distintas producen hashes distintos, que `window_start` se redondea al múltiplo del windowMinutes sin segundos ni milisegundos, que los límites de `verify-email` (5/60 min) se respetan, y que el nombre del endpoint llega sin modificar a D1. Para el validador CORS: permite el origen exacto de `APP_URL`, rechaza orígenes distintos, rechaza subdominios, rechaza todos los orígenes cuando `APP_URL` es `undefined`, rechaza string vacío, y distingue http de https.
- `src/worker/validation.test.ts`: verifica schemas Zod y el helper `validateData`. Cubre los schemas de creación y actualización de todas las entidades: empleados, job roles, negocios, tópicos, notas, adelantos, pagos de sueldo, compras y facturación. Para empleados cubre también los campos de salida (`ausencia_desde`, `informo`, `cuando_informo`, `sueldo_pendiente`): acepta valores válidos y null, rechaza `sueldo_pendiente` negativo en ambos schemas. Cubre también `chatHistoryItemSchema` (acepta `role: "user"|"assistant"` con content de 1–2000 chars; rechaza roles inválidos, content vacío y content excesivo) y `chatHistoryArraySchema` (acepta array vacío y arrays válidos; rechaza ítems con role inválido). Cubre `crearSuscripcionSchema` (acepta `ref_code` válido, acepta objeto vacío porque es opcional, rechaza código >20 chars, rechaza string vacío). Valida tipos enum, rangos de monto, formatos de fecha y hora, campos requeridos y fallbacks de error. Actualmente deja `src/worker/validation.ts` con cobertura completa.
- `src/react-app/components/employees/EmployeeModal.test.tsx`: verifica el control segmentado de estado y el formulario condicional de baja. Cubre: que ambos botones ("Empleado activo" / "Empleado inactivo") se renderizan; que "Empleado activo" está seleccionado por defecto en un empleado nuevo; que al editar un empleado inactivo el botón "Empleado inactivo" queda seleccionado; que los campos de baja no aparecen cuando el empleado está activo; que aparecen al seleccionar "Empleado inactivo"; que `cuando_informo` permanece oculto mientras `informo` está desmarcado; que `cuando_informo` aparece al marcar `informo`; que los campos desaparecen al re-activar; que al editar un empleado inactivo los campos se pre-rellenan correctamente (`ausencia_desde`, `informo`, `cuando_informo`, `sueldo_pendiente`); y que desmarcar `informo` limpia `cuando_informo`.
- `src/react-app/components/employees/EmployeeViewModal.test.tsx`: verifica el modal de solo lectura para visualizar empleados. Cubre 4 bloques: **visibilidad** (no renderiza si `isOpen` es false o si `employee` es null; renderiza cuando ambos están presentes); **empleado activo** (nombre, cargo, iniciales en avatar, teléfono, email, salario formateado en MXN, badge "Activo", y que la sección de información de baja no aparece); **empleado inactivo** (badge "Inactivo", sección de información de baja con `ausencia_desde`, `sueldo_pendiente` formateado, estado de `informo`, y que la sección no aparece cuando todos los campos de baja están vacíos/nulos); **acciones** (`onEdit` se llama con el empleado correcto al pulsar "Editar", `onClose` al pulsar "Cerrar", `onClose` al pulsar el backdrop, y que "Cerrar" no dispara `onEdit`).
- `src/react-app/pages/modulos/Employees.test.tsx`: verifica la integración de la página de empleados. Cubre 2 bloques: **clic en tarjeta abre vista** (el modal de vista no está visible al cargar; clic en una tarjeta abre el modal con el empleado correcto; clic en otra tarjeta muestra ese empleado; cerrar el modal lo oculta); **control segmentado en tarjetas** (cada tarjeta tiene ambos botones de estado; clic en "Empleado inactivo" abre el modal de edición con el empleado pre-configurado con `is_active: 0`; clic en "Empleado activo" en empleado inactivo llama a `updateEmployee` con `is_active: true`; los botones de estado NO abren el modal de vista; toast de éxito al marcar activo).
- `src/react-app/hooks/useSalaries.test.tsx`: verifica el hook `useSalaries`. Cubre: **estado inicial** (`isLoading: false`, `error: null`); **fetchOverview** (retorna datos en éxito; null + mensaje de error en fallo; "Error de conexión" en error de red); **fetchAdvances** (retorna array en éxito; array vacío cuando `data` es undefined; lanza en fallo); **createAdvance** (retorna el `Advance` creado en éxito; lanza en fallo); **deleteAdvance** (retorna `true` en éxito; lanza en fallo); **markAsPaid** (retorna `true` en éxito; lanza en fallo); **markAllAsPaid** (retorna `true` en éxito; lanza en fallo).
- `src/react-app/pages/modulos/Salaries.test.tsx`: verifica la página de sueldos. Cubre: estado de carga muestra "Cargando..."; renderizado de título, nombres de empleados, roles y selectores mes/año; badge "Pagado" cuando `is_paid=true`, botón "Pagado" cuando `is_paid=false`; monto de adelanto clickeable si > 0; clic en "Adelanto" selecciona el empleado; clic en "Pagado" llama `markAsPaid` con el empleado y período; clic en "Marcar Todos" pide confirmación y llama `markAllAsPaid`.
- `src/react-app/components/compras/ComprasHistoryModal.test.tsx`: verifica el modal de historial de compras. Cubre: no renderiza nada cuando `isOpen` es false; renderizado de ítems cuando hay datos; mensaje de estado vacío cuando no hay compras; filtrado por texto de búsqueda (nombre del ítem); mockea `useCompras` para aislar el componente.
- `src/react-app/components/facturacion/FacturasHistoryModal.test.tsx`: verifica el modal de historial de facturas. Cubre: no renderiza nada cuando `isOpen` es false; estado vacío; muestra concepto cuando hay datos; filtrado por turno; filtrado por texto de búsqueda (concepto); mockea `useFacturacion`.
- `src/react-app/pages/Settings.test.tsx`: verifica la página de configuración de módulos. Cubre: nombre, email e inicial del avatar del usuario; listado de todos los módulos (Compras, Facturación, Sueldos); que el switch de cada módulo llama a `toggleModule()` al hacer clic.
- `src/react-app/pages/modulos/Compras.test.tsx`: verifica la página de compras. Cubre: spinner de carga; título de la página; selectores de mes y año; mensaje de error; botones "Nueva Compra" e "Historial"; montos por día en el calendario y conteo de ítems cuando hay datos de resumen.
- `src/react-app/pages/modulos/Facturacion.test.tsx`: verifica la página de facturación. Cubre: spinner de carga; título de la página; selectores de mes y año; mensaje de error; botones "Nueva Venta" e "Historial"; montos por día en el calendario y conteo de ventas cuando hay datos de resumen.
- `src/react-app/components/UsageBanner.test.tsx`: verifica cuando el banner no aparece, cuando avisa y cuando marca limite alcanzado.
- `src/react-app/components/ErrorBoundary.test.tsx`: verifica que renderiza hijos sin error, muestra UI de error por defecto o fallback personalizado al capturar excepciones, y que el botón "Intentar de nuevo" restaura el estado limpio.
- `src/react-app/context/UsageLimitModalContext.test.tsx`: verifica el modal global de upgrade por límite. Cubre apertura al recibir `USAGE_LIMIT_EVENT`, renderizado del contenido dinámico, cierre con tecla `Escape`, cierre por click en el backdrop y restauración del `overflow` del `body`.
- `src/react-app/hooks/useSidebar.test.tsx`: verifica estado inicial, toggles de isOpen e isCollapsed, cierre del menú mobile al hacer resize a ≥1024px, y error al usar el hook fuera del Provider.
- `src/react-app/context/ChatContext.test.tsx`: verifica el contexto del chat (2 tests). Cubre: error lanzado al llamar `useChatContext()` fuera de `ChatProvider`; y que dentro del provider el contexto expone `messages` (array), `sendMessage` (función), `clearMessages` (función) y `triggerDailyGreeting` (función).
- `src/react-app/components/auth/ProtectedRoute.test.tsx`: verifica loading y redirecciones de rutas protegidas (9 tests). Cubre: spinner de carga mientras auth está pendiente; usuarios anónimos redirigidos a `/`; usuarios con email no verificado redirigidos a `/verify-email`; usuarios autenticados sin negocio activo redirigidos a `/negocio/setup`; la ruta `/negocio/setup` accesible sin negocio activo; la ruta `/invite/:token` accesible sin negocio activo; renderizado del contenido protegido cuando hay auth y negocio disponibles; gerentes con módulo restringido redirigidos a `/agente-ia`; y renderizado normal cuando el módulo está disponible.
- `src/react-app/pages/LandingPage.test.tsx`: verifica la landing page pública en 4 bloques (25 tests). **WaveBackground** (4 tests): renderiza el elemento SVG, contiene exactamente 6 paths de onda, los paths tienen `fill="none"`, y el SVG tiene `preserveAspectRatio="xMidYMid slice"`. **Renderizado** (13 tests): branding "La Hoja", links de navegación con anclas correctas, h1 del hero, botón de login en navbar, botones "Empezá gratis" (hero + CTA), sección de pain points con su heading, las 6 tarjetas de problemas, sección de módulos con su heading, los 6 títulos de módulo, beneficios en verde por módulo, sección "¿Cómo funciona?" con los 3 pasos, las 4 estadísticas de confianza y el footer con copyright. **Autenticación** (4 tests): redirige a `/agente-ia` cuando el usuario está autenticado; no redirige mientras `isPending` es true; muestra el banner de email verificado con `?verified=true`; no muestra el banner sin el query param. **Login** (4 tests): al hacer click en el botón de login llama a `/api/oauth/google/redirect_url` y redirige a la URL recibida; muestra "Conectando..." y spinner durante la carga; el botón queda deshabilitado mientras espera; vuelve a habilitarse si el fetch falla.
- `src/react-app/pages/AuthCallback.test.tsx`: verifica la página de callback OAuth en 5 bloques (9 tests). **Estado inicial** (1 test): muestra spinner y texto "Procesando autenticación" mientras el fetch está pendiente. **Error** (3 tests): estado de error cuando no hay `?code` en la URL; cuando el servidor responde `success: false`; cuando `fetch` lanza excepción de red. **Verificación pendiente** (1 test): navega a `/verify-email` cuando el servidor responde `error.code === "PENDING_VERIFICATION"`. **Éxito** (2 tests): muestra estado de éxito tras autenticación correcta; llama a `window.location.assign("/agente-ia")` después del timeout. **Interacción** (1 test): el botón "Volver a intentar" navega a `/` desde el estado de error.
- `src/react-app/hooks/useModulePrefs.test.ts`: verifica estado por defecto sin usuario (no hace fetch), carga de prefs y restricciones de negocio para usuarios autenticados (incluyendo `isGerente`), mantenimiento de prefs por defecto cuando la respuesta del endpoint tiene formato inválido, update optimista con confirmación exitosa y rollback ante fallo. Módulos registrados: `calendario`, `personal`, `sueldos`, `compras` y `facturacion`.
- `src/react-app/hooks/useSuscripcion.test.ts`: verifica el hook de suscripciones MercadoPago (23 tests). Cubre 4 bloques:
  - **Estado inicial y carga en mount** (4 tests): `isLoading: true` antes de resolver, fetch a `/api/suscripciones/estado` en mount y seteo de `suscripcion`, respuesta `null` cuando no hay suscripción, error de red al cargar estado.
  - **crear()** (13 tests): retorno de `init_point` y llamada a `fetchEstado` en éxito, reset de `isLoading`; `400 ALREADY_SUBSCRIBED` con mensaje del servidor; los 5 códigos 502 de MercadoPago (`MP_NETWORK_ERROR`, `MP_AUTH_ERROR`, `MP_VALIDATION_ERROR` con y sin `mp_detail`, `MP_SERVER_ERROR`, `MP_NO_INIT_POINT`); código desconocido con y sin `mp_detail`; error sin código; `fetch` throws.
  - **cancelar()** (3 tests): retorno `true` y llamada a `fetchEstado` en éxito; retorno `false` con error en fallo 404; `fetch` throws → retorna `false` y error de red.
  - **fetchPagos()** (3 tests): seteo de lista de pagos en éxito; respuesta no-ok no modifica el estado de error; excepción de red no modifica el estado de error.
- `src/react-app/hooks/useSellers.test.tsx`: verifica el hook `useSellers` (10 tests). Cubre 4 bloques: **estado inicial** (vendedor/referidos/stats en null, isLoading false, error null); **fetchMe() exitoso** (carga vendedor, lista de referidos y stats desde `/api/sellers/me`, reset de isLoading); **manejo de errores** (error de red y error de servidor en fetchMe, reset de isLoading en ambos casos); **activate()** (POST a `/api/sellers/activate`, seteo de `vendedor.codigo`, llamada a fetchMe en éxito; error de red y error de servidor en activación; estado de isLoading durante la operación); **refresh()** (re-llama a fetchMe y actualiza estado).
- `src/react-app/pages/Sellers.test.tsx`: verifica la página Sellers en dos estados principales (23 tests). Cubre: **spinner de carga** mientras fetchMe está pendiente; **card de activación** cuando el usuario no es vendedor (título "Convertite en vendedor", comisión 7.500 ARS, reembolso 6.000 ARS, listado de beneficios, botón "Activarme como vendedor"); **mensaje de error** cuando activate falla; **estado activado** (link de referido con código, botón de copiar, stats — total referidos, confirmados, comisión total, pendiente de cobro); **tabla de referidos** (nombre + email, fecha, badge de suscripción, badge de estado referido con colores pendiente/confirmado/cancelado); **comisión pagada** (monto tachado + badge "✓"); **estado vacío** ("Aún no tenés referidos").
- `src/worker/usageLimit.test.ts`: verifica `incrementAndCheckInteligenteLimit`. Cubre: bloqueo cuando el count supera `CHAT_CAP_INTELIGENTE` (3000); decremento atómico al bloquear; que el INSERT SQL contiene `ON CONFLICT DO UPDATE SET count = count + 1 RETURNING count`; y el threshold de aviso al 80% (3 tests): `warnAt80: true` exactamente en el conteo 2400, `warnAt80` undefined en 2399 y en 2401.
- `src/worker/usageTools.test.ts`: verifica las constantes `USAGE_TOOLS` (3 tests). Cubre: que hay exactamente 10 claves en el objeto; que cada valor coincide con su clave en minúsculas con guiones bajos; y que el tipo `UsageTool` incluye todos los valores esperados (`employees`, `job_roles`, `topics`, `notes`, `advances`, `salary_payments`, `events`, `chat`, `compras`, `facturacion`).
- `src/worker/salaryHelpers.test.ts`: verifica la función pura `calcSalaryRow` (5 tests). Cubre: empleado sin anticipos no pagado (paid_amount=0, remaining=salario); empleado con anticipos no pagado (paid_amount=anticipos, remaining=neto); empleado pagado sin anticipos (paid_amount=salario, remaining=0); empleado pagado con anticipos (paid_amount=salario, remaining=0); salario cero (todos los campos en 0).
- `src/cron/index.test.ts`: verifica el handler `scheduled` del Worker de cron (2 tests). Cubre: que al ejecutar el cron se consultan las compras con `expires_at <= datetime('now')`, se llama a `R2_BUCKET.delete` por cada fila encontrada y se ejecuta `UPDATE compras SET comprobante_key = NULL`; y que si no hay filas expiradas no se llama a R2.
- `src/worker/kvCache.test.ts`: verifica el caché KV en el endpoint de empleados (3 tests). Cubre: que `GET /api/employees` devuelve datos del KV cuando hay cache hit (no consulta D1 más allá del middleware); que en cache miss consulta D1 y persiste el resultado en KV con TTL 60s; y que `POST /api/employees` invalida la clave `emp:{negocio_id}` en KV.
- `src/worker/comprasR2Cleanup.test.ts`: verifica la limpieza de R2 en los endpoints de compras (10 tests en 2 bloques). **PUT /api/compras/:id** (6 tests): elimina el objeto R2 anterior cuando `comprobante_key` cambia; no llama a R2 si la clave no cambió; no llama a R2 si la compra no tenía comprobante; no llama a R2 si el PUT no envía `comprobante_key`; ignora errores de R2 sin propagar 500; devuelve 404 y no toca R2 si la compra no existe. **DELETE /api/compras/:id** (4 tests): elimina el objeto R2 cuando la compra tiene `comprobante_key`; no llama a R2 si no hay comprobante; devuelve 404 y omite R2 si la compra no existe; ignora errores de R2 sin propagar 500.
- `src/worker/webhooks.test.ts`: verifica el endpoint `POST /api/webhooks/mercadopago` (3 tests). Cubre: que una firma inválida devuelve 200 sin ejecutar lógica (silent fail); que un pago aprobado (`type=payment`, `status=approved`) inserta en `pagos_suscripcion` y actualiza `users.role = 'usuario_inteligente'` vía `db.batch`; y que un preapproval autorizado (`type=preapproval`, `status=authorized`) ejecuta `UPDATE suscripciones SET estado='autorizada'`.
- `src/worker/chatContext.test.ts`: verifica el endpoint `POST /api/chat` con foco en la construcción de contexto (4 tests). **Queries de contexto con LIMIT:** cuando el caché D1 está expirado, confirma que `db.batch` se llama exactamente una vez y que las queries SQL incluyen `ORDER BY is_active DESC LIMIT 30` (empleados), `ORDER BY event_date ASC LIMIT 20` (eventos) y `ORDER BY t.due_date ASC LIMIT 15` (temas). **Truncado de historial:** con un historial de 10 mensajes, verifica que el payload enviado a DeepSeek contiene exactamente 7 items en `messages` (1 system con contexto + 5 mensajes del historial truncado por `slice(-5)` + el mensaje nuevo del usuario). **Balance en contexto reconstruido:** cuando el caché expira y se reconstruye, verifica que el batch incluye las queries de `compras` y `facturas` con filtro `negocio_id + strftime('%Y-%m', fecha)`, y que la línea `Balance <mes>: Ventas $X - Gastos $Y = $Z` está presente en el contexto resultante. **Filtrado condicional Gastos/Ventas:** verifica que `filterContext` incluye la línea Balance siempre; incluye Gastos si el mensaje contiene keywords de compras o ventas (`wantsCompras || wantsVentas`); incluye Ventas solo si el mensaje contiene keywords de ventas (`wantsVentas`); y excluye ambas líneas en mensajes genéricos sin esos keywords.
- `src/react-app/hooks/useChat.test.ts`: verifica el hook del chatbot. Cubre: estado inicial vacío, que mensajes vacíos o con solo espacios no disparen la API, que el primer mensaje envíe `history: []`, que el mensaje del usuario y la respuesta del asistente se agreguen al estado `messages`, que los mensajes siguientes incluyan el intercambio previo como historial, que el rol `assistant` se preserve como `assistant` en el historial (formato OpenAI-compatible de DeepSeek), que el historial se corte a los últimos 5 items, manejo de errores de API y de red, reset de `isLoading` en ambos casos, `clearMessages`, propagación del id del negocio a `apiFetch`, y `triggerDailyGreeting`: envía el saludo en la primera visita (sin `lastActivity` previa); sin mensaje si han pasado menos de 8h **y ya se saludó hoy** (requiere ambas condiciones); envía el saludo si pasaron >8h y el historial está vacío; no envía si ya hay mensajes en el estado; **envía el saludo cuando es un día nuevo aunque la actividad fue reciente** (`isNewDay`); **persiste `greetingKey` en localStorage al enviar el saludo del día**.
- `src/react-app/components/ChatWidget.test.tsx`: verifica el widget flotante de chat. Cubre: botón flotante oculto en `/agente-ia` y visible en otras rutas; que al abrir el panel se llame a `triggerDailyGreeting`; cierre del panel al segundo clic; panel en estado vacío con la lista de capacidades; renderizado de mensajes con timestamps; spinner de carga; caja de error; y que el botón "Limpiar" solo aparece cuando hay mensajes.
- `functions/route.test.ts`: verifica el routing de la Pages Function de Cloudflare. 7 tests en 3 grupos: `/assets/*` (asset existente pasa sin modificar; asset faltante o con error devuelve 404 `text/plain` con `Cache-Control: no-store`; nunca hace fallback a `index.html`), SPA routing (recurso existente pasa directo; ruta desconocida hace fallback a `/index.html`), y `/api/*` (delega al Hono Worker sin llamar a ASSETS). El mock de `src/worker/index` aísla completamente la lógica de routing de los endpoints de negocio.
- `src/react-app/pages/Dashboard.test.tsx`: verifica la página del Agente IA en 5 bloques (10 tests). **Sin mensajes** (2 tests): muestra el mensaje de bienvenida "¡Hola! Soy tu agente de IA" cuando no hay mensajes; el botón "Limpiar" no es visible con historial vacío. **Con mensajes** (2 tests): renderiza el contenido de los mensajes de usuario y asistente; muestra el botón "Limpiar" cuando hay mensajes. **Carga y error** (2 tests): muestra el indicador de escritura (`.animate-bounce`) cuando `isLoading` es `true`; muestra el texto de error cuando `error` tiene valor. **Acciones** (3 tests): submit del formulario llama a `sendMessage` con el texto ingresado; no llama a `sendMessage` si el input está vacío; el input queda deshabilitado cuando `isLoading` es `true`. **AgenteIA — montaje** (1 test): llama a `triggerDailyGreeting` al montar el componente.
- `src/react-app/pages/Admin.test.tsx`: verifica el panel de administración en cuatro bloques. El `BASE_MOCK` incluye `suscripciones`, `fetchSuscripciones` y `fetchPagosUsuario` (requeridos por la sección de suscripciones del panel Admin):
  - **Paginación de uso por usuario** (10 tests): ausencia de controles con ≤50 filas, aparición de controles con >50 filas, estado disabled de "Anterior" en página 1 y "Siguiente" en la última, visibilidad correcta de filas por página, navegación hacia adelante y hacia atrás, indicador "Página X de Y", reset a página 1 al filtrar por email, y reset a página 1 al limpiar filtros.
  - **Uso del Sistema** (12 tests): spinner mientras `fetchUsage` está pendiente, mensaje de error cuando `fetchUsage` falla, botón "Reintentar" visible en estado de error y que vuelve a llamar a `fetchUsage` y `fetchLimits`, mensaje "Sin datos" cuando `usageData` es null, período y conteo de usuarios básicos en la descripción de la tarjeta, cálculo correcto de `usado / (límite × usuariosBásicos)` con uno y con múltiples usuarios, subtexto "Límite: X/usuario" por herramienta, `0%` cuando no hay límite configurado, y que los usuarios inteligentes no se cuentan en el denominador del límite.
  - **Tarjeta de Usuarios Registrados** (3 tests): muestra `0` cuando `stats` es null, muestra el valor correcto de `totalUsers` cuando `stats` está disponible, y verifica que las tarjetas antiguas eliminadas ("Correos Registrados", "Promedio Empleados", "Promedio Eventos") ya no aparecen en el DOM.
  - **Programa de Referidos** (14 tests): título "Programa de Referidos" visible; tabs "Referidos" y "Vendedores"; estado vacío cuando no hay referidos; display de email del vendedor y del referido; badge "pendiente" para referido pendiente; sin botones de comisión/reembolso para referido pendiente; botones "Marcar pagada" y "Marcar procesado" para referido confirmado sin pagar; cada botón llama al handler correcto con el id del referido; badges "Pagada" y "Procesado" reemplazan a los botones cuando ya están marcados; tab "Vendedores" muestra mensaje vacío si no hay sellers; tab "Vendedores" muestra nombre, código y stats del seller; llamadas a `fetchSellers()` y `fetchReferidos()` en el montaje inicial del panel admin.

> **Atención al agregar un nuevo módulo:** este archivo debe actualizarse manualmente. Los objetos de prefs y restricciones esperados deben incluir la nueva clave, y cualquier mock de respuesta del endpoint `/api/modules/prefs` también debe incluirla — el hook valida que **todos** los módulos registrados en `MODULES` estén presentes en la respuesta, y si falta uno el test fallará silenciosamente (los prefs no se actualizan y se mantiene el valor por defecto). Los módulos actualmente registrados son: `calendario`, `personal`, `sueldos`, `compras` y `facturacion`.

### 2. Ejecutar tests en modo watch

```bash
npm run test:watch
```

Que verifica:
- Ejecuta la misma suite de Vitest en modo interactivo.
- Sirve para desarrollo mientras vas cambiando codigo.

### 3. Ejecutar tests con cobertura

```bash
npm run test:coverage
```

Que verifica:
- Ejecuta la suite de Vitest y genera reporte de cobertura.
- Sirve para ver que partes del codigo ya estan cubiertas y cuales faltan.

Estado actual:
- Con `npm install`, este comando ya funciona sin instalar dependencias adicionales manualmente.
- Cobertura global: **40.34% statements / 42.73% branches / 50.80% funciones / 40.63% líneas** (medido con V8; el porcentaje bajo lo arrastra `src/worker/index.ts` en 21.53%, que no tiene tests de integración directos).
- Módulos con cobertura 100% statements: `functions/[[route]].ts`, `src/cron/index.ts`, `src/worker/validation.ts`, `src/worker/rateLimitAuth.ts`, `src/worker/geminiCache.ts`, `src/worker/salaryHelpers.ts`, `useSalaries.ts`, `useSellers.ts`, `useSuscripcion.ts`, `useChat.ts`, `api.ts`, `utils.ts`, `UsageBanner.tsx`, `ProtectedRoute.tsx`, `AuthCallback.tsx`, `Dashboard.tsx`, `ChatContext.tsx` y todos los componentes UI.
- Módulos sin cobertura: `useAdmin.ts` (0%), `AuthContext.tsx` (1.88%). Cobertura parcial: `src/worker/index.ts` (21.53%), `EmployeeModal.tsx` (26.47%), `Employees.tsx` (48.42%), `Settings.tsx` (32.98%), `Admin.tsx` (59.35%), `Compras.tsx` (75.3%), `Facturacion.tsx` (75%), `Salaries.tsx` (76.27% statements / 79.41% branches), `Sellers.tsx` (90.47% statements).
- `useSuscripcion.ts` cubre 100% statements y 88.23% branches; las ramas no cubiertas son fallbacks `?? null` en líneas 58, 96, 111 y 129.

### 4. Ejecutar el linter

```bash
npm run lint
```

Que verifica:
- Reglas ESLint para TypeScript y React.
- Detecta problemas de calidad, patrones invalidos y errores comunes de hooks.

### 5. Ejecutar el build

```bash
npm run build
```

Que verifica:
- Typecheck con TypeScript.
- Build de produccion con Vite.
- Detecta errores de compilacion antes de publicar.

### 6. Ejecutar el check completo

```bash
npm run check
```

Que verifica:
- Compilacion TypeScript.
- Build de Vite.
- Dry-run de deploy con Wrangler para detectar problemas de configuracion o despliegue.

### 7. Buscar codigo sin usar

```bash
npm run knip
```

Que verifica:
- Detecta archivos, exports o dependencias sin uso.
- Sirve como chequeo complementario de mantenimiento.

## Nota sobre E2E

Actualmente el proyecto no tiene Playwright ni tests end-to-end configurados. Hoy la validacion automatica del repo se apoya en Vitest, ESLint, TypeScript, Vite, Wrangler dry-run y Knip.

## Resumen

Orden recomendado para validar rapido:

```bash
npm test
npm run lint
npm run build
```

Antes de desplegar:

```bash
npm run check
```

Chequeo adicional de mantenimiento:

```bash
npm run knip
```