# Research: Categorías de tratamientos y % profesional por categoría

**Spec**: [spec.md](./spec.md) · **Fecha**: 2026-11-23

## R1 — Catálogo de categorías: tabla por tenant, como `marcas`

- **Decision**: tabla `categorias_tratamiento` (`id`, `tenant_id`, `nombre` 1–40, `clave` generada con
  `public.clave_nombre` de la 021, `creado_por` nullable, `creado_en`, `desactivado_en`), índice único
  `(tenant_id, clave)`. Renombrar = `UPDATE nombre`; desactivar/reactivar = `desactivado_en`. Sin
  `eliminado_en` (FR-004). Insertar y actualizar: solo administración (RLS). Un trigger
  `proteger_categoria_tratamiento` mantiene `tenant_id`, `creado_por` y `creado_en`.
- **Rationale**: las categorías tienen identidad estable (el % por lugar y los registros las
  referencian por id), así que un renombre no puede ser "otra categoría". El patrón de `marcas` (fila
  por tenant, último cambio gana, clave normalizada) ya está probado en sync y RLS.
- **Alternatives considered**:
  - Reutilizar `categorias` de insumos con un tipo: mezcla dos catálogos que no comparten nada, y las
    de insumos se guardan en el insumo como **texto** (sin id).
  - Categorías como constantes de código, como las precargadas de insumos: no se podrían renombrar ni
    desactivar (Clarifications) y el % necesitaría claves por nombre.
  - Ledger propio para el catálogo: no hace falta historial del nombre; el historial que pide la spec
    es el de la asignación y el % (FR-006, FR-009), que va en el ledger existente (R3, R4).

## R2 — Siembra de las 8 categorías

- **Decision**: función `public.sembrar_categorias_tratamiento(p_tenant uuid)` (security definer) que
  inserta las 8 si el tenant no tiene ninguna. La migración la llama para cada tenant existente, y un
  trigger `after insert on tenants` la llama para los nuevos (`scripts/alta-tenant.mjs` crea el tenant
  por PostgREST con service role, así que el trigger cubre el alta sin cambiar el script). `creado_por
  null`, ids `gen_random_uuid()`.
- **Rationale**: SC-005 (cliente nuevo las ve sin hacer nada) y edge case "aparecen una sola vez". Al
  ser filas, se renombran y desactivan como las demás.
- **Alternatives considered**: sembrar desde el cliente en el primer uso: dos dispositivos sin conexión
  crearían duplicados.

## R3 — Categoría de un tratamiento: campo `categoria` del ledger

- **Decision**: nuevo `campo = 'categoria'` en `cambios_tratamiento`, con `tratamiento_id`,
  `valor_nuevo` = id de la categoría (string) o `null` ("Sin categoría"). `proyectarTratamientos` gana
  `categoriaId: string | null`.
- **Rationale**: FR-006 (historial con autor y fecha) y misma resolución "último cambio gana" que los
  demás campos del tratamiento. RLS de inserción ya es solo administración (FR-008).
- **Validación**: CHECK `jsonb_typeof(valor_nuevo) in ('string','null')`. No hay FK desde jsonb; un id
  que no exista en el catálogo se proyecta como "Sin categoría".

## R4 — % por categoría y lugar: campo `porcentajeCategoria` del ledger

- **Decision**: nuevo `campo = 'porcentajeCategoria'` con `tratamiento_id null`, `lugar_id` y una
  columna nueva `categoria_tratamiento_id` (FK compuesta con `tenant_id`). `valor_nuevo` = número 0–100
  o `null` (borrar). Se reescriben los CHECK:
  - `tratamiento_id is null` ⇔ campo ∈ {`porcentajeProfesional`, `porcentajeCategoria`};
  - `lugar_id is not null` ⇔ campo ∈ {`precio`, `porcentajeProfesional`, `porcentajeCategoria`};
  - `categoria_tratamiento_id is not null` ⇔ campo = `porcentajeCategoria`;
  - el CHECK de rango del porcentaje cubre ambos campos de %.
  `porcentajesPorCategoria(cambios)` → `Map<"categoriaId|lugarId", number>`.
- **Rationale**: FR-009 pide historial y "aplica hacia adelante", igual que el % general, que ya vive
  en este ledger. Reutiliza push/pull, RLS (solo administración) y proyección.
- **Alternatives considered**: tabla `porcentajes_categoria(categoria, lugar, %)` con último cambio
  gana, como `minimos_lugar`: sin historial.

## R5 — % aplicable

