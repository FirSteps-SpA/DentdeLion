# Implementation Plan: Categorías de tratamientos y % profesional por categoría

**Branch**: `026-categorias-tratamientos` | **Date**: 2026-11-23 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/026-categorias-tratamientos/spec.md`

## Summary

Los tratamientos ganan una categoría opcional de un catálogo por cliente (9 sembradas, administrables)
y cada categoría puede tener un % profesional propio **por lugar**, que reemplaza al general del lugar
al registrar. Historial y Reportes muestran lo realizado por categoría.

- **Catálogo** (R1, R2): tabla `categorias_tratamiento` como `marcas`, sembrada por migración y por
  un trigger en el alta de tenants. Sección nueva en Ajustes.
- **Asignación y %** (R3, R4): dos campos nuevos del ledger `cambios_tratamiento` (`categoria` y
  `porcentajeCategoria`, este con columna `categoria_tratamiento_id`). Así heredan historial, último
  cambio gana, sync y RLS de solo administración.
- **% aplicable** (R5): una función pura para lo que se muestra y lo que se guarda.
- **Snapshot** (R6): `tratamientos_realizados` guarda la categoría (id y nombre) inmutable.
- **Por categoría** (R11): filtro en Historial y tarjeta en Reportes.

## Technical Context

**Language/Version**: TypeScript ~6.0 (React 19), Node.js ^22.22 o ≥24.15; SQL (Postgres 17 de
Supabase).

**Primary Dependencies**: sin dependencias nuevas.

**Storage**: migración `20261123000000_categorias_tratamiento.sql` (tabla nueva, columnas nuevas,
CHECK reescritos, siembra y trigger); Dexie v15 ([data-model.md](./data-model.md)).

**Testing**: Vitest + RTL (unit e integración de [contracts/ui-contracts.md §8](./contracts/ui-contracts.md));
`npm run test:rls` con los 9 controles nuevos ([contracts/supabase-schema.md §5](./contracts/supabase-schema.md));
ensayo de la migración sobre la restauración del respaldo de producción; recorrido con `run-indentory`.

**Target Platform**: PWA (teléfono, tablet, desktop) + Supabase.

**Project Type**: PWA con backend Supabase.

**Performance Goals**: las proyecciones recorren el ledger de tratamientos (cientos de filas) sin
costo perceptible; la tarjeta nueva de Reportes no debe romper el presupuesto de
`tests/unit/reportes/rendimiento.test.ts` (< 300 ms).

**Constraints**:

- Sin conexión (Constitución I): todo se escribe en Dexie y sube con el sync.
- Orden del sync: categorías antes que `cambios_tratamiento` y `tratamientos_realizados` (FK).
- Migración antes del front; respaldo y ensayo previos; ningún monto existente cambia (SC-003).
- Convivencia con dispositivos en caché (R9): sin errores, con % general.
- Táctil ≥ 48 px y estados con texto (Constitución III).

**Scale/Scope**: 1 migración; Dexie v15; módulos nuevos `tratamientos/lib/categorias.ts`,
`ajustes/components/CategoriasTratamientoSection.tsx`; cambios en `proyeccion.ts`, `catalogo.ts`,
`registro.ts`, `useMontosTratamiento.ts`, `historial.ts`, `tratamientosStore.ts`, `sync/index.ts`,
`TratamientoForm`, `TratamientosView`, `TratamientoDetalle`, `MontosTratamiento`,
`RegistrarTratamientoSheet`, `HistorialTratamientos`, `ajustes/lib/secciones.ts`, `AjustesView`,
`useResumenesAjustes`, `reportes/lib/kpis.ts`, `ReportesView`, `avisosStore`/`AvisosConsumo` (aviso
nuevo), `scripts/test-rls.mjs`. ~6 archivos de prueba nuevos y ~6 ampliados.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Cumplimiento | Estado |
|---|---|---|
| I. Offline-First | Categorías, asignaciones y % se escriben en Dexie y suben con el sync; el registro usa el % conocido localmente | ✅ |
| II. Zustand | `tratamientosStore` proyecta categorías, `porcentajesPorCategoria` y `categoriaId` desde Dexie con `liveQuery` | ✅ |
| III. Táctil 48 px | Selector, chips, `NumeroInput`, interruptor y botones de 48 px; "Desactivada" y origen del % en texto | ✅ |
| IV. Trazabilidad | Asignación y % por categoría en el ledger con autor y fecha; snapshot inmutable de la categoría en cada registro | ✅ |
| V. Búsqueda manual | No toca búsqueda ni cámara | ✅ |
| VI. Multi-usuario | `usuarioId` en cada cambio; RLS de solo administración en catálogo, asignación y % | ✅ |
| Pila obligatoria | Sin dependencias nuevas | ✅ |

**Re-check post-diseño**: sin violaciones.

## Project Structure

### Documentation (this feature)

```text
specs/026-categorias-tratamientos/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── supabase-schema.md
│   └── ui-contracts.md
├── checklists/requirements.md
└── tasks.md
```

### Source Code (repository root)

```text
supabase/migrations/20261123000000_categorias_tratamiento.sql   # nuevo
scripts/test-rls.mjs                                             # controles nuevos
src/
├── lib/db/index.ts                     # tipos + Dexie v15
├── lib/sync/index.ts                   # push/pull categorías; columnas nuevas
├── stores/tratamientosStore.ts         # categorías, % por categoría
├── stores/avisosStore.ts, app/AvisosConsumo.tsx  # aviso "categoria-tratamiento-repetida"
├── features/tratamientos/
│   ├── lib/categorias.ts               # nuevo
│   ├── lib/{proyeccion,catalogo,registro,useMontosTratamiento,historial}.ts
│   └── components/{TratamientoForm,TratamientosView,TratamientoDetalle,MontosTratamiento,
│                   RegistrarTratamientoSheet,HistorialTratamientos}.tsx
├── features/ajustes/
│   ├── components/CategoriasTratamientoSection.tsx   # nuevo
│   └── lib/{secciones,useResumenesAjustes}.ts, components/AjustesView.tsx
└── features/reportes/{lib/kpis.ts,components/ReportesView.tsx}
tests/ (ver contracts/ui-contracts.md §8)
```

**Structure Decision**: PWA única existente; el cambio se concentra en `features/tratamientos`, con
una sección nueva en `features/ajustes` y una tarjeta en `features/reportes`.

## Despliegue

1. Respaldo de producción y ensayo de la migración sobre su restauración ([quickstart.md](./quickstart.md)).
2. `supabase db push` de `20261123000000_categorias_tratamiento.sql` (**requiere visto bueno explícito**:
   cambia la base de producción) y comprobación (9 categorías por tenant, totales intactos).
3. Front (release con `main` → Netlify).
4. Avisar al equipo; mientras quede un dispositivo con versión anterior, sus registros usan el % general.
