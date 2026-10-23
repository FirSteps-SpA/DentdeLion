# Data Model: Ajustes por secciones

**Feature**: 019-ajustes-por-secciones | **Date**: 2026-10-22

**Sin esquema nuevo.** No hay migración de Postgres ni versión nueva de Dexie (sigue v12). Se despliega
solo el front. Lo que cambia es qué registro existente edita una pantalla y cómo se descarga uno.

## Entidades existentes que toca la spec

### Insumo (`insumos` / `db.insumos`) — sin cambios

| Campo | Uso en esta spec |
|---|---|
| `id`, `nombre` | Fila del editor de mínimos; búsqueda por `plegar(nombre)` |
| `stockMinimo: number \| null` | **Mínimo del catálogo**. Desde Ajustes solo se edita con **un solo lugar activo** (`actualizarStockMinimo`) |
| `unidadMedida` | Validación del mínimo (`validarStockMinimo`: entero si la unidad lo exige) |
| `dadoDeBajaEn` | Los dados de baja no aparecen en el editor (FR-016) |

### MinimoLugar (`minimos_lugar` / `db.minimosLugar`) — sin cambios de esquema

| Campo | Notas |
|---|---|
| `insumoId`, `lugarId` | **Clave compuesta** (PK en Postgres). Cursor de la descarga paginada (research R5) |
| `tenantId` | Lo completa el cliente (`tenantActualOFallar`) |
| `stockMinimo: number \| null` | `null` = "usar el del catálogo"; se guarda como fila (upsert), no como borrado |
| `sincronizado: boolean` | `false` hasta que el push lo sube; el pull no lo pisa (`conservarCambioLocal`) |

Regla de lectura (sin cambios, `minimoEfectivo`): mínimo del lugar si existe y no es `null`; si no, el del
catálogo.

Regla de escritura desde Ajustes (nueva, FR-017):

| Lugares activos | Selección | Qué edita el editor |
|---|---|---|
| 1 | ese lugar | `Insumo.stockMinimo` (catálogo) |
| ≥ 2 | un lugar | `MinimoLugar(insumo, lugar)`; vacío → `stockMinimo: null` |
| ≥ 2 | "Todos" | nada (solo lectura) |

Es la misma regla que ya aplica `EditarInsumoForm` (catálogo siempre + lugar con varios lugares).

## Tipos nuevos (solo de presentación, no persistidos)

### `IdSeccion`

`'perfil' | 'lugares' | 'avisos' | 'categorias' | 'baja'` (la 021 suma `'proveedores'`).

### `SeccionAjustes` (registro `SECCIONES_AJUSTES`)

| Campo | Tipo | Notas |
|---|---|---|
| `id` | `IdSeccion` | También es el segmento del hash: `#ajustes/<id>` |
| `titulo` | `(esAdmin) => string` | "Perfil y equipo" / "Perfil"; "Notificaciones y avisos" / "Notificaciones" |
| `Icon` | componente de ícono | Del set de `components/icons` |
| `soloAdministracion` | `boolean` | `lugares`, `categorias`, `baja` → `true`; `perfil`, `avisos` → `false` |

Orden fijo del registro = orden del índice (FR-001).

### Estado de navegación de Ajustes

| Estado | Dónde | Transiciones |
|---|---|---|
| Índice | sin hash `#ajustes/…` | tocar tarjeta → Sección (push) |
| Sección `<id>` | `location.hash = #ajustes/<id>` | "Volver" / `popstate` → Índice; recarga → misma Sección; sección no visible para el rol → Índice (replace); cambiar de vista desde la navegación → hash limpio |

### `FilaMinimo` (salida de `filasMinimos`)

| Campo | Tipo | Notas |
|---|---|---|
| `insumo` | `Insumo` | Activo, orden por nombre (`localeCompare('es')`) |
| `modo` | `'catalogo' \| 'lugar' \| 'todos'` | Según la tabla de escritura |
| `minimo` | `number \| null` | Valor que rige (modos `catalogo` y `lugar`) |
| `origen` | `'lugar' \| 'catalogo'` | Solo en modo `lugar` |
| `porLugar` | `{ lugar, minimo, origen }[]` | Solo en modo `todos`, un elemento por lugar activo |

### `ResumenSeccion`

`string | null` — `null` mientras los datos locales no están listos (la tarjeta muestra solo el título).
