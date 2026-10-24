# Implementation Plan: Proveedores

**Branch**: `021-proveedores` | **Date**: 2026-10-23 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/021-proveedores/spec.md`

## Summary

El proveedor deja de ser texto libre en cada lote y pasa a un catálogo por tenant, con un
predeterminado por lugar de trabajo:

- **Servidor** (P1): tabla `proveedores` con una clave normalizada generada y única por tenant (R1),
  `lugares.proveedor_predeterminado_id` (R2) y `lotes.proveedor_id`. El texto se conserva un release y
  no cambia después del insert (R3). Un trigger resuelve por nombre los lotes que suben las 2.4.0 en
  caché (R4). La migración crea un proveedor por nombre distinto y asocia todos los lotes; las fusiones
  de la clienta se aplican con un script aparte (R5). RLS: cualquier miembro crea, solo administración
  edita; eliminar es una baja lógica, solo sin lotes (R7).
- **Sincronización** (P1): tabla Dexie `proveedores` (v13), push y pull antes de lugares y lotes. Los
  duplicados creados sin conexión se remapean al proveedor del servidor (R6).
- **Registro** (P1): `SelectorProveedor` en una hoja con buscador, "Agregar proveedor" y el
  predeterminado del lugar ya elegido, en el alta de material y en la recepción de compras (R8).
- **Ajustes** (P2): sección Proveedores con lista paginada, edición en hoja, "Predeterminado en" por
  lugar, desactivados, y WhatsApp normalizado a +56 (R9, R10).
- **Detalle del insumo**: cada lote muestra su proveedor (R11).
- **Deuda**: se elimina `configuracion_clinica` del servidor y de Dexie (R12).

## Technical Context

**Language/Version**: TypeScript ~6.0 (React 19), Node.js ^22.22 o ≥24.15; SQL (Postgres de Supabase).

**Primary Dependencies**: sin dependencias nuevas (React, Zustand, Dexie, Tailwind, `lucide-react`,
`@supabase/supabase-js`).

**Storage**: Postgres: migración `20261023000000_proveedores.sql` (tabla, columnas, triggers, RLS,
datos, `drop configuracion_clinica`). Dexie **v13** (`proveedores`, índice `lotes.proveedorId`, borra
`configuracionClinica`). Detalle en [data-model.md](./data-model.md).

**Testing**: Vitest + RTL (unit de lógica, sincronización y Dexie v13; integración del selector,
Ajustes, alta, compras y detalle); `npm run test:rls` ampliado (aislamiento, triggers, 2.4.0); capturas
con `run-indentory` en tres tamaños; ensayo de la migración sobre una restauración del respaldo de
producción ([quickstart.md](./quickstart.md)).

**Target Platform**: PWA (teléfono, tablet, desktop) + Supabase.

**Project Type**: PWA con backend Supabase (front + migración).

**Performance Goals**: el selector filtra 50–200 proveedores en memoria al escribir, sin demora
perceptible; con el predeterminado elegido, el registro no suma pasos (SC-001); elegir otro toma ≤ 3
toques (SC-002). La migración procesa los lotes de producción (cientos) en una transacción.

**Constraints**:

- Sin conexión (Constitución I): crear, elegir y editar proveedores escribe primero en Dexie; el push
  respeta las FK (proveedor → lugar → lote) y converge con los duplicados sin perder lotes.
- Convivencia con la 2.4.0 en caché: el servidor acepta lotes con solo el texto (R4) y no deja que un
  upsert pise `proveedor_id` (R3).
- Aislamiento por tenant (FR-004) verificado en `test:rls`.
- Táctil ≥ 48 px (Constitución III) en el selector, la lista y la hoja.

**Scale/Scope**: 1 migración, 1 script de servicio (`scripts/proveedores.mjs`); 1 feature nueva
(`src/features/proveedores`: 3 módulos de lógica y 1 componente); `ProveedoresSection` nuevo en
Ajustes; cambios en `db`, `sync`, `tenancy`, `inventoryStore`, `avisosStore`, alta, recepción,
`InsumoDetalle` y `secciones`/resúmenes de Ajustes; 7 archivos de prueba nuevos y ~12 ajustados.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Cumplimiento | Estado |
|---|---|---|
| I. Offline-First | Proveedores en Dexie, creados y elegidos sin red; push ordenado por FK; duplicados sin conexión convergen por remapeo determinista (R6); un rechazo de eliminación se revierte con aviso, sin pérdida silenciosa | ✅ |
| II. Zustand | `proveedores` se suma a `inventoryStore` por `liveQuery`, como `categorias`; sin store nuevo | ✅ |
| III. Táctil 48 px | Campo del selector, opciones, "Agregar", interruptores y "Ver más" con `touch-target`; la hoja evita el combobox chico bajo el teclado | ✅ |
| IV. Trazabilidad | El proveedor por lote pasa a ser un dato consistente (sin variantes) y se ve en el detalle; la migración no pierde ningún lote (verificación que aborta) | ✅ |
| V. Búsqueda manual | El selector abre con el buscador enfocado; ninguna cámara; el predeterminado ahorra el paso | ✅ |
| VI. Multi-usuario | `creado_por` en cada proveedor (también en los de la migración y del trigger); RLS por rol: crear cualquiera, administrar solo administración | ✅ |
| Pila obligatoria | Sin dependencias nuevas (WhatsApp sin `libphonenumber`, R10) | ✅ |

**Re-check post-diseño**: sin violaciones.

## Project Structure

### Documentation (this feature)

```text
specs/021-proveedores/
├── plan.md
├── research.md          # R1–R13
├── data-model.md        # Proveedor, Lugar y Lote, Dexie v13, migración de datos
├── quickstart.md        # pruebas, recorrido manual, 2.4.0, publicación
├── contracts/
│   ├── supabase-schema.md   # tabla, triggers, RLS, migración, test:rls, orden de sync
│   └── ui-contracts.md      # lógica, SelectorProveedor, formularios, Ajustes, pruebas
├── checklists/requirements.md
└── tasks.md             # /speckit-tasks
```

### Source Code (repository root)

```text
supabase/migrations/
└── 20261023000000_proveedores.sql          # NUEVO (R1–R5, R7, R12)

