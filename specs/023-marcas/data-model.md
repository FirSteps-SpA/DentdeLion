# Data Model: Marcas

Referencias: [research.md](./research.md) (R1–R13) y [contracts/supabase-schema.md](./contracts/supabase-schema.md).

## Marca (nueva)

| Campo (servidor / cliente) | Tipo | Reglas |
|---|---|---|
| `id` / `id` | uuid | Lo genera el cliente (offline). |
| `tenant_id` / `tenantId` | uuid | Default `tenant_actual()`; inmutable. |
| `nombre` / `nombre` | text | 1–60 caracteres sin contar espacios de los extremos; obligatorio (FR-002). |
| `clave` / — | text generada | `clave_nombre(nombre)`; única por tenant entre las no eliminadas. En el cliente: `claveCategoria(nombre)`. |
| `creado_por` / `creadoPor` | uuid | `auth.uid()` al insertar (RLS); inmutable. |
| `creado_en` / `creadoEn` | timestamptz | Inmutable. |
| `desactivado_en` / `desactivadoEn` | timestamptz \| null | `null` = activa. |
| `eliminado_en` / `eliminadoEn` | timestamptz \| null | Baja lógica (R6); no se revierte; solo sin insumos. |
| — / `sincronizado` | boolean | Local: `false` = creada o cambiada aquí y aún sin subir. |

**Estados**:

```text
activa ──desactivar──▶ desactivada ──reactivar──▶ activa
  │                        │
  └──eliminar (0 insumos)──┴──▶ eliminada (terminal, no visible)
```

- **Activa**: se ofrece en el selector y cuenta en el resumen de Ajustes.
- **Desactivada**: no se ofrece. Los insumos que la tienen la conservan y la muestran (FR-018).
  Aparece en "Desactivadas" de Ajustes.
- **Eliminada**: no se muestra en ninguna parte. El servidor la rechaza si algún insumo la usa
  (`marca_con_insumos`).

**Permisos** (RLS + trigger):

| Acción | Administración | Personal |
|---|---|---|
| Ver | ✅ | ✅ |
| Crear (desde el selector o Ajustes) | ✅ | ✅ (como sí mismo) |
| Renombrar, desactivar, reactivar, eliminar | ✅ | ❌ |

## Insumo (existente, cambia)

| Campo | Cambio |
|---|---|
| `marca_id` / `marcaId` | **Nuevo**, `uuid \| null`. FK compuesta `(marca_id, tenant_id) → marcas (id, tenant_id)`. `null` = sin marca. Se fija en el INSERT; en UPDATE solo lo cambia el historial (R3). |

- Los insumos existentes quedan con `marca_id = null` (FR-004).
- `CampoEditableInsumo` suma `'marcaId'`: es catálogo (FR-008), solo administración lo cambia en un
  insumo existente.

## CambioInsumo (existente, cambia)

| Campo | Cambio |
|---|---|
| `campo` | Acepta `'marcaId'` (check del servidor y tipo del cliente). |
| `valor_anterior` / `valor_nuevo` | Para `'marcaId'`: el id de la marca (string en jsonb) o `null`. |
| `factor` | Siempre `null` para `'marcaId'` (el check existente ya lo exige fuera de `unidadMedida`). |

**Regla de aplicación** (servidor y cliente, la misma): para cada insumo, `marcaId` vale el
`valor_nuevo` del cambio `'marcaId'` vigente con mayor `(creado_en, id)`. Sin cambios, vale el del
INSERT.

## Dexie v14

```text
marcas:  'id, tenantId, sincronizado'                           (nueva)
insumos: 'id, nombre, categoria, codigoFabricante, tenantId, marcaId'   (suma índice marcaId)
upgrade: insumos.marcaId ??= null
```

- `inventoryStore.marcas`: marcas del tenant actual sin las eliminadas, por `liveQuery`.
- Borrador del alta (`BorradorAlta.datos`): suma `marcaId: string | null`. Un borrador anterior sin el
  campo se lee como `null`.

## Relaciones

```text
Tenant 1──* Marca 1──* Insumo (opcional) *──1 Tenant
                         │
                         └──* CambioInsumo (campo 'marcaId')
```

## Valores derivados (cliente)

- **Nombre visible de la marca de un insumo**: `marcasPorId.get(insumo.marcaId)?.nombre`, solo si la
  marca no está eliminada. Si no, no se muestra nada.
- **Uso de una marca** (Ajustes): cantidad de insumos locales del tenant con `marcaId = marca.id`,
  incluidos los dados de baja.
- **Renglón del pedido**: `Nombre · Marca` si el insumo del ítem tiene marca visible.
