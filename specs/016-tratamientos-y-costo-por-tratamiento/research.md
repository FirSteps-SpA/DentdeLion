# Research: Tratamientos y Costo por Tratamiento

**Feature**: 016-tratamientos-y-costo-por-tratamiento | **Date**: 2026-10-19

No quedan NEEDS CLARIFICATION: las tres preguntas se resolvieron el 2026-10-19 (precio por lugar,
porcentaje profesional por lugar, montos visibles para todo el equipo).

Punto de partida (`develop` en `56aa4dc`, spec 015 incluida):

- Costo unitario por insumo: `costosUnitariosPorInsumo` / `useCostosUnitarios` (último ingreso con
  precio, todo el tenant, en unidad de consumo actual).
- Stock por lote y lugar desde movimientos normalizados (`movimientosNormalizadosDeLote`,
  `inventoryStore.movimientos`); FEFO en `fefo.ts`; consumo rápido con "Deshacer" por ajuste
  vinculado (`consumoRapido.ts`); reconciliación de sobregiros en el sync.
- Ledgers append-only con proyección determinista `(creadoEn, id)`: `cambios_insumo`,
  `cambios_lote`. Lugares editados por administración con bandera `sincronizado`.
- Navegación: `SECCIONES` en `src/app/navegacion.ts` (Inicio, Inventario, Compras, Alertas, Más),
  compartida por barra inferior y sidebar.

---

## R1. Catálogo de tratamientos: fila mínima + ledger `cambios_tratamiento`

- **Decision**: `tratamientos` guarda solo identidad (`id`, `tenant_id`, `creado_por`,
  `creado_en`). Todo lo editable vive en un ledger append-only **`cambios_tratamiento`**
  (`campo` ∈ `nombre`, `materiales`, `activo`, `precio`, `porcentajeProfesional`), y el estado se
  proyecta en el dispositivo con la regla de siempre: por campo (y por lugar, en `precio` y
  `porcentajeProfesional`), gana el de mayor `(creadoEn, id)`.
  - `materiales`: el valor es la lista completa `[{ insumoId, cantidad, unidad }]` (se reemplaza
    entera: editar la receta es un solo cambio auditable).
  - `precio`: `tratamiento_id` + `lugar_id`, valor número ≥ 0 o `null` (sin precio en ese lugar).
  - `porcentajeProfesional`: `tratamiento_id` nulo + `lugar_id`, valor 0–100 o `null`.
- **Rationale**: FR-003 y FR-012 piden historial con autor y resolución determinista de ediciones
  concurrentes sin red; el ledger ya resuelve eso (spec 007/015) y evita el `filaParaSubir` de
  `insumos` (no hay fila mutable que subir). Un único ledger para precio y porcentaje deja un solo
  push/pull y una sola RLS.
- **Alternatives considered**: fila `tratamientos` mutable + upsert (el último dispositivo pisa a los
  demás, sin historial); tabla `precios_tratamiento` como `minimos_lugar` (sin historial);
  `lugares.porcentaje_profesional` (sin historial y con último-gana).

## R2. Materiales en unidad de consumo, convertibles

- **Decision**: cada material guarda `unidad` (la de consumo del insumo al definirlo). La cantidad
  efectiva = `cantidad × factoresDeUnidad(insumo)[unidad]` (spec 015 R3), así una conversión
  posterior no cambia la cantidad física (Edge Cases). El formulario valida decimales con la unidad
  actual. Materiales de insumos dados de baja se muestran marcados y no se descuentan.
- **Rationale**: misma solución que los movimientos de la 015; un solo mecanismo de conversión.

## R3. Costo, comisión y ganancia estimada: funciones puras

- **Decision**: `calcularCostoTratamiento(materiales, insumos, costos, factores)` →
  `{ lineas[{ insumo, cantidad, costoUnitario|null, costo|null }], costoMateriales, completo }`;
  `calcularGanancia(precio|null, porcentaje|null, costoMateriales)` →
  `{ comision|null, ganancia|null, motivo? }` con `motivo` ∈ `sin-precio`, `sin-porcentaje`.
  Costo incompleto = suma de los materiales con precio y `completo: false` ("desde $X").
  Formato con `formatearCLP` (015). Ganancia negativa con signo y tono de error.
- **Rationale**: FR-006–FR-011 y SC-002 se prueban directamente con el ejemplo del DS.

## R4. Registro de un tratamiento realizado: registro + consumos en una transacción

- **Decision**: tabla **`tratamientos_realizados`** con snapshot inmutable (`precio`,
  `porcentaje_profesional`, `materiales` jsonb con `{ insumoId, nombre, cantidad, unidad,
  costoUnitario }`, `costo_materiales`, `ganancia_estimada`) más `anulado_en`/`anulado_por`.
  `registrarTratamiento()` corre en **una** transacción Dexie: crea el registro y, por material, los
  movimientos `consumo` repartidos por FEFO entre lotes **vigentes** del lugar, con la columna nueva
  `movimientos.tratamiento_realizado_id`. Si algún material no alcanza, lanza
  `StockInsuficienteError` con el detalle por material y no escribe nada (FR-014/FR-015). El stock
  se relee dentro de la transacción (como "Consumir 1").
