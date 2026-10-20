-- DentdeLion — spec 016 (tratamientos y costo por tratamiento).
-- Orden y contenido: specs/016-tratamientos-y-costo-por-tratamiento/contracts/supabase-schema.md
-- y data-model.md. Todo en una transacción. Ningún dato existente cambia.
--
-- El catálogo de tratamientos es una fila de identidad más un ledger
-- append-only (`cambios_tratamiento`) que el dispositivo proyecta por
-- `(creado_en, id)` (research.md R1). Los tratamientos realizados guardan un
-- snapshot inmutable; solo se les puede agregar la anulación (R4/R5).

begin;

-- ---------------------------------------------------------------------------
-- 1. tratamientos (identidad)
-- ---------------------------------------------------------------------------

create table public.tratamientos (
  id uuid primary key,
  tenant_id uuid not null default public.tenant_actual() references public.tenants (id),
  creado_por uuid not null,
  creado_en timestamptz not null,
  constraint tratamientos_id_tenant_key unique (id, tenant_id)
);

create index tratamientos_tenant_idx on public.tratamientos (tenant_id);

alter table public.tratamientos enable row level security;

create policy "tratamientos: leer del tenant" on public.tratamientos
  for select to authenticated using (tenant_id = public.tenant_actual());
create policy "tratamientos: administrador crea, como sí mismo" on public.tratamientos
  for insert to authenticated
  with check (
    tenant_id = public.tenant_actual()
    and creado_por = auth.uid()
    and public.es_administrador(auth.uid())
  );

-- ---------------------------------------------------------------------------
-- 2. cambios_tratamiento (ledger del catálogo, precios y % profesional)
-- ---------------------------------------------------------------------------

