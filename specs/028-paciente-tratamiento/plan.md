# Implementation Plan: Paciente opcional en cada tratamiento realizado

**Branch**: `028-paciente-tratamiento` | **Date**: 2026-11-23 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/028-paciente-tratamiento/spec.md`

## Summary

Un texto opcional "Paciente (nombre o N° de ficha)" por registro, guardado **aparte** del registro en
`pacientes_registro`, con RLS que solo deja leerlo y escribirlo al autor del registro y a la
administración (R1, R2). Se anota al registrar (misma transacción local), se corrige o quita desde el
historial y se busca en el historial (R5, R7). El dispositivo borra los pacientes sincronizados al
cerrar sesión y se queda solo con los que el servidor le deja leer (R4). Sentry no recibe el texto
(R6).

## Technical Context

**Language/Version**: TypeScript ~6.0 (React 19), Node.js ^22.22 o ≥24.15; SQL (Postgres 17).

**Primary Dependencies**: sin dependencias nuevas.

**Storage**: migración `20261124000000_pacientes_registro.sql`; Dexie v16 (`pacientesRegistro`).

**Testing**: Vitest + RTL (contracts/ui-contracts.md §4); `test:rls` con 9 controles nuevos; ensayo
de la migración sobre la restauración del respaldo; recorrido con `run-indentory`.

**Target Platform**: PWA + Supabase.

**Project Type**: PWA con backend Supabase.

**Performance Goals**: una fila por registro con paciente; filtro en memoria sobre el período.

**Constraints**:

- Dato de salud: acceso solo autor/administración (servidor y UI), sin salir a Sentry, borrado al
  cerrar sesión, corregible.
- Sin conexión (Constitución I): todo en Dexie y sync.
- Orden del sync: pacientes después de `tratamientos_realizados` (FK).
- Migración antes del front, con respaldo y visto bueno.

**Scale/Scope**: 1 migración; Dexie v16; módulo nuevo `tratamientos/lib/pacientes.ts`; cambios en
`registro.ts`, `tratamientosStore.ts`, `authStore.ts`, `sync/index.ts`, `sentry.ts`,
`RegistrarTratamientoSheet.tsx`, `HistorialTratamientos.tsx`, `historial.ts`, `scripts/test-rls.mjs`.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Cumplimiento | Estado |
|---|---|---|
| I. Offline-First | Paciente en Dexie en la misma transacción que el registro; sube con el sync | ✅ |
| II. Zustand | `tratamientosStore` expone los pacientes visibles desde Dexie | ✅ |
| III. Táctil 48 px | Campo, lápiz, buscador y botones de 48 px | ✅ |
| IV. Trazabilidad | `actualizado_por`/`actualizado_en` en cada cambio; el registro sigue inmutable | ✅ |
| V. Búsqueda manual | Buscador de texto en el historial | ✅ |
| VI. Multi-usuario | Autor tomado del registro en el servidor; RLS por autor/administración | ✅ |
| Pila obligatoria | Sin dependencias nuevas | ✅ |

**Re-check post-diseño**: sin violaciones.

## Project Structure

```text
supabase/migrations/20261124000000_pacientes_registro.sql
scripts/test-rls.mjs
src/lib/db/index.ts                     # PacienteRegistro + Dexie v16
src/lib/sync/index.ts                   # push/pull pacientes
src/lib/sentry.ts                       # beforeBreadcrumb
src/stores/{authStore,tratamientosStore}.ts
src/features/tratamientos/lib/{pacientes,registro,historial}.ts
src/features/tratamientos/components/{RegistrarTratamientoSheet,HistorialTratamientos}.tsx
tests/… (contracts/ui-contracts.md §4)
```

## Despliegue

1. Respaldo y ensayo de la migración.
2. `supabase db push` (**visto bueno explícito**).
3. Front.
4. Revisar con asesoría legal el uso del dato antes de anunciarlo a la clienta (Assumptions).