- **Decision**: función pura `porcentajeAplicable({ categoriaId, lugarId, porcentajesLugar,
  porcentajesCategoria })` → `{ valor: number | null, origen: 'categoria' | 'lugar' | null }` (FR-010).
  La usan `registrarTratamiento` (snapshot) y `useMontosTratamiento` (detalle, hoja, catálogo) con la
  etiqueta de FR-012 ("50 % · Evaluación" / "40 % · general del lugar").
- **Rationale**: una sola regla para lo que se muestra y lo que se guarda.
- Una categoría **desactivada** sigue aplicando su % (edge case).

## R6 — Snapshot en el registro

- **Decision**: `tratamientos_realizados` gana `categoria_tratamiento_id uuid null` (FK compuesta) y
  `categoria_nombre text null`. `proteger_tratamiento_realizado` las conserva en todo UPDATE, como el
  resto del snapshot. `porcentaje_profesional` ya guarda el % aplicado (ahora el de FR-010).
- **Rationale**: FR-011/FR-013. Historial muestra el nombre del momento; Reportes agrupa por id (FR-016).

## R7 — Dexie v15

- **Decision**: `categoriasTratamiento: 'id, tenantId, sincronizado'`. Upgrade: `categoriaId ??= null`
  en `cambiosTratamiento`, y `categoriaId ??= null`, `categoriaNombre ??= null` en
  `tratamientosRealizados`. Tipos: `CategoriaTratamiento` (`id`, `tenantId`, `nombre`, `creadoPor`,
  `creadoEn`, `desactivadoEn`, `sincronizado`, `rechazadoEn`).

## R8 — Sync

- **Decision**:
  - `pushCategoriasTratamiento`: solo administración; filas no sincronizadas por `upsert`. `23505`
    (clave repetida, dos administradoras sin conexión) → se marca `rechazadoEn` local y aviso
    informativo "categoria-tratamiento-repetida"; la proyección ignora las rechazadas. RLS → igual que
    el resto (`rechazadoEn`).
  - `pullCategoriasTratamiento` con `seleccionarTodo` (paginado), sin pisar filas locales sin subir.
  - Orden en el ciclo: categorías **antes** de `cambios_tratamiento` (FK de `porcentajeCategoria`) y de
    `tratamientos_realizados` (FK del snapshot).
  - `cambios_tratamiento` y `tratamientos_realizados`: mapear las columnas nuevas en push y pull.
- **Rationale**: mismo patrón que marcas y categorías de insumos.

## R9 — Convivencia con versiones anteriores en caché

- Pull de `cambios_tratamiento` con campos nuevos: `proyectarTratamientos` ignora campos desconocidos
  (`default`), `porcentajesPorLugar` filtra por `porcentajeProfesional`, y `tratamientoId null` se
  salta. Sin errores; el dispositivo viejo usa el % general.
- Push de registros de una versión vieja: sin columnas nuevas → `null` ("Sin categoría") y % general.
  Documentado en las notas de despliegue.
- La migración se aplica **antes** del front; el front nuevo con el servidor viejo fallaría al subir
  categorías (tabla inexistente), por eso el orden.

## R10 — UI

- **Ajustes → "Categorías de tratamientos"** (`IdSeccion` `'categoriasTratamiento'`, solo
  administración, después de `'lugares'`): lista con "Ver más" (spec 020), "Nueva categoría", y una hoja
  por categoría con nombre, activa/desactivada y un `NumeroInput` de % por cada lugar activo, con
  placeholder "Usa el general (40 %)" o "Sin % general en este lugar".
- **Formulario de tratamiento**: `SelectorCatalogo` con `permitirNinguno` ("Sin categoría") y
  `crear` = crear categoría (el formulario ya es solo de administración).
- **Catálogo** (`TratamientosView`): categoría en cada fila y chips de filtro por categoría (las que
  están en uso + "Sin categoría").
- **Detalle / hoja de registro / montos**: % con su origen (FR-012).
- **Historial**: categoría del registro en cada fila y un filtro de categoría (selector) que también
  filtra los totales.
- **Reportes**: tarjeta "Por categoría de tratamiento" con `HorizontalBarChart` de producción y tabla
  (Categoría, Producción, Ganancia del profesional).

## R11 — Agrupación en Reportes

- **Decision**: por `categoriaId` del registro; nombre = el actual del catálogo si existe, si no el del
  snapshot; `null` → "Sin categoría". Excluye anulados; respeta período y lugar como el resto de
  `resumenReportes`.
