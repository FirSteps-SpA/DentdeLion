# Contrato: esquema Supabase y sincronización

Migración: `supabase/migrations/20261023000000_proveedores.sql`, en una sola transacción. Decisiones en
[research.md](../research.md) (R1–R7, R12).

## 1. Función de clave

```text
public.clave_nombre(texto text) returns text  -- immutable, parallel safe
  = regexp_replace(lower(translate(trim(texto), <letras con tilde>, <sin tilde>)), '\s+', ' ', 'g')
```

Debe dar el mismo resultado que `claveNombre` del cliente para las letras del español (á é í ó ú ü ñ y
sus mayúsculas, más à è ì ò ù â ê î ô û ä ë ï ö ç por si acaso).

## 2. Tabla `proveedores`

```text
id              uuid primary key
tenant_id       uuid not null default tenant_actual() references tenants(id)
nombre          text not null  check (char_length(trim(nombre)) between 1 and 60)
clave           text generated always as (clave_nombre(nombre)) stored
whatsapp        text null      check (whatsapp ~ '^[0-9]{10,15}$')
contacto        text null      check (contacto is null or char_length(trim(contacto)) between 1 and 60)
creado_por      uuid null       -- null: migración sin autor o service role
creado_en       timestamptz not null default now()
desactivado_en  timestamptz null
eliminado_en    timestamptz null
unique (id, tenant_id)
unique index proveedores_clave_por_tenant on (tenant_id, clave) where eliminado_en is null
```

### Políticas RLS

| Operación | Política |
|---|---|
| SELECT | `tenant_id = tenant_actual()` |
| INSERT | `tenant_id = tenant_actual() and creado_por = auth.uid()` (cualquier miembro activo) |
| INSERT | pendiente previo a la desactivación: `tenant_id = tenant_del_perfil() and creado_en < desactivado_en_propio()` (como `lotes`) |
| UPDATE | `tenant_id = tenant_actual() and es_administrador(auth.uid())`; check `tenant_id = tenant_actual()` |
| DELETE | ninguna (baja lógica) |

### Trigger `proteger_proveedor()` (before update)

- `tenant_id`, `creado_por`, `creado_en` := los de `old`.
- Si `eliminado_en` pasa de `null` a una fecha y hay lotes con `proveedor_id = old.id` → `raise
  exception 'proveedor_con_lotes'` (código `P0001`).
- Si `desactivado_en` o `eliminado_en` pasan de `null` a una fecha → `update lugares set
  proveedor_predeterminado_id = null where proveedor_predeterminado_id = old.id`.

## 3. `lugares`

```text
add column proveedor_predeterminado_id uuid null
add foreign key (proveedor_predeterminado_id, tenant_id)
    references proveedores (id, tenant_id) on delete set null (proveedor_predeterminado_id)
```

Trigger `before insert or update` en `lugares`: si el proveedor indicado está desactivado o eliminado,
lo pone en `null` (un predeterminado subido sin conexión después de una desactivación no lo revive).

## 4. `lotes`

```text
add column proveedor_id uuid null
add foreign key (proveedor_id, tenant_id) references proveedores (id, tenant_id)
create index lotes_proveedor_idx on lotes (proveedor_id)
```

### Trigger `resolver_proveedor_lote()` (before insert, security definer)

Corre después de que los `default` completan `tenant_id`.

1. Si `new.proveedor_id` es nulo (cliente 2.4.0):
   - `k := clave_nombre(coalesce(new.proveedor, ''))`; si `k = ''`, nombre = "Sin proveedor".
   - Busca `proveedores` del tenant con `clave = k and eliminado_en is null` (activo o desactivado).
   - Si no hay: `insert … (id, tenant_id, nombre, creado_por) values (gen_random_uuid(), new.tenant_id,
     trim(new.proveedor) o 'Sin proveedor', auth.uid()) on conflict do nothing` y vuelve a buscar
     (dos inserts a la vez convergen).
   - `new.proveedor_id :=` el encontrado.
2. Si `new.proveedor_id` viene y `trim(new.proveedor) = ''`: `new.proveedor :=` el nombre del proveedor.

### `proteger_lote()` (existente, se amplía en update)

