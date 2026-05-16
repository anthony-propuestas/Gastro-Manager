# Seguridad

Este documento describe las capas de seguridad implementadas en Gastro Manager y las decisiones de diseño que las respaldan.

---

## Autenticación

- **Google OAuth 2.0** — no se almacenan contraseñas. El flujo completo pasa por Google; el backend solo intercambia el código por tokens y verifica la identidad.
- **JWT firmado** — tras autenticar con Google, el backend emite un JWT firmado con `JWT_SECRET` (TTL: 7 días) y lo devuelve como cookie `HttpOnly`. Cada request subsiguiente incluye esta cookie automáticamente sin exposición en JavaScript.
- **Rol leído de DB en cada request** — el campo `role` del usuario no se lee del JWT sino de la tabla `users` en cada llamada. Esto garantiza que una promoción o degradación de rol tenga efecto inmediato sin necesidad de re-login ni de invalidar tokens.

---

## Autorización

### Acceso a endpoints

Todos los endpoints de datos están protegidos por `authMiddleware`, que:
1. Verifica la firma y expiración del JWT.
2. Consulta el usuario en DB y adjunta `user` al contexto de la request.
3. Rechaza con `401` si el token es inválido o el usuario no existe.

### Panel de administración

El acceso al panel `/admin` y a todos sus endpoints (`/api/admin/*`) requiere que el email del usuario esté en la tabla `admin_emails` **o** que coincida con `INITIAL_ADMIN_EMAIL` (variable de entorno). El helper `isAdmin()` comprueba ambas condiciones en cada request; no basta con tener un rol elevado.

### Aislamiento por negocio

Todos los datos de negocio (empleados, sueldos, eventos, compras, facturas) están particionados por `negocio_id`. El frontend envía el negocio activo en el header `X-Negocio-ID`. El backend valida que el usuario sea miembro del negocio declarado antes de procesar cualquier operación de lectura o escritura.

### Roles de negocio

Dentro de cada negocio los miembros tienen un rol de negocio (`owner` / `gerente`). El owner puede restringir módulos para gerentes. Las restricciones se leen de DB en cada request; no se cachean en el cliente.

---

## Cuotas y límites

- El middleware de cuotas usa un patrón **increment-then-revert atómico** sobre D1 (`INSERT … ON CONFLICT DO UPDATE … RETURNING count`). Esto garantiza que dos requests concurrentes no puedan exceder el límite simultáneamente (sin condición de carrera TOCTOU).
- Cuando el backend responde `429 USAGE_LIMIT_EXCEEDED`, `apiFetch` emite un evento global `USAGE_LIMIT_EVENT` que abre el modal de upgrade. El usuario nunca puede evadir el límite manipulando el cliente.

### Visualización de cuotas en el panel de administración

El panel de administración calcula el uso total del sistema con la fórmula:

```
límite_total = límite_por_usuario × cantidad_de_usuarios_básicos
porcentaje   = uso_total / límite_total
```

Los usuarios con rol `usuario_inteligente` se excluyen deliberadamente del denominador porque no están sujetos a cuotas. Incluirlos inflaría artificialmente el límite total y haría que el panel subestimara el agotamiento real de cuota para los usuarios básicos.

Esta lógica es la misma que aplica el middleware de cuotas en el backend: solo los usuarios básicos consumen cuota, por lo que el denominador en la visualización debe reflejar únicamente ese grupo.

### Conteo de usuarios registrados

El endpoint `/api/admin/stats` obtiene el total de usuarios con:

```sql
SELECT COUNT(*) FROM users
```

La tabla `users` tiene una restricción `UNIQUE` sobre `email` y almacena exactamente una fila por usuario autenticado, independientemente de cuántos negocios integre. Esto garantiza que el conteo no se infle por membresías múltiples. La consulta anterior usaba `negocio_members`, que puede contener múltiples filas por usuario (una por negocio), y producía un recuento mayor al real — lo que podría haber sido interpretado como mayor base de usuarios de la existente. El cambio a `users` hace que el dato mostrado en el panel refleje únicamente identidades únicas autenticadas.

---

## Chatbot (IA)

El endpoint `POST /api/chat` introduce una superficie adicional que merece atención específica.

### Historial enviado por el cliente

El cliente envía un array `history` con los turnos previos de la conversación. El servidor lo recibe y lo inyecta en el prompt de DeepSeek como historial multi-turno. Mitigaciones aplicadas:

