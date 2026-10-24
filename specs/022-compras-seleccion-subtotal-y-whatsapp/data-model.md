# Data Model: Compras · selección, subtotal y pedido por WhatsApp

**Spec**: [spec.md](./spec.md) · **Research**: [research.md](./research.md)

## Saludo del pedido (cambia `ConfiguracionAlertas`)

| Campo (Dexie / Postgres) | Tipo | Reglas |
|---|---|---|
| `saludoPedido` / `saludo_pedido` | text null | `null` = saludo de la clienta (`SALUDO_PEDIDO_POR_DEFECTO`, en el cliente). Si hay texto: 1–500 caracteres tras `trim`. Lo escribe solo administración (política existente "administrador escribe"); lo leen todos los miembros del tenant |

En Dexie el campo es opcional (R1):

| Valor local | Significado | Al subir |
|---|---|---|
| `undefined` | Nunca se cambió en este dispositivo | No se envía la columna |
| `null` | Restablecido o guardado vacío | `saludo_pedido: null` |
| `'texto'` | Saludo propio | `saludo_pedido: 'texto'` (recortado) |

Al bajar, `null` del servidor se guarda como `null` (no `undefined`), para que un "Restablecer" de otro
dispositivo se aplique aquí.

`saludoEfectivo(config) = config?.saludoPedido?.trim() || SALUDO_PEDIDO_POR_DEFECTO`.

`SALUDO_PEDIDO_POR_DEFECTO = 'Hola, ¿cómo están? Me gustaría saber si tienen los siguientes materiales,
fechas de vencimiento y sus precios, por favor'`.

**Validación** (Ajustes): más de 500 caracteres → "El saludo puede tener hasta 500 caracteres." (el
`textarea` no deja escribir más; el mensaje cubre el pegado). Vacío o solo espacios → se guarda `null`.

## Selección de compras (nueva, solo local)

Fila de `borradores` (Dexie, nunca sincronizada; R2):

```ts
interface BorradorSeleccionCompras {
  id: 'seleccion-compras'
  datos: { tenantId: string; claves: string[] }
  actualizadoEn: string
}
```

`Borrador` pasa a ser la unión de `BorradorAlta` (`'alta-material'`, existente) y este. Sin cambio de
esquema Dexie (el índice es solo `id`).

**Claves**:

| Ítem | Clave |
|---|---|
| Sugerido | `s:<lugarId>:<insumoId>` |
| Manual | `m:<itemCompraId>` |

**Ciclo de vida**:

```text
(sin fila) ── marcar ──► claves = [k] ── marcar/desmarcar ──► claves'
     ▲                         │
     │        poda: k ya no es un ítem pendiente de ningún lugar ──► se quita k
     └── cerrar sesión (borradores.clear) / tenant distinto (se ignora)
```

## Vistas calculadas (nunca se guardan)

```ts
/** Un renglón de la lista de compras, sugerido o manual, con su clave de selección. */
interface ItemPedido {
  clave: string                  // R2
  origen: 'sugerido' | 'manual'
  nombre: string
  lugarId: string
  insumo: Insumo | null          // sugerido: siempre; manual: el vinculado y activo
  cantidad: number | null        // unidades de compra (R3)
  unidadCompra: string | null    // null en un manual sin insumo
}

type ValorItem =
  | { tipo: 'monto'; monto: number }     // cantidad × precio por unidad de compra
  | { tipo: 'sin-precio' }
  | { tipo: 'sin-cantidad' }

interface ResumenSeleccion {
  seleccionados: number
  subtotal: number        // suma de los 'monto', sin redondear
  sinPrecio: number
  sinCantidad: number
}
```

Precio por unidad de compra de un insumo = `costosUnitariosPorInsumo(...).get(id).costo ×
insumo.contenido` (R3). Prioridad: sin precio antes que sin cantidad.

## Sin cambios

- `Proveedor`, `Lugar`, `Lote`: se leen, no cambian.
- `items_compra` en el servidor: mismas políticas; solo cambia cómo sube el cliente (R6).

## ItemCompra (cambia, solo local)

| Campo | Tipo | Reglas |
|---|---|---|
| `cambioLocal` | boolean opcional (solo Dexie) | `true` al crear, marcar comprado o eliminar en este dispositivo; se limpia al subir. Un ítem ajeno solo sube (por UPDATE) si lo tiene; el pull no pisa uno que lo tenga (R6). Ausente en las filas que vienen del servidor. Sin versión nueva de Dexie |
