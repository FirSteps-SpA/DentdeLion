-- DentdeLion — spec 026 (categorías de tratamientos y % profesional por categoría).
-- Orden y contenido: specs/026-categorias-tratamientos/contracts/supabase-schema.md,
-- data-model.md y research.md (R1–R6). Todo en una transacción.
--
-- Ningún dato existente cambia: los tratamientos quedan sin categoría y los
-- registros conservan su % y su ganancia. Se agregan las 8 categorías
-- sembradas a cada tenant (y a los nuevos, por trigger).

begin;

-- ---------------------------------------------------------------------------
-- 1. categorias_tratamiento (R1): catálogo por tenant, como `marcas`.
-- ---------------------------------------------------------------------------

create table public.categorias_tratamiento (
  id uuid primary key,
  tenant_id uuid not null default public.tenant_actual() references public.tenants (id),
  nombre text not null
    constraint categorias_tratamiento_nombre_check
      check (char_length(btrim(nombre)) between 1 and 40),
  clave text generated always as (public.clave_nombre(nombre)) stored,
  -- `null` en las sembradas.
  creado_por uuid,
  creado_en timestamptz not null default now(),
  desactivado_en timestamptz,
  constraint categorias_tratamiento_id_tenant_key unique (id, tenant_id)
);

create unique index categorias_tratamiento_clave_por_tenant
  on public.categorias_tratamiento (tenant_id, clave);
create index categorias_tratamiento_tenant_idx on public.categorias_tratamiento (tenant_id);

alter table public.categorias_tratamiento enable row level security;

create policy "categorias_tratamiento: leer del tenant" on public.categorias_tratamiento
  for select to authenticated using (tenant_id = public.tenant_actual());
create policy "categorias_tratamiento: administrador inserta, como sí mismo"
  on public.categorias_tratamiento
  for insert to authenticated
  with check (
    tenant_id = public.tenant_actual()
    and creado_por = auth.uid()
    and public.es_administrador(auth.uid())
  );
create policy "categorias_tratamiento: administrador actualiza" on public.categorias_tratamiento
  for update to authenticated
  using (tenant_id = public.tenant_actual() and public.es_administrador(auth.uid()))
  with check (tenant_id = public.tenant_actual());

-- Identidad inmutable: solo cambian el nombre y la desactivación.
create function public.proteger_categoria_tratamiento() returns trigger
  language plpgsql security definer set search_path = public
as $$
begin
  new.id := old.id;
  new.tenant_id := old.tenant_id;
  new.creado_por := old.creado_por;
  new.creado_en := old.creado_en;
  return new;
end;
$$;

create trigger categorias_tratamiento_proteger
  before update on public.categorias_tratamiento
  for each row execute function public.proteger_categoria_tratamiento();

-- ---------------------------------------------------------------------------
-- 2. Siembra (R2): 8 categorías por tenant, una sola vez.
-- ---------------------------------------------------------------------------

create function public.sembrar_categorias_tratamiento(p_tenant uuid) returns void
  language plpgsql security definer set search_path = public
as $$
begin
  if exists (select 1 from categorias_tratamiento where tenant_id = p_tenant) then
    return;
  end if;
  insert into categorias_tratamiento (id, tenant_id, nombre, creado_por)
  select gen_random_uuid(), p_tenant, nombre, null
  from unnest(array[
    'Evaluación', 'Prevención', 'Restauración', 'Endodoncia', 'Periodoncia',
    'Extracción y cirugía', 'Prótesis', 'Urgencia'
  ]) as nombre;
end;
$$;

create function public.sembrar_categorias_tenant_nuevo() returns trigger
  language plpgsql security definer set search_path = public
as $$
begin
  perform sembrar_categorias_tratamiento(new.id);
  return new;
end;
$$;

create trigger tenants_sembrar_categorias_tratamiento
  after insert on public.tenants
  for each row execute function public.sembrar_categorias_tenant_nuevo();

revoke execute on function public.sembrar_categorias_tratamiento(uuid) from public, anon, authenticated;
revoke execute on function public.sembrar_categorias_tenant_nuevo() from public, anon, authenticated;

select public.sembrar_categorias_tratamiento(id) from public.tenants;

-- ---------------------------------------------------------------------------
-- 3. cambios_tratamiento (R3, R4): campos `categoria` y `porcentajeCategoria`.
-- ---------------------------------------------------------------------------