```text
new.proveedor_id := coalesce(old.proveedor_id, new.proveedor_id)
new.proveedor    := old.proveedor
```

## 5. Datos existentes

En la misma migración, después de crear todo lo anterior (ver [data-model.md](../data-model.md),
"Migración de datos"):

```text
-- por tenant y clave: nombre más frecuente, autor/fecha del lote más antiguo
insert into proveedores (…) select …
update lotes set proveedor_id = p.id from proveedores p
  where p.tenant_id = lotes.tenant_id and p.clave = clave_nombre(lotes.proveedor) and p.eliminado_en is null
-- verificación
do $$ … if exists (select 1 from lotes where proveedor_id is null) then raise exception …; $$
```

## 6. Retiro de `configuracion_clinica`

```text
drop table public.configuracion_clinica;   -- arrastra sus políticas, FK y default
```

## 7. Pruebas de aislamiento (`scripts/test-rls.mjs`)

Se quitan los casos de `configuracion_clinica`. Se agregan:

| Caso | Esperado |
|---|---|
| A (personal) crea un proveedor en su tenant | 201 |
| A (personal) lo renombra o desactiva | rechazado (0 filas o 4xx) |
| Admin de A renombra, desactiva o reactiva | 2xx |
| B no lee los proveedores de A (ni `whatsapp` ni `contacto`) | 0 filas |
| B no crea un proveedor con `tenant_id` de A | 4xx |
| B no usa un proveedor de A en un lote propio | 4xx (FK compuesta) |
| B no pone un proveedor de A como predeterminado de su lugar | 4xx |
| Dos proveedores con "Dental Sur" y " dental  súr" en A | el segundo, 409 (`23505`) |
| El mismo nombre en A y en B | ambos 201 |
| Lote sin `proveedor_id` con texto conocido (otras mayúsculas) | queda con el proveedor existente |
| Lote sin `proveedor_id` con texto nuevo | crea el proveedor y lo usa |
| Lote sin `proveedor_id` con el nombre de un desactivado | usa el desactivado, sigue desactivado |
| Upsert de un lote existente con `proveedor_id: null` o con otro texto | `proveedor_id` y `proveedor` no cambian |
| Eliminar (`eliminado_en`) un proveedor con lotes | rechazado (`proveedor_con_lotes`) |
| Eliminar uno sin lotes | 2xx; su nombre queda libre para crear otro |
| Desactivar el predeterminado de un lugar | el lugar queda con `proveedor_predeterminado_id = null` |
| `clave_nombre` sobre la lista de paridad (R1) | las claves esperadas |

## 8. Sincronización (`src/lib/sync/index.ts`)

```text
interface ProveedorRow { id, tenant_id, nombre, whatsapp, contacto, creado_por, creado_en,
                         desactivado_en, eliminado_en }   // `clave` solo se lee, nunca se envía
LoteRow  += proveedor_id: string | null    // toLoteRow lo omite si es null
LugarRow += proveedor_predeterminado_id: string | null
```

Orden en `ejecutarCiclo`:

```text
validarSesion
pushProveedores        # nuevo: pendientes del tenant; admin upsert / personal insert;
                       #   23505 → remapear al del servidor por `clave`; rechazo de permisos → queda pendiente
pullProveedores        # nuevo: seleccionarTodo('proveedores'), respeta conservarCambioLocal
pushLugares            # sube proveedor_predeterminado_id
pullLugares
… (sin cambios) …
pushLotes              # sube proveedor_id (omitido si null)
…
pullLotes              # trae proveedor_id
```

`pushProveedores` registra en el ciclo los errores que no son duplicado ni permisos, como el resto de
las etapas. Un `proveedor_con_lotes` al eliminar deja de marcar la fila como pendiente, y el pull trae
el estado del servidor (sin eliminar). Además se avisa con `useAvisosStore` (tipo nuevo
`proveedor-no-eliminado`).

`remapearProveedor(localId, servidorId)` corre en una transacción sobre `lotes`, `lugares`,
`proveedores` y `borradores`: cambia `proveedorId` y `proveedorPredeterminadoId`, borra la fila local y
trae la del servidor.
