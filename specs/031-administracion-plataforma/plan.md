# Implementation Plan: Administración de la plataforma

**Branch**: `031-administracion-plataforma` | **Date**: 2026-11-23 | **Spec**: [spec.md](./spec.md)

## Summary

Panel "Plataforma" en Ajustes, visible solo para operadores (tabla del servidor). Edge Function
`plataforma` que verifica al operador y, con service role, lista clientes y usuarios, crea clientes,
invita, exporta y elimina usuarios y clientes mediante funciones SQL transaccionales, y borra cuentas
con la API de Auth. Migración que quita las FKs de historial a `auth.users` para poder borrar cuentas
conservando registros, más `usuarios_eliminados` para mostrar "Usuario eliminado". Los dispositivos de
cuentas borradas limpian sus datos al conectarse (R1–R8).

## Technical Context

**Language/Version**: TypeScript (React 19, Deno), SQL (Postgres 17).

**Storage**: migración `20261126000000_administracion_plataforma.sql`; Dexie v17
(`usuariosEliminados`).

**Testing**: Vitest (cliente, UI, sync de eliminados, cierre de sesión por cuenta borrada);
`test:rls` (contracts/api.md §controles) contra Supabase local con la función servida.

**Constraints**: irreversible para clientes (respaldo descargado antes); nada de correos o ids en el
repo (la lista de operadores se carga con SQL a mano); conexión obligatoria en el panel.

## Constitution Check

| Principio | Cumplimiento | Estado |
|---|---|---|
| I. Offline-First | El panel requiere conexión (operación de plataforma, no de clínica); el resto sigue igual | ✅ (excepción acotada) |
| II. Zustand | Estado local de pantalla; `usuariosEliminados` en un store existente | ✅ |
| III. Táctil 48 px | Botones de 48 px; confirmaciones escritas | ✅ |
| IV. Trazabilidad | Registros conservados con el id del autor; auditoría de plataforma | ✅ |
| VI. Multi-usuario | Operador verificado en el servidor en cada llamada | ✅ |

## Project Structure

```text
supabase/migrations/20261126000000_administracion_plataforma.sql
supabase/functions/plataforma/{index.ts,logica.ts}
supabase/config.toml
scripts/test-rls.mjs
src/features/plataforma/{lib/plataforma.ts,components/*}
src/features/ajustes/lib/secciones.ts            # sección 'plataforma'
src/lib/db/index.ts                              # v17 usuariosEliminados
src/lib/sync/index.ts                            # pull de eliminados; cuenta borrada
src/lib/tenancy/index.ts                         # limpiar usuariosEliminados
src/features/ayuda/contenido.ts                  # ayuda de la sección
tests/…
```

## Despliegue

Respaldo → ensayo sobre la restauración → `db push` (visto bueno) → deploy de `plataforma` → insertar
la cuenta del operador en `administradores_plataforma` con SQL → front.
