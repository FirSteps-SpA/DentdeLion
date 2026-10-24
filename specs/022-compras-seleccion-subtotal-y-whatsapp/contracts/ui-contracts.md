# Contract: lógica y UI

**Research**: [R2–R5, R7–R9](../research.md) · **Data model**: [data-model.md](../data-model.md)

## Lógica pura (`src/features/compras/lib/`)

### `pedido.ts` (nuevo)

```ts
export const SALUDO_PEDIDO_POR_DEFECTO: string
export const LARGO_MAXIMO_SALUDO = 500
export const LARGO_MAXIMO_ENLACE = 4000

export function saludoEfectivo(config: ConfiguracionAlertas | undefined): string

/** Sugeridos y manuales de una vista, en el orden de pantalla (R5). */
export function itemsDelPedido(
  sugeridos: { item: ItemSugerido; lugarId: string }[],
  manuales: ItemCompra[],
  insumos: Insumo[],                 // activos: un vinculado dado de baja queda sin insumo
): ItemPedido[]

export function claveSugerido(lugarId: string, insumoId: string): string   // 's:…:…'
export function claveManual(itemId: string): string                        // 'm:…'

/** R3: precio por unidad de compra = costo unitario × contenido actual. */
export function valorItem(item: ItemPedido, costos: Map<string, CostoUnitario>): ValorItem
export function resumirSeleccion(
  items: ItemPedido[], seleccion: ReadonlySet<string>, costos: Map<string, CostoUnitario>,
): ResumenSeleccion

/** R5. `nombresLugar` solo en la vista "Todos". */
export function construirMensajePedido(
  saludo: string,
  items: ItemPedido[],               // ya filtrados a los seleccionados
  nombresLugar?: Map<string, string>,
): string

/** R4: `https://wa.me/<dígitos>?text=…` o `https://wa.me/?text=…`. */
export function enlaceWhatsApp(whatsapp: string | null, mensaje: string): string
```

`compartir.ts`: se elimina `construirTextoCompartir` (lo reemplaza `construirMensajePedido`); quedan
`puedeCompartir` y `copiarAlPortapapeles`.

### `useSeleccionCompras.ts` (nuevo)

```ts
export function useSeleccionCompras(clavesPendientes: ReadonlySet<string>): {
  seleccion: ReadonlySet<string>      // ya podada contra clavesPendientes
  alternar(clave: string): void
  marcarTodos(claves: string[]): void // FR-002: si todas ya estaban, las desmarca
  cargando: boolean
}
```

- Lee y escribe `db.borradores` (`'seleccion-compras'`) con el `tenantId` actual (R2).
- `clavesPendientes` = claves de **todos** los lugares del tenant (no solo de la vista), para la poda.
- Escritura optimista: el estado en memoria cambia al instante y la fila se guarda detrás.

### `saludoAdmin.ts` (nuevo, en `features/ajustes/lib/`)

```ts
/** Guarda en Dexie con sincronizado: false; '' o solo espacios → null. Lanza si > 500. */
export async function guardarSaludoPedido(texto: string): Promise<void>
export async function restablecerSaludoPedido(): Promise<void>
```

Crea la fila `'global'` si no existe (con `NIVELES_AVISO_POR_DEFECTO`), como hace hoy la sección de
avisos.

## Componentes

### `ComprasView.tsx` (cambia)

- Cabecera: título "Compras"; se quita "Compartir Lista" (pasa a la barra de resumen).
- Encima de las listas: casilla "Seleccionar todo" (`role="checkbox"`, `aria-checked="mixed"` si hay
  algunas), sobre los ítems **visibles** de la vista.
- `ItemSugeridoCard` e `ItemManualCard` reciben `seleccionado`, `onAlternar` y `valor: ValorItem | null`
  (`null` si no está seleccionado).
- Pie: `ResumenSeleccion` (abajo).
- Overlay nuevo `{ tipo: 'enviarWhatsApp' }` → `EnviarPedidoSheet`.

### Casilla en las tarjetas (`ItemSugeridoCard`, `ItemManualCard`)

- `<input type="checkbox">` visualmente propio, dentro de un `<label>` de 48 × 48 px a la izquierda de
  la tarjeta; `aria-label="Seleccionar <nombre>"` (o "… en <lugar>" en "Todos").
- Seleccionado: borde `primary` en la tarjeta y, al final del bloque de texto, el monto
  (`formatearCLP`) o "Sin precio" / "Sin cantidad" en `text-muted`.
- El botón ✓ (recibir) y el menú del manual no cambian.

### `ResumenSeleccion.tsx` (nuevo)

```text
┌───────────────────────────────────────────────┐
│ 3 seleccionados        Subtotal estimado       │
│ 1 sin precio                       $45.990     │
│ [ Enviar por WhatsApp ]  [Copiar] [Compartir]  │
└───────────────────────────────────────────────┘
```

- `aria-live="polite"` en la línea de totales.
- Sin selección: "Selecciona lo que vas a pedir" y los tres botones `disabled`.
- "Compartir" solo si `puedeCompartir()`; si no, solo "Copiar" (como hoy). Mensajes: "Lista copiada",
  "No se pudo copiar…" (existentes).
- Teléfono: fijo sobre la barra inferior, con `padding-bottom` en la lista para no tapar la última
  tarjeta. Tablet/desktop: `sticky bottom-0` al pie de la columna.

### `EnviarPedidoSheet.tsx` (nuevo)

`BottomSheet` "Enviar pedido":

1. "¿A quién se lo envías?": `radiogroup` con los proveedores activos (orden alfabético), cada opción
   ≥ 48 px con el nombre y, si no tiene número, "Sin WhatsApp". Buscador si hay más de 8. Preelegido:
   el predeterminado del lugar activo (o del último lugar activo en "Todos"); si no hay, ninguno.
2. Vista previa del mensaje (`<pre>` con `whitespace-pre-wrap`, máx. 8 líneas y "…").
3. Avisos:
   - proveedor sin WhatsApp o ninguno elegido: "<Nombre> no tiene WhatsApp: elige el contacto en
     WhatsApp." / "Elige el contacto en WhatsApp.";
   - enlace > `LARGO_MAXIMO_ENLACE`: "La lista es muy larga para WhatsApp. Cópiala y pégala en el
     chat." y en lugar del enlace, el botón "Copiar".
4. Acción: `<a href={enlaceWhatsApp(…)} target="_blank" rel="noopener noreferrer">Abrir WhatsApp</a>`
   con estilo de botón primario; al tocarlo, la hoja se cierra. La selección no cambia (FR-017).

Sin catálogo de proveedores: la lista no aparece; solo el aviso "Elige el contacto en WhatsApp." y el
botón.

### Ajustes → Proveedores (`ProveedoresSection.tsx`, cambia)

Tarjeta "Mensaje del pedido" antes de la lista:

- `textarea` (4 filas, `maxLength=500`) con el saludo efectivo; contador "N/500".
- "Guardar" (deshabilitado si no cambió) y "Restablecer" (deshabilitado si ya es el de la clienta).
- Al guardar: "Saludo guardado." Sin conexión se guarda igual (Dexie) y sube después.
- Texto de ayuda: "Va al comienzo del pedido que se envía por WhatsApp. La lista de materiales se agrega
  sola, sin precios."

### `alertasStore` (cambia)

Expone `saludoPedido: string` (= `saludoEfectivo(config)`) junto a los niveles, desde la misma
`liveQuery`.

## Pruebas

| Archivo | Cubre |
|---|---|
| `tests/unit/compras/pedido.test.ts` (nuevo) | claves; `valorItem` (sugerido, caducado, manual vinculado/sin vínculo/dado de baja, precio 0, cambio de presentación); `resumirSeleccion`; `construirMensajePedido` (saludo, orden, sin precios ni "Sugerido"/"Manual", "Todos" con lugar, sin cantidad); `enlaceWhatsApp` (con y sin número, `encodeURIComponent` con "ñ", "&", "#", saltos de línea) |
| `tests/unit/compras/useSeleccionCompras.test.tsx` (nuevo) | persiste en `borradores`; poda; ítem nuevo sin marcar; tenant distinto se ignora; marcar todos / desmarcar todos |
| `tests/unit/ajustes/saludoAdmin.test.ts` (nuevo) | guardar, vacío → `null`, > 500 lanza, restablecer, crea la fila si falta, `sincronizado: false` |
| `tests/integration/compras-seleccion.test.tsx` (nuevo) | casillas y "Seleccionar todo"; subtotal y contadores; Copiar con solo lo seleccionado; botones deshabilitados sin selección; selección tras desmontar y montar |
| `tests/integration/enviar-pedido.test.tsx` (nuevo) | predeterminado preelegido; `href` del enlace con número y mensaje; sin WhatsApp → aviso y `wa.me/?text=`; sin catálogo; lista muy larga → Copiar; la selección no cambia |
| `tests/integration/ajustes-proveedores.test.tsx` (cambia) | tarjeta del saludo: guardar, restablecer, contador; `personal` no ve la sección |
| `tests/integration/compras.test.tsx` (cambia) | "Compartir Lista" pasa a la barra; textos nuevos |
| `tests/unit/compras/compartir.test.ts` (cambia) | sin `construirTextoCompartir` (sus casos pasan a `pedido.test.ts`) |
