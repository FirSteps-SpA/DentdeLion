# Data Model: Mejoras de UX en Nuevo insumo, perfil y tabla de inventario

Sin tablas ni columnas nuevas. Sin cambio de versión de Dexie.

## perfiles (servidor) — sin cambios de esquema

| Campo | Cambio |
|---|---|
| `nombre` | La propia persona activa lo puede cambiar, solo vía `actualizar_mi_nombre` (contracts/api.md). Se valida 1–80 caracteres tras `trim`. |
| `rol`, `tenant_id`, `desactivado_en` | Sin cambios: solo administración (policy existente + `proteger_ultimo_admin`). |

## usuarioActual / usuariosConocidos (Dexie) — sin cambios de esquema

- `authStore.actualizarNombre(nombre)` (nuevo): escribe `usuarioActual.nombre` y hace `put` en
  `usuariosConocidos` con el mismo id, igual que `login`.
- El chequeo de perfil del sync compara `perfil.nombre` con `usuario.nombre` y llama a
  `actualizarNombre` si difieren.

## Estado de formulario: cantidad doble (solo cliente)

```ts
interface CantidadTecleada {
  cantidad: number | null   // lo escrito (null = vacío; solo en los mínimos, que son opcionales)
  unidad: string            // en qué unidad se escribió: la de compra o la de consumo
}
```

Reglas (`src/features/insumos/lib/cantidadDoble.ts`):
- `aConsumo`: `compra × contenido` si se escribió en la unidad de compra, o la misma cantidad si se
  escribió en la de consumo. Una unidad que ya no es de la presentación se toma como de consumo.
- `equivalente`: lo escrito en la otra unidad con ≤ 2 decimales, `exacto: false` → "≈". Nunca se
  redondea a entero.
- Al escribir se rechazan los decimales si la unidad no los admite. El calculado puede tenerlos.
- Al cambiar `contenido` se conserva lo escrito y se recalcula el otro.
- Sin `contenido` válido: el campo de compra queda deshabilitado.
- **Stock inicial (Alta)**: se guarda tal como se escribió (`stockInicial` + `unidadStockInicial`).
  Así el lote conserva `cantidadIngresada`/`unidadIngresada` exactos ("3 jeringas"), como en spec 015.
- **Mínimos (Alta y Editar)**: se guardan en unidad de consumo (`aConsumo`). En Alta, si se escribió
  en la de compra, el formulario recuerda lo escrito para recalcular el mínimo si cambia el contenido.
- Con unidades iguales, el campo es el `Stepper` de siempre (con − y +).
