# Implementation Plan: Unidades y Costo Unitario

**Branch**: `015-unidades-y-costo-unitario` | **Date**: 2026-10-19 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/015-unidades-y-costo-unitario/spec.md`

## Summary

Separa la unidad de compra de la de consumo, registra el precio de compra y deriva el costo
unitario de cada insumo, sin cambiar ningún stock existente.

- **Catálogo** del DS §25 como constante de código; `pieza` pasa a `unidad` (research.md R1).
- **Stock en unidad de consumo**, como hoy. Cada movimiento guarda su `unidad`, lo que permite
  convertir sin reescribir historia (R2).
- **Conversión de la unidad de consumo** (Q1): un cambio `unidadMedida` con `factor` en el ledger
  `cambios_insumo`; los factores se obtienen plegando el ledger de forma determinista, también con
  consumos offline en la unidad anterior (R3). Un solo punto normaliza las cantidades al leer stock
  (R4).
- **Presentación** (`unidadCompra`, `contenido`) en el insumo, editable por administración, y
  **snapshot** del ingreso en el lote (R5).
- **Precio** por unidad de compra en el lote (inmutable) y correcciones en la tabla nueva
  append-only `cambios_lote`, abierta a todo el tenant (Q3, R6).
- **Costo unitario** = último ingreso con precio del tenant (Q2, R7), calculado en el dispositivo.
- **Compras**: presentaciones sugeridas para insumos bajo mínimo (R8) y equivalentes "≈ 2 cajas +
  20" (R9).
- **Migración** en servidor y Dexie v11 con contenido 1, sin cambios de valores (R10).

## Technical Context

**Language/Version**: TypeScript ~6.0 (React 19), Node.js ^22.22 o ≥24.15.

**Primary Dependencies**: sin dependencias nuevas. Supabase JS, Dexie, Zustand, Tailwind,
`lucide-react`; `fake-indexeddb` (dev, ya instalada en la 014) para el upgrade v11.

**Storage**:
- Postgres (Supabase): columnas nuevas en `insumos`, `lotes`, `movimientos` y `cambios_insumo`;
  tabla `cambios_lote`; triggers `normalizar_unidad`, `completar_unidad_movimiento`, `proteger_lote`;
  `proteger_catalogo_insumo` y `verificar_traslado` ampliados.
- Dexie v11: mismos campos más `cambiosLote`.
- Detalle en [data-model.md](./data-model.md) y [contracts/supabase-schema.md](./contracts/supabase-schema.md).

**Testing**:
- Vitest + RTL: funciones puras (factores, conversión, precio, costo, sugeridas, equivalentes),
  upgrade v11, sync de `cambiosLote` y columnas nuevas, y los flujos de interfaz de
  [contracts/ui-contracts.md](./contracts/ui-contracts.md).
- Prueba de arquitectura: ninguna lectura de `db.movimientos` para stock fuera de la lista
  permitida (R4).
- `test:rls` con los casos de contracts/supabase-schema.md §8.
- Ensayo de la migración sobre el respaldo de producción; Dexie v11 en Chromium real.

**Target Platform**: PWA (teléfono, tablet y desktop) y Supabase (Postgres, Auth).

**Project Type**: PWA + esquema Supabase.

**Performance Goals**: el costo unitario y los factores se calculan en memoria sobre cientos de
insumos y miles de movimientos por tenant, sin demora perceptible al abrir el inventario (menos de
100 ms extra en un teléfono medio, medido en la prueba de integración con 300 insumos).

**Constraints**:
- Ningún stock, mínimo ni movimiento existente cambia de valor (SC-001).
- Offline completo: presentación, ingreso con conversión, precio, corrección y conversión de unidad
  (Constitución I).
- Clientes 2.3.0 siguen funcionando durante el despliegue (triggers de compatibilidad); la primera
  conversión espera a que todos los dispositivos estén actualizados.
- No renombrar `inDENToryDB` ni `unidad_medida`.

**Scale/Scope**:
- 1–2 tenants, ≤ 300 insumos y unos miles de movimientos por tenant.
- ~12 archivos de lógica y ~8 componentes afectados; 2 diálogos nuevos (precio de lote y
  conversión).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Cumplimiento | Estado |
|---|---|---|
| I. Offline-First | Todo se escribe primero en Dexie. Conversiones y correcciones de precio son ledgers append-only con orden `(creadoEn, id)`: los conflictos se resuelven de forma determinista y auditable. Los consumos offline en la unidad anterior se convierten con su `unidad` explícita, sin pérdida | ✅ |
| II. Zustand | Factores, movimientos normalizados y costo unitario se derivan en `inventoryStore`; no hay estado nuevo fuera de Zustand | ✅ |
| III. Táctil 48 px | Selectores de unidad, segmentados `[Cajas \| Cartuchos]` y `[Por caja \| Total]`, `Stepper` de contenido y botones de los diálogos ≥ 48 px | ✅ |
| IV. Trazabilidad y alertas | Lotes conservan su snapshot y su historial de precios; los movimientos nunca se reescriben; las alertas siguen calculándose localmente, en unidad de consumo | ✅ |
| V. Búsqueda manual | Sin cambios; ningún formulario activa la cámara | ✅ |
| VI. Multi-usuario | Cada cambio de presentación, conversión y precio guarda `usuario_id = auth.uid()`; la conversión y la presentación siguen restringidas a administración en el servidor | ✅ |
| Pila obligatoria | Sin dependencias nuevas | ✅ |

**Re-check post-diseño**: sin violaciones. El único punto delicado es que la lectura de stock dependa
de un helper de normalización (R4); se protege con la prueba de arquitectura.

## Project Structure

### Documentation (this feature)

```text
specs/015-unidades-y-costo-unitario/
├── plan.md
├── research.md          # R1–R11
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── supabase-schema.md   # migración, triggers, cambios_lote, sync, casos test:rls
│   └── ui-contracts.md      # presentación, ingreso, tabla, detalle, precio, conversión, compras
├── checklists/requirements.md
└── tasks.md             # /speckit-tasks
```

### Source Code (repository root)

```text
supabase/migrations/20261021000000_unidades_y_costo.sql  # nuevo
scripts/test-rls.mjs                                     # casos §8

