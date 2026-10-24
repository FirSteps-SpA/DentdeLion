# Implementation Plan: Marcas

**Branch**: `023-marcas` | **Date**: 2026-10-24 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/023-marcas/spec.md`

## Summary

Cada insumo puede tener una marca opcional, elegida de un catálogo por tenant o agregada desde el mismo
selector, con su sección en Ajustes:

- **Servidor** (P1): tabla `marcas` con la clave normalizada de la 021 (R1) e `insumos.marca_id`
  opcional con FK compuesta (R2), sin migración de datos. `marca_id` solo cambia en el INSERT o por el
  historial: `proteger_catalogo_insumo` lo conserva en todo UPDATE, y un trigger sobre
  `cambios_insumo` (`campo = 'marcaId'`) aplica el más reciente (R3, R4). Así ni la 2.5.0 en caché ni
  un dispositivo recién actualizado pueden borrar una marca, y solo administración la cambia en un
  insumo existente. RLS como proveedores; eliminar es baja lógica, solo sin insumos (R6).
- **Sincronización** (P1): tabla Dexie `marcas` (v14), push y pull después de proveedores y antes de
  insumos. Los duplicados creados sin conexión se remapean, incluidos los cambios `marcaId` pendientes
  (R5, R13).
- **Formularios** (P1): `SelectorCatalogo` extraído de `SelectorProveedor` (R7); `SelectorMarca` con
  "Sin marca" en el alta (cualquier miembro) y en la edición (administración) (R12).
- **Visualización** (P2): marca en el detalle, `Nombre · Marca` en Inventario y Compras, búsqueda por
  marca y renglón del mensaje de WhatsApp (R8–R10).
- **Ajustes** (P2): sección Marcas con la cantidad de insumos por marca, "Ver más", desactivadas y
  eliminar sin insumos (R11).

## Technical Context

**Language/Version**: TypeScript ~6.0 (React 19), Node.js ^22.22 o ≥24.15; SQL (Postgres de Supabase).

**Primary Dependencies**: sin dependencias nuevas (React, Zustand, Dexie, Tailwind, `lucide-react`,
`@supabase/supabase-js`).

**Storage**: Postgres: migración `20261025000000_marcas.sql` (tabla, columna, FK, triggers, check del
historial, RLS; sin datos). Dexie **v14** (`marcas`, índice `insumos.marcaId`). Detalle en
[data-model.md](./data-model.md).

**Testing**: Vitest + RTL (unit de catálogo genérico, marcas, sincronización y Dexie v14; integración
del selector, Ajustes, alta, edición, detalle, compras y búsqueda); `npm run test:rls` ampliado
(aislamiento, permisos, `marca_id` protegido, historial, convivencia 2.5.0); capturas con
`run-indentory` en tres tamaños ([quickstart.md](./quickstart.md)).

**Target Platform**: PWA (teléfono, tablet, desktop) + Supabase.

**Project Type**: PWA con backend Supabase (front + migración).

**Performance Goals**: el selector filtra 50–200 marcas en memoria sin demora perceptible; elegir una
marca toma ≤ 3 toques (SC-002); el alta sin marca no suma pasos (SC-001). La búsqueda de Inventario
suma una consulta a un `Map` por insumo (≤ 300 insumos), sin costo perceptible.

**Constraints**:

- Sin conexión (Constitución I): crear y elegir marcas escribe primero en Dexie; el push respeta la FK
  (marca → insumo) y retiene los cambios `marcaId` hasta que su marca suba.
- Convivencia con la 2.5.0 en caché y con dispositivos recién actualizados: `marca_id` nunca se pisa
  por un upsert de insumos (R3).
- Aislamiento por tenant (FR-003) verificado en `test:rls`.
- Táctil ≥ 48 px (Constitución III) en el selector, la lista y la hoja.
- `SelectorProveedor` no cambia de comportamiento: sus pruebas pasan sin tocarlas.

**Scale/Scope**: 1 migración; 1 feature nueva (`src/features/marcas`: 2 módulos de lógica y 1
componente); `src/lib/catalogo.ts` y `src/components/ui/SelectorCatalogo.tsx` nuevos (extraídos de la
021); `MarcasSection` nuevo en Ajustes; cambios en `db`, `sync`, `tenancy`, `inventoryStore`,
`avisosStore`, alta, edición, `catalogo.ts`, `InsumoDetalle`, `InsumoCard`, `InventarioTabla`, tarjetas
de compras, `pedido.ts` y `secciones`/resúmenes de Ajustes; 7 archivos de prueba nuevos y ~10
ajustados.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Cumplimiento | Estado |
|---|---|---|
| I. Offline-First | Marcas en Dexie, creadas y elegidas sin red; push ordenado por FK; duplicados sin conexión convergen por remapeo (R5); una baja rechazada se revierte con aviso; ninguna marca se pierde por un push desfasado (R3) | ✅ |
| II. Zustand | `marcas` se suma a `inventoryStore` por `liveQuery`, como `proveedores`; sin store nuevo | ✅ |
| III. Táctil 48 px | Campo del selector, opciones, "Agregar", "Sin marca", filas de Ajustes y "Ver más" con `touch-target` | ✅ |
| IV. Trazabilidad | Cada cambio de marca de un insumo existente queda en `cambios_insumo` con valor anterior y nuevo, autor y fecha (FR-009) | ✅ |
| V. Búsqueda manual | El selector abre con el buscador enfocado; la búsqueda de Inventario encuentra por marca (FR-013); ninguna cámara | ✅ |
| VI. Multi-usuario | `creado_por` en cada marca; RLS por rol: crear cualquiera, administrar solo administración; cambiar la marca de un insumo existente solo administración (historial con RLS) | ✅ |
| Pila obligatoria | Sin dependencias nuevas | ✅ |

**Re-check post-diseño**: sin violaciones.

## Project Structure

### Documentation (this feature)

```text
specs/023-marcas/
├── plan.md
├── research.md          # R1–R14
├── data-model.md        # Marca, Insumo.marcaId, CambioInsumo 'marcaId', Dexie v14
├── quickstart.md        # pruebas, recorrido manual, 2.5.0, publicación
├── contracts/
│   ├── supabase-schema.md   # tabla, triggers, RLS, historial, orden de sync, test:rls
│   └── ui-contracts.md      # catálogo genérico, SelectorCatalogo/SelectorMarca, formularios, Ajustes, pruebas
├── checklists/requirements.md
└── tasks.md             # /speckit-tasks
```

### Source Code (repository root)

```text
supabase/migrations/
└── 20261025000000_marcas.sql               # NUEVO (R1–R4, R6)

