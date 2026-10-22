# Implementation Plan: Detalles de alertas y formularios

**Branch**: `018-detalles-alertas-y-formularios` | **Date**: 2026-10-22 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/018-detalles-alertas-y-formularios/spec.md`

## Summary

Cuatro arreglos de front pedidos por la clienta, sin cambios de datos ni de sincronización:

- **Rueda del mouse** (P1): un componente `NumeroInput` que reemplaza los 10 `<input type="number">`
  de la app (incluido el del `Stepper`) y suelta el foco al recibir la rueda, así el navegador no cambia
  el valor y la página se desplaza (R1). Una prueba de arquitectura impide volver a escribir un
  `type="number"` suelto (R2).
- **Texto de caducidad** (P2): helpers puros `textoTiempoCaducidad` (días por debajo de 60, meses
  completos desde 60) y `formatearFechaCaducidad` (fecha local legible, sin el corrimiento de zona
  horaria) en `src/features/alertas/lib/` (R3, R4). Alertas, el resumen de Inicio y "Próximos
  vencimientos" los usan y dejan de mostrar el lote.
- **Detalle desde la alerta** (P2): el renglón pasa a ser un botón que abre el `InsumoDetalle`
  existente encima de la pantalla, con los datos del lugar de la alerta; al cerrarlo se queda donde
  estaba (R5).
- **"Sin stock"** (P2): etiqueta compartida por Alertas e Inicio (R6).
- **"¿Caduca?"** (P3): el interruptor del alta pasa dentro de la tarjeta del lote, justo antes de la
  fecha (R7).

## Technical Context

**Language/Version**: TypeScript ~6.0 (React 19), Node.js ^22.22 o ≥24.15.

**Primary Dependencies**: sin dependencias nuevas (React, Zustand, Dexie, Tailwind, `lucide-react`).

**Storage**: sin cambios. Postgres y Dexie (v12) iguales; no hay migración ni versión nueva de la base
local. Detalle en [data-model.md](./data-model.md).

**Testing**: Vitest + RTL — `NumeroInput` (rueda, escritura, flechas), una prueba de rueda por cada
componente con campos numéricos (FR-005), prueba de arquitectura `sin-input-number-suelto`, helpers de
texto y fecha con los límites (0, 1, 59, 60, 89, 90 días y caducados), integración de Alertas, Inicio y
el alta; recorrido visual y prueba manual de la rueda con `run-indentory` (quickstart).

**Target Platform**: PWA (teléfono, tablet, desktop). La rueda solo importa en desktop (Chrome, Edge,
Firefox, Safari).

**Project Type**: PWA, solo front.

**Performance Goals**: sin metas nuevas; los textos se derivan de cálculos que ya existen.

**Constraints**:
- Offline completo (Constitución I/IV): solo cambia la presentación de datos locales.
- Objetivos táctiles ≥ 48 px (Constitución III), incluidos los renglones de alerta que pasan a ser
  botones.
- Mismo cálculo de alertas y niveles (FR-015): `computeAlertasCaducidad`, `computeInsumosStockBajo` y
  `resumenInicio` no cambian su lógica.

**Scale/Scope**: 1 componente nuevo (`NumeroInput`), 2 helpers, ~12 componentes tocados, 1 prueba de
arquitectura.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Cumplimiento | Estado |
|---|---|---|
| I. Offline-First | Sin red ni sincronización involucradas; todo se deriva de IndexedDB | ✅ |
| II. Zustand | Sin store nuevo; el insumo abierto es estado local del componente (`useState`), como en Inventario | ✅ |
| III. Táctil 48 px | Renglones de alerta y vencimiento como botones de ≥ 48 px de alto; `NumeroInput` conserva la altura de los campos actuales; el interruptor movido mantiene su área | ✅ |
| IV. Trazabilidad y alertas | El lote sigue a un toque (detalle); alertas visuales por color, ícono y etiqueta se mantienen; "Lotes en revisión" conserva el lote | ✅ |
| V. Búsqueda manual | Ningún formulario activa la cámara; el alta solo reordena un campo | ✅ |
| VI. Multi-usuario | Sin cambios en registros ni autoría | ✅ |
| Pila obligatoria | Sin dependencias nuevas | ✅ |

**Re-check post-diseño**: sin violaciones.

## Project Structure

### Documentation (this feature)

```text
specs/018-detalles-alertas-y-formularios/
├── plan.md
├── research.md          # R1–R8
├── data-model.md        # sin esquema nuevo; tipos derivados de presentación
├── quickstart.md
├── contracts/
│   └── ui-contracts.md  # NumeroInput, textos de caducidad, renglones de alerta, alta
├── checklists/requirements.md
└── tasks.md             # /speckit-tasks
```

### Source Code (repository root)

```text
src/
├── components/ui/
│   ├── NumeroInput.tsx            # NUEVO (R1)
│   └── Stepper.tsx                # usa NumeroInput
├── features/
│   ├── alertas/
│   │   ├── lib/textoCaducidad.ts  # NUEVO: textoTiempoCaducidad, formatearFechaCaducidad (R3, R4)
│   │   ├── lib/etiquetaStock.ts   # NUEVO: "Sin stock" / "Bajo mínimo" (R6)
│   │   └── components/
│   │       ├── AlertasView.tsx              # renglones sin lote, botón → InsumoDetalle
│   │       ├── RenglonAlerta.tsx            # NUEVO: renglón-botón compartido con Inicio (UI §4)
│   │       └── DetalleDesdeAlerta.tsx       # NUEVO: InsumoDetalle con la vista del lugar (R5)
│   ├── inicio/components/InicioView.tsx     # resumen y próximos vencimientos alineados
│   ├── insumos/components/
│   │   ├── AltaMaterialView.tsx             # interruptor "¿Caduca?" antes de la fecha (R7)
│   │   ├── ConsumoForm.tsx, EditarInsumoForm.tsx,
│   │   │   ConvertirUnidadDialog.tsx, PrecioIngresoField.tsx   # → NumeroInput
│   │   └── InsumoDetalle.tsx                # sin cambios de contrato
│   ├── ajustes/components/
│   │   ├── ConfiguracionAlertasSection.tsx  # → NumeroInput (×2)
│   │   └── LugaresSection.tsx               # → NumeroInput
│   └── tratamientos/components/TratamientoForm.tsx  # → NumeroInput

tests/
├── unit/
│   ├── NumeroInput.test.tsx
│   ├── alertas/textoCaducidad.test.ts
│   ├── alertas/etiquetaStock.test.ts
│   └── sin-input-number-suelto.test.ts      # arquitectura (R2)
└── integration/
    ├── rueda-campos-numericos.test.tsx      # NUEVO: rueda en cada formulario (FR-005)
    ├── alertas-detalle.test.tsx             # NUEVO: textos, sin lote, detalle, "Sin stock"
    ├── inicio.test.tsx                      # ampliado: resumen y próximos vencimientos
    └── alta-material.test.tsx               # ampliado: orden del interruptor
```

**Structure Decision**: misma estructura por feature de las specs anteriores. Lo compartido entre
Alertas e Inicio (textos y etiqueta de stock) vive en `features/alertas/lib/`, que ya es la dueña de
los cálculos de alertas; el control numérico va con los demás componentes de UI en
`src/components/ui/`.

## Complexity Tracking

Sin violaciones de la constitución; no aplica.