- **Reparto FEFO**: `repartirFefo(lotesConStock, cantidad)` → `[{ lote, cantidad }]` ordenado por
  `compararFefo`, excluyendo caducados (no se usan materiales vencidos en un paciente; mismo
  criterio que "Consumir 1").
- **Rationale**: atomicidad en el dispositivo (Constitución I); el snapshot garantiza SC-003.
- **Alternatives considered**: guardar solo el tratamiento y recalcular (pierde SC-003); un
  movimiento por material sin lote (rompe trazabilidad por lote, Constitución IV).

## R5. Anulación ("Deshacer")

- **Decision**: `anularTratamiento(id)`: en una transacción, por cada consumo vinculado escribe un
  `ajuste` con `movimientoOrigenId` = consumo, la misma `unidad` y el mismo
  `tratamiento_realizado_id`, y marca el registro `anuladoEn`/`anuladoPor`. Idempotente. Lo puede
  hacer cualquier miembro del tenant. Sin conexión funciona igual.
- **Servidor**: `update` de `tratamientos_realizados` solo puede pasar `anulado_en` de `null` a un
  valor (trigger `proteger_tratamiento_realizado` conserva el snapshot y la primera anulación).
- **Rationale**: mismo patrón que el deshacer de consumos (spec 007); nada se borra.

## R6. Sincronización

- `tratamientos` y `cambios_tratamiento`: patrón `categorias`/`cambios_insumo` (bandera
  `sincronizado`, `rechazadoEn` si el RLS rechaza por rol, reintento por fila).
- `tratamientos_realizados`: bandera `sincronizado` (insert) y `anulacionSincronizada` (update de la
  anulación). Se suben **antes** que `movimientos` (FK de `tratamiento_realizado_id`). Un error deja
  todo pendiente; la reconciliación de sobregiros existente cubre registros simultáneos (Edge Cases).
- Indicador de pendientes (spec 012): cuenta registros, anulaciones y cambios de tratamiento.
- Aislamiento local por tenant (spec 014) y subida previa a la desactivación: igual que la 015.

## R7. Navegación (DS §29)

- **Decision**: `SECCIONES` agrega **Tratamientos** (ícono `Stethoscope` de Lucide). En la sidebar
  se muestran todas. En la barra inferior móvil caben 5: **Inicio, Inventario, Tratamientos,
  Alertas, Más**; **Compras** pasa a "Más" en móvil (y sigue accesible desde el KPI "Para comprar"
  de Inicio).
- **Rationale**: el DS §29 pone Tratamientos en la barra; 6 ítems en 375 px dejan etiquetas
  ilegibles. Alertas se mantiene visible por su rol clínico (Constitución IV).
- **Alternatives considered**: 6 ítems (etiquetas de ~60 px); sacar Alertas (pierde el badge).
  Decisión a validar con la clienta (plan, Riesgos).

## R8. Historial y totales

- **Decision**: vista "Historial" dentro de Tratamientos: registros del lugar activo (o de todos con
  chip de lugar) del más reciente al más antiguo; filtros hoy / esta semana (lunes a hoy) / este mes
  en hora local; totales = conteo, Σ precio, Σ costo de materiales, Σ ganancia estimada, excluyendo
  anulados y sin sumar precio/ganancia de registros sin precio.

## R9. Migración y compatibilidad

- **Servidor** (`20261022000000_tratamientos.sql`): tablas `tratamientos`, `cambios_tratamiento`,
  `tratamientos_realizados`; columna `movimientos.tratamiento_realizado_id` (FK compuesta, nula);
  RLS por tenant; checks de valores del ledger por campo; trigger de protección del registro.
  Ningún dato existente cambia.
- **Dexie v12**: tablas `tratamientos`, `cambiosTratamiento`, `tratamientosRealizados`; índice
  `tratamientoRealizadoId` en `movimientos` (sin backfill: `null` en los existentes).
- **Clientes 2.3.x/015 en caché**: no conocen la columna nueva; sus movimientos llegan con `null`.
  No hay riesgo de datos mal interpretados (un consumo de tratamiento es un consumo normal para
  ellos).

## R10. Pruebas

- Unit: proyección del ledger (concurrencia, precio y porcentaje por lugar), costo/ganancia con el
  ejemplo del DS, `repartirFefo`, registro atómico y `StockInsuficienteError`, anulación
  idempotente, conversión de materiales, totales del historial, Dexie v12, sync de las tres tablas.
- Integración (RTL): crear y editar tratamiento, detalle con montos y "Ganancia estimada", registrar
  con ajuste de cantidades y falta de stock, deshacer, porcentaje en Ajustes → Lugares, historial,
  navegación móvil y desktop, todo sin red.
- `test:rls`: aislamiento de las tres tablas, personal no edita el catálogo, personal registra y
  anula como sí mismo, snapshot inmutable, FK del movimiento al registro del mismo tenant.
- Ensayo de la migración sobre un respaldo nuevo de producción y Dexie v12 en Chromium real.