scripts/
├── proveedores.mjs                         # NUEVO: listar / fusionar (R5)
└── test-rls.mjs                            # casos de proveedores; sin configuracion_clinica

src/
├── lib/
│   ├── db/index.ts                         # Proveedor, Lote.proveedorId, Lugar.proveedorPredeterminadoId, v13
│   ├── sync/index.ts                       # push/pull proveedores, remapeo, LoteRow/LugarRow
│   └── tenancy/index.ts                    # limpia proveedores ajenos; sin configuracionClinica
├── stores/
│   ├── inventoryStore.ts                   # proveedores por liveQuery
│   └── avisosStore.ts                      # aviso proveedor-no-eliminado
└── features/
    ├── proveedores/                        # NUEVO
    │   ├── lib/proveedores.ts              # clave, orden, búsqueda, coincidencia, predeterminado
    │   ├── lib/proveedoresAdmin.ts         # crear/editar/desactivar/reactivar/eliminar/predeterminado
    │   ├── lib/whatsapp.ts                 # normalizar y formatear (R10)
    │   └── components/SelectorProveedor.tsx
    ├── insumos/
    │   ├── lib/alta.ts, lib/useBorradorAlta.ts      # proveedorId
    │   └── components/AltaMaterialView.tsx, InsumoDetalle.tsx
    ├── compras/
    │   ├── lib/recepcion.ts
    │   └── components/RecibirItemForm.tsx
    └── ajustes/
        ├── lib/secciones.ts, lib/useResumenesAjustes.ts
        └── components/ProveedoresSection.tsx       # NUEVO (+ registro en SeccionAjustesPantalla)

tests/
├── unit/proveedores/{proveedores,whatsapp,proveedoresAdmin}.test.ts   # NUEVOS
├── unit/sync-proveedores.test.ts, unit/dexie-v13.test.ts               # NUEVOS
├── integration/selector-proveedor.test.tsx, ajustes-proveedores.test.tsx  # NUEVOS
└── (ajustados) alta-material, compras, alertas-detalle, ajustes, unit/insumos/alta,
    unit/compras/recepcion, helpers/tablasMemoria y mocks con configuracionClinica
```

**Structure Decision**: feature nueva `src/features/proveedores`, porque la usan tres features (insumos,
compras y ajustes), como `categorias` vive hoy en `insumos/lib` pero ya pesa en Ajustes. La sección de
Ajustes sigue en `features/ajustes` como las demás. La lógica del servidor (resolución, protecciones)
va en triggers, porque debe aplicarse también a los clientes 2.4.0.

## Complexity Tracking

Sin violaciones de la constitución; no aplica.

## Notas

- **Mensaje de error**: se mantiene "Ingresa el proveedor." (spec, US1-3), aunque el campo ahora se
  elige.
- **Eliminar = baja lógica** (R7): la spec habla de "eliminar"; para la persona es eliminar (no aparece
  en ninguna parte), pero la fila queda en el servidor para que la baja llegue a todos los dispositivos.
- **Después de la 2.5.0**: retirar `lotes.proveedor` (texto), poner `proveedor_id not null` y quitar
  la resolución del trigger. Va al backlog al publicar (quickstart, "Publicación" paso 4).
- **022**: usa `proveedores.whatsapp` (solo dígitos, listo para `wa.me`) y pide el proveedor al enviar
  (Clarifications Q3).
