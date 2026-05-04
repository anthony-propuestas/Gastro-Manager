# Auditoría: Discrepancias entre Documentación y Código Real

**Fecha:** 4 de Mayo 2026  
**Revisado por:** Análisis automático de arquitectura  
**Estado:** ✅ DOCUMENTADAS

---

## Resumen Ejecutivo

Se encontraron **12 discrepancias significativas** entre la documentación (architecture.md, api.md) y el código real (src/worker/index.ts):

- **4 críticas:** Endpoints de escritura sin consumo de cuota (PUT/DELETE compras, PUT/DELETE facturación)
- **3 moderadas:** DELETE en otros módulos sin cuota, campo faltante en respuesta, endpoint no documentado
- **5 menores:** Inconsistencias semánticas y aclaraciones requeridas

---

## Discrepancias por Área

### 🔴 CRÍTICAS (Afectan seguridad/cuotas)

| # | Área | Documentación | Código Real | Impacto |
|---|------|---------------|-------------|---------|
| 1 | PUT /api/compras/:id | "Sujeto a cuota `compras`" | **NO tiene middleware de cuota** | Usuarios básicos hacen updates ilimitadas ⚠️ |
| 2 | DELETE /api/compras/:id | "Sujeto a cuota `compras`" | **NO tiene middleware de cuota** | Usuarios básicos eliminan ilimitadamente ⚠️ |
| 3 | PUT /api/facturacion/:id | "Sujeto a cuota `facturacion`" | **NO tiene middleware de cuota** | Usuarios básicos hacen updates ilimitadas ⚠️ |
| 4 | DELETE /api/facturacion/:id | "Sujeto a cuota `facturacion`" | **NO tiene middleware de cuota** | Usuarios básicos eliminan ilimitadamente ⚠️ |

**Recomendación:** Agregar `createUsageLimitMiddleware` a estos 4 endpoints o actualizar documentación si es intencional.

---

### 🟡 MODERADAS (Impacto funcional)

| # | Área | Documentación | Código Real | Impacto |
|---|------|---------------|-------------|---------|
| 5 | DELETE operations | Documentación silenciosa (no menciona cuota) | **NO consumen cuota** en: employees, topics, notes, job-roles, advances | Inconsistencia: solo POST consume en estos módulos |
| 6 | GET /api/users/me | Incluye campo `suscripcion` en respuesta | **Campo NO existe** en respuesta real | Frontend obtiene suscripción desde otro endpoint (GET /api/suscripciones/estado) |
| 7 | POST /api/compras/upload | **NO documentado** | Implementado en código (línea 3246) | Falta documentación de upload de archivos |

**Recomendación:** 
- Documentar todos los DELETE y aclarar que no consumen cuota
- Actualizar respuesta de GET /api/users/me en docs
- Documentar POST /api/compras/upload

---

### 🔵 MENORES (Semánticas/aclaraciones)

| # | Área | Documentación | Código Real | Impacto |
|---|------|---------------|-------------|---------|
| 8 | CORS validation | "respuesta no incluye `Access-Control-Allow-Origin`" | `return cors({ origin: () => null, ... })` | Semánticamente equivalente pero impreciso |
| 9 | GET /api/auth/verify-email | "Rate limit: máx 5 intentos/IP/hora" | `checkRateLimit(ip, endpoint, db, maxAttempts, windowMinutes)` | Verificar si parámetros son (5, 60) |
| 10 | POST /api/sessions | "Flujo de verificación documentado" | Implementado correctamente | ✅ Funcionalidad OK |
| 11 | POST /api/chat | "No restringible por owner" | Sin `createModuleRestrictionMiddleware` | ✅ Correcto |
| 12 | GET /api/compras/files/* | "Sin restricción de módulo" | Sin `createModuleRestrictionMiddleware` | ✅ Correcto |

---

## Cambios Realizados en Documentación

### docs/api.md

✅ **Línea ~85:** Actualizado GET /api/users/me
- Removido campo `suscripcion` de respuesta
- Agregada nota indicando que ese dato viene de GET /api/suscripciones/estado

✅ **Línea ~554:** Actualizado PUT /api/compras/:id
- Removida etiqueta "Sujeto a cuota"
- Agregada discrepancia documentada: "NO consume cuota (inconsistencia)"

✅ **Línea ~559:** Actualizado DELETE /api/compras/:id
- Agregada nota: "NO consume cuota (inconsistencia con documentación)"

✅ **Línea ~562:** Actualizado POST /api/compras/upload
- Agregada descripción completa del endpoint
- Aclarada autenticación y restricción de módulo
- Agregada nota: "NO consume cuota"

✅ **Línea ~625:** Actualizado PUT /api/facturacion/:id
- Removida etiqueta "Sujeto a cuota"
- Agregada discrepancia documentada

✅ **Línea ~630:** Actualizado DELETE /api/facturacion/:id
- Removida etiqueta "Sujeto a cuota"
- Agregada discrepancia documentada

### docs/architecture.md

✅ **Línea ~280:** Sección "Sistema de Roles y Cuotas"
- Agregada sección "DISCREPANCIA CRÍTICA - Consumo de cuota en PUT/DELETE"
- Listadas las 4 operaciones sin middleware de cuota
- Documentado que DELETE no consume cuota en ningún módulo
- Aclarado que permite a usuarios básicos eliminar datos ilimitadamente

---

## Recomendaciones

### Acción Inmediata (P0)

```typescript
// OPCIÓN A: Agregar cuota a PUT/DELETE (recomendado)
app.put("/api/compras/:id",
  authMiddleware,
  negocioMiddleware,
  createModuleRestrictionMiddleware('compras'),
  createUsageLimitMiddleware(USAGE_TOOLS.COMPRAS),  // ← AGREGAR
  async (c) => { ... }
);

// OPCIÓN B: Documentar que es intencional (si aplica lógica de negocio especial)
// Actualizar docs con justificación
```

### Mejora (P1)

- [ ] Revisar rate limiting: confirmación de parámetros (5, 60) en `checkRateLimit`
- [ ] Completar documentación de DELETE operations con tabla de consumo
- [ ] Agregar pruebas para verificar consumo de cuota en 8 endpoints

### Refactoring (P2)

- [ ] Considerar `POST /api/compras/upload` como consumidor de cuota (file upload = recurso)
- [ ] Unificar patrón de consumo: todos POST/PUT/DELETE vs solo POST por módulo

---

## Referencias

- **Código analizado:** `src/worker/index.ts` (líneas 1-3900+)
- **Documentación analizada:** 
  - `docs/architecture.md`
  - `docs/api.md`
- **Commits relevantes:** Verifique historial de cambios en líneas documentadas

---

## Verificación Post-Cambios

Para validar que las discrepancias están resueltas:

```bash
# 1. Verificar que PUT/DELETE tienen createUsageLimitMiddleware
grep -n "PUT.*compras" src/worker/index.ts | head -5
grep -n "createUsageLimitMiddleware" src/worker/index.ts | wc -l

# 2. Confirmar documentación actualizada
grep -A2 "PUT /api/compras" docs/api.md
grep -A2 "DELETE /api/compras" docs/api.md

# 3. Ejecutar tests de cuota
npm test -- usage-limits
```

---

**Próxima revisión recomendada:** Después de implementar cambios P0
