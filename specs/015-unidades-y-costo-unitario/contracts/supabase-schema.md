# Contract: esquema Supabase — Unidades y Costo Unitario

**Migración**: `supabase/migrations/20261021000000_unidades_y_costo.sql` (una transacción).
Construye sobre `20261020000000_multi_tenant.sql` (`tenant_actual()`, `es_administrador()`, RLS por
tenant). Fragmentos orientativos; el SQL final se escribe en la implementación.

## 1. Catálogo y `pieza` → `unidad`

```sql
update insumos set unidad_medida = 'unidad' where unidad_medida = 'pieza';
update cambios_insumo
   set valor_anterior = case when valor_anterior = '"pieza"'::jsonb then '"unidad"'::jsonb else valor_anterior end,
       valor_nuevo    = case when valor_nuevo    = '"pieza"'::jsonb then '"unidad"'::jsonb else valor_nuevo end
 where campo = 'unidadMedida';
```

Check de unidades válidas (`unidad_medida`, `unidad_compra`, `lotes.unidad_*`, `movimientos.unidad`)
con la lista de R1, agregado **después** del backfill. Trigger `normalizar_unidad` (`before insert or
update` en `insumos`) convierte `pieza` en `unidad` para clientes 2.3.0.

## 2. Insumos

```sql
alter table insumos
  add column unidad_compra text,
  add column contenido numeric not null default 1 check (contenido > 0);
update insumos set unidad_compra = unidad_medida;
alter table insumos alter column unidad_compra set not null;
```

`proteger_catalogo_insumo` agrega `unidad_compra` y `contenido` a los campos que un no
administrador no puede cambiar. Un `insert` de cliente 2.3.0 sin `unidad_compra` la completa con
`unidad_medida` (en `normalizar_unidad`).

## 3. `cambios_insumo`

```sql
alter table cambios_insumo add column factor numeric check (factor is null or factor > 0);
-- check de campo: agrega 'unidadCompra' y 'contenido'
-- factor solo con campo = 'unidadMedida'
alter table cambios_insumo add constraint cambios_insumo_factor_campo
  check (factor is null or campo = 'unidadMedida');
```

RLS sin cambios (inserta solo administración del tenant, como sí misma).

## 4. Lotes

```sql
alter table lotes
  add column cantidad_ingresada numeric check (cantidad_ingresada is null or cantidad_ingresada > 0),
  add column unidad_ingresada text,
  add column contenido numeric not null default 1 check (contenido > 0),
  add column unidad_consumo text,
  add column precio_compra numeric check (precio_compra is null or precio_compra >= 0);
update lotes l set unidad_consumo = i.unidad_medida from insumos i where i.id = l.insumo_id;
alter table lotes alter column unidad_consumo set not null;
```

Trigger `proteger_lote` (`before insert or update`, reemplaza `proteger_resolucion_lote`):

- `insert`: si `unidad_consumo` es `null`, la completa desde el insumo (cliente 2.3.0).
- `update`: conserva `old` en `cantidad_ingresada`, `unidad_ingresada`, `contenido`,
  `unidad_consumo`, `precio_compra`, `insumo_id` y `tenant_id`; mantiene la regla de `estado`
  (`revision → activo` solo administración).

## 5. Movimientos

```sql
alter table movimientos add column unidad text;
update movimientos m set unidad = i.unidad_medida
  from lotes l join insumos i on i.id = l.insumo_id
 where l.id = m.lote_id;
alter table movimientos alter column unidad set not null;
```

Trigger `completar_unidad_movimiento` (`before insert`): si `unidad` es `null`, toma la
`unidad_medida` actual del insumo del lote. `verificar_traslado` agrega `s.unidad = e.unidad` a la
condición de consistencia. RLS sin cambios (insert-only como uno mismo).

## 6. `cambios_lote` (nueva)

```sql
create table cambios_lote (
  id uuid primary key,
  tenant_id uuid not null default tenant_actual() references tenants (id),
  lote_id uuid not null,
  campo text not null check (campo in ('precioCompra')),
  valor_anterior jsonb,
  valor_nuevo jsonb,
  usuario_id uuid not null,
  creado_en timestamptz not null,
  foreign key (lote_id, tenant_id) references lotes (id, tenant_id)
);
create index on cambios_lote (tenant_id);
create index on cambios_lote (lote_id);
alter table cambios_lote enable row level security;
create policy "cambios_lote: leer del tenant" on cambios_lote
  for select to authenticated using (tenant_id = tenant_actual());
create policy "cambios_lote: insertar como uno mismo" on cambios_lote
  for insert to authenticated
  with check (tenant_id = tenant_actual() and usuario_id = auth.uid());
create policy "cambios_lote: pendiente previo a la desactivación" on cambios_lote
  for insert to authenticated
  with check (usuario_id = auth.uid() and tenant_id = tenant_del_perfil()
              and creado_en < desactivado_en_propio());
```

Sin políticas de update ni delete. Si `lotes` no tiene una clave única `(id, tenant_id)`, se agrega
(la 014 ya la creó para las FK compuestas; verificar). Validación de `valor_nuevo`: número `≥ 0` o
`null` (check con `jsonb_typeof`).

## 7. Sincronización (cliente)

| Tabla | Push | Pull |
|---|---|---|
| `insumos` | Igual (columnas nuevas en `toInsumoRow`; `filaParaSubir` deshace también `unidadCompra`/`contenido`) | Igual |
| `cambios_insumo` | Igual, con `factor` | Igual |
| `lotes` | Igual, columnas nuevas (el trigger las protege en update) | Igual |
| `movimientos` | Igual, con `unidad` | Igual |
| `cambios_lote` | Nuevo, patrón `cambios_insumo`: pendientes del usuario actual, `upsert` con `ignoreDuplicates`, marca `sincronizado` solo si el servidor aceptó; error de fila = error de ciclo (no hay rechazo por rol) | Nuevo, `select *` |

Orden del ciclo: `lotes` antes que `cambios_lote` (FK). La reconciliación de sobregiros usa
movimientos normalizados (research.md R4).

## 8. Casos `test:rls`

1. Tenant B no lee ni inserta `cambios_lote` de lotes del tenant A.
2. Personal del tenant inserta `cambios_lote` como sí mismo; no puede con otro `usuario_id`.
3. `update lotes set precio_compra = …` desde cualquier rol no cambia el valor.
4. Personal no cambia `insumos.unidad_compra` ni `contenido`; administración sí (vía upsert +
   cambio en el ledger).
5. Insert de movimiento sin `unidad` → queda con la unidad del insumo.
6. Traslado con `unidad` distinta en salida y entrada → rechazado al confirmar.
7. Insert de insumo con `unidad_medida = 'pieza'` → queda `unidad`.
8. `cambios_insumo` con `factor` y `campo <> 'unidadMedida'` → rechazado.
