# Costos de Infraestructura — Análisis de Consumo por Escala

## Contexto

Este documento estima el consumo real de recursos de infraestructura según el plan y nivel de uso de cada cliente. El objetivo es validar la sostenibilidad del precio de **ARS 15.000/mes** (`usuario_inteligente`) frente a los costos reales de servir distintos perfiles de usuario.

Los datos se derivan de la arquitectura actual: Cloudflare Pages (frontend) + Workers (API) + D1 (base de datos) + R2 (archivos), Google Gemini 2.5 Flash, Resend y MercadoPago.

---

## Perfil de uso

### `usuario_inteligente` — Alto uso (sin límites)

| Acción | Cant./mes |
|--------|-----------|
| Empleados registrados | 50 |
| Pagos de sueldo | 50 |
| Adelantos | 100 |
| Facturas (`facturacion`) | 500 |
| Compras (`compras`) | 100 |
| Preguntas a Gemini (`chat`) | 1.000 |
| Eventos | 50 |
| Horas conectado | ~90 hs (3 hs/día) |

### `usuario_basico` — Uso completo del free tier

Límites definidos en `migrations/10.sql` y `migrations/16.sql`:

| Herramienta | Límite mensual |
|-------------|---------------|
| `employees` | 5 |
| `job_roles` | 3 |
| `topics` | 10 |
| `notes` | 20 |
| `advances` | 10 |
| `salary_payments` | 10 |
| `events` | 15 |
| `chat` (Gemini) | 20 |
| `compras` | 50 |
| `facturacion` | 50 |
| **Total acciones/mes** | **193 writes** |

---

## Consumo por usuario (estimación mensual)

| Recurso | `usuario_inteligente` | `usuario_basico` |
|---------|-----------------------|-----------------|
| Workers requests | ~10.000 | ~1.000 |
| D1 reads | ~26.000 | ~2.500 |
| D1 writes | ~1.800 | ~193 |
| R2 nuevos archivos | ~100 imgs × 500KB = **50 MB** | ~15 imgs × 300KB = **4,5 MB** |
| Gemini queries | 1.000 | 20 |
| Gemini input tokens | ~3.000.000 (3.000/query) | ~60.000 (3.000/query) |
| Gemini output tokens | ~500.000 (500 max/query) | ~10.000 |

> El contexto de cada query a Gemini incluye: system prompt + datos del negocio (empleados, eventos, últimas facturas) + pregunta del usuario. Se estima ~3.000 tokens de entrada por query como promedio conservador. El output está limitado a `max_tokens: 500` en el código (`src/worker/index.ts`).

---

## Escala: 100 inteligentes + 500 básicos

### Cloudflare Workers (API requests)

| Segmento | Requests/mes | Requests/día (prom.) |
|----------|-------------|---------------------|
| 100 inteligentes | 1.000.000 | 33.333 |
| 500 básicos | 500.000 | 16.667 |
| **Total** | **1.500.000** | **50.000** |

**Free tier:** 100.000 req/día
**Uso:** 50% del límite → ✅ Dentro del free tier
**Punto de quiebre:** ~1.200 usuarios con la misma proporción (2× la base actual)

### Cloudflare D1 (base de datos)

| Segmento | Reads/mes | Writes/mes |
|----------|-----------|------------|
| 100 inteligentes | 2.600.000 | 180.000 |
| 500 básicos | 1.250.000 | 96.500 |
| **Total** | **3.850.000** | **276.500** |
| **Promedio diario** | **128.333** | **9.217** |

**Free tier reads:** 5.000.000/día → Uso: 2,6% → ✅ Ampliamente dentro
**Free tier writes:** 100.000/día → Uso: 9,2% → ✅ Dentro del free tier
**Punto de quiebre D1:** ~38× la escala actual → No es una preocupación a corto plazo

### Cloudflare R2 (almacenamiento de recibos)

