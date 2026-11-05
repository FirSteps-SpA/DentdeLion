# Research: Descarte de vencidos al reponer y ajuste de stock por lote

**Spec**: [spec.md](./spec.md) · **Fecha**: 2026-11-05

## R1 — Qué movimiento representa un descarte o una corrección

- **Decision**: un `Movimiento` `tipo: 'ajuste'` con `movimientoOrigenId: null`, `cantidad` con signo
  (negativa resta, positiva suma), `lugarId` del lugar corregido y `unidad` = unidad de consumo
  actual. Se escribe con `crearMovimiento` (`src/features/insumos/lib/movements.ts`), como cualquier
  otro movimiento.
- **Rationale**: `computeStockLote` ya suma `ajuste` con su signo. El CHECK de `movimientos.tipo` y la
  política RLS "insertar como uno mismo" ya lo aceptan, y `movimiento_origen_id` es opcional. Por eso
  no hace falta migración, cambio de Dexie ni cambio de sync. Las anulaciones existentes (consumo rápido
  y tratamientos) son `ajuste` **con** `movimientoOrigenId`, y es lo único que las distingue.
- **Consumidores revisados**:
  - `reportes/lib/gasto.ts` solo imputa los `ajuste` con origen y solo valoriza `consumo`. Un ajuste
    sin origen no cuenta como consumo ni como gasto (FR-011, SC-004).
  - `consumoRapido.ts` y `tratamientos/lib/registro.ts` buscan anulaciones por `movimientoOrigenId` o
    `tratamientoRealizadoId`. Un ajuste sin ninguno de los dos no les afecta.
  - Alertas, estado, FEFO y sugeridos de Compras parten de `computeStockLote`, así que reflejan el
    ajuste sin cambios (FR-013).
- **Alternatives considered**: un `tipo: 'descarte'` nuevo, que exigiría migración (CHECK), un cambio
  de Dexie y que los clientes 2.6.0 en caché entiendan el tipo. También un campo `motivo`, que queda
  fuera de alcance. Ninguno aporta algo que la spec pida.

## R2 — Descarte dentro de la recepción

- **Decision**: `RecepcionInput` gana `descartarVencidos: boolean`. `recibirEnInsumo` amplía su
  transacción a `lotes, movimientos, itemsCompra, proveedores, insumos, cambiosInsumo`. *Antes* de
  crear el lote nuevo, lee los lotes del insumo y, por cada uno vencido, calcula su stock en el lugar
  de la recepción con `movimientosNormalizadosDeLote` + filtro por `lugarId`. Si es mayor que 0, crea
  un ajuste por `−stock`. Todo queda en la misma transacción que el lote y el ítem `'comprado'`
  (FR-002).
- **Rationale**: recalcular dentro de la transacción deja cada lote exactamente en 0, aunque el store
  esté un tick atrasado. Además, `movimientosNormalizadosDeLote` es el único punto permitido para leer
  movimientos (prueba de arquitectura `lecturas-movimientos.test.ts`) y convierte unidades si el
  insumo cambió de unidad de consumo. Calcular antes de crear el lote nuevo excluye ese lote aunque
  venga vencido (Edge Case).
- **"Vencido"**: `diasEntre(lote.fechaCaducidad, hoy) < 0`, la misma regla que el nivel `'caducado'`
  de `computeAlertasCaducidad`, para que la casilla y el estado nunca discrepen. Se extrae a un helper
  puro `estaVencido(lote, hoy)` en `alertas/lib/caducidad.ts`, que usan ambos.
- **Casilla (UI)**: un helper puro `stockVencidoEnLugar(insumo, lotes, movimientos, lugarId, hoy)`
  devuelve `[{ lote, stock }]` con `stock > 0`, calculado desde `inventoryStore`. Se muestra solo si
  `insumo.caduca` y la suma es mayor que 0. El lugar es `getLugarParaEscribir(lugarId)`: el elegido en
  "¿En qué lugar?" o el activo. Sin lugar no hay casilla, y la recepción falla igual que hoy.
- **Alternatives considered**: pasar al lib la lista de lotes que mostró la UI. Se descartó porque
  podría desfasarse del estado real dentro de la transacción. También se descartó descartar en una
  operación aparte después de la recepción, porque rompe el "todo o nada".

## R3 — Etiqueta y unidad

- **Decision**: "Descartar stock vencido (4 cajas)". La cantidad se muestra con
  `formatearCantidad(n, insumo.unidadMedida)` y, si aplica, `formatearEquivalente`, igual que el
  "Stock total" de `InsumoDetalle`. Debajo, en texto chico: "Lote L-123 (vence 2026-09-01)…", para
  saber qué se descarta.
- **Rationale**: las unidades son texto libre, así que "vencidas/vencidos" no concuerda en todos los
  casos. Mostrar los lotes evita sorpresas con la casilla marcada por defecto.

## R4 — Corrección de stock por lote en Editar

