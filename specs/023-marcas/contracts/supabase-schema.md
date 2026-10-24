# Contrato: esquema Supabase y sincronización

Migración: `supabase/migrations/20261025000000_marcas.sql`, en una sola transacción y **sin cambios de
datos**. Decisiones en [research.md](../research.md) (R1–R6, R14).

## 1. Tabla `marcas`

```text
id              uuid primary key
tenant_id       uuid not null default tenant_actual() references tenants(id)
nombre          text not null  check (char_length(btrim(nombre)) between 1 and 60)
clave           text generated always as (clave_nombre(nombre)) stored   -- función de la 021
creado_por      uuid null
creado_en       timestamptz not null default now()
desactivado_en  timestamptz null
eliminado_en    timestamptz null
unique (id, tenant_id)
unique index marcas_clave_por_tenant on (tenant_id, clave) where eliminado_en is null
```

### Políticas RLS (las mismas que `proveedores`)

| Operación | Política |
|---|---|
| SELECT | `tenant_id = tenant_actual()` |
| INSERT | `tenant_id = tenant_actual() and creado_por = auth.uid()` |
| INSERT | pendiente previo a la desactivación: `tenant_id = tenant_del_perfil() and creado_por = auth.uid() and creado_en < desactivado_en_propio()` |
| UPDATE | `using (tenant_id = tenant_actual() and es_administrador(auth.uid()))`, `with check (tenant_id = tenant_actual())` |
| DELETE | ninguna (baja lógica) |

### Trigger `proteger_marca()` (before update, security definer)

- `tenant_id`, `creado_por`, `creado_en` := los de `old`; un `eliminado_en` ya puesto no se borra.
- Si `eliminado_en` pasa de `null` a una fecha y existe un insumo con `marca_id = old.id` (incluidos
  los dados de baja) → `raise exception 'marca_con_insumos' using errcode = 'P0001'`.

## 2. `insumos.marca_id`

```text
alter table insumos add column marca_id uuid null
alter table insumos add constraint insumos_marca_tenant_fkey
  foreign key (marca_id, tenant_id) references marcas (id, tenant_id)
create index insumos_marca_idx on insumos (marca_id)
```

### `proteger_catalogo_insumo()` (create or replace, before update)

Lo de hoy, más esta regla:

```text
if coalesce(current_setting('dentdelion.aplicando_marca', true), '') <> 'on' then
  new.marca_id := old.marca_id        -- para cualquier usuario, también administración (R3)
end if
```

El INSERT no pasa por este trigger: el alta fija `marca_id` (cualquier miembro, FR-007).

## 3. `cambios_insumo`

- `cambios_insumo_campo_check` se recrea con `'marcaId'` sumado a la lista actual (`nombre`,
  `categoria`, `unidadMedida`, `unidadCompra`, `contenido`, `stockMinimo`, `codigoFabricante`,
  `caduca`, `baja`).
- RLS sin cambios: solo administración inserta, como sí misma (FR-008).

### Trigger `aplicar_marca_desde_cambio()` (after insert, security definer, `when (new.campo = 'marcaId')`)

```text
perform set_config('dentdelion.aplicando_marca', 'on', true)
update insumos set marca_id = (
  select nullif(c.valor_nuevo #>> '{}', '')::uuid
  from cambios_insumo c
  where c.insumo_id = new.insumo_id and c.campo = 'marcaId'
  order by c.creado_en desc, c.id desc
  limit 1
) where id = new.insumo_id
perform set_config('dentdelion.aplicando_marca', '', true)
```

- Gana el más reciente por `(creado_en, id)`, igual que `proyectarInsumo` (data-model.md), aunque los
  cambios lleguen desordenados.
- Si el id no es una marca del tenant del insumo, la FK falla, el insert del cambio se rechaza y el
  cambio queda pendiente en el cliente (error de ciclo, no de permisos).

## 4. Sincronización (`src/lib/sync/index.ts`)

Orden en `ejecutarCiclo`:

```text
pushProveedores → pullProveedores
pushMarcas      → pullMarcas            ← NUEVO (antes de insumos: FK de marca_id)
pushLugares     → pullLugares
pushCategorias  → pushInsumos → … → pushCambiosInsumo → pullCambiosInsumo → pullInsumos → …
```

- `toInsumoRow` / `fromInsumoRow`: `marca_id` ↔ `marcaId` (`?? null` al leer).
- `pushMarcas`: pendientes del tenant (`sincronizado = false`); el personal solo sube las suyas, con
  insert; administración hace upsert. Respuestas:
  - éxito → `sincronizado = true` si la fila no cambió entretanto;
  - `23505` → `resolverMarcaDuplicada`: si el servidor ya tiene ese id, es un renombrado que choca
    (aviso `marca-repetida`, se da por subida); si no, `remapearMarca(localId, delServidor)`;
  - `marca_con_insumos` → se da por subida (el pull trae el estado real) y aviso
    `marca-no-eliminada`;
  - sin permisos → queda pendiente (el pull trae la versión del servidor);
  - otro → error del ciclo.
- `remapearMarca` (una transacción Dexie): `insumos.marcaId`, `cambiosInsumo` **no sincronizados**
  con `campo = 'marcaId'` (`valorNuevo` y `valorAnterior`), borrador `alta-material`; borra la local y
  guarda la del servidor.
- `pushCambiosInsumo`: excluye los cambios `marcaId` cuyo `valorNuevo` apunta a una marca local con
  `sincronizado = false`.
- `pullMarcas`: `seleccionarTodo('marcas')` (paginado), sin pisar filas con cambio local pendiente
  (`conservarCambioLocal`).
- `tenancy`: al cambiar de tenant, borra las marcas sincronizadas ajenas, como `proveedores`.

## 5. `npm run test:rls` (casos nuevos en `scripts/test-rls.mjs`)

1. Aislamiento: un usuario del tenant 2 no lee, no inserta en el tenant 1 ni actualiza marcas del
   tenant 1.
2. Personal crea una marca como sí mismo ✅; con otro `creado_por` ❌; renombrar, desactivar o eliminar
   ❌.
3. Clave repetida (`"3m "` frente a `"3M"`) en el mismo tenant → `23505`; en otro tenant ✅.
4. Eliminar una marca con un insumo (también dado de baja) → `marca_con_insumos`; sin insumos ✅.
5. Insumo con `marca_id` de otro tenant → rechazo por FK.
6. **Convivencia 2.5.0**: upsert del insumo **sin** la clave `marca_id` (como la 2.5.0) conserva la
   marca.
7. **Fila desfasada**: upsert del insumo con `marca_id: null` por administración conserva la marca
   (R3).
8. Cambio `marcaId` de administración → `insumos.marca_id` cambia; dos cambios desordenados → queda el
   de mayor `(creado_en, id)`; cambio a `null` → sin marca.
9. Cambio `marcaId` de personal → rechazo RLS y `marca_id` intacto.
10. Alta de insumo por personal con `marca_id` del tenant ✅.