| Segmento | Nuevos archivos/mes | Tamaño nuevo/mes |
|----------|--------------------|--------------------|
| 100 inteligentes | 10.000 imgs | ~5.000 MB (5 GB) |
| 500 básicos | 7.500 imgs | ~2.250 MB (2,25 GB) |
| **Total mensual nuevo** | **17.500 imgs** | **~7,25 GB** |

**Free tier storage:** 10 GB (acumulativo)
**Free tier ops (Class A - escritura):** 1.000.000/mes → 17.500 ops → ✅ OK

**⚠️ Advertencia de storage acumulativo:**

| Mes | Storage total acumulado | ¿Excede free tier? | Costo extra/mes |
|-----|------------------------|-------------------|-----------------|
| 1 | ~7,25 GB | ✅ No | $0 |
| 2 | ~14,5 GB | ❌ Sí (+4,5 GB) | ~$0,07 |
| 6 | ~43,5 GB | ❌ Sí (+33,5 GB) | ~$0,50 |
| 12 | ~87 GB | ❌ Sí (+77 GB) | ~$1,16 |

> R2 cobra **$0,015 por GB/mes** sobre los primeros 10 GB gratuitos. El impacto es negligible pero crece linealmente. **Acción recomendada:** implementar limpieza automática de recibos con más de 12 meses (o dejar que el usuario los elimine manualmente).

### Google Gemini 2.5 Flash

| Segmento | Queries/mes | Input tokens | Output tokens |
|----------|-------------|-------------|---------------|
| 100 inteligentes | 100.000 | 300.000.000 (300M) | 50.000.000 (50M) |
| 500 básicos | 10.000 | 30.000.000 (30M) | 5.000.000 (5M) |
| **Total** | **110.000** | **330M** | **55M** |

**Gemini free tier:** 1.500 req/día = ~45.000/mes
**Uso:** 110.000/mes ≈ **3.667/día** → ❌ Excede el free tier
> La API de Gemini **debe estar en plan pago** ya desde los primeros usuarios inteligentes activos.

**Costo Gemini 2.5 Flash (plan pago):**
- Input: 330M tokens × $0,15/M = **$49,50**
- Output: 55M tokens × $0,60/M = **$33,00**
- **Subtotal Gemini: $82,50/mes**

### Cloudflare Pages (frontend hosting)

| Métrica | Valor | Free tier | Estado |
|---------|-------|-----------|--------|
| Builds/mes | ~10-20 (deploys) | 500/mes | ✅ OK |
| Requests al frontend | ilimitadas | Ilimitadas | ✅ OK |
| Bandwidth | ilimitado | Ilimitado | ✅ OK |

> Cloudflare Pages **no cobra por requests ni bandwidth**. El frontend (HTML, JS, CSS, assets) se sirve desde la CDN edge de Cloudflare sin costo adicional. Costo: **$0,00**.

### Resend (emails de verificación)

- Estimado: ~30-50 nuevos registros/mes
- Free tier: 3.000 emails/mes → ✅ Dentro del free tier

### MercadoPago (comisión de procesamiento)

- Comisión estimada: 1-3% según método de pago
- Sobre 1.500.000 ARS/mes (100 suscripciones): ~15.000-45.000 ARS (~$15-$45 USD)

---

## Resumen de costos totales

### Costos de infraestructura (100 inteligentes + 500 básicos)

| Servicio | Costo/mes |
|----------|-----------|
| Cloudflare Pages | $0,00 ✅ |
| Cloudflare Workers | $0,00 ✅ |
| Cloudflare D1 | $0,00 ✅ |
| Cloudflare R2 (storage acumulativo) | $0 → $1,16 ⚠️ |
| Google Gemini 2.5 Flash | **$82,50** |
| Resend | $0,00 ✅ |
| MercadoPago comisión | ~$15-$45 |
| **TOTAL INFRA** | **~$98-$130 USD/mes** |

### Ingresos vs costos

| Concepto | Valor/mes |
|----------|-----------|
| Ingresos (100 × ARS 15.000) | ARS 1.500.000 ≈ **$1.500 USD** |
| Costos de infraestructura | **~$100-$130 USD** |
| **Margen bruto** | **~$1.370-$1.400 USD (~92%)** |

