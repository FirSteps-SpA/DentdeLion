# Supabase Schema Contract: spec 026

Migración `supabase/migrations/20261123000000_categorias_tratamiento.sql`, en una transacción, en
este orden. Se aplica en producción **antes** del front, con respaldo previo y ensayo sobre su
restauración.

## 1. `categorias_tratamiento`

```sql
create table public.categorias_tratamiento (
  id uuid primary key,
  tenant_id uuid not null default public.tenant_actual() references public.tenants (id),
  nombre text not null
    constraint categorias_tratamiento_nombre_check check (char_length(btrim(nombre)) between 1 and 40),
  clave text generated always as (public.clave_nombre(nombre)) stored,
  creado_por uuid,
  creado_en timestamptz not null default now(),
  desactivado_en timestamptz,
  constraint categorias_tratamiento_id_tenant_key unique (id, tenant_id)
);
create unique index categorias_tratamiento_clave_por_tenant
  on public.categorias_tratamiento (tenant_id, clave);
create index categorias_tratamiento_tenant_idx on public.categorias_tratamiento (tenant_id);
alter table public.categorias_tratamiento enable row level security;
```

Políticas:

- `leer del tenant` (select): `tenant_id = tenant_actual()`.
- `administrador inserta, como sí mismo` (insert): tenant actual, `creado_por = auth.uid()`,
  `es_administrador(auth.uid())`.
- `administrador actualiza` (update): tenant actual y administrador.

Trigger `proteger_categoria_tratamiento` (before update): `new.tenant_id/creado_por/creado_en :=
old.*`.

## 2. Siembra

```sql
create function public.sembrar_categorias_tratamiento(p_tenant uuid) returns void
  language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from categorias_tratamiento where tenant_id = p_tenant) then return; end if;
  insert into categorias_tratamiento (id, tenant_id, nombre, creado_por)
  select gen_random_uuid(), p_tenant, n, null
  from unnest(array['Evaluación','Prevención','Restauración','Endodoncia','Periodoncia',
                    'Cirugía','Prótesis','Urgencia','Odontopediatría']) as n;
end $$;

select public.sembrar_categorias_tratamiento(id) from public.tenants;

create function public.sembrar_categorias_tenant_nuevo() returns trigger ... -- llama a la anterior
create trigger tenants_sembrar_categorias_tratamiento
  after insert on public.tenants for each row execute function public.sembrar_categorias_tenant_nuevo();
```

`revoke execute ... from public, anon, authenticated` en ambas funciones (solo las usa el trigger y
la migración).

## 3. `cambios_tratamiento`

```sql
alter table public.cambios_tratamiento add column categoria_tratamiento_id uuid;
alter table public.cambios_tratamiento add constraint cambios_tratamiento_categoria_fkey
  foreign key (categoria_tratamiento_id, tenant_id)
  references public.categorias_tratamiento (id, tenant_id);
```

Se reemplazan los CHECK:

- `campo_check`: + `'categoria'`, `'porcentajeCategoria'`.
- `tratamiento_check`: `(campo in ('porcentajeProfesional','porcentajeCategoria')) = (tratamiento_id is null)`.
- `lugar_check`: `(campo in ('precio','porcentajeProfesional','porcentajeCategoria')) = (lugar_id is not null)`.
- nuevo `categoria_id_check`: `(campo = 'porcentajeCategoria') = (categoria_tratamiento_id is not null)`.
- `porcentaje_check`: aplica a `campo in ('porcentajeProfesional','porcentajeCategoria')`.
- nuevo `categoria_valor_check`: `campo <> 'categoria' or valor_nuevo is null or jsonb_typeof(valor_nuevo) in ('string','null')`.

Las políticas no cambian (insertar: solo administración).

## 4. `tratamientos_realizados`

```sql
alter table public.tratamientos_realizados
  add column categoria_tratamiento_id uuid,
  add column categoria_nombre text;
alter table public.tratamientos_realizados add constraint tratamientos_realizados_categoria_fkey
  foreign key (categoria_tratamiento_id, tenant_id)
  references public.categorias_tratamiento (id, tenant_id);
```

`create or replace function proteger_tratamiento_realizado()`: igual que la spec 016 más
`new.categoria_tratamiento_id := old.categoria_tratamiento_id; new.categoria_nombre :=
old.categoria_nombre;`.

## 5. Controles de `npm run test:rls` (nuevos)

1. Un tenant existente tiene las 9 sembradas; un tenant creado después también, una sola vez.
2. Personal no inserta ni actualiza `categorias_tratamiento`; administración sí.
3. Nombre repetido por clave ("evaluacion " vs "Evaluación") → `23505`.
4. Administración no puede cambiar `tenant_id`/`creado_por` de una categoría (el trigger lo revierte).
5. Personal no inserta `cambios_tratamiento` con `categoria` ni `porcentajeCategoria`.
6. `porcentajeCategoria` sin `categoria_tratamiento_id`, con `tratamiento_id`, sin `lugar_id` o con
   valor 120 → rechazado (`23514`).
7. `categoria` con un número como valor → rechazado.
8. Un tenant no lee las categorías de otro ni puede referenciarlas (FK compuesta).
9. Un registro con categoría: un UPDATE que cambie `categoria_tratamiento_id` o `categoria_nombre`
   no surte efecto.
