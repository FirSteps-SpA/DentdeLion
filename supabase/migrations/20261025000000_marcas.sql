-- DentdeLion — spec 023 (marcas).
-- Orden y contenido: specs/023-marcas/contracts/supabase-schema.md,
-- data-model.md y research.md (R1–R4, R6). Todo en una transacción.
--
-- Cada insumo puede tener una marca opcional de un catálogo por tenant. Sin
-- migración de datos: los insumos existentes quedan sin marca. `marca_id` se
-- fija en el alta y después solo lo cambia el historial (`cambios_insumo`),
-- porque `pushInsumos` sube todas las filas en cada ciclo y una fila
-- desfasada (2.5.0 en caché o dispositivo recién actualizado) la borraría (R3).

begin;

-- ---------------------------------------------------------------------------
-- 1. marcas (R1): la clave de la 021 (`clave_nombre`).
-- ---------------------------------------------------------------------------

create table public.marcas (
  id uuid primary key,
  tenant_id uuid not null default public.tenant_actual() references public.tenants (id),
  nombre text not null
    constraint marcas_nombre_check check (char_length(btrim(nombre)) between 1 and 60),
  clave text generated always as (public.clave_nombre(nombre)) stored,
  creado_por uuid,
  creado_en timestamptz not null default now(),
  desactivado_en timestamptz,
  eliminado_en timestamptz,
  constraint marcas_id_tenant_key unique (id, tenant_id)
);

create unique index marcas_clave_por_tenant
  on public.marcas (tenant_id, clave) where eliminado_en is null;

alter table public.marcas enable row level security;

create policy "marcas: leer del tenant" on public.marcas
  for select to authenticated using (tenant_id = public.tenant_actual());
create policy "marcas: crear en el tenant, como sí mismo" on public.marcas
  for insert to authenticated
  with check (tenant_id = public.tenant_actual() and creado_por = auth.uid());
create policy "marcas: pendiente previo a la desactivación" on public.marcas
  for insert to authenticated
  with check (
    tenant_id = public.tenant_del_perfil()
    and creado_por = auth.uid()
    and creado_en < public.desactivado_en_propio()
  );
create policy "marcas: administrador actualiza" on public.marcas
  for update to authenticated
  using (tenant_id = public.tenant_actual() and public.es_administrador(auth.uid()))
  with check (tenant_id = public.tenant_actual());

-- Identidad inmutable; una eliminada no vuelve; no se elimina con insumos,
-- contando los dados de baja (R6).
create function public.proteger_marca() returns trigger
  language plpgsql security definer set search_path = public
as $$
begin
  new.tenant_id := old.tenant_id;
  new.creado_por := old.creado_por;
  new.creado_en := old.creado_en;
  if old.eliminado_en is not null then
    new.eliminado_en := old.eliminado_en;
  end if;

  if old.eliminado_en is null and new.eliminado_en is not null
     and exists (select 1 from insumos i where i.marca_id = old.id) then
    raise exception 'marca_con_insumos' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger marcas_proteger
  before update on public.marcas
  for each row execute function public.proteger_marca();

-- ---------------------------------------------------------------------------
-- 2. insumos.marca_id (R2) y su protección (R3)
-- ---------------------------------------------------------------------------

alter table public.insumos add column marca_id uuid;
alter table public.insumos add constraint insumos_marca_tenant_fkey
  foreign key (marca_id, tenant_id) references public.marcas (id, tenant_id);
create index insumos_marca_idx on public.insumos (marca_id);

-- Spec 007/015 + 023: un no administrador no cambia el catálogo; nadie cambia
-- `marca_id` por el upsert de insumos — solo `aplicar_marca_desde_cambio`.
create or replace function public.proteger_catalogo_insumo() returns trigger
  language plpgsql set search_path = public
as $$
begin
  if not es_administrador(auth.uid()) then
    new.nombre := old.nombre;
    new.categoria := old.categoria;
    new.unidad_medida := old.unidad_medida;
    new.unidad_compra := old.unidad_compra;
    new.contenido := old.contenido;
    new.stock_minimo := old.stock_minimo;
    new.codigo_fabricante := old.codigo_fabricante;
    new.caduca := old.caduca;
    new.dado_de_baja_en := old.dado_de_baja_en;
    new.dado_de_baja_por := old.dado_de_baja_por;
  end if;
  if coalesce(current_setting('dentdelion.aplicando_marca', true), '') <> 'on' then
    new.marca_id := old.marca_id;
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. cambios_insumo: campo 'marcaId' (R4) y su aplicación (R3)
-- ---------------------------------------------------------------------------

alter table public.cambios_insumo drop constraint cambios_insumo_campo_check;
alter table public.cambios_insumo
  add constraint cambios_insumo_campo_check
    check (campo = any (array[
      'nombre', 'categoria', 'unidadMedida', 'unidadCompra', 'contenido',
      'stockMinimo', 'codigoFabricante', 'caduca', 'baja', 'marcaId'
    ]));

-- Gana el cambio más reciente por (creado_en, id), como `proyectarInsumo` en
-- el cliente, aunque lleguen desordenados. Un id que no es una marca del
-- tenant del insumo hace fallar la FK y con ella el insert del cambio.
create function public.aplicar_marca_desde_cambio() returns trigger
  language plpgsql security definer set search_path = public
as $$
begin
  perform set_config('dentdelion.aplicando_marca', 'on', true);
  update insumos set marca_id = (
    select nullif(c.valor_nuevo #>> '{}', '')::uuid
    from cambios_insumo c
    where c.insumo_id = new.insumo_id and c.campo = 'marcaId'
    order by c.creado_en desc, c.id desc
    limit 1
  ) where id = new.insumo_id;
  perform set_config('dentdelion.aplicando_marca', '', true);
  return null;
end;
$$;

create trigger cambios_insumo_aplicar_marca
  after insert on public.cambios_insumo
  for each row when (new.campo = 'marcaId')
  execute function public.aplicar_marca_desde_cambio();

commit;
