# Implementation Plan: "Consumir" sin atajo

**Branch**: `025-consumir-sin-atajo` | **Date**: 2026-11-23 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/025-consumir-sin-atajo/spec.md`

## Summary

El botón "Consumir 1" de Inventario pasa a ser **"Consumir"** y abre la hoja de consumo existente
(`ConsumoForm`) con el insumo elegido y cantidad 1; desaparece el consumo de un toque y la opción
"Consumir otra cantidad" del menú. Todo es del lado del cliente: sin migración, sin cambio de Dexie ni
de sync.

- **Hoja como camino principal** (P1): `InventarioView` abre la hoja (o "¿En qué lugar?" en "Todos").
  `ConsumoForm` gana `cantidadInicial`, selección al enfocar y foco automático solo en desktop (R4).
- **Lote por defecto vigente** (P1): hoy la hoja propone un lote vencido si vence antes que uno
  vigente. `selectLoteConsumo` prefiere vigentes y solo cae a vencidos si no hay otro stock; la hoja
  muestra "Lote vencido" cuando corresponde (R1, R6).
- **Registro con aviso y Deshacer** (P2): `insumos/lib/consumo.ts` registra el consumo en una
  transacción que recalcula el stock del lote, vibra y emite el aviso con "Deshacer"; recibe
  `deshacerConsumo` desde `consumoRapido.ts`, que se elimina (R2, R3).
- **Menú sin duplicados** (P3): `InsumoAccionesMenu` sin "Consumir otra cantidad" (R5).

## Technical Context

**Language/Version**: TypeScript ~6.0 (React 19), Node.js ^22.22 o ≥24.15.

**Primary Dependencies**: sin dependencias nuevas (React, Zustand, Dexie, Tailwind, `lucide-react`).

**Storage**: Dexie sin cambio de versión, Postgres sin migración. Movimientos `consumo` y `ajuste`
existentes ([data-model.md](./data-model.md)).

**Testing**: Vitest + RTL. Unit de `consumo.ts` y `selectLoteConsumo`; integración de Inventario
(tarjetas, tabla, "Todos", conversión de unidad). La prueba de arquitectura `lecturas-movimientos`
debe seguir pasando. Capturas con `run-indentory` ([quickstart.md](./quickstart.md)).

**Target Platform**: PWA (teléfono, tablet, desktop) + Supabase.

**Project Type**: PWA con backend Supabase (solo front en esta spec).

**Performance Goals**: sin cambios perceptibles; la transacción de registro lee los movimientos de un
solo lote.

**Constraints**:

- Sin conexión (Constitución I): el consumo se escribe en Dexie y sube con el push existente.
- Solo `movimientosNormalizadosDeLote` lee movimientos de Dexie (prueba de arquitectura).
- Táctil ≥ 48 px (Constitución III) en "Consumir", −/+ y "Confirmar consumo".
- En móvil, "Confirmar consumo" debe quedar visible al abrir la hoja (sin teclado automático).
- Convivencia con dispositivos 2.8.0 en caché: escriben los mismos movimientos.

**Scale/Scope**: 1 módulo nuevo (`insumos/lib/consumo.ts`), 1 eliminado (`consumoRapido.ts`);
cambios en `fefo.ts`, `ConsumoForm`, `InsumoCard`, `InventarioTabla`, `InventarioView`,
`InsumoAccionesMenu`, `avisosStore` (import) y comentarios en `traslado.ts` y
`tratamientos/lib/registro.ts`. 1 archivo de prueba nuevo, 1 eliminado y ~6 ajustados.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Cumplimiento | Estado |
|---|---|---|
| I. Offline-First | El consumo se escribe en una transacción Dexie local y sube con el push existente; sin dependencia de red | ✅ |
| II. Zustand | La UI sigue leyendo de `inventoryStore`; el aviso usa `avisosStore`; sin store nuevo | ✅ |
| III. Táctil 48 px | "Consumir" y los controles de la hoja son `TouchButton`/campos de 48 px; se elimina el consumo de un toque, la principal fuente de registros accidentales con guantes | ✅ |
| IV. Trazabilidad | Cada consumo es un movimiento por lote con autor, fecha y lugar; el lote por defecto ya no es un vencido; "Lote vencido" con ícono y texto | ✅ |
| V. Búsqueda manual | No toca la búsqueda ni la cámara | ✅ |
| VI. Multi-usuario | `usuarioId` en cada consumo y en su reversión, como hoy | ✅ |
| Pila obligatoria | Sin dependencias nuevas | ✅ |

**Re-check post-diseño**: sin violaciones.

## Project Structure

### Documentation (this feature)

```text
specs/025-consumir-sin-atajo/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/ui-contracts.md
├── checklists/requirements.md
└── tasks.md             # /speckit-tasks
```

### Source Code (repository root)

```text
src/
├── features/insumos/
│   ├── lib/
│   │   ├── consumo.ts            # nuevo: registrarConsumo, deshacerConsumo, disponibilidadConsumo
│   │   ├── consumoRapido.ts      # se elimina
│   │   └── fefo.ts               # + selectLoteConsumo
│   └── components/
│       ├── ConsumoForm.tsx       # cantidadInicial, foco, lote vigente, "Lote vencido", registrarConsumo
│       ├── InsumoCard.tsx        # "Consumir"
│       ├── InventarioTabla.tsx   # "Consumir"
│       ├── InventarioView.tsx    # abrirConsumo, sin consumirUno
│       └── InsumoAccionesMenu.tsx # sin "Consumir otra cantidad"
└── stores/avisosStore.ts         # import de deshacerConsumo

tests/
├── unit/insumos/consumo.test.ts  # nuevo (reemplaza consumoRapido.test.ts)
├── unit/fefo.test.ts
├── unit/avisosStore.test.ts
└── integration/{acciones-rapidas,inventario-tabla,vista-todos,conversion-unidad,ingreso-precio}.test.tsx
```

**Structure Decision**: PWA única existente (`src/features/*`, `tests/unit`, `tests/integration`);
el cambio queda dentro de `features/insumos`.

## Despliegue

Solo front: merge a `develop`, release con `main` y Netlify. Sin `db push`. Si el front falla, se
revierte sin tocar el servidor. Avisar al equipo del cambio de "Consumir 1" a "Consumir".
