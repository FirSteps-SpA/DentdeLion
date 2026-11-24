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
interface CantidadDoble {
  consumo: number | null        // lo que se guarda (null = vacío; solo en el mínimo, que es opcional)
  ultimoEditado: 'compra' | 'consumo'
  textoEditado: string          // lo escrito tal cual, para no reformatear mientras se tipea
}
```

Reglas:
- `compra = consumo / contenido` y `consumo = compra × contenido`. El campo derivado se muestra con
  ≤ 2 decimales y "≈" si `|derivado − redondeado| > 1e-9`.
- Escribir en la unidad de compra respeta `unidadAdmiteDecimales(unidadCompra)`, y en la de consumo
  respeta `unidadAdmiteDecimales(unidadMedida)`. El valor derivado nunca se redondea a entero.
- Al cambiar `contenido`, se conserva el valor de `ultimoEditado` y se recalcula el otro. Si lo último
  editado fue la compra, `consumo` cambia.
- `contenido` vacío o ≤ 0: solo el campo de consumo queda habilitado.
- Alta: `stockInicial = consumo` y `unidadStockInicial = unidadMedida`. `stockMinimo = consumo`.