src/lib/db/index.ts                     # tipos + version(11) + cambiosLote
src/lib/sync/index.ts                   # columnas nuevas; push/pull cambios_lote; reconciliación normalizada
src/lib/unidades.ts                     # nuevo: catálogo, normalizarUnidad, plural, formatearEquivalente
src/stores/inventoryStore.ts            # movimientos normalizados, factores, costo unitario, cambiosLote
src/features/insumos/lib/stock.ts       # factoresDeUnidad, cantidadEnUnidadActual, movimientosNormalizadosDeLote
src/features/insumos/lib/{catalogo,quantity,proyeccion,alta,movements,consumoRapido,traslado}.ts
src/features/insumos/lib/conversion.ts  # nuevo: validar y convertir unidad de consumo
src/features/insumos/lib/precio.ts      # nuevo: precio por total, costo de lote e insumo, corregir precio
src/features/compras/lib/{recepcion,sugeridos,compartir}.ts
src/features/insumos/components/{AltaMaterialView,EditarInsumoForm,InventarioTabla,InsumoCard,InsumoDetalle,ConsumoForm}.tsx
src/features/insumos/components/{PresentacionFields,CantidadIngresoField,PrecioIngresoField,EditarPrecioDialog,ConvertirUnidadDialog}.tsx  # nuevos
src/features/compras/components/{RecibirItemForm,ItemSugeridoCard}.tsx

tests/unit/{unidades,factoresUnidad,precio,conversion,sugeridasPresentacion,dexie-v11,sync-cambios-lote,lecturas-movimientos}.test.ts
tests/integration/{presentacion,ingreso-precio,conversion-unidad}.test.tsx
```

**Structure Decision**: mismo proyecto PWA. La lógica nueva va en módulos puros (`unidades.ts`,
`conversion.ts`, `precio.ts`) y la normalización de cantidades en un único punto de `stock.ts`, para
que las funciones de alertas, FEFO, Inicio y compras no cambien de firma.

## Riesgos y notas

- **Compuerta del roadmap**: confirmada con la clienta el 2026-10-19; se implementa.
- **Lecturas de stock sin normalizar**: si una lectura de `db.movimientos` se salta el helper, el
  stock de un insumo convertido sale mal. Mitigación: prueba de arquitectura y casos de integración
  con un insumo convertido en consumo rápido, traslado y reconciliación.
- **Clientes 2.3.0 y conversiones** (aceptado 2026-10-19): un 2.3.0 no entiende `factor` y
  mostraría stock sin convertir. Igual que en la 014, se verifica la versión de todos los
  dispositivos antes de la primera conversión.
- **Mínimo editado sin red durante una conversión**: queda en la unidad anterior (R3). Riesgo
  aceptado el 2026-10-19: requiere dos administradoras offline editando el mismo insumo; se corrige editando.
- **Redondeo**: `precio_compra` y los costos se guardan sin redondear (`numeric`); solo se redondea
  al mostrar. Un total que no divide exacto (p. ej. $10.000 / 3) guarda el cociente con la precisión
  de `numeric`; la diferencia de un peso al recomponer el total es aceptable y se documenta.
- **Tamaño**: M–L (revisado el 2026-10-19 por la conversión, Q1: A). Si hace falta recortar, la
  conversión (§5 de ui-contracts) es separable como última historia.

## Complexity Tracking

Sin violaciones de la constitución.
