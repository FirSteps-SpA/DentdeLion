# Implementation Plan: Reportes y KPIs

**Branch**: `017-reportes-y-kpis` | **Date**: 2026-10-22 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/017-reportes-y-kpis/spec.md`

## Summary

Agrega la sección **Reportes** (DS §34) con Producción, Gasto en materiales y Ganancia estimada y
sus variaciones, cuatro gráficos y filtros de período y lugar, y suma **Valor de inventario** a
Inicio (DS §20). Sin tablas nuevas: todo se deriva en memoria de los stores existentes.

- **Cálculo** con funciones puras en `src/features/reportes/lib/` sobre `inventoryStore` y
  `tratamientosStore` (R1).
- **Gasto** = consumos valorizados al costo de su lote, neto de reversiones imputadas al consumo
  (R2). **Producción** y **ganancia** desde los snapshots de la 016 (R3).
- **Períodos** fijos + mes pasado, en hora local, con ventana de 13 meses (R4, R5).
- **Gráficos SVG propios**, sin dependencias, accesibles y con la paleta del DS §35 (R6, R7).
- **Valor de inventario** reconstruido desde movimientos para el cierre del mes anterior (R8).
- **Pulls paginados** de las tablas que crecen: hoy se truncan en 1.000 filas, lo que rompería la
  ventana de 13 meses (y el stock) en dispositivos nuevos (R9).
- **Navegación**: Reportes en la sidebar y en "Más" en móvil (R11).

## Technical Context

**Language/Version**: TypeScript ~6.0 (React 19), Node.js ^22.22 o ≥24.15.

**Primary Dependencies**: sin dependencias nuevas (Supabase JS, Dexie, Zustand, Tailwind,
`lucide-react` — íconos `ChartColumn` y `Wallet`). Gráficos en SVG propio (R7).

**Storage**: sin cambios de esquema. Postgres y Dexie (v12) iguales; solo cambia cómo se descargan
seis tablas (paginación). Detalle en [data-model.md](./data-model.md).

**Testing**: Vitest + RTL — períodos, gasto con reversiones, KPIs e invariantes, valor de
inventario, rendimiento con datos sintéticos, paginación del sync, integración de Reportes e Inicio;
prueba de arquitectura `lecturas-movimientos`; ensayo de pull completo en Chromium real (quickstart
§5); recorrido visual con `run-indentory`.

**Target Platform**: PWA (teléfono, tablet, desktop) + Supabase.

**Project Type**: PWA (sin cambios en el esquema Supabase).

**Performance Goals**: cálculo completo de Reportes < 300 ms en Node con 20.000 movimientos y 3.000
tratamientos; pantalla completa < 2 s en el dispositivo, también sin red (SC-004).

**Constraints**:
- Offline completo (Constitución I/IV): todo se calcula con datos locales.
- 13 meses de historia garantizados en el dispositivo (FR-018a).
- "Ganancia estimada", nunca "utilidad" (FR-006).
- Ningún dato de otro tenant (los stores ya filtran por tenant con `delTenant`).

**Scale/Scope**: 1 sección nueva, 4 gráficos, 1 tarjeta en Inicio; ~5 módulos de lógica, ~8
componentes, 1 helper de sync.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Cumplimiento | Estado |
|---|---|---|
| I. Offline-First | Cálculo 100 % local; pulls paginados garantizan la historia completa en el dispositivo; nada nuevo que sincronizar | ✅ |
| II. Zustand | Derivados con `useMemo` sobre `inventoryStore`, `tratamientosStore` y `lugarStore`; sin store nuevo | ✅ |
| III. Táctil 48 px | Selector de período, "Ver como tabla", elementos de gráficos con tooltip y tarjeta de Inicio ≥ 48 px | ✅ |
| IV. Trazabilidad y alertas | Valoriza movimientos por lote sin modificarlos; alertas sin cambios; valor de inventario excluye caducados | ✅ |
| V. Búsqueda manual | Ninguna pantalla activa la cámara | ✅ |
| VI. Multi-usuario | Solo lectura; visible para todo el equipo (FR-020); aislamiento por tenant heredado | ✅ |
| Pila obligatoria | Sin dependencias nuevas; gráficos con React + SVG + Tailwind | ✅ |

**Re-check post-diseño**: sin violaciones.

## Project Structure

### Documentation (this feature)

```text
specs/017-reportes-y-kpis/
├── plan.md
├── research.md          # R1–R12
├── data-model.md        # tipos derivados, sin esquema nuevo
├── quickstart.md
├── contracts/
│   ├── reportes-lib.md  # funciones puras y seleccionarTodo
│   └── ui-contracts.md
├── checklists/requirements.md
└── tasks.md             # /speckit-tasks
```

### Source Code (repository root)

```text
src/lib/sync/paginar.ts                    # nuevo: seleccionarTodo
src/lib/sync/index.ts                      # 6 pulls usan seleccionarTodo

src/features/reportes/lib/{periodos,gasto,kpis,valorInventario}.ts   # nuevos, puros
src/features/reportes/useReportes.ts       # nuevo: hooks useReportes / useValorInventario
src/features/reportes/components/ReportesView.tsx                    # nuevo
src/features/reportes/components/{SelectorPeriodo,TarjetaKpiReporte,EstadoVacioReportes}.tsx
src/features/reportes/components/charts/{DonutChart,LineChart,HorizontalBarChart,BarChart,TablaAlternativa,colores}.tsx

src/components/ui/Card.tsx                 # KpiCard: props variacion y nota; onClick opcional
src/components/icons/index.tsx             # ChartColumn, Wallet
src/app/{navegacion.ts,App.tsx}            # vista 'reportes'
src/features/ajustes/components/AjustesView.tsx   # acceso Reportes en "Más"
src/features/inicio/components/InicioView.tsx     # tarjeta Valor de inventario

tests/unit/reportes/{periodos,gasto,kpis,valorInventario,rendimiento}.test.ts
tests/unit/sync-paginacion.test.ts
tests/integration/{reportes,inicio-valor-inventario,navegacion-reportes}.test.tsx
```

**Structure Decision**: feature nueva `src/features/reportes/` con lógica pura separada de los
componentes, como `tratamientos` e `insumos`. Reutiliza `costoLote`, `factoresDeUnidad`,
`stockLoteEnLugar`, `claveCategoria`, `formatearCLP`, `ETIQUETA_GANANCIA`/`NOTA_GANANCIA` y
`KpiCard`.

## Riesgos y notas

- **Pulls truncados (R9)**: hallazgo de esta spec; afecta también al inventario actual en cuanto
  un tenant supere 1.000 movimientos. Conviene implementarlo primero (fase fundacional) y, si el
  volumen de producción ya se acerca, publicarlo como arreglo antes del resto de la spec.
- **Volumen del ciclo completo**: cada sync baja todas las filas. Se mide en el ensayo; el pull
  incremental queda para después si hace falta.
- **Gasto vs. costo de tratamientos**: el gasto valoriza al costo del lote y el snapshot del
  tratamiento al costo unitario vigente al registrar; pueden diferir. Se explica en la ayuda de la
  tarjeta.
- **"Este año" casi siempre sin comparación** por la ventana de 13 meses (Clarifications Q5).
  Pasar a 24 meses es solo cambiar `inicioVentana`, si la clienta lo pide.

## Complexity Tracking

Sin violaciones de la constitución que justificar.