scripts/
└── test-rls.mjs                            # casos de marcas (supabase-schema §5)

src/
├── lib/
│   ├── catalogo.ts                         # NUEVO: orden, activos, búsqueda, coincidencia genéricos (R7)
│   ├── db/index.ts                         # Marca, Insumo.marcaId, CampoEditableInsumo 'marcaId', v14
│   ├── sync/index.ts                       # push/pull marcas, remapeo, InsumoRow.marca_id, guarda de cambios
│   └── tenancy/index.ts                    # limpia marcas ajenas
├── components/ui/
│   └── SelectorCatalogo.tsx                # NUEVO (extraído de SelectorProveedor)
├── stores/
│   ├── inventoryStore.ts                   # marcas por liveQuery; búsqueda por marca
│   └── avisosStore.ts                      # marca-no-eliminada, marca-repetida
└── features/
    ├── marcas/                             # NUEVO
    │   ├── lib/marcas.ts                   # clave, nombre visible, usos, marcaParaInsumo
    │   ├── lib/marcasAdmin.ts              # crear/renombrar/desactivar/reactivar/eliminar
    │   └── components/SelectorMarca.tsx
    ├── proveedores/
    │   ├── lib/proveedores.ts              # reexporta helpers genéricos (sin cambio de API)
    │   └── components/SelectorProveedor.tsx  # envoltorio de SelectorCatalogo
    ├── insumos/
    │   ├── lib/alta.ts, lib/useBorradorAlta.ts, lib/catalogo.ts
    │   └── components/AltaMaterialView.tsx, EditarInsumoForm.tsx, InsumoDetalle.tsx,
    │       InsumoCard.tsx, InventarioTabla.tsx, InventarioView.tsx, SearchPicker.tsx
    ├── compras/
    │   ├── lib/pedido.ts
    │   └── components/ItemSugeridoCard.tsx, ItemManualCard.tsx
    └── ajustes/
        ├── lib/secciones.ts, lib/useResumenesAjustes.ts
        └── components/MarcasSection.tsx    # NUEVO (+ registro en SeccionAjustesPantalla)

tests/
├── unit/catalogo-generico.test.ts, unit/marcas/{marcas,marcasAdmin}.test.ts      # NUEVOS
├── unit/sync-marcas.test.ts, unit/dexie-v14.test.ts                      # NUEVOS
├── integration/selector-marca.test.tsx, ajustes-marcas.test.tsx          # NUEVOS
└── (ajustados) alta-material, edición de insumo, alertas-detalle, compras, ajustes,
    unit/compras/pedido, inventoryStore, helpers/tablasMemoria y mocks de Dexie
```

**Structure Decision**: feature nueva `src/features/marcas`, como `proveedores`, porque la usan
insumos, compras y ajustes. Lo común con proveedores (helpers y selector) sube a `src/lib/catalogo.ts`
y `src/components/ui/SelectorCatalogo.tsx`, para no duplicar la accesibilidad y el teclado del
selector. La protección de `marca_id` va en triggers, porque debe aplicarse también a los clientes
2.5.0.

## Complexity Tracking

Sin violaciones de la constitución; no aplica.

## Notas

- **Riesgo principal** (R3): el upsert completo de insumos en cada ciclo. Lo resuelve el servidor: los
  casos 6–8 de `test:rls` y el paso 4 de "Compatibilidad con la 2.5.0" del quickstart son condición
  para mergear.
- **US1-3 (personal)**: hoy el personal no ve "Editar" en el insumo. "Ver la marca sin poder
  cambiarla" se cumple en el detalle, y el servidor rechaza un cambio `marcaId` suyo igual.
- **Búsqueda**: la comparación por nombre del insumo sigue como hoy (solo minúsculas). Plegar las
  tildes del nombre queda como mejora aparte (R9).
- **Refactor de la 021**: extraer `SelectorCatalogo` va como primera tarea, con las pruebas de
  proveedores como red de seguridad, antes de tocar marcas.
