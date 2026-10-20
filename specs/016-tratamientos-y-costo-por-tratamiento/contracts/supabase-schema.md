# Contract: esquema Supabase — Tratamientos

**Migración**: `supabase/migrations/20261022000000_tratamientos.sql` (una transacción). Construye
sobre la 014 (`tenant_actual()`, `tenant_del_perfil()`, `desactivado_en_propio()`,
`es_administrador()`) y la 015. Fragmentos orientativos.

## 1. `tratamientos`

```sql
create table tratamientos (
  id uuid primary key,
  tenant_id uuid not null default tenant_actual() references tenants (id),
  creado_por uuid not null,
  creado_en timestamptz not null,
  constraint tratamientos_id_tenant_key unique (id, tenant_id)
);
```

RLS: leer del tenant; insertar solo administración del tenant con `creado_por = auth.uid()`. Sin
update ni delete.

## 2. `cambios_tratamiento`

```sql
create table cambios_tratamiento (
  id uuid primary key,
  tenant_id uuid not null default tenant_actual() references tenants (id),
  tratamiento_id uuid,
  lugar_id uuid,
  campo text not null check (campo in ('nombre','materiales','activo','precio','porcentajeProfesional')),
  valor_anterior jsonb,
  valor_nuevo jsonb,
  usuario_id uuid not null,
  creado_en timestamptz not null,
  foreign key (tratamiento_id, tenant_id) references tratamientos (id, tenant_id),
  foreign key (lugar_id, tenant_id) references lugares (id, tenant_id),
  check ((campo = 'porcentajeProfesional') = (tratamiento_id is null)),
  check ((campo in ('precio','porcentajeProfesional')) = (lugar_id is not null)),
  check (campo <> 'precio' or valor_nuevo is null or valor_nuevo = 'null'::jsonb
         or (jsonb_typeof(valor_nuevo) = 'number' and (valor_nuevo)::numeric >= 0)),
  check (campo <> 'porcentajeProfesional' or valor_nuevo is null or valor_nuevo = 'null'::jsonb
         or (jsonb_typeof(valor_nuevo) = 'number' and (valor_nuevo)::numeric between 0 and 100)),
  check (campo <> 'materiales' or jsonb_typeof(valor_nuevo) = 'array')
);
create index on cambios_tratamiento (tenant_id);
create index on cambios_tratamiento (tratamiento_id);
```

RLS: leer del tenant; insertar solo administración del tenant, `usuario_id = auth.uid()`. Sin update
ni delete.

## 3. `tratamientos_realizados`

```sql
create table tratamientos_realizados (
  id uuid primary key,
  tenant_id uuid not null default tenant_actual() references tenants (id),
  lugar_id uuid not null,
  tratamiento_id uuid not null,
  nombre text not null,
  precio numeric check (precio is null or precio >= 0),
  porcentaje_profesional numeric check (porcentaje_profesional is null or porcentaje_profesional between 0 and 100),
  materiales jsonb not null check (jsonb_typeof(materiales) = 'array'),
  costo_materiales numeric not null check (costo_materiales >= 0),
  costo_completo boolean not null,
  ganancia_estimada numeric,
  usuario_id uuid not null,
  creado_en timestamptz not null,
  anulado_en timestamptz,
  anulado_por uuid,
  constraint tratamientos_realizados_id_tenant_key unique (id, tenant_id),
  foreign key (lugar_id, tenant_id) references lugares (id, tenant_id),
  foreign key (tratamiento_id, tenant_id) references tratamientos (id, tenant_id),
  check ((anulado_en is null) = (anulado_por is null))
);
```

RLS: leer del tenant; insertar como uno mismo (`usuario_id = auth.uid()`) en el tenant, más la
política de pendientes previos a la desactivación; actualizar en el tenant con
`anulado_por = auth.uid()`. Trigger `proteger_tratamiento_realizado` (`before update`): conserva
todo el snapshot y, si `old.anulado_en` no es nulo, conserva la anulación original.

## 4. `movimientos.tratamiento_realizado_id`

```sql
alter table movimientos add column tratamiento_realizado_id uuid;
alter table movimientos add constraint movimientos_tratamiento_realizado_fkey
  foreign key (tratamiento_realizado_id, tenant_id)
  references tratamientos_realizados (id, tenant_id);
create index on movimientos (tratamiento_realizado_id) where tratamiento_realizado_id is not null;
```

## 5. Sincronización (cliente)

| Tabla | Push | Pull |
|---|---|---|
| `tratamientos` | pendientes del usuario; rechazo por rol → `rechazadoEn` | `select *` |
| `cambios_tratamiento` | igual que `cambios_insumo` (fila por fila ante RLS) | `select *` |
| `tratamientos_realizados` | insert de los no sincronizados; luego `update` de anulaciones pendientes (`anulado_en`, `anulado_por`) | `select *` |
| `movimientos` | igual, con `tratamiento_realizado_id`; **después** de `tratamientos_realizados` | igual |

Orden: lugares → categorías → insumos → tratamientos → cambios_tratamiento → lotes → cambios_lote
→ tratamientos_realizados → movimientos.

## 6. Casos `test:rls`

1. Otro tenant no lee ni inserta en las tres tablas.
2. Personal no inserta `tratamientos` ni `cambios_tratamiento`; administración sí.
3. Personal inserta un `tratamientos_realizados` como sí mismo; no a nombre de otro.
4. Un `update` que cambia `precio`, `materiales` o `costo_materiales` no los cambia.
5. Una segunda anulación no reemplaza la primera.
6. Un movimiento con `tratamiento_realizado_id` de otro tenant se rechaza (FK compuesta).
7. `cambios_tratamiento` `precio` sin `lugar_id`, o `porcentajeProfesional` con 120 → rechazado.
