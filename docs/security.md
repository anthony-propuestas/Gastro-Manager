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

El cliente envía un array `history` con los turnos previos de la conversación. El servidor lo recibe y lo inyecta en el prompt de Gemini como historial multi-turno. Mitigaciones aplicadas:

- El array se corta a los últimos **20 ítems** (`slice(-20)`) antes de procesarlo, evitando que un cliente infle el payload para agotar tokens de la API.
- El campo `message` se valida como string no vacío.
- `history` se valida como array.

Cada ítem de `history` se valida con `chatHistoryItemSchema` (Zod): `role` debe ser `"user" | "model"` y `content` tiene un máximo de 2000 caracteres. El mensaje entrante también está limitado a 2000 caracteres server-side.

### Prompt injection via historial

Un usuario autenticado puede craftear ítems en `history` para intentar manipular el comportamiento del modelo (ej. inyectar un turno `role: "model"` con instrucciones falsas). Esto es **autocontenido**: el contexto del negocio lo controla el servidor, y el historial manipulado solo afecta la respuesta que el propio atacante recibe. No hay acceso a datos de otros negocios.

### Caché de contexto (`chat_context_cache`)

- La clave es `(user_id, negocio_id)`: el contexto de un usuario no puede cruzarse con el de otro.
- El contexto se genera **después** de que `negocioMiddleware` valida la membresía, por lo que los datos almacenados ya están autorizados.
- **Staleness:** si un miembro es expulsado del negocio, su caché puede contener datos del negocio por hasta **30 minutos** hasta que expire. Riesgo bajo dado que el acceso a la API ya estará bloqueado por `negocioMiddleware` en el momento de la expulsión.

---

## Validación de entrada

- Todas las entradas del cliente se validan con **Zod** en el servidor antes de escribir en DB. Los schemas están centralizados en `src/worker/validation.ts` y tienen cobertura de tests al 100%.
- El backend nunca confía en datos del cliente sin validar: tipos, rangos de monto, formatos de fecha/hora y campos requeridos se comprueban en cada endpoint.
- El array `history` del chatbot se acota a 20 ítems server-side y cada ítem se valida con Zod (`role: "user"|"model"`, `content` máx. 2000 chars).

---

## Almacenamiento de archivos

- Los comprobantes de compras se suben a **Cloudflare R2** con una clave generada por el servidor (UUID). El cliente nunca controla el nombre del archivo en el bucket.
- Los archivos se sirven a través de URLs firmadas o con rutas internas; no hay exposición directa del bucket.

---

## Variables de entorno sensibles

| Variable | Uso |
|---|---|
| `JWT_SECRET` | Firma de sesiones JWT. Nunca expuesta al cliente. |
| `GOOGLE_CLIENT_SECRET` | Intercambio OAuth. Solo en el Worker. |
| `GEMINI_API_KEY` | Llamadas a la API de Gemini. Solo en el Worker. |
| `INITIAL_ADMIN_EMAIL` | Email del primer admin. No se incluye en el bundle del cliente. |

Ninguna variable sensible se incluye en el build del frontend (Vite). El Worker las lee de los secretos de Cloudflare.

---

## Tests de seguridad relevantes

- `src/react-app/lib/api.test.ts`: verifica que `apiFetch` emita `USAGE_LIMIT_EVENT` ante `429 USAGE_LIMIT_EXCEEDED` y que agregue `X-Negocio-ID` correctamente.
- `src/react-app/context/UsageLimitModalContext.test.tsx`: verifica que el modal de upgrade se active ante el evento global y no pueda ser ignorado.
- `src/react-app/components/auth/ProtectedRoute.test.tsx`: verifica redirecciones para usuarios no autenticados.
- `src/worker/validation.test.ts`: verifica que los schemas Zod rechacen entradas inválidas en todos los módulos. Incluye 8 casos para `chatHistoryItemSchema` y `chatHistoryArraySchema`: acepta roles válidos (`user`/`model`) y content dentro del límite; rechaza roles arbitrarios, content vacío y content > 2000 chars. Incluye 5 casos para los nuevos campos de salida del empleado: acepta valores válidos y null; rechaza `sueldo_pendiente` negativo tanto en create como en update.
- `src/react-app/components/employees/EmployeeModal.test.tsx`: verifica que los campos de salida solo se muestran cuando el empleado está inactivo y que se pre-rellenan correctamente al editar.
- `src/react-app/pages/Admin.test.tsx`: verifica que la tarjeta "Usuarios Registrados" muestre `totalUsers` correctamente y que las tarjetas eliminadas (`registeredEmails`, `avgEmployees`, `avgEvents`) ya no estén presentes en el DOM.

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
| Agotamiento de tokens de Gemini vía history largo | `history` cortado a 20 ítems server-side; cada ítem validado (role + longitud) |
| Rate limiting en endpoints de auth (`/api/auth/*`) | No implementado — pendiente agregar a nivel IP en el Worker |
| Datos de negocio en caché tras expulsión de miembro | Caché expira en 30 min; acceso a la API ya bloqueado por `negocioMiddleware` desde el momento de la expulsión |
| XSS | React escapa por defecto; no se usa `dangerouslySetInnerHTML` |
| CSRF | Cookies `HttpOnly` + validación de origen en el Worker |
