# Data Model: Reportes y KPIs

**Feature**: 017-reportes-y-kpis | **Date**: 2026-10-22

Esta spec **no agrega tablas** ni columnas en Postgres ni en Dexie, y no cambia la versión de Dexie
(sigue en v12). Todo lo de abajo son **tipos derivados en memoria** (`src/features/reportes/lib/`),
calculados desde entidades existentes.

## Fuentes (existentes)

| Entidad | Store | Campos usados |
|---|---|---|
| `TratamientoRealizado` (016) | `tratamientosStore.realizados` | `lugarId`, `creadoEn`, `precio`, `gananciaEstimada`, `anuladoEn` |
| `Movimiento` normalizado (002/014/015/016) | `inventoryStore.movimientos` | `tipo`, `loteId`, `lugarId`, `cantidad` (unidad actual), `movimientoOrigenId`, `creadoEn` |
| `Lote` (015) | `inventoryStore.lotes` | `insumoId`, `fechaCaducidad`, `precioCompra`, `contenido`, `unidadConsumo` |
| `CambioLote` (015) | `inventoryStore.cambiosLote` | precio vigente (`precioVigenteLote`) |
| `CambioInsumo` (015) | `inventoryStore.cambiosInsumo` | factores de unidad (`factoresDeUnidad`) |
| `Insumo` (activos y dados de baja) | `inventoryStore.insumos`, `insumosDadosDeBaja` | `nombre`, `categoria`, `unidadMedida`, `dadoDeBajaEn` |
| `Lugar` (014) | `lugarStore` | `id`, `nombre`, `desactivadoEn` |

## Tipos derivados

### `Periodo`

```ts
type Periodo =
  | { tipo: 'esteMes' | 'mesAnterior' | 'ultimos3' | 'esteAnio' }
  | { tipo: 'mes'; anio: number; mes: number } // mes 0–11, dentro de la ventana
```

### `RangoPeriodo`

| Campo | Tipo | Regla |
|---|---|---|
| `desde`, `hasta` | `Date` | `[desde, hasta)` en hora local (research R4) |
| `anterior` | `{ desde, hasta } \| null` | Período de comparación (FR-005); `null` si empieza antes de la ventana de 13 meses |
| `etiqueta` | `string` | "Este mes", "Marzo 2026"… |
| `meses` | `{ anio, mes }[]` | Meses de la serie de Gastos mensuales (6 o 12) |

**Ventana**: `inicioVentana(ahora)` = día 1 del mes actual − 12 meses. Ningún cálculo usa datos
anteriores.

### `FiltroLugar`

`string` (id de lugar) o `'todos'` (todos los lugares del tenant, incluidos los desactivados con
datos del período).

### `Kpi`

| Campo | Tipo | Regla |
|---|---|---|
| `valor` | `number` | Sin redondear (FR-019) |
| `variacion` | `{ tipo: 'porcentaje'; valor: number } \| { tipo: 'nuevo' } \| { tipo: 'sin-datos' } \| null` | research R5 |
| `mejora` | `boolean \| null` | Producción/ganancia: sube = mejora; gasto: baja = mejora |
| `incompleto` | `{ tratamientosSinPrecio?: number; tratamientosSinPorcentaje?: number; materialesSinPrecio?: number } \| null` | FR-016. Producción y ganancia usan los de tratamientos; gasto, `materialesSinPrecio` (insumos distintos con consumos sin precio) |

### `ResumenReportes`

| Campo | Tipo | Origen |
|---|---|---|
| `produccion` | `Kpi` | Σ `precio` de realizados vigentes (R3) |
| `gasto` | `Kpi` | Consumo valorizado neto (R2) |
| `ganancia` | `Kpi` | Σ `gananciaEstimada` de realizados vigentes (R3) |
| `porCategoria` | `{ clave, nombre, monto, porcentaje }[]` | ≤ 4 elementos (3 + "Otras", research R7) |
| `gastosMensuales` | `{ anio, mes, monto }[]` | 6 o 12 puntos |
| `masUtilizados` | `{ insumoId, nombre, monto, cantidad, unidad, dadoDeBaja }[]` | ≤ 10, por monto |
| `gananciaPorLugar` | `{ lugarId, nombre, monto }[] \| null` | `null` salvo "Todos" con ≥ 2 lugares con datos en el período (FR-012) |
| `vacio` | `boolean` | Sin realizados ni consumos valorizados en el período (FR-017) |

### `ValorInventario`

| Campo | Tipo | Regla |
|---|---|---|
| `valor` | `number` | Σ stock × `costoLote` de lotes no caducados con stock > 0 (R8) |
| `lotesSinPrecio` | `number` | Lotes con stock > 0 sin precio |
| `variacion` | como `Kpi.variacion` | Contra el valor al cierre del mes anterior |

## Reglas de cálculo (resumen)

- **Vigente**: un `TratamientoRealizado` con `anuladoEn === null`.
- **Gasto de un movimiento**: `consumo` → `+cantidad × costoLote`; `ajuste` con origen consumo →
  `−cantidad × costoLote`, imputado a fecha y lugar del consumo origen; otros tipos → 0.
- **Costo de lote**: `costoLote(lote, cambiosLote, factoresDeUnidad(insumo, cambiosInsumo))`;
  `null` = sin precio (no se valoriza; se cuenta).
- **Categoría**: `claveCategoria(insumo.categoria)`; vacía → "Sin categoría".
- **Período del dato**: `creadoEn` (fecha del registro en el dispositivo), no la de sincronización.

## Cambios en sync (sin cambio de esquema)

- Pulls paginados (`seleccionarTodo`) de `movimientos`, `lotes`, `cambios_lote`, `cambios_insumo`,
  `cambios_tratamiento` y `tratamientos_realizados` (research R9). Mismas filas, mismo mapeo.
