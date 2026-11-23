# UI Contracts: "Consumir" sin atajo

**Spec**: [spec.md](./spec.md) · **Fecha**: 2026-11-23

## 1. Botón "Consumir" (tarjeta y fila de tabla)

| Estado | Texto | `aria-label` | Acción |
|---|---|---|---|
| Hay stock > 0 en el lugar | Consumir | `Consumir <insumo>` | Abre la hoja "Consumir <insumo>" (o "¿En qué lugar?" en "Todos") |
| Stock 0 | Sin stock | `Sin stock: <insumo>` | Deshabilitado |

- Variante `secondary` habilitado, `ghost` deshabilitado; área táctil ≥ 48 px.
- Tocarlo nunca escribe un movimiento.

## 2. Menú "⋮" / toque largo

Opciones: Ver detalle · Trasladar (≥ 2 lugares) · Editar (admin) · Eliminar (admin). Sin "Consumir
otra cantidad".

## 3. Hoja "Consumir <insumo>" (`ConsumoForm`)

Props:

```ts
interface ConsumoFormProps {
  insumoInicial?: Insumo
  lugarId?: string
  /** Spec 025: cantidad con la que parte el campo (Inventario pasa 1). */
  cantidadInicial?: number
  onDone?: () => void
}
```

- Cantidad parte en `cantidadInicial`; al enfocar se selecciona el contenido; `autoFocus` solo en
  desktop.
- Lote por defecto según `selectLoteConsumo`. Opciones del selector: `<lote> — vence <fecha>[ —
  vencido] — disponible <cantidad>`.
- Si el lote elegido está vencido: badge "Lote vencido" (tono urgente, ícono + texto) en lugar de
  "Recomendado FEFO".
- "Confirmar consumo" → `registrarConsumo`. Éxito: la hoja se cierra (`onDone`) y aparece el aviso
  "Consumo de … / Deshacer" existente. Error (stock insuficiente, unidad): mensaje en la hoja, sin
  escribir, la hoja sigue abierta.
- Cerrar la hoja sin confirmar no escribe nada.

## 4. Módulo `insumos/lib/consumo.ts`

```ts
export function disponibilidadConsumo(lotesConStock: LoteConStock[]): DisponibilidadConsumo
export function lotesConStockDeInsumo(insumoId: string, lotes: Lote[], movimientos: Movimiento[]): LoteConStock[]
export async function registrarConsumo(input: {
  insumo: Insumo; loteId: string; cantidad: number; lugarId?: string
}): Promise<Movimiento>          // lanza StockInsuficienteConsumoError sin escribir
export async function deshacerConsumo(movimientoConsumoId: string): Promise<Movimiento | null>
```

`insumos/lib/fefo.ts`:

```ts
export function selectLoteConsumo(lotesConStock: LoteConStock[], cantidad: number, hoy?: Date): LoteConStock | null
```

## 5. Se elimina

`insumos/lib/consumoRapido.ts` (`consumirUno`, `selectLoteConsumoRapido`,
`DisponibilidadConsumoRapido`), `onConsumirUno`, `handleConsumirUno`, `'consumirUno'` en
`AccionConLugar`, `onConsumirOtraCantidad`, `mensajeExito` de `ConsumoForm`.

## 6. Pruebas

Nuevas:

- `tests/unit/insumos/consumo.test.ts` (reemplaza `consumoRapido.test.ts`): `disponibilidadConsumo`
  (stock fraccionario, solo vencido, 0); `registrarConsumo` (escribe, vibra, avisa; rechaza sin
  escribir si no alcanza; dos registros concurrentes no sobregiran); `deshacerConsumo` (restaura una
  sola vez).
- `tests/unit/fefo.test.ts`: casos de `selectLoteConsumo` (vigente antes que vencido; vence hoy =
  vigente; sin fecha al final; solo vencidos → vencido; ninguno cubre → primero vigente; sin stock →
  `null`).

Ajustadas:

- `tests/integration/acciones-rapidas.test.tsx`: "Consumir" abre la hoja sin escribir; confirmar con
  1 y con otra cantidad; aviso y Deshacer; menú sin "Consumir otra cantidad"; "Sin stock"; solo
  vencido → hoja con "Lote vencido"; vencido + vigente → propone el vigente; cerrar no escribe.
- `tests/integration/inventario-tabla.test.tsx`, `vista-todos.test.tsx`: botón "Consumir" y flujo por
  la hoja.
- `tests/integration/conversion-unidad.test.tsx`: el caso de "Consumir 1" pasa a `registrarConsumo`
  con 1 unidad.
- `tests/unit/avisosStore.test.ts`: import de `deshacerConsumo` desde `consumo.ts`.
- `tests/integration/ingreso-precio.test.tsx`: revisar referencias.