- El array se corta a los últimos **5 ítems** (`slice(-5)`) antes de procesarlo, evitando que un cliente infle el payload para agotar tokens de la API.
- El campo `message` se valida como string no vacío.
- `history` se valida como array.

Cada ítem de `history` se valida con `chatHistoryItemSchema` (Zod): `role` debe ser `"user" | "assistant"` y `content` tiene un máximo de 2000 caracteres. El mensaje entrante también está limitado a 2000 caracteres server-side.

### Prompt injection via historial

Un usuario autenticado puede craftear ítems en `history` para intentar manipular el comportamiento del modelo (ej. inyectar un turno `role: "model"` con instrucciones falsas). Esto es **autocontenido**: el contexto del negocio lo controla el servidor, y el historial manipulado solo afecta la respuesta que el propio atacante recibe. No hay acceso a datos de otros negocios.

### Caché de contexto (`chat_context_cache`)

- La clave es `negocio_id`: el contexto es compartido por todos los miembros del negocio; no hay riesgo de cross-negocio.
- El contexto se genera **después** de que `negocioMiddleware` valida la membresía, por lo que los datos almacenados ya están autorizados.
- **Staleness:** si un miembro es expulsado del negocio, su caché puede contener datos del negocio por hasta **30 minutos** hasta que expire. Riesgo bajo dado que el acceso a la API ya estará bloqueado por `negocioMiddleware` en el momento de la expulsión.

### Enriquecimiento de contexto financiero (Balance / Gastos / Ventas)

Áreas revisadas:

- **Aislamiento por `negocio_id`**: las queries de `compras` y `facturas` filtran por `negocio_id = ?` y por `strftime('%Y-%m', fecha) = ?` — idéntico patrón que el resto de queries del contexto. No hay riesgo de cross-negocio.
- **filterContext**: la lógica condicional opera sobre líneas de texto ya construidas a partir de datos autorizados; no amplía el scope de acceso a DB ni expone datos de otros negocios.
- **filterContextByRestrictions**: filtra las líneas Balance/Gastos/Ventas del contexto según módulos restringidos del rol, antes de enviarlo al LLM. Un gerente con `compras` restringido no ve datos de Gastos en el contexto del chatbot; uno con `facturacion` restringido no ve Ventas; si ambos están restringidos se elimina también el Balance. El filtrado ocurre server-side antes del envío a DeepSeek; no depende de decisiones del cliente.
- **Chatbot / historial**: las líneas Balance/Gastos/Ventas son generadas server-side; no provienen del historial del cliente. Sin vector de inyección adicional.
- **Cuotas**: no hay nuevo endpoint ni nuevo consumo de cuota; el cambio está dentro del `rebuildContext` existente.

**Conclusión**: sin nuevo riesgo de seguridad. Los datos financieros en el contexto están correctamente particionados por `negocio_id` y su inclusión condicional (`filterContext`) no afecta el aislamiento.

---

## Validación de entrada

- Todas las entradas del cliente se validan con **Zod** en el servidor antes de escribir en DB. Los schemas están centralizados en `src/worker/validation.ts` y tienen cobertura de tests al 100%.
- El backend nunca confía en datos del cliente sin validar: tipos, rangos de monto, formatos de fecha/hora y campos requeridos se comprueban en cada endpoint.
- El array `history` del chatbot se acota a 5 ítems server-side (`slice(-5)`) y cada ítem se valida con Zod (`role: "user"|"assistant"`, `content` máx. 2000 chars).

---

## Almacenamiento de archivos

- Los comprobantes de compras se suben a **Cloudflare R2** con una clave generada por el servidor (UUID). El cliente nunca controla el nombre del archivo en el bucket.
- Los archivos se sirven a través de URLs firmadas o con rutas internas; no hay exposición directa del bucket.

---

## Cron Worker (`gastro-manager-cron`)

Áreas revisadas:

- **Endpoint nuevo o modificado**: El Worker de cron solo exporta `{ scheduled }` — no tiene ningún endpoint HTTP. No es alcanzable via requests de usuarios.
- **Autenticación / sesión**: No aplica. El handler `scheduled` lo invoca exclusivamente el scheduler de Cloudflare; no existe vector de acceso externo.
- **Aislamiento por `negocio_id`**: No aplica. La limpieza usa `expires_at` como criterio temporal, afectando filas de todos los negocios uniformemente. No hay cross-tenancy: solo se eliminan objetos R2 cuyos `comprobante_key` pertenecen a filas ya expiradas de `compras`.
- **Autorización / roles**: No aplica. No hay usuarios ni roles involucrados.
- **Validación de entrada**: No aplica. No recibe input externo.