- **Decision**:
  - **Lib** `ajustarStockLotes(insumoId, correcciones: { loteId, lugarId, cantidad }[])` en
    `insumos/lib/ajusteStock.ts` (nuevo):
    - empieza con `exigirAdministrador('ajustar el stock de')`;
    - valida cada cantidad (≥ 0, entera si `!permiteDecimales`) con `validarCantidadLote`, una función
      pura exportada;
    - dentro de la transacción recalcula el stock actual de cada `(lote, lugar)` y escribe un ajuste
      por `cantidad − actual` cuando la diferencia no es 0.
  - **Atomicidad (FR-008)**: el formulario guarda con un `guardarEdicionInsumo(...)` nuevo. Abre **una**
    transacción Dexie que incluye las tablas de `editarInsumo`, `movimientos`, `cambiosInsumo` y
    `minimosLugar`, y dentro llama a `editarInsumo`, `ajustarStockLotes` y `guardarMinimoLugar`. Las
    transacciones internas de Dexie se vuelven subtransacciones de la externa, porque sus tablas son
    un subconjunto y el modo es `rw`. Una excepción en cualquiera de las tres revierte las tres. De
    paso, el mínimo por lugar pasa a guardarse junto con lo demás, cosa que hoy no ocurre.
  - **Filas a mostrar** (`filasStockPorLote`, pura):
    - en un lugar: `lotesEnLugar(lotes, movimientos, lugarId)` del insumo, con
      `stockLoteEnLugar`, incluidos los que están en 0;
    - en "Todos": un renglón por cada par `(lote, lugar)` con stock distinto de 0 en algún lugar
      activo, con el nombre del lugar;
    - orden: vencimiento ascendente (los vencidos primero), luego "No caduca", y en empate por
      `creadoEn`.
  - **UI**: sección "Stock por lote" al final del formulario, antes de los botones, solo si el rol es
    `'administrador'`. Cada renglón muestra "Lote X · vence AAAA-MM-DD" con una insignia **Vencido**
    (color + ícono + texto, Constitución IV) y un `NumeroInput` (48 px) con la unidad. Debajo aparece
    la diferencia en vivo ("−3 cartuchos"). El error de cada renglón va bajo su campo. `hayCambios`
    incluye las correcciones, para que se active Guardar.
- **Rationale**: es la decisión de la clienta (por lote). Cada ajuste queda trazable a su lote y lugar,
  que es la unidad en que se guarda el stock (spec 014 R3). La diferencia se recalcula al guardar
  porque el form puede llevar un rato abierto mientras llegan movimientos por sync. Así el lote queda
  exactamente con lo escrito en este dispositivo.
- **Alternatives considered**: guardar en secuencia como hoy, sin atomicidad, porque viola FR-008.
  También poner la sección en `InsumoDetalle`, que la spec deja fuera de alcance.

## R5 — Eliminar desde Editar

- **Decision**: `EditarInsumoForm` recibe `onEliminado?: () => void`. Si lo recibe y el rol es
  administrador, muestra al final un botón "Eliminar insumo" (`variant="ghost"` con texto `text-danger` e ícono `Trash`, como la opción del menú). El botón abre
  `ConfirmarBajaDialog` **dentro del formulario**, como ya pasa con `ConvertirUnidadDialog`, y el
  `stockTotal` sale de los movimientos del store. Al confirmar llama a `darDeBajaInsumo` y después a
  `onEliminado`. `InventarioView` pasa un handler que reutiliza su lógica de `handleConfirmarBaja`
  (deseleccionar y cerrar). Cancelar cierra solo el diálogo y el formulario conserva su estado (US3-3).
- **Rationale**: si se cambiara el overlay de `InventarioView` a `'baja'` se desmontaría el
  formulario y se perderían los cambios al cancelar. La confirmación y la baja son las mismas
  (FR-009, SC-005).

## R6 — Sobregiro por descarte concurrente

- **Decision**: `restaStock` en `src/lib/sync/index.ts` pasa a recibir el movimiento (o la fila) y
  también cuenta los `ajuste` con `cantidad < 0`. Así, cuando un ajuste negativo sube o llega por
  pull, su lote entra en la verificación de sobregiro existente (feature 002 FR-009). Si queda
  negativo, se marca `'revision'` y aparece en Alertas para administración. Administración lo corrige
  con "Stock por lote" y lo marca resuelto, el flujo que `revision.ts` ya da por hecho.
- **Rationale**: es un cambio de una línea que reutiliza la reconciliación y la alerta existentes.
  Así el caso del Edge Case no queda invisible.
- **Alternatives considered**: llevar el lote a 0 al detectar un negativo. Se descartó porque
  reescribiría el resultado sin intervención humana y ocultaría que hubo dos acciones en conflicto.

## R7 — Historial del lote

- **Decision**: `InsumoDetalle` agrega, por lote, los ajustes sin `movimientoOrigenId`, junto a los
  traslados y con el mismo formato: "Ajuste de stock: −4 cajas · 5 nov 2026 · Ana". Los positivos
  llevan "+".
- **Rationale**: FR-010 y SC-003 piden que cada descarte o corrección se vea con su autor. Hoy el
  detalle no lista ajustes.
