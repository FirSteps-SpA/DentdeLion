# Research: "Consumir" sin atajo

**Spec**: [spec.md](./spec.md) · **Fecha**: 2026-11-23

## R1 — Lote por defecto de la vista de consumo

- **Hallazgo**: `ConsumoForm` elige el lote con `selectFefoLot` (`insumos/lib/fefo.ts`), que ordena
  solo por fecha y **no excluye vencidos**. Con un lote vencido y otro vigente, ambos con stock, hoy
  propone el vencido (vence antes). "Consumir 1" (`selectLoteConsumoRapido`) sí lo saltaba. Como la
  vista de consumo pasa a ser el camino principal, mantenerla así haría que el uso normal consuma
  vencidos.
- **Decision**: función pura nueva `selectLoteConsumo(lotesConStock, cantidad, hoy)` en `fefo.ts`:
  1. vigentes con stock, en orden FEFO: el primero que cubre `cantidad`; si ninguno, el primero;
  2. si no hay stock vigente, los vencidos con stock en orden FEFO, con la misma regla.
  Vencido = `estaVencido` de `alertas/lib/caducidad.ts` (la regla de alertas, de la spec 024 y de los
  tratamientos: vence hoy = vigente). `ConsumoForm` la usa en vez de `selectFefoLot`.
- **Rationale**: mismo criterio que tenía "Consumir 1" y que usa el registro de tratamientos
  (`repartirFefo` solo con vigentes). Cubre la Clarification (solo vencido → se propone el vencido).
- **Alternatives considered**: cambiar `selectFefoLot`, que también usa `proximoLote.ts` para mostrar
  el lote más próximo a vencer en la tarjeta (ahí sí deben aparecer los vencidos); se descartó.

## R2 — Dónde vive el registro del consumo

- **Decision**: módulo nuevo `insumos/lib/consumo.ts` con:
  - `registrarConsumo({ insumo, loteId, cantidad, lugarId })`: transacción `rw` sobre lotes,
    movimientos, insumos y cambiosInsumo que **recalcula** el stock del lote en el lugar con
    `movimientosNormalizadosDeLote` y rechaza si no alcanza (error con el mensaje actual de stock
    insuficiente); escribe el `consumo` con `crearMovimiento`; tras el commit, `vibrarLeve()` y el
    aviso `tipo: 'consumo'` con "Deshacer" (`useAvisosStore.agregar`).
  - `deshacerConsumo` (movido tal cual desde `consumoRapido.ts`).
  - `disponibilidadConsumo(lotesConStock)`: `{ ok: true }` si la suma de stock > 0; si no,
    `{ ok: false, motivo: 'sin-stock' }`.
  `consumoRapido.ts` se elimina (`consumirUno`, `selectLoteConsumoRapido`, `lotesConStockDeInsumo`
  pasa a `consumo.ts`).
- **Rationale**: la recomprobación dentro de la transacción es la que evitaba sobregiros con dos
  toques seguidos en "Consumir 1"; hoy `ConsumoForm` valida contra un snapshot. La lectura de
  movimientos pasa por `movimientosNormalizadosDeLote`, como exige `lecturas-movimientos.test.ts`.
- **Alternatives considered**: dejar `crearMovimiento` en el formulario y agregar solo el aviso; no
  protege del doble envío desde dos pestañas o del `liveQuery` atrasado.

## R3 — Aviso con "Deshacer"

- **Decision**: el aviso lo emite `registrarConsumo`, así que aparece en todo consumo de la vista. El
  único que abre la vista es Inventario (el formulario con búsqueda no se monta en ninguna pantalla
  hoy), así que no cambia otro flujo. `AvisosConsumo` y `avisosStore` no cambian salvo el import de
  `deshacerConsumo`. El mensaje de éxito interno del formulario (`mensajeExito`) se elimina: la vista
  se cierra al confirmar y el aviso lo reemplaza.
- **Rationale**: FR-007 y SC-003; reutiliza duración, tope de 3 avisos e idempotencia del deshacer.

## R4 — Cantidad inicial y foco

- **Decision**: `ConsumoForm` recibe `cantidadInicial?: number` (Inventario pasa 1). El campo
  selecciona su contenido en `onFocus` (`event.currentTarget.select()`, válido en `type="number"`).
  `autoFocus` solo cuando `useDisposicion() === 'desktop'`.
- **Rationale**: en teléfono, el foco automático abre el teclado y tapa "Confirmar consumo" dentro de
  la hoja, lo que rompería el caso de 1 unidad en 2 toques (SC-001). En desktop no hay ese problema y
  se escribe directo.
- **Alternatives considered**: foco siempre (tapa el botón en móvil); cantidad vacía (obliga a
  escribir siempre, más lento para 1 unidad).

## R5 — Botón, menú y "Todos"

- **Decision**: `InsumoCard` e `InventarioTabla` reciben `onConsumir` y `disponibilidad:
  DisponibilidadConsumo`; texto "Consumir", `aria-label` "Consumir <insumo>"; deshabilitado con "Sin
  stock". `MOTIVO_DESHABILITADO` queda solo con `sin-stock`. `InventarioView` reemplaza
  `handleConsumirUno` por `abrirConsumo(insumoId)`: en "Todos" abre `elegirLugar` con `accion:
  'consumir'`, si no, `overlay: { tipo: 'consumir' }`. Se elimina `'consumirUno'` de
  `AccionConLugar`. `InsumoAccionesMenu` pierde `onConsumirOtraCantidad`.
- **Rationale**: reutiliza el overlay y la hoja ya existentes (que conservan filtros y posición,
  FR-006).

## R6 — Indicador "Lote vencido"

- **Decision**: cada opción del selector de lote agrega "— vencido" si `estaVencido`; bajo el
  selector, un `Badge` de tono urgente con ícono y el texto "Lote vencido" cuando el lote elegido lo
  está (FR-010). Reemplaza al badge "Recomendado FEFO" en ese caso.
- **Rationale**: texto, no solo color (Constitución III/IV, DS).

## R7 — Compatibilidad

- Sin migración, sin cambio de Dexie, sin cambio de sync. Un dispositivo con 2.8.0 en caché sigue
  mostrando "Consumir 1" y escribe los mismos movimientos; conviven.