create table public.cambios_tratamiento (
  id uuid primary key,
  tenant_id uuid not null default public.tenant_actual() references public.tenants (id),
  tratamiento_id uuid,
  lugar_id uuid,
  campo text not null
    constraint cambios_tratamiento_campo_check
      check (campo in ('nombre', 'materiales', 'activo', 'precio', 'porcentajeProfesional')),
  valor_anterior jsonb,
  valor_nuevo jsonb,
  usuario_id uuid not null,
  creado_en timestamptz not null,
  constraint cambios_tratamiento_tratamiento_fkey
    foreign key (tratamiento_id, tenant_id) references public.tratamientos (id, tenant_id),
  constraint cambios_tratamiento_lugar_fkey
    foreign key (lugar_id, tenant_id) references public.lugares (id, tenant_id),
  -- El % profesional es del lugar, no de un tratamiento (Clarifications Q2).
  constraint cambios_tratamiento_tratamiento_check
    check ((campo = 'porcentajeProfesional') = (tratamiento_id is null)),
  constraint cambios_tratamiento_lugar_check
    check ((campo in ('precio', 'porcentajeProfesional')) = (lugar_id is not null)),
  constraint cambios_tratamiento_precio_check
    check (campo <> 'precio' or valor_nuevo is null or valor_nuevo = 'null'::jsonb
           or (jsonb_typeof(valor_nuevo) = 'number' and (valor_nuevo)::numeric >= 0)),
  constraint cambios_tratamiento_porcentaje_check
    check (campo <> 'porcentajeProfesional' or valor_nuevo is null or valor_nuevo = 'null'::jsonb
           or (jsonb_typeof(valor_nuevo) = 'number'
               and (valor_nuevo)::numeric between 0 and 100)),
  constraint cambios_tratamiento_materiales_check
    check (campo <> 'materiales' or jsonb_typeof(valor_nuevo) = 'array'),
  constraint cambios_tratamiento_nombre_check
    check (campo <> 'nombre' or (jsonb_typeof(valor_nuevo) = 'string'
           and char_length(trim(valor_nuevo #>> '{}')) between 1 and 80)),
  constraint cambios_tratamiento_activo_check
    check (campo <> 'activo' or jsonb_typeof(valor_nuevo) = 'boolean')
);

create index cambios_tratamiento_tenant_idx on public.cambios_tratamiento (tenant_id);
create index cambios_tratamiento_tratamiento_idx on public.cambios_tratamiento (tratamiento_id);

alter table public.cambios_tratamiento enable row level security;

create policy "cambios_tratamiento: leer del tenant" on public.cambios_tratamiento
  for select to authenticated using (tenant_id = public.tenant_actual());
create policy "cambios_tratamiento: administrador inserta, como sí mismo" on public.cambios_tratamiento
  for insert to authenticated
  with check (
    tenant_id = public.tenant_actual()
    and usuario_id = auth.uid()
    and public.es_administrador(auth.uid())
  );

-- ---------------------------------------------------------------------------
-- 3. tratamientos_realizados (snapshot inmutable + anulación)
-- ---------------------------------------------------------------------------

create table public.tratamientos_realizados (
  id uuid primary key,
  tenant_id uuid not null default public.tenant_actual() references public.tenants (id),
  lugar_id uuid not null,
  tratamiento_id uuid not null,
  nombre text not null,
  precio numeric
    constraint tratamientos_realizados_precio_check check (precio is null or precio >= 0),
  porcentaje_profesional numeric
    constraint tratamientos_realizados_porcentaje_check
      check (porcentaje_profesional is null or porcentaje_profesional between 0 and 100),
  materiales jsonb not null
    constraint tratamientos_realizados_materiales_check check (jsonb_typeof(materiales) = 'array'),
  costo_materiales numeric not null
    constraint tratamientos_realizados_costo_check check (costo_materiales >= 0),
  costo_completo boolean not null,
  ganancia_estimada numeric,
  usuario_id uuid not null,
  creado_en timestamptz not null,
  anulado_en timestamptz,
  anulado_por uuid,
  constraint tratamientos_realizados_id_tenant_key unique (id, tenant_id),
  constraint tratamientos_realizados_lugar_fkey
    foreign key (lugar_id, tenant_id) references public.lugares (id, tenant_id),
  constraint tratamientos_realizados_tratamiento_fkey
    foreign key (tratamiento_id, tenant_id) references public.tratamientos (id, tenant_id),
  constraint tratamientos_realizados_anulacion_check
    check ((anulado_en is null) = (anulado_por is null))
);

create index tratamientos_realizados_tenant_idx on public.tratamientos_realizados (tenant_id);
create index tratamientos_realizados_lugar_idx on public.tratamientos_realizados (lugar_id);

alter table public.tratamientos_realizados enable row level security;

create policy "tratamientos_realizados: leer del tenant" on public.tratamientos_realizados
  for select to authenticated using (tenant_id = public.tenant_actual());
create policy "tratamientos_realizados: insertar como uno mismo" on public.tratamientos_realizados
  for insert to authenticated
  with check (tenant_id = public.tenant_actual() and usuario_id = auth.uid());
create policy "tratamientos_realizados: pendiente previo a la desactivación" on public.tratamientos_realizados
  for insert to authenticated
  with check (
    usuario_id = auth.uid()
    and tenant_id = public.tenant_del_perfil()
    and creado_en < public.desactivado_en_propio()
  );
create policy "tratamientos_realizados: anular en el tenant" on public.tratamientos_realizados
  for update to authenticated
  using (tenant_id = public.tenant_actual())
  with check (tenant_id = public.tenant_actual());

-- El snapshot no cambia nunca; la primera anulación gana (R5).
create function public.proteger_tratamiento_realizado() returns trigger
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

create trigger tratamientos_realizados_proteger
  before update on public.tratamientos_realizados
  for each row execute function public.proteger_tratamiento_realizado();

-- ---------------------------------------------------------------------------
-- 4. movimientos.tratamiento_realizado_id
-- ---------------------------------------------------------------------------

alter table public.movimientos add column tratamiento_realizado_id uuid;
alter table public.movimientos
  add constraint movimientos_tratamiento_realizado_fkey
    foreign key (tratamiento_realizado_id, tenant_id)
    references public.tratamientos_realizados (id, tenant_id);
create index movimientos_tratamiento_realizado_idx on public.movimientos (tratamiento_realizado_id)
  where tratamiento_realizado_id is not null;

commit;