> Los 500 usuarios básicos no generan ingreso directo. Su costo es ~$7,50 en Gemini/mes, el resto entra en los free tiers de Cloudflare. Son mayormente gratuitos de servir.

---

## Puntos de quiebre por servicio

| Servicio | Free tier actual | Uso actual (600 users) | Se excede al llegar a... |
|----------|-----------------|----------------------|--------------------------|
| **Workers** | 100.000 req/día | 50.000/día (50%) | ~1.200 usuarios (2×) |
| **D1 reads** | 5.000.000 filas/día | 128.333/día (2,6%) | ~23.000 usuarios (38×) |
| **D1 writes** | 100.000/día | 9.217/día (9,2%) | ~6.500 usuarios (10×) |
| **R2 storage** | 10 GB total | Mes 2+ ya excede | Desde el mes 2 (mínimo) |
| **Gemini API free** | 1.500 req/día | 3.667/día | ❌ Ya excedido |

---

## Cuello de botella real: Gemini

Es el **único costo que escala significativamente**. Si no hay límite en el plan inteligente:

| Usuarios inteligentes | Queries Gemini/mes | Costo Gemini/mes | Margen aprox. |
|----------------------|-------------------|-----------------|--------------|
| 10 | 10.000 | $8,25 | 99% |
| 50 | 50.000 | $41,25 | 96% |
| 100 | 100.000 | $75,00 | 94% |
| 500 | 500.000 | $375,00 | 91% |
| 1.000 | 1.000.000 | $750,00 | 89% |

> El margen se mantiene saludable incluso a escala alta. Sin embargo, si un usuario abusa del chat (ej. 10.000 queries/mes), ese usuario solo cuesta $7,50 en Gemini — sigue siendo rentable.

**Acción opcional:** Agregar un cap de ~5.000 queries/mes por negocio para `usuario_inteligente` para protegerse de edge cases (bots, scraping). El sistema ya tiene la infraestructura de conteo en `usage_counters` — solo faltaría no excluir `chat` del check para usuarios pagos.

---

## Notas de arquitectura relevantes

- **Conteo de uso:** `src/worker/usageTools.ts` define las herramientas; el middleware `createUsageLimitMiddleware` incrementa y verifica en cada write. Para `usuario_inteligente`, la verificación se saltea completamente.
- **Contexto Gemini por query:** el endpoint `POST /api/chat` hace ~6 queries a D1 antes de llamar a Gemini para armar el contexto del negocio (empleados, eventos, temas, adelantos, sueldos). Esto explica el alto ratio de D1 reads por query de chat.
- **Gemini context caching activo:** el system prompt + datos del negocio se cachean en la API de Gemini con TTL de 2 horas (`cachedContent`). El cache name se persiste en `chat_context_cache` (columnas `gemini_cache_name` / `gemini_cache_expires_at`, migración 25). Queries en la misma sesión reutilizan el cache, reduciendo input tokens en ~60-75%.
- **R2 y ciclo de vida:** actualmente no hay TTL ni limpieza automática de recibos. Agregar un job de limpieza (o política de retención configurable por negocio) evitaría el crecimiento lineal del storage.

---

## Checklist de reducción de costos

Ordenada por **impacto en costo / esfuerzo de implementación**.

### Gemini (mayor impacto — $82,50/mes)

- [x] **Activar Gemini context caching** ✅ — implementado en `src/worker/geminiCache.ts` con TTL de 2 horas (7200s). El cache name se persiste en D1 (`chat_context_cache`, migración 25); `src/worker/index.ts:2990-3022` lo usa como `cachedContent` en cada llamada a Gemini. Queries en la misma sesión omiten el envío del contexto completo, reduciendo input tokens en ~60-75%. Impacto estimado: **-$40 a -$60/mes** a 100 usuarios inteligentes. Fallback transparente a contexto completo si la API de Gemini falla.

