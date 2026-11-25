# Implementation Plan: Lugares que comparten bodega

**Branch**: `033-bodega-compartida` | **Date**: 2026-11-24 | **Spec**: [spec.md](./spec.md)

## Summary

Varios lugares del mismo tenant pueden compartir un solo stock. Se guarda como `lugares.bodega_id`
(uuid; `null` = bodega propia). Todo el inventario se calcula con la "vista del lugar" de la spec 014.
Esa vista pasa a filtrar por el **conjunto** de lugares de la bodega, así que estado, alertas,
sugeridos, Compras e Inicio cambian en un solo punto. El mínimo por bodega reutiliza `minimos_lugar`
(lectura = el mayor; escritura en todos los lugares). Juntar solo cambia `bodega_id`. Separar
registra traslados que dejan al lugar en 0. Los reportes por lugar siguen el lugar de cada
movimiento; el valor del inventario agrupa por bodega.

## Technical Context

**Language/Version**: TypeScript (React 19), SQL (Postgres 17).

**Primary Dependencies**: las existentes (Zustand, Dexie, Tailwind, supabase-js). Sin nuevas.

**Storage**: migración `20261128000000_bodega_compartida.sql` (columna + índice + check). Dexie: campo
nuevo en `Lugar`, sin versión nueva.

**Testing**: Vitest. Unit: `bodega.ts` (conjunto, rótulo), `datosDeBodega`, mínimos (máx. y
escritura), `separarDeBodega` (saldos ±, traslados, último lugar), `reconcileOverdraft` por bodega,
consumo, ajuste y traslado validados contra el stock común. Integración: Ajustes → Lugares (juntar,
mínimos, separar, desactivar), Inventario/Alertas/Compras/Inicio en bodega, "Todos", Reportes (valor
sin doble conteo). `test:rls`: contracts/api.md §1–6.

**Target Platform**: PWA (móvil, tablet, desktop).

**Project Type**: web app (SPA offline-first + Supabase).

**Performance Goals**: sin metas nuevas; la prueba de Reportes (< 300 ms) sigue aplicando (R10).

**Constraints**: offline-first (juntar y separar funcionan sin conexión y suben con el sync de
lugares/mínimos/movimientos); sin cambios para tenants sin bodegas (FR-019); compatibilidad con
clientes 2.11 (R9).

**Scale/Scope**: ~20 archivos de cliente (inventario de R2), 1 migración, ~10 archivos de test.

## Constitution Check

| Principio | Cumplimiento | Estado |
|---|---|---|
| I. Offline-First | Juntar y separar se escriben en Dexie y suben con el sync. El stock es una función pura de movimientos + `bodega_id` y converge en cualquier orden de llegada (R6) | ✅ |
| II. Zustand | `lugarStore` expone la bodega; las vistas siguen derivadas en hooks | ✅ |
| III. Táctil 48 px | Acciones y confirmaciones nuevas con `TouchButton` | ✅ |
| IV. Trazabilidad | Ningún movimiento se reescribe. Cada movimiento conserva su lugar. Separar deja traslados con autor y fecha | ✅ |
| V. Búsqueda manual | Sin cambios en el consumo por búsqueda | ✅ |
| VI. Multi-usuario | Solo administración cambia `bodega_id` (policy existente), probado en `test:rls` | ✅ |

Re-evaluado tras el diseño (Phase 1): sin cambios.

## Project Structure

### Documentation (this feature)

```text
specs/033-bodega-compartida/
├── spec.md · plan.md · research.md (R1–R10) · data-model.md · quickstart.md
├── contracts/{api.md, ui-contracts.md}
└── checklists/requirements.md
```

### Source Code

```text
supabase/migrations/20261128000000_bodega_compartida.sql
scripts/test-rls.mjs                                   # §1–6
src/lib/db/index.ts                                    # Lugar.bodegaId
src/lib/sync/index.ts                                  # toLugarRow/fromLugarRow
src/lib/sync/reconcileOverdraft.ts                     # por bodega
src/stores/lugarStore.ts                               # bodegaDe, lugaresDeBodega, rotuloBodega
src/features/insumos/lib/{vistaLugar,stock,minimos,consumo,ajusteStock,conversion,traslado}.ts
src/features/insumos/lib/bodega.ts                     # nuevo: compartirBodega, separarDeBodega
src/features/insumos/components/{InventarioView,ConsumoForm,TrasladoForm,EditarInsumoForm,ConvertirUnidadDialog}.tsx
src/features/ajustes/components/LugaresSection.tsx     # juntar / separar / desactivar
src/features/ajustes/lib/minimosEditor.ts
src/features/compras/components/ComprasView.tsx        # "Agregado en …"
src/features/alertas/components/AlertasView.tsx
src/features/inicio/components/InicioView.tsx
src/features/tratamientos/{lib/registro.ts,components/RegistrarTratamientoSheet.tsx}
src/features/reportes/lib/valorInventario.ts          # por bodega
src/app/SelectorLugar.tsx                              # "· bodega con …"
src/features/ayuda/contenido.ts                        # Lugares: compartir bodega
tests/unit/{bodega,vista-bodega,minimos-bodega,separar-bodega,reconcile-bodega}.test.ts
tests/integration/{lugares-bodega,inventario-bodega,compras-bodega,reportes-bodega}.test.tsx
```

**Structure Decision**: proyecto único existente. La lógica de bodega va en
`features/insumos/lib/bodega.ts` (operaciones) y en `lugarStore` (consultas), junto a lo que ya
existe de lugares.

## Orden sugerido

1. Fundación: migración + `bodegaId` en Dexie/sync + helpers de bodega + `datosDeBodega`. Con todos
   los lugares en `null` no cambia nada (FR-019): la suite actual debe seguir en verde.
2. US2 (operar sobre el stock común): validaciones, reconciliación, vistas, Compras, "Todos",
   Reportes. Se prueba poniendo `bodegaId` a mano en los tests.
3. US1 (juntar con confirmación y mínimos).
4. US3 (separar y desactivar).

US1 y US2 son P1, pero US2 se construye primero porque US1 sin US2 dejaría una bodega que no hace
nada.

## Despliegue

`db push` (columna nullable, sin datos que mover) → front → esperar que los dispositivos se
actualicen antes de configurar bodegas (R9).

## Complexity Tracking

Sin desviaciones que justificar.
