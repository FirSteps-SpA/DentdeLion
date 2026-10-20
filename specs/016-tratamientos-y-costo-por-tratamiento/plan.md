# Implementation Plan: Tratamientos y Costo por Tratamiento

**Branch**: `016-tratamientos-y-costo-por-tratamiento` | **Date**: 2026-10-19 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/016-tratamientos-y-costo-por-tratamiento/spec.md`

## Summary

Agrega tratamientos con sus materiales, su precio por lugar y el porcentaje profesional del lugar,
calcula costo de materiales y **ganancia estimada** (DS §27) y permite registrar un tratamiento
realizado que descuenta sus materiales por FEFO en una sola operación.

- **Catálogo** como fila mínima + ledger `cambios_tratamiento` (nombre, materiales, activo, precio
  por lugar, % profesional por lugar), proyectado en el dispositivo con `(creadoEn, id)` (R1).
- **Materiales** en unidad de consumo, convertibles con los factores de la 015 (R2).
- **Montos** con funciones puras sobre el costo unitario de la 015 (R3).
- **Registro realizado** con snapshot inmutable + consumos FEFO vinculados, en una transacción
  Dexie; falta de stock bloquea con detalle (R4). **Anulación** por ajustes vinculados (R5).
- **Sync** de tres tablas nuevas y la columna `movimientos.tratamiento_realizado_id` (R6).
- **Navegación**: Tratamientos en sidebar y barra inferior; Compras pasa a "Más" en móvil (R7).
- **Historial** con totales por período (R8).

## Technical Context

**Language/Version**: TypeScript ~6.0 (React 19), Node.js ^22.22 o ≥24.15.

**Primary Dependencies**: sin dependencias nuevas (Supabase JS, Dexie, Zustand, Tailwind,
`lucide-react` — ícono `Stethoscope`).

**Storage**:
- Postgres: `tratamientos`, `cambios_tratamiento`, `tratamientos_realizados`,
  `movimientos.tratamiento_realizado_id`, RLS y un trigger de protección.
- Dexie v12: tres tablas nuevas e índice `tratamientoRealizadoId`.
- Detalle en [data-model.md](./data-model.md) y [contracts/supabase-schema.md](./contracts/supabase-schema.md).

**Testing**: Vitest + RTL (proyección, montos, FEFO, registro atómico, anulación, historial, Dexie
v12, sync, interfaz), `test:rls` (§6 del esquema), ensayo de migración sobre un respaldo nuevo de
producción, Dexie v12 en Chromium real, recorrido visual con `run-indentory`.

**Target Platform**: PWA (teléfono, tablet, desktop) + Supabase.

**Project Type**: PWA + esquema Supabase.

**Performance Goals**: lista de 100 tratamientos con montos en < 100 ms en memoria; registrar un
tratamiento de 10 materiales en < 300 ms en el dispositivo.

**Constraints**:
- Offline completo (Constitución I): definir, registrar, anular, ver montos.
- Ningún registro descuenta más de lo disponible ni de otro lugar (SC-004).
- Snapshot inmutable de cada registro (SC-003), también en el servidor.
- Sin datos de pacientes.

**Scale/Scope**: decenas de tratamientos por tenant, cientos de registros por mes; 3 tablas, ~6
módulos de lógica, ~8 componentes nuevos.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Cumplimiento | Estado |
|---|---|---|
| I. Offline-First | Registro + consumos en una transacción Dexie; ledger determinista para el catálogo; anulación por ajustes; sync en segundo plano con reintentos | ✅ |
| II. Zustand | Estado en `inventoryStore` (o un `tratamientosStore`) leyendo Dexie con `liveQuery`; montos derivados en memoria | ✅ |
| III. Táctil 48 px | Steppers, "Registrar", "Deshacer", filtros y formularios ≥ 48 px | ✅ |
| IV. Trazabilidad y alertas | Consumos por lote (FEFO) vinculados al registro; sin caducados; sobregiros siguen marcando lotes en revisión; alertas sin cambios | ✅ |
| V. Búsqueda manual | El buscador de materiales es manual; ninguna pantalla activa la cámara | ✅ |
| VI. Multi-usuario | Autor en cada cambio, registro y anulación; catálogo solo administración en el servidor | ✅ |
| Pila obligatoria | Sin dependencias nuevas | ✅ |

**Re-check post-diseño**: sin violaciones.

## Project Structure

### Documentation (this feature)

```text
specs/016-tratamientos-y-costo-por-tratamiento/
├── plan.md
├── research.md          # R1–R10
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── supabase-schema.md
│   └── ui-contracts.md
├── checklists/requirements.md
└── tasks.md             # /speckit-tasks
```

### Source Code (repository root)

```text
supabase/migrations/20261022000000_tratamientos.sql      # nuevo
scripts/test-rls.mjs                                     # casos §6

src/lib/db/index.ts                     # tipos + version(12)
src/lib/sync/index.ts                   # push/pull de tratamientos, cambios, realizados; FK de movimientos
src/lib/sync/indicador.ts, src/stores/pendientesStore.ts, src/lib/tenancy/index.ts
src/stores/tratamientosStore.ts         # nuevo: liveQuery + proyección
src/features/tratamientos/lib/{proyeccion,catalogo,montos,registro,historial}.ts      # nuevos
src/features/insumos/lib/fefo.ts        # repartirFefo
src/features/tratamientos/components/{TratamientosView,TratamientoForm,TratamientoDetalle,RegistrarTratamientoSheet,HistorialTratamientos}.tsx  # nuevos
src/features/ajustes/components/LugaresSection.tsx      # % profesional
src/app/{navegacion.ts,BottomNav.tsx,Sidebar.tsx,App.tsx}   # sección Tratamientos
src/app/AvisosConsumo.tsx               # aviso "Registrada …" con Deshacer
src/features/insumos/components/InsumoDetalle.tsx       # consumos de tratamiento en el historial del lote

tests/unit/tratamientos/{proyeccion,montos,registro,historial}.test.ts
tests/unit/{fefo-reparto,dexie-v12,sync-tratamientos}.test.ts
tests/integration/{tratamientos,registrar-tratamiento,navegacion-tratamientos}.test.tsx
```

**Structure Decision**: feature nueva `src/features/tratamientos/` con lógica pura separada de los
componentes, como `insumos` y `compras`. Reutiliza `useCostosUnitarios`, `factoresDeUnidad`,
`movimientosNormalizadosDeLote`, `crearMovimiento` y el patrón de ledger.

## Riesgos y notas

- **Barra inferior móvil (R7)**: Compras pasa a "Más" en móvil. Validar con la clienta; si prefiere
  Compras, la alternativa es mover Alertas al encabezado con su badge.
- **Respaldo nuevo antes del ensayo**: el último respaldo es anterior a la 014 en producción.
- **Costo con materiales sin precio**: la ganancia se muestra incompleta, no estimada a cero; puede
  verse "peor" de lo real hasta cargar precios. Se comunica con "desde $X".
- **Tamaño (L)**: el registro atómico y su anulación tocan consumo, FEFO, sync y reconciliación. Las
  pruebas existentes de consumo deben seguir en verde.
- **Registro sin precio en el lugar**: permitido; no suma a precios ni ganancias del historial.

## Complexity Tracking

Sin violaciones de la constitución.