**Conclusión**: sin superficie de ataque nueva. El Worker de cron accede a los mismos D1 y R2 que el Worker principal y ejecuta la misma lógica que antes existía en el `scheduled` handler del Worker principal. La separación no introduce ningún riesgo adicional.

---

## Sellers / Programa de Referidos

### Endpoints de usuario

- **`POST /api/sellers/activate`** y **`GET /api/sellers/me`** requieren JWT válido via `authMiddleware`. Sin JWT: 401. Cada endpoint filtra datos por el `user_id` extraído del token — no es posible acceder al perfil o referidos de otro vendedor.

### Validación de entrada

- El campo `ref_code` en `POST /api/suscripciones/crear` se valida con Zod: `min(1), max(20)`. Sin `ref_code`: flujo normal sin referido. Campo vacío o supera 20 chars: rechazado antes de tocar DB.

### Aislamiento por negocio_id

- **Sellers es una feature platform-level, no particionada por `negocio_id`.** Los vendedores y referidos son globales al usuario, independientes del negocio activo. Decisión de diseño intencional: el vínculo es entre usuarios, no entre negocios.

### Autorización / roles

- Los cuatro endpoints `/api/admin/sellers` y `/api/admin/referidos/*` (GET + dos PUT) verifican `isAdmin()` explícitamente antes de cualquier operación. Un usuario normal recibe 403.

### Prevención de auto-referido

- En `POST /api/suscripciones/crear`, el worker verifica que `seller.user_id !== currentUser.id`. Si coinciden, rechaza la operación con error antes de insertar el registro.

### Prevención de referido duplicado

- Constraint `UNIQUE(referido_user_id)` en la tabla `referidos` — un comprador solo puede ser referido una vez, a nivel de base de datos.

### Generación de código de vendedor

- Algoritmo con retry (hasta 5 intentos) ante colisión de `UNIQUE` en `vendedores.codigo`. El código es alfanumérico (~8 chars) con componente de timestamp. La colisión forzada via brute force requeriría conocer el espacio de claves activas, que no es un endpoint público.

---

## Suscripciones (MercadoPago)

### Webhook público `POST /api/webhooks/mercadopago`

Este endpoint es intencionalmente público (MercadoPago no envía credenciales de sesión). Protección implementada:

- **Firma HMAC verificada** via `verifyMPWebhook()`: si la firma en el header `x-signature` no coincide, el handler retorna `200` silencioso sin procesar el evento. Un atacante no puede activar cambios de estado (rol, suscripción) sin conocer el `MERCADO_PAGO_WEBHOOK_SECRET`.
- **Sin parseo de body directo**: el handler solo lee `c.req.query("type")` y `c.req.query("data.id")`. Query strings malformadas o con tipos no reconocidos resultan en no-ops.
- **Idempotente**: el INSERT de pagos usa `INSERT OR IGNORE` con `mp_payment_id` como clave; un mismo evento procesado dos veces no duplica registros.

### Error detail forwarding en `POST /api/suscripciones/crear`

En caso de error 502, la respuesta incluye `mp_detail` (mensaje de error de MercadoPago) y `mp_status` (código HTTP de MP). Análisis:

- Endpoint protegido por `authMiddleware` → solo usuarios autenticados reciben estos detalles.
- `mp_detail` proviene de la respuesta pública de la API de MP (mensajes como "Invalid credentials" o "Invalid value for preapproval_plan_id"), no de datos internos del sistema.
- Riesgo de info disclosure: bajo. El usuario solo recibe información sobre el fallo de su propia solicitud de suscripción.

### Aislamiento

Los endpoints de suscripción (`/api/suscripciones/*`) operan sobre `user_id` extraído del JWT, no sobre `negocio_id`. No hay riesgo de acceso cruzado entre negocios.

Los endpoints de admin (`/api/admin/suscripciones*`) verifican `isAdmin()` en cada request.

---

## Headers de seguridad HTTP

Los siguientes headers se aplican a todas las rutas via `public/_headers`:

| Header | Valor |
|---|---|
| `X-Content-Type-Options` | `nosniff` |
| `X-Frame-Options` | `DENY` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=()` |

Adicionalmente, `index.html` recibe un `Content-Security-Policy` que restringe scripts y conexiones al mismo origen, y `frame-ancestors 'none'` como refuerzo del `X-Frame-Options`.

**HSTS** debe activarse en el dashboard de Cloudflare → SSL/TLS → Edge Certificates → "Enable HSTS" (`max-age=31536000; includeSubDomains`).

## CORS explícito

El middleware `hono/cors` valida que el `Origin` de cada request a `/api/*` coincida con `APP_URL`. Requests con origen no autorizado no reciben el header `Access-Control-Allow-Origin`.

## Auditoría de eventos de autenticación

Los eventos `login_success` y `email_verify_success` se registran en `usage_logs` con `action_type` correspondiente y `negocio_id = null`, permitiendo auditar autenticaciones sin requerir contexto de negocio.

---

## Variables de entorno sensibles

| Variable | Uso |
|---|---|
| `JWT_SECRET` | Firma de sesiones JWT. Nunca expuesta al cliente. |
| `GOOGLE_CLIENT_SECRET` | Intercambio OAuth. Solo en el Worker. |
| `DEEPSEEK_API_KEY` | Llamadas a la API de DeepSeek. Solo en el Worker. |
| `INITIAL_ADMIN_EMAIL` | Email del primer admin. No se incluye en el bundle del cliente. |
| `MERCADO_PAGO_ACCESS_TOKEN` | Token de producción para llamadas a la API de MercadoPago. |
| `MERCADO_PAGO_ACCESS_TOKEN_TEST` | *(Opcional)* Token de prueba; si está presente, tiene precedencia sobre el de producción. |
| `MERCADO_PAGO_WEBHOOK_SECRET` | Clave HMAC para verificar la firma de los webhooks de MercadoPago. |
| `MERCADO_PAGO_PLAN_ID` | ID del plan de suscripción en MercadoPago. |
| `APP_URL` | *(Opcional)* URL base de la app; usada como `back_url` al crear suscripciones. |

Ninguna variable sensible se incluye en el build del frontend (Vite). El Worker las lee de los secretos de Cloudflare.

---

## Tests de seguridad relevantes

- `src/react-app/lib/api.test.ts`: verifica que `apiFetch` emita `USAGE_LIMIT_EVENT` ante `429 USAGE_LIMIT_EXCEEDED` y que agregue `X-Negocio-ID` correctamente.
- `src/react-app/context/UsageLimitModalContext.test.tsx`: verifica que el modal de upgrade se active ante el evento global y no pueda ser ignorado.
- `src/react-app/components/auth/ProtectedRoute.test.tsx`: verifica redirecciones para usuarios no autenticados (redirige a `/`, la landing pública) y para gerentes con módulo restringido (redirige a `/dashboard`).
- `src/worker/validation.test.ts`: verifica que los schemas Zod rechacen entradas inválidas en todos los módulos. Incluye 8 casos para `chatHistoryItemSchema` y `chatHistoryArraySchema`: acepta roles válidos (`user`/`assistant`) y content dentro del límite; rechaza roles arbitrarios, content vacío y content > 2000 chars. Incluye 5 casos para los campos de salida del empleado: acepta valores válidos y null; rechaza `sueldo_pendiente` negativo tanto en create como en update. Incluye casos para `crearSuscripcionSchema`: acepta `ref_code` ausente, string de 1-20 chars; rechaza string vacío y string de más de 20 chars.
- `src/react-app/components/employees/EmployeeModal.test.tsx`: verifica el control segmentado de estado y el formulario condicional de baja. Cubre que ambos botones se renderizan; selección por defecto; selección correcta al editar un empleado inactivo; que los campos de baja no aparecen en estado activo; que aparecen al seleccionar inactivo; visibilidad condicional de `cuando_informo` según el checkbox `informo`; ocultamiento al re-activar; pre-relleno de los 4 campos al editar un empleado inactivo; y que desmarcar `informo` limpia `cuando_informo`.
- `src/react-app/components/employees/EmployeeViewModal.test.tsx`: verifica que el modal de vista es de solo lectura (no expone acciones de escritura) y que no renderiza cuando `employee` es null.
- `src/react-app/pages/modulos/Employees.test.tsx`: verifica que el toggle de estado (activo/inactivo) llama a `updateEmployee` correctamente y que el clic en el botón de estado no abre el modal de vista (separación de intenciones).
- `src/react-app/pages/Admin.test.tsx`: verifica que la tarjeta "Usuarios Registrados" muestre `totalUsers` correctamente y que las tarjetas eliminadas (`registeredEmails`, `avgEmployees`, `avgEvents`) ya no estén presentes en el DOM.
- `src/react-app/components/ChatWidget.test.tsx` y `src/react-app/hooks/useChat.test.ts`: verifica que `triggerDailyGreeting` no envía mensajes en la primera visita ni antes de 8h de inactividad, y que el historial se corta a 5 items antes de enviarse al backend. **Áreas revisadas sin riesgo nuevo:** `triggerDailyGreeting` usa una clave localStorage particionada por `negocio_id` (no filtra datos entre negocios); `negocio_id` ya validado por `negocioMiddleware` en el backend. No aplica cambio en autenticación, autorización ni endpoints.

---

## Integridad de assets estáticos (SPA)

Vite genera archivos con hash en el nombre (ej. `index-BFSxencr.js`). Tras un redeploy, el browser puede tener un `index.html` viejo con hashes que ya no existen.

**Mitigaciones aplicadas:**

- `public/_headers`: `index.html` se sirve con `Cache-Control: no-cache, no-store, must-revalidate`. El browser siempre solicita el `index.html` fresco antes de cargar assets; tras un redeploy obtiene los nuevos hashes de inmediato. Los assets de `/assets/` reciben `Cache-Control: public, max-age=31536000, immutable` — cache agresivo seguro porque el hash en el nombre cambia con el contenido.
- `functions/[[route]].ts`: para rutas `/assets/*`, si el asset no existe en ASSETS, se devuelve `new Response('Not found', { status: 404, headers: { 'Cache-Control': 'no-store' } })` en lugar de la página HTML de Cloudflare. El `no-store` previene que tanto el browser como el CDN de Cloudflare cacheen la respuesta 404 — sin esto, una respuesta 404 queda cacheada hasta 4 horas y el browser la sirve `from disk cache` sin contactar el servidor, lo que perpetúa el error incluso después de un redeploy correcto.

**Áreas revisadas que no aplican:** endpoints de API, aislamiento por negocio, autenticación, autorización. El cambio es exclusivamente de routing de archivos estáticos sin lógica de datos.

---

## Superficie de ataque conocida y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Escalada de privilegios vía JWT manipulado | Rol leído de DB en cada request; JWT solo identifica al usuario |
| Acceso cruzado entre negocios | `negocio_id` validado en el servidor contra membresía del usuario |
| Exceder cuotas con requests concurrentes | Incremento atómico en D1 con RETURNING count |
| Inyección SQL | D1 con prepared statements en todos los endpoints |
| Campos de salida del empleado (`ausencia_desde`, `informo`, `cuando_informo`, `sueldo_pendiente`) | Solo modificables vía `PUT /api/employees/:id`, protegido por `authMiddleware` + `negocioMiddleware` + `createModuleRestrictionMiddleware('personal')`. El query sigue usando `WHERE id = ? AND negocio_id = ?` — no hay acceso cross-negocio. Los 4 campos se validan con Zod: tipos, rango de `sueldo_pendiente ≥ 0`, nullable permitido. |
| Prompt injection via `history` del chat | Autocontenido (solo afecta al atacante); contexto del negocio es server-controlled; ítems validados con `chatHistoryArraySchema` (role + longitud) |
| Agotamiento de tokens de DeepSeek vía history largo | `history` cortado a 5 ítems server-side (`slice(-5)`); cada ítem validado (role + longitud) |
| Rate limiting en endpoints de auth (`/api/auth/*`) | Implementado: `checkRateLimit()` en `POST /api/sessions` (10 req / 15 min por IP) y `GET /api/auth/verify-email` (5 req / 60 min por IP). IP hasheada con SHA-256. Tabla `rate_limit_auth` en D1. |
| Datos de negocio en caché tras expulsión de miembro | Caché expira en 30 min; acceso a la API ya bloqueado por `negocioMiddleware` desde el momento de la expulsión |
| Auto-referido en Sellers | Worker verifica `seller.user_id !== currentUser.id` antes de crear el registro |
| Referido duplicado en Sellers | Constraint `UNIQUE(referido_user_id)` en tabla `referidos` a nivel de base de datos |
| Acceso a endpoints admin de Sellers sin privilegios | `isAdmin()` verificado en los 4 endpoints `/api/admin/sellers` y `/api/admin/referidos/*` |
| XSS | React escapa por defecto; no se usa `dangerouslySetInnerHTML` |
| CSRF | Cookies `HttpOnly` + validación de origen en el Worker |

---

## Análisis de seguridad — Landing Page (routing refactor)

Áreas revisadas:

- **Endpoint nuevo o modificado**: No hay endpoints de API nuevos ni modificados. El cambio es exclusivamente frontend.
- **Autenticación / sesión**: `ProtectedRoute` sigue rechazando usuarios no autenticados; solo cambia el destino del redirect de `/login` a `/` (ambas son rutas públicas). No hay degradación de protección.
- **Autorización / roles**: `RestrictedModuleRoute` sigue bloqueando gerentes con módulos restringidos; redirect actualizado de `/` a `/dashboard` (ruta protegida, lo que es más correcto que antes).
- **Validación de entrada**: No aplica; LandingPage no recibe input del servidor ni envía datos sensibles.
- **Aislamiento por negocio_id**: No aplica; LandingPage es pública y no accede a datos de negocio.

**Conclusión**: sin riesgo de seguridad. El cambio reduce una ambigüedad anterior (el redirect de módulo restringido apuntaba a `/`, que era la vista protegida; ahora apunta a `/dashboard` explícitamente).

---

## Análisis de seguridad — AuthCallback: window.location.assign vs navigate

Áreas revisadas:

- **Autenticación / sesión**: El cambio reemplaza `navigate("/", { replace: true })` (navegación SPA client-side) por `window.location.assign("/dashboard")` (recarga completa). La motivación es corregir una race condition: `AuthContext` hace `GET /api/users/me` al montar, antes de que exista sesión; con navegación SPA el contexto ya resuelto tenía `user = null` y la LandingPage volvía a mostrarse. La cookie `session_token` la setea el servidor en `POST /api/sessions`; el cambio no altera cómo se crea ni transmite la cookie.
- **Endpoint nuevo o modificado**: No hay cambios en endpoints. Solo cambia el comportamiento post-callback en el cliente.
- **Autorización / roles**: `ProtectedRoute` sigue protegiendo `/dashboard`; si la cookie es inválida o inexistente, `authMiddleware` responde `401` y el cliente redirige a `/`.
- **Validación de entrada**: No aplica. `AuthCallback` no procesa inputs del usuario directamente.
- **Aislamiento por `negocio_id`**: No aplica. El callback no accede a datos de negocio.

**Conclusión**: sin riesgo de seguridad. El reload completo es una práctica estándar tras OAuth y elimina una clase de bug de estado stale sin exponer ninguna superficie nueva.

---

## Revisión — Refactor frontend ChatContext + renombre /agente-ia (2026-05-14)

Áreas revisadas:

- **ChatContext nuevo**: `ChatProvider` encapsula `useChat()` existente y lo comparte entre `Dashboard` y `ChatWidget`. No hay nueva superficie de red; el mismo endpoint `POST /api/chat` con las mismas validaciones Zod y la misma autenticación por JWT/cookie. Sin impacto en seguridad.
- **Chatbot / historial**: el historial sigue truncado a 5 ítems antes de enviarlo a DeepSeek. El nuevo context solo reorganiza el estado en React; no modifica cómo se construye ni se envía el payload.
- **Autenticación / sesión**: `ProtectedRoute` y `AuthCallback` solo cambiaron la ruta de redirect post-auth (`/dashboard` → `/agente-ia`). El contrato de seguridad es idéntico: la cookie `session_token` sigue siendo validada por `authMiddleware` en cada request; el reload completo de `AuthCallback` no fue modificado.
- **Autorización / roles**: `OwnerPanel` y `RestrictedModuleRoute` siguen redirigiendo a `/agente-ia` (antes `/dashboard`) sin cambios en la lógica de verificación de roles.
- **Suscripcion.tsx / SuscripcionEstado.tsx**: solo consumen el hook `useSuscripcion()` ya existente; no agregan endpoints ni modifican el flujo de webhook de MercadoPago documentado arriba.

**Conclusión**: sin nuevo riesgo de seguridad. Los cambios son de organización de estado React y renombrado de rutas frontend.