alter table public.cambios_tratamiento add column categoria_tratamiento_id uuid;
alter table public.cambios_tratamiento
  add constraint cambios_tratamiento_categoria_fkey
    foreign key (categoria_tratamiento_id, tenant_id)
    references public.categorias_tratamiento (id, tenant_id);
create index cambios_tratamiento_categoria_idx
  on public.cambios_tratamiento (categoria_tratamiento_id)
  where categoria_tratamiento_id is not null;

alter table public.cambios_tratamiento drop constraint cambios_tratamiento_campo_check;
alter table public.cambios_tratamiento
  add constraint cambios_tratamiento_campo_check
    check (campo in (
      'nombre', 'materiales', 'activo', 'precio', 'porcentajeProfesional',
      'categoria', 'porcentajeCategoria'
    ));

-- Los % (general del lugar y de una categoría en un lugar) no son de un tratamiento.
alter table public.cambios_tratamiento drop constraint cambios_tratamiento_tratamiento_check;
alter table public.cambios_tratamiento
  add constraint cambios_tratamiento_tratamiento_check
    check ((campo in ('porcentajeProfesional', 'porcentajeCategoria')) = (tratamiento_id is null));

alter table public.cambios_tratamiento drop constraint cambios_tratamiento_lugar_check;
alter table public.cambios_tratamiento
  add constraint cambios_tratamiento_lugar_check
    check ((campo in ('precio', 'porcentajeProfesional', 'porcentajeCategoria')) = (lugar_id is not null));

alter table public.cambios_tratamiento
  add constraint cambios_tratamiento_categoria_id_check
    check ((campo = 'porcentajeCategoria') = (categoria_tratamiento_id is not null));

alter table public.cambios_tratamiento drop constraint cambios_tratamiento_porcentaje_check;
alter table public.cambios_tratamiento
  add constraint cambios_tratamiento_porcentaje_check
    check (campo not in ('porcentajeProfesional', 'porcentajeCategoria')
           or valor_nuevo is null or valor_nuevo = 'null'::jsonb
           or (jsonb_typeof(valor_nuevo) = 'number'
               and (valor_nuevo)::numeric between 0 and 100));

-- La categoría de un tratamiento: el id (texto) o null ("Sin categoría").
alter table public.cambios_tratamiento
  add constraint cambios_tratamiento_categoria_valor_check
    check (campo <> 'categoria' or valor_nuevo is null
           or jsonb_typeof(valor_nuevo) in ('string', 'null'));

-- ---------------------------------------------------------------------------
-- 4. tratamientos_realizados (R6): la categoría con que se registró.
-- ---------------------------------------------------------------------------

alter table public.tratamientos_realizados
  add column categoria_tratamiento_id uuid,
  add column categoria_nombre text;
alter table public.tratamientos_realizados
  add constraint tratamientos_realizados_categoria_fkey
    foreign key (categoria_tratamiento_id, tenant_id)
    references public.categorias_tratamiento (id, tenant_id);

-- El snapshot no cambia nunca; la primera anulación gana (spec 016 R5).
create or replace function public.proteger_tratamiento_realizado() returns trigger
  language plpgsql security definer set search_path = public
as $$
begin
  new.id := old.id;
  new.tenant_id := old.tenant_id;
  new.lugar_id := old.lugar_id;
  new.tratamiento_id := old.tratamiento_id;
  new.nombre := old.nombre;
  new.precio := old.precio;
  new.porcentaje_profesional := old.porcentaje_profesional;
  new.materiales := old.materiales;
  new.costo_materiales := old.costo_materiales;
  new.costo_completo := old.costo_completo;
  new.ganancia_estimada := old.ganancia_estimada;
  new.usuario_id := old.usuario_id;
  new.creado_en := old.creado_en;
  new.categoria_tratamiento_id := old.categoria_tratamiento_id;
  new.categoria_nombre := old.categoria_nombre;
  if old.anulado_en is not null then
    -- Ya anulado: una segunda anulación (otro dispositivo) no cambia nada y no
    -- falla, así el cliente la da por subida.
    new.anulado_en := old.anulado_en;
    new.anulado_por := old.anulado_por;
  elsif new.anulado_en is not null and new.anulado_por is distinct from auth.uid() then
    raise exception 'la anulación se registra a nombre propio' using errcode = '42501';
  end if;
  return new;
end;
$$;

commit;