- [x] **Cap de queries Gemini para `usuario_inteligente`** ✅ — implementado mediante `incrementAndCheckInteligenteLimit` (`src/worker/usageLimit.ts`) e integrado en `createUsageLimitMiddleware` (`src/worker/index.ts`). Cap de 3.000 queries/mes por `(user_id, negocio_id)`. Usa el mismo patrón atomic increment + revert que `usuario_basico`; responde 429 `USAGE_LIMIT_EXCEEDED` al superarlo. Otros tools del plan inteligente no se ven afectados.
  - Impacto estimado: protección ante edge cases, no reducción en uso normal.

- [x] **Reducir tokens de contexto por query** ✅ — implementado en `src/worker/index.ts` (~línea 2910). Employees: `ORDER BY is_active DESC, id DESC LIMIT 30` (activos primero, máx 30 total). Topics: `ORDER BY due_date ASC LIMIT 15` (más urgentes primero). Events: `ORDER BY event_date ASC LIMIT 20`. Impacto estimado: **-20 a -40% en input tokens** en negocios con datos históricos acumulados.

- [ ] **Truncar historial del chat en sesión** — si el frontend envía toda la conversación en cada mensaje, el context crece con cada turn. Limitar a los últimos 4-5 mensajes del hilo. Revisar cómo se pasa `messages` al endpoint.


### R2 (impacto bajo pero creciente)

- [ ] **Comprimir imágenes antes de subir a R2** — redimensionar y comprimir recibos en el cliente (WebP, calidad 70%) antes del upload. Un recibo de 500KB puede bajar a ~80-120KB sin pérdida visible. Impacto: reduce el storage acumulativo en ~75%.
  - Librería sugerida: `browser-image-compression` (sin dependencias de servidor).

- [ ] **Política de retención de recibos** — agregar un campo `expires_at` en la tabla `compras` y un Cloudflare Cron Trigger que borre archivos R2 con más de 13 meses. Mantiene el storage acumulativo estable en vez de crecer indefinidamente.
  - Cron Workers en Cloudflare son gratuitos (incluidos en el plan Workers).

- [ ] **Eliminar archivos R2 huérfanos** — cuando se borra una compra desde la app, verificar que también se elimine el objeto R2 asociado. Evita acumulación de storage sin referencia en DB.

### Cloudflare Workers (impacto bajo a escala actual)

- [ ] **Cachear respuestas de listas frecuentes con KV** — endpoints de solo lectura frecuentes (lista de empleados, eventos del mes) podrían cachearse en Cloudflare KV con TTL de 60 segundos. Reduce D1 reads y tiempo de respuesta.
  - KV free tier: 100.000 lecturas/día, 1.000 escrituras/día — suficiente para esta escala.
  - Solo aplicar a rutas GET que no cambien por cada request.

- [ ] **Batching de queries D1 en el endpoint `/api/chat`** — actualmente hace ~6 queries secuenciales para armar el contexto. Usar `db.batch([...])` de D1 para ejecutarlas en paralelo. No reduce el número de reads pero sí la latencia y el CPU time del Worker (que tiene límite de 10ms en free tier).

### MercadoPago (impacto medio)

- [ ] **Incentivar pago por transferencia/CBU** — la comisión de MP varía: ~0,79% para débito/transferencia vs ~4,99% para tarjeta de crédito. Si el flujo de pago actual no sugiere el método más barato, agregar un banner explicando el ahorro. A 100 usuarios, la diferencia puede ser **$30 USD/mes** en comisiones.

### Monitoreo (impacto indirecto)

- [ ] **Agregar logging de tokens Gemini por negocio** — loguear `usage_metadata.prompt_token_count` y `candidates_token_count` que devuelve la API de Gemini en cada respuesta. Guardar en D1 o en un log de Analytics Engine (gratuito en Cloudflare) para detectar negocios con consumo anómalo antes de que impacten la factura mensual.

- [ ] **Alerta de uso > 80% del cap Gemini** — si se implementa el cap, enviar un email (Resend) o una notificación in-app cuando el negocio supere el 80% de su cuota mensual de chat. Evita sorpresas y mejora la experiencia.
