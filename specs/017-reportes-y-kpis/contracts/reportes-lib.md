# Contrato: lógica de reportes (`src/features/reportes/lib/`)

**Feature**: 017-reportes-y-kpis | **Date**: 2026-10-22

Funciones **puras** (sin Dexie, sin React, sin reloj implícito: reciben `ahora`). Tipos en
[data-model.md](../data-model.md). Las pruebas unitarias se escriben contra este contrato.

## `periodos.ts`

| Función | Firma | Garantías |
|---|---|---|
| `inicioVentana` | `(ahora: Date) => Date` | Día 1 del mes actual − 12 meses, 00:00 local |
| `rangoPeriodo` | `(p: Periodo, ahora: Date) => RangoPeriodo` | Tabla de research R4; `anterior = null` si sale de la ventana |
| `mesesSeleccionables` | `(ahora: Date) => { anio, mes }[]` | Los 12 meses completos de la ventana, del más reciente al más antiguo |
| `enRango` | `(iso: string, desde: Date, hasta: Date) => boolean` | `desde ≤ t < hasta` |

## `gasto.ts`

| Función | Firma | Garantías |
|---|---|---|
| `indiceCostos` | `(lotes, insumos, cambiosLote, cambiosInsumo) => { costoPorLote: Map<string, number \| null>; insumoPorLote: Map<string, Insumo> }` | `costoLote` calculado una vez por lote |
| `consumosValorizados` | `(movimientos, indice, filtro: FiltroLugar) => ConsumoValorizado[]` | Un elemento por consumo con `monto` neto de sus reversiones (`ajuste` con `movimientoOrigenId`), fecha y lugar del consumo; `monto = null` si el lote no tiene precio |

`ConsumoValorizado = { movimientoId, insumoId, lugarId, creadoEn, cantidad, monto: number | null }`
(`cantidad` neta, en la unidad de consumo actual).

## `kpis.ts`

| Función | Firma | Garantías |
|---|---|---|
| `variacion` | `(actual: number, anterior: number \| null) => Kpi['variacion']` | research R5 |
| `resumenReportes` | `(entrada: EntradaReportes, p: Periodo, filtro: FiltroLugar, ahora: Date) => ResumenReportes` | FR-003 a FR-012, FR-016, FR-017 |

`EntradaReportes = { realizados, consumos: ConsumoValorizado[], insumos, lugares }`.

Invariantes verificadas por pruebas:

1. Σ por lugar de `produccion`, `gasto` y `ganancia` = valor en `'todos'` (SC-003).
2. Un realizado anulado no cambia ningún valor.
3. Deshacer un consumo deja el gasto igual a no haberlo registrado, en el período del consumo.
4. `porCategoria.length ≤ 5`, `masUtilizados.length ≤ 10`, Σ `porCategoria.monto` = `gasto.valor`.
5. Mismo resultado con cualquier orden de entrada (determinismo).

## `valorInventario.ts`

| Función | Firma | Garantías |
|---|---|---|
| `valorInventario` | `(movimientos, lotes, indice, filtro, fecha: Date) => { valor, lotesSinPrecio }` | Solo movimientos con `creadoEn < fecha` y lotes no caducados a `fecha` con stock > 0 |
| `valorInventarioConVariacion` | `(..., ahora: Date) => ValorInventario` | Compara `ahora` con el fin del mes anterior |

## Hook `useReportes` / `useValorInventario` (`src/features/reportes/useReportes.ts`)

- Lee `inventoryStore`, `tratamientosStore`, `lugarStore`; memoriza `indiceCostos` y
  `consumosValorizados` por versión de los arrays, y `resumenReportes` por `(periodo, filtro)`.
- No lee `db.movimientos` directamente (prueba `lecturas-movimientos.test.ts`).

## Sync: `seleccionarTodo` (`src/lib/sync/paginar.ts`)

```text
seleccionarTodo(client, tabla, tamañoPagina = 1000)
  → { data: Row[] | null, error }
```

- Pagina **por cursor**: `.select('*').order('id').limit(tamañoPagina)` y, desde la segunda página,
  `.gt('id', últimoId)`, hasta que una página trae menos de `tamañoPagina` filas (research R9).
- Ante el error de cualquier página devuelve `{ data: null, error }` (no aplica filas parciales).
- Lo usan los pulls de `movimientos`, `lotes`, `cambios_lote`, `cambios_insumo`,
  `cambios_tratamiento` y `tratamientos_realizados`.
