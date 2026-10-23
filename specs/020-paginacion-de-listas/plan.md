# Implementation Plan: Paginación de listas

**Branch**: `020-paginacion-de-listas` | **Date**: 2026-10-23 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/020-paginacion-de-listas/spec.md`

## Summary

Inventario y las listas de Ajustes pasan a mostrarse por partes con un componente común, sin tocar
datos ni sincronización:

- **Paginación común** (P1): `src/lib/paginacion.ts` con funciones puras y el hook
  `useListaPaginada`, que guarda un solo número (`hasta`) y sirve para "Ver más" y para páginas
  numeradas (R1). Vuelve al comienzo cuando cambia una `clave` (búsqueda, filtros, lugar) (R2) y nunca
  muestra una página vacía si la lista se achica (R3). Componentes `VerMas` y `Paginador` en
  `components/ui`.
- **Inventario** (P1–P2): orden alfabético estable (R4); tarjetas (teléfono y tablet) con "Ver más";
  tabla (desktop) con páginas numeradas, desplazamiento al comienzo y anuncio del rango (R6). El
  detalle del insumo se abre en `BottomSheet`, como desde Alertas, así la lista no se mueve (R5).
  Búsqueda, filtros y resumen de alertas siguen calculándose sobre todo el inventario.
- **Ajustes** (P3): Categorías e Insumos dados de baja (este último, ordenado por nombre) usan
  `VerMas`; el editor de mínimos reemplaza su "Ver más" propio por el común.

## Technical Context

**Language/Version**: TypeScript ~6.0 (React 19), Node.js ^22.22 o ≥24.15.

**Primary Dependencies**: sin dependencias nuevas (React, Zustand, Dexie, Tailwind, `lucide-react`).

**Storage**: sin cambios (Postgres y Dexie v12); la paginación es estado de presentación en
`useState`. Detalle en [data-model.md](./data-model.md).

**Testing**: Vitest + RTL — unit de las funciones puras y del hook; integración nueva de Inventario con
volumen (60–200 insumos); tabla, Ajustes y mínimos ampliados; tests que usan "Cerrar detalle" pasan al
"Cerrar" de la hoja. Capturas con `run-indentory` en tres tamaños (quickstart).

**Target Platform**: PWA (teléfono, tablet, desktop).

**Project Type**: PWA, solo front.

**Performance Goals**: primera página de Inventario con 200 insumos en < 1 s en un teléfono de gama
media (SC-001); se renderizan 25 tarjetas o filas en vez de todas. Los cálculos de estado y alertas
siguen siendo sobre todo el inventario (sin cambio de costo).

**Constraints**:
- Offline completo (Constitución I): todo sale de los stores locales; no hay red de por medio.
- Táctil ≥ 48 px (Constitución III): "Ver más", números, anterior/siguiente con `touch-target`.
- Búsqueda, filtros, alertas y totales antes de paginar (FR-008).
- Sin cambios en `src/lib/sync`, `src/lib/db` ni `supabase/` (SC-006).

**Scale/Scope**: 1 módulo nuevo (`lib/paginacion.ts`), 2 componentes UI nuevos, 6 componentes tocados
(`InventarioView`, `InventarioTabla`, `InsumoDetalle`, `DetalleDesdeAlerta`, y 3 secciones de Ajustes),
1 script de seed ampliado, 3 archivos de prueba nuevos y ~6 ajustados.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Cumplimiento | Estado |
|---|---|---|
| I. Offline-First | Paginar es solo presentación sobre los datos de IndexedDB ya cargados | ✅ |
| II. Zustand | Sin store nuevo; la página es estado local de la pantalla, como los filtros de Inventario | ✅ |
| III. Táctil 48 px | Todos los controles con `touch-target`; "Ver más" evita gestos de precisión en móvil | ✅ |
| IV. Trazabilidad y alertas | El resumen de alertas y los filtros de estado siguen sobre todo el inventario; nada queda oculto a las alertas | ✅ |
| V. Búsqueda manual | La búsqueda de Inventario busca en todo y lleva al comienzo de los resultados; sin cámara | ✅ |
| VI. Multi-usuario | Sin cambios en autoría ni permisos | ✅ |
| Pila obligatoria | Sin dependencias nuevas (sin librería de virtualización ni paginación) | ✅ |

**Re-check post-diseño**: sin violaciones.

## Project Structure

### Documentation (this feature)

```text
specs/020-paginacion-de-listas/
├── plan.md
├── research.md          # R1–R8
├── data-model.md        # sin esquema; estado de paginación y orden de cada lista
├── quickstart.md
├── contracts/
│   └── ui-contracts.md  # paginacion.ts, VerMas, Paginador, cambios por componente, tests
├── checklists/requirements.md
└── tasks.md             # /speckit-tasks
```

### Source Code (repository root)

```text
src/
├── lib/
│   └── paginacion.ts                        # NUEVO: TAMANO_PAGINA, funciones puras, useListaPaginada (R1–R3)
├── components/ui/
│   ├── VerMas.tsx                           # NUEVO: botón + región aria-live (R6)
│   └── Paginador.tsx                        # NUEVO: anterior/números/siguiente + rango (R6)
└── features/
    ├── insumos/components/
    │   ├── InventarioView.tsx               # orden por nombre, useListaPaginada, detalle en BottomSheet (R4, R5)
    │   ├── InventarioTabla.tsx              # caption con el rango, ref para desplazar y enfocar
    │   └── InsumoDetalle.tsx                # sin `enHoja` ni "Cerrar detalle" (siempre en hoja)
    ├── alertas/components/
    │   └── DetalleDesdeAlerta.tsx           # deja de pasar `enHoja`
    └── ajustes/
        ├── lib/minimosEditor.ts             # sin TAMANO_PAGINA_MINIMOS
        └── components/
            ├── MinimosPorInsumoSection.tsx  # VerMas común
            ├── CategoriasSection.tsx        # VerMas
            └── InsumosBajaSection.tsx       # orden por nombre + VerMas

scripts/
└── seed-volumen.mjs                         # --insumos N (R8)

tests/
├── unit/
│   ├── paginacion.test.ts                   # NUEVO
│   └── useListaPaginada.test.tsx            # NUEVO
└── integration/
    ├── inventario-paginacion.test.tsx       # NUEVO: volumen, filtros, alertas, detalle en hoja, foco
    ├── inventario-tabla.test.tsx            # paginador
    ├── inventario.test.tsx, acciones-rapidas.test.tsx, alertas-detalle.test.tsx  # cierre por la hoja
    ├── ajustes.test.tsx                     # categorías y dados de baja con Ver más
    └── ajustes-minimos.test.tsx             # sin regresiones con el VerMas común
```

**Structure Decision**: la lógica de paginación va en `src/lib/paginacion.ts` y los controles en
`src/components/ui`, porque los usan dos features (`insumos` y `ajustes`). Cada lista sigue siendo
dueña de su filtrado y orden; el hook solo recorta.

## Complexity Tracking

Sin violaciones de la constitución; no aplica.

## Notas

- **Orden alfabético** (FR-003a): ajuste hecho durante el plan. La spec asumía "el orden de hoy",
  pero Inventario e insumos dados de baja salen por `id` (UUID), es decir, sin orden para la persona.
- **021 (proveedores)**: la lista de proveedores en Ajustes puede usar `useListaPaginada` + `VerMas`
  desde el primer día.
