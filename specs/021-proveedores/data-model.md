# Data Model: Proveedores

**Spec**: [spec.md](./spec.md) · **Research**: [research.md](./research.md)

## Proveedor (nuevo)

| Campo (Dexie / Postgres) | Tipo | Reglas |
|---|---|---|
| `id` / `id` | uuid | Lo genera el cliente (`crypto.randomUUID()`) |
| `tenantId` / `tenant_id` | uuid | Default `tenant_actual()`; inmutable |
| `nombre` / `nombre` | text | Obligatorio, 1–60 caracteres tras `trim` |
| — / `clave` | text generada | `clave_nombre(nombre)`; única por tenant entre no eliminados (R1). En el cliente se calcula con `claveNombre` y no se guarda |
| `whatsapp` / `whatsapp` | text null | Solo dígitos, 10–15, con código de país (R10) |
| `contacto` / `contacto` | text null | 1–60 caracteres tras `trim`; vacío = `null` |
| `creadoPor` / `creado_por` | uuid null | Quien lo creó (selector, Ajustes, migración o trigger de la 2.4.0); inmutable. `null` solo si la migración no encontró autor o el lote lo subió la service role |
| `creadoEn` / `creado_en` | timestamptz | Inmutable |
| `desactivadoEn` / `desactivado_en` | timestamptz null | `null` = activo. Desactivado: fuera del selector, conserva sus lotes, reactivable |
| `eliminadoEn` / `eliminado_en` | timestamptz null | Baja lógica (R7). Solo sin lotes; no aparece en ninguna lista |
| `sincronizado` | boolean (solo Dexie) | `false` = creado o cambiado aquí y aún sin subir |

**Estados**:

```text
           crear (cualquier miembro)
                   │
                   ▼
   ┌──────────►  activo  ──── desactivar (admin) ───►  desactivado
   │               │  ▲                                    │
   │               │  └──────── reactivar (admin) ─────────┘
   │               │                                       │
   │      eliminar (admin, sin lotes)          eliminar (admin, sin lotes)
   │               ▼                                       │
   └─ (no vuelve) eliminado ◄──────────────────────────────┘
```

Al pasar a desactivado o eliminado, ningún lugar lo conserva como predeterminado.

**Validaciones** (cliente y servidor):

- Nombre vacío o con solo espacios → "Escribe el nombre del proveedor."
- Clave repetida con otro activo o desactivado → "Ya existe un proveedor con ese nombre." (en el
  selector, en vez de error se elige el existente o se ofrece reactivarlo).
- WhatsApp que tras normalizar no tiene 10–15 dígitos → "Revisa el número de WhatsApp."
- Eliminar con lotes → no se ofrece; si el servidor lo rechaza, se revierte con aviso.

## Lugar (existente, cambia)

| Campo | Tipo | Reglas |
|---|---|---|
| `proveedorPredeterminadoId` / `proveedor_predeterminado_id` | uuid null | Proveedor **activo** del mismo tenant; `null` = sin predeterminado. FK compuesta, `on delete set null`. Lo cambia solo administración |

## Lote (existente, cambia)

| Campo | Tipo | Reglas |
|---|---|---|
| `proveedorId` / `proveedor_id` | uuid null | Nuevo. Obligatorio en los lotes que crea la versión nueva; los de la 2.4.0 lo reciben del trigger (R4); los viejos, de la migración. Inmutable tras el insert (R3). En Dexie, `null` solo antes del primer pull tras actualizar |
| `proveedor` / `proveedor` | text not null | Se conserva un release (FR-019): nombre del proveedor al registrar. Inmutable tras el insert. Respaldo para mostrar si no hay `proveedorId` (R11) |

## ConfiguracionClinica (se elimina)

Tabla local `configuracionClinica` y tabla del servidor `configuracion_clinica`: se borran (R12).

## Dexie v13

```text
proveedores: 'id, tenantId, sincronizado'                      # nueva
lotes:       'id, insumoId, fechaCaducidad, codigoFabricante, estado, tenantId, lugarId, proveedorId'
configuracionClinica: null                                     # borrada
upgrade:
  lotes.proveedorId ??= null
  lugares.proveedorPredeterminadoId ??= null
```

## Estado en memoria

- `inventoryStore.proveedores: Proveedor[]`: proveedores **no eliminados** del tenant, por `liveQuery`
  (igual que `categorias`). Desde ahí se arman:
  - los activos por orden alfabético (`plegar(nombre)`) para el selector y Ajustes,
  - el mapa `id → nombre` para el detalle del insumo,
  - los desactivados para Ajustes.
- El valor del selector en los formularios es `proveedorId: string | null` (estado del formulario y
  del borrador del alta).

## Migración de datos (servidor)

Por cada tenant y cada `clave_nombre(lotes.proveedor)` distinta:

- `nombre` = el texto recortado más frecuente con esa clave (desempate: el del lote más antiguo); si la
  clave es vacía, "Sin proveedor".
- `creado_por` / `creado_en` = autor y fecha del lote más antiguo con esa clave. `lotes` no guarda
  autor: se toma el `usuario_id` del movimiento `ingreso` de ese lote y, si no lo hay, el administrador
  más antiguo del tenant.
- `lotes.proveedor_id` = el proveedor de su clave.

Invariantes verificadas al final (la migración aborta si fallan): `count(lotes)` igual al de antes y
`count(*) where proveedor_id is null` = 0.
