# Implementation Plan: Estimación de materiales con IA

**Branch**: `029-estimacion-materiales-ia` | **Date**: 2026-11-23 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/029-estimacion-materiales-ia/spec.md`

## Summary

Botón "Sugerir cantidades" en el formulario del catálogo de tratamientos que llama a una Edge
Function nueva, `estimar-materiales`. La función verifica sesión, rol y tenant, lee los materiales
de la base, reserva una de las 20 estimaciones diarias del cliente y consulta a Claude
(`claude-opus-5-5`, salida estructurada, sin herramientas). Valida la respuesta y devuelve una
cantidad y una nota por material, que la administradora aplica con "Usar sugerencias" (R1–R6).

## Technical Context

**Language/Version**: TypeScript ~6.0 (React 19) en la app; TypeScript en Deno para la Edge
Function; SQL (Postgres 17).

**Primary Dependencies**: `npm:@anthropic-ai/sdk` (solo en la Edge Function); nada nuevo en la app.

**Storage**: migración `20261125000000_estimaciones_ia.sql`; sin Dexie.

**Testing**: Vitest para la lógica pura de la función y para el cliente; `test:rls` para la tabla, la
reserva y la función local sin clave; prueba real manual con costo (quickstart).

**Target Platform**: PWA + Supabase (Edge Functions).

**Project Type**: PWA con backend Supabase.

**Performance Goals**: respuesta < 15 s; timeout 30 s.

**Constraints**:

- Solo en línea: es la única función de la app que requiere conexión (excepción explícita a la
  Constitución I: no registra datos, solo sugiere).
- Clave solo en el servidor; límite de 20/día por tenant; sin datos de pacientes, precios ni stock.
- Ninguna llamada real a la IA sin clave configurada y visto bueno (costo).

**Scale/Scope**: 1 migración, 1 Edge Function (`index.ts` + `logica.ts`), `tratamientos/lib/estimacion.ts`,
cambios en `TratamientoForm.tsx`, `supabase/config.toml`, `scripts/test-rls.mjs`, CI (servir la
función nueva como la de invitaciones).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Cumplimiento | Estado |
|---|---|---|
| I. Offline-First | Sin conexión el botón queda deshabilitado con su motivo; el resto del formulario funciona igual. La sugerencia no es un registro, así que no rompe el trabajo sin red | ✅ (excepción acotada) |
| II. Zustand | Estado local del formulario; sin store nuevo | ✅ |
| III. Táctil 48 px | Botones de 48 px; sugerencias con texto | ✅ |
| IV. Trazabilidad | `estimaciones_ia` registra quién, cuándo y resultado | ✅ |
| V. Búsqueda manual | Sin cambios | ✅ |
| VI. Multi-usuario | Rol y tenant verificados en el servidor | ✅ |
| Pila obligatoria | SDK de Anthropic solo en la función de servidor | ✅ |

## Project Structure

```text
supabase/migrations/20261125000000_estimaciones_ia.sql
supabase/functions/estimar-materiales/{index.ts,logica.ts}
supabase/config.toml                      # [functions.estimar-materiales]
.github/workflows/ci.yml                  # servir la función en el job rls
scripts/test-rls.mjs
src/features/tratamientos/lib/estimacion.ts
src/features/tratamientos/components/TratamientoForm.tsx
tests/unit/tratamientos/{estimacion-logica,estimacion-cliente}.test.ts
tests/integration/tratamientos.test.tsx   # botón y sugerencias
```

## Despliegue

Respaldo → `db push` (visto bueno) → secreto `ANTHROPIC_API_KEY` y tope de gasto en la consola de
Anthropic → `supabase functions deploy estimar-materiales` → front.
