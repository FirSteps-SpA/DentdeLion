-- DentdeLion — spec 014 (multi-tenant y lugares de trabajo).
-- Orden y contenido: specs/014-multi-tenant-y-lugares-de-trabajo/contracts/supabase-schema.md
-- y data-model.md. Todo en una transacción: o aplica completa o no aplica.
--
-- Los datos actuales pasan al tenant 1 / lugar 1, con UUID fijos que también
-- conoce el dispositivo (Dexie v10), para que los pendientes de la 2.2.0
-- suban al lugar correcto (research.md R8/R9). Los clientes 2.2.0 en caché
-- siguen funcionando: no envían tenant_id ni lugar_id y los completan los
-- `default` y el trigger `lugar_por_defecto` (R2/R3).

begin;

-- ---------------------------------------------------------------------------
-- 1. Tenants, lugares y mínimos por lugar; siembra del tenant 1 / lugar 1
-- ---------------------------------------------------------------------------

create table public.tenants (
  id uuid primary key default gen_random_uuid(),
  nombre text not null
    constraint tenants_nombre_check
      check (char_length(trim(nombre)) between 1 and 80),
  creado_en timestamptz not null default now()
);

create table public.lugares (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id),
  nombre text not null
    constraint lugares_nombre_check
      check (char_length(trim(nombre)) between 1 and 60),
  desactivado_en timestamptz,
  creado_en timestamptz not null default now(),
  constraint lugares_id_tenant_key unique (id, tenant_id)
);
create unique index lugares_nombre_por_tenant
  on public.lugares (tenant_id, lower(trim(nombre)));

insert into public.tenants (id, nombre, creado_en)
values (
  '00000000-0000-4000-8000-000000000001',
  coalesce(
    (select nullif(trim(nombre), '') from public.configuracion_clinica limit 1),
    'Clínica'
  ),
  '2026-01-01T00:00:00Z'
);
insert into public.lugares (id, tenant_id, nombre, creado_en)
select
  '00000000-0000-4000-8000-000000000011',
  t.id,
  t.nombre,
  '2026-01-01T00:00:00Z'
from public.tenants t
where t.id = '00000000-0000-4000-8000-000000000001';

-- ---------------------------------------------------------------------------
-- 2. tenant_id / lugar_id en las tablas de negocio, con FK compuestas para que
--    ninguna referencia cruce tenants
-- ---------------------------------------------------------------------------

alter table public.insumos               add column tenant_id uuid;
alter table public.categorias            add column tenant_id uuid;
alter table public.cambios_insumo        add column tenant_id uuid;
alter table public.lotes                 add column tenant_id uuid, add column lugar_id uuid;
alter table public.movimientos           add column tenant_id uuid, add column lugar_id uuid;
alter table public.items_compra          add column tenant_id uuid, add column lugar_id uuid;
alter table public.configuracion_alertas add column tenant_id uuid;
alter table public.configuracion_clinica add column tenant_id uuid;

update public.insumos               set tenant_id = '00000000-0000-4000-8000-000000000001';
update public.categorias            set tenant_id = '00000000-0000-4000-8000-000000000001';
update public.cambios_insumo        set tenant_id = '00000000-0000-4000-8000-000000000001';
update public.configuracion_alertas set tenant_id = '00000000-0000-4000-8000-000000000001';
update public.configuracion_clinica set tenant_id = '00000000-0000-4000-8000-000000000001';
update public.lotes set
  tenant_id = '00000000-0000-4000-8000-000000000001',
  lugar_id  = '00000000-0000-4000-8000-000000000011';
update public.movimientos set
  tenant_id = '00000000-0000-4000-8000-000000000001',
  lugar_id  = '00000000-0000-4000-8000-000000000011';
update public.items_compra set
  tenant_id = '00000000-0000-4000-8000-000000000001',
  lugar_id  = '00000000-0000-4000-8000-000000000011';

alter table public.insumos               alter column tenant_id set not null;
alter table public.categorias            alter column tenant_id set not null;
alter table public.cambios_insumo        alter column tenant_id set not null;
alter table public.configuracion_alertas alter column tenant_id set not null;
alter table public.configuracion_clinica alter column tenant_id set not null;
alter table public.lotes        alter column tenant_id set not null, alter column lugar_id set not null;
alter table public.movimientos  alter column tenant_id set not null, alter column lugar_id set not null;
alter table public.items_compra alter column tenant_id set not null, alter column lugar_id set not null;

alter table public.insumos               add constraint insumos_tenant_id_fkey               foreign key (tenant_id) references public.tenants (id);
alter table public.categorias            add constraint categorias_tenant_id_fkey            foreign key (tenant_id) references public.tenants (id);
alter table public.cambios_insumo        add constraint cambios_insumo_tenant_id_fkey        foreign key (tenant_id) references public.tenants (id);
alter table public.configuracion_alertas add constraint configuracion_alertas_tenant_id_fkey foreign key (tenant_id) references public.tenants (id);
alter table public.configuracion_clinica add constraint configuracion_clinica_tenant_id_fkey foreign key (tenant_id) references public.tenants (id);
alter table public.lotes                 add constraint lotes_tenant_id_fkey                 foreign key (tenant_id) references public.tenants (id);
alter table public.movimientos           add constraint movimientos_tenant_id_fkey           foreign key (tenant_id) references public.tenants (id);
alter table public.items_compra          add constraint items_compra_tenant_id_fkey          foreign key (tenant_id) references public.tenants (id);

-- Destinos de las FK compuestas.
alter table public.insumos     add constraint insumos_id_tenant_key     unique (id, tenant_id);
alter table public.lotes       add constraint lotes_id_tenant_key       unique (id, tenant_id);
alter table public.movimientos add constraint movimientos_id_tenant_key unique (id, tenant_id);

-- Referencias al insumo dentro del mismo tenant.
alter table public.lotes          drop constraint lotes_insumo_id_fkey;
alter table public.cambios_insumo drop constraint cambios_insumo_insumo_id_fkey;
alter table public.items_compra   drop constraint items_compra_insumo_id_fkey;
alter table public.lotes add constraint lotes_insumo_tenant_fkey
  foreign key (insumo_id, tenant_id) references public.insumos (id, tenant_id);
alter table public.cambios_insumo add constraint cambios_insumo_insumo_tenant_fkey
  foreign key (insumo_id, tenant_id) references public.insumos (id, tenant_id);
-- MATCH SIMPLE: un ítem manual sin insumo vinculado (insumo_id null) pasa.
alter table public.items_compra add constraint items_compra_insumo_tenant_fkey
  foreign key (insumo_id, tenant_id) references public.insumos (id, tenant_id);

-- Referencias al lote y al movimiento de origen dentro del mismo tenant.
alter table public.movimientos drop constraint movimientos_lote_id_fkey;
alter table public.movimientos drop constraint movimientos_movimiento_origen_id_fkey;
alter table public.movimientos add constraint movimientos_lote_tenant_fkey
  foreign key (lote_id, tenant_id) references public.lotes (id, tenant_id);
alter table public.movimientos add constraint movimientos_origen_tenant_fkey
  foreign key (movimiento_origen_id, tenant_id) references public.movimientos (id, tenant_id);

-- Referencias al lugar dentro del mismo tenant.
alter table public.lotes add constraint lotes_lugar_tenant_fkey
  foreign key (lugar_id, tenant_id) references public.lugares (id, tenant_id);
alter table public.movimientos add constraint movimientos_lugar_tenant_fkey
  foreign key (lugar_id, tenant_id) references public.lugares (id, tenant_id);
alter table public.items_compra add constraint items_compra_lugar_tenant_fkey
  foreign key (lugar_id, tenant_id) references public.lugares (id, tenant_id);

create index insumos_tenant_idx        on public.insumos (tenant_id);
create index categorias_tenant_idx     on public.categorias (tenant_id);
create index cambios_insumo_tenant_idx on public.cambios_insumo (tenant_id);
create index lotes_tenant_idx          on public.lotes (tenant_id);
create index lotes_lugar_idx           on public.lotes (lugar_id);
create index movimientos_tenant_idx    on public.movimientos (tenant_id);
create index movimientos_lugar_idx     on public.movimientos (lugar_id);
create index items_compra_tenant_idx   on public.items_compra (tenant_id);
create index items_compra_lugar_idx    on public.items_compra (lugar_id);
create index lugares_tenant_idx        on public.lugares (tenant_id);

-- Mínimo por lugar (R6). `stock_minimo` null = usar el del catálogo: así
-- "volver al mínimo del catálogo" es un upsert más y no un borrado que habría
-- que sincronizar.
create table public.minimos_lugar (
  tenant_id uuid not null references public.tenants (id),
  insumo_id uuid not null,
  lugar_id uuid not null,
  stock_minimo numeric
    constraint minimos_lugar_stock_minimo_check check (stock_minimo >= 0),
  primary key (insumo_id, lugar_id),
  constraint minimos_lugar_insumo_tenant_fkey
    foreign key (insumo_id, tenant_id) references public.insumos (id, tenant_id),
  constraint minimos_lugar_lugar_tenant_fkey
    foreign key (lugar_id, tenant_id) references public.lugares (id, tenant_id)
);
create index minimos_lugar_tenant_idx on public.minimos_lugar (tenant_id);

-- ---------------------------------------------------------------------------
-- 3. perfiles = membresía (R1)
-- ---------------------------------------------------------------------------

alter table public.perfiles
  add column tenant_id uuid,
  add column desactivado_en timestamptz;
update public.perfiles set tenant_id = '00000000-0000-4000-8000-000000000001';
alter table public.perfiles alter column tenant_id set not null;
alter table public.perfiles add constraint perfiles_tenant_id_fkey
  foreign key (tenant_id) references public.tenants (id);
create index perfiles_tenant_idx on public.perfiles (tenant_id);

-- ---------------------------------------------------------------------------
-- 4. configuracion_alertas: una fila por tenant (R7). `id` se conserva con su
--    default 'global' porque los clientes la envían y la usan como clave local.
--    configuracion_clinica conserva su PK `id` solo por los clientes 2.2.0
--    (todos del tenant 1); se elimina en la spec siguiente.
-- ---------------------------------------------------------------------------

alter table public.configuracion_alertas drop constraint configuracion_alertas_pkey;
alter table public.configuracion_alertas drop constraint configuracion_alertas_singleton;
alter table public.configuracion_alertas add primary key (tenant_id);

-- ---------------------------------------------------------------------------
-- 5. Traslados (R4)
-- ---------------------------------------------------------------------------

alter table public.movimientos drop constraint movimientos_tipo_check;
alter table public.movimientos add constraint movimientos_tipo_check
  check (tipo = any (array[
    'ingreso', 'consumo', 'ajuste', 'traslado_salida', 'traslado_entrada'
  ]));
alter table public.movimientos add column traslado_id uuid;
alter table public.movimientos add constraint movimientos_traslado_id_check
  check ((tipo in ('traslado_salida', 'traslado_entrada')) = (traslado_id is not null));
create index movimientos_traslado_idx on public.movimientos (traslado_id)
  where traslado_id is not null;

-- ---------------------------------------------------------------------------
-- 6. Funciones, triggers e invitaciones
-- ---------------------------------------------------------------------------

-- Tenant del usuario con sesión, o null si no tiene perfil o está desactivado
-- (FR-021): un desactivado no lee ni escribe nada por las políticas de tenant.
create function public.tenant_actual() returns uuid
  language sql stable security definer set search_path = public
as $$
  select p.tenant_id from perfiles p
  where p.id = auth.uid() and p.desactivado_en is null;
$$;

-- Tenant del perfil aunque esté desactivado, y su fecha de desactivación:
-- solo para la política de pendientes previos a la desactivación (FR-021).
create function public.tenant_del_perfil() returns uuid
  language sql stable security definer set search_path = public
as $$
  select p.tenant_id from perfiles p where p.id = auth.uid();
$$;

create function public.desactivado_en_propio() returns timestamptz
  language sql stable security definer set search_path = public
as $$
  select p.desactivado_en from perfiles p where p.id = auth.uid();
$$;

-- security definer: la política de perfiles la usa, y leer perfiles con RLS
-- desde ella sería recursivo.
create or replace function public.es_administrador(uid uuid) returns boolean
  language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from perfiles p
    where p.id = uid and p.rol = 'administrador' and p.desactivado_en is null
  );
$$;

alter table public.insumos               alter column tenant_id set default public.tenant_actual();
alter table public.categorias            alter column tenant_id set default public.tenant_actual();
alter table public.cambios_insumo        alter column tenant_id set default public.tenant_actual();
alter table public.lotes                 alter column tenant_id set default public.tenant_actual();
alter table public.movimientos           alter column tenant_id set default public.tenant_actual();
alter table public.items_compra          alter column tenant_id set default public.tenant_actual();
alter table public.configuracion_alertas alter column tenant_id set default public.tenant_actual();
alter table public.configuracion_clinica alter column tenant_id set default public.tenant_actual();
alter table public.minimos_lugar         alter column tenant_id set default public.tenant_actual();
alter table public.lugares               alter column tenant_id set default public.tenant_actual();

-- Clientes 2.2.0: completa lugar_id con el lugar principal del tenant (el
-- activo más antiguo). Los `default` ya se aplicaron cuando corre un trigger
-- BEFORE, así que tenant_id está disponible.
create function public.lugar_por_defecto() returns trigger
  language plpgsql security definer set search_path = public
as $$
begin
  if new.lugar_id is null then
    select l.id into new.lugar_id
    from lugares l
    where l.tenant_id = new.tenant_id and l.desactivado_en is null
    order by l.creado_en, l.id
    limit 1;
  end if;
  return new;
end;
$$;

create trigger lotes_lugar_por_defecto before insert on public.lotes
  for each row execute function public.lugar_por_defecto();
create trigger movimientos_lugar_por_defecto before insert on public.movimientos
  for each row execute function public.lugar_por_defecto();
create trigger items_compra_lugar_por_defecto before insert on public.items_compra
  for each row execute function public.lugar_por_defecto();

-- Al cerrar la transacción, cada traslado tiene exactamente una salida y una
-- entrada del mismo lote y cantidad, en lugares distintos del mismo tenant
-- (FR-023). Si falta una mitad, el commit falla y no queda nada a medias.
create function public.verificar_traslado() returns trigger
  language plpgsql security definer set search_path = public
as $$
declare
  salidas int;
  entradas int;
  consistente boolean;
begin
  select
    count(*) filter (where m.tipo = 'traslado_salida'),
    count(*) filter (where m.tipo = 'traslado_entrada')
  into salidas, entradas
  from movimientos m
  where m.traslado_id = new.traslado_id;

  if salidas <> 1 or entradas <> 1 then
    raise exception 'traslado % incompleto: % salida(s), % entrada(s)',
      new.traslado_id, salidas, entradas
      using errcode = '23514';
  end if;

  select
    s.lote_id = e.lote_id
    and s.cantidad = e.cantidad
    and s.cantidad > 0
    and s.lugar_id <> e.lugar_id
    and s.tenant_id = e.tenant_id
  into consistente
  from movimientos s
  join movimientos e
    on e.traslado_id = s.traslado_id and e.tipo = 'traslado_entrada'
  where s.traslado_id = new.traslado_id and s.tipo = 'traslado_salida';

  if not consistente then
    raise exception 'traslado % inconsistente', new.traslado_id
      using errcode = '23514';
  end if;
  return null;
end;
$$;

create constraint trigger movimientos_verificar_traslado
  after insert on public.movimientos
  deferrable initially deferred
  for each row
  when (new.traslado_id is not null)
  execute function public.verificar_traslado();

-- Siempre queda al menos un lugar activo (FR-005, FR-011).
create function public.proteger_ultimo_lugar() returns trigger
  language plpgsql security definer set search_path = public
as $$
begin
  if new.tenant_id <> old.tenant_id then
    raise exception 'un lugar no cambia de tenant' using errcode = '42501';
  end if;
  if old.desactivado_en is null and new.desactivado_en is not null
     and not exists (
       select 1 from lugares l
       where l.tenant_id = old.tenant_id
         and l.id <> old.id
         and l.desactivado_en is null
     ) then
    raise exception 'ultimo_lugar_activo' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger lugares_proteger_ultimo before update on public.lugares
  for each row execute function public.proteger_ultimo_lugar();

-- Siempre queda al menos una administradora activa (FR-021). Además, un
-- perfil no cambia de tenant por la API.
create function public.proteger_ultimo_admin() returns trigger
  language plpgsql security definer set search_path = public
as $$
begin
  if new.tenant_id <> old.tenant_id or new.id <> old.id then
    raise exception 'un perfil no cambia de tenant' using errcode = '42501';
  end if;
  if old.rol = 'administrador' and old.desactivado_en is null
     and (new.rol <> 'administrador' or new.desactivado_en is not null)
     and not exists (
       select 1 from perfiles p
       where p.tenant_id = old.tenant_id
         and p.id <> old.id
         and p.rol = 'administrador'
         and p.desactivado_en is null
     ) then
    raise exception 'ultimo_administrador' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger perfiles_proteger_ultimo_admin before update on public.perfiles
  for each row execute function public.proteger_ultimo_admin();

-- Invitaciones (R5). Solo se guarda el hash del token.
create table public.invitaciones (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id),
  correo text not null
    constraint invitaciones_correo_check
      check (correo = lower(trim(correo)) and position('@' in correo) > 1),
  rol text not null
    constraint invitaciones_rol_check check (rol in ('administrador', 'personal')),
  token_hash text not null constraint invitaciones_token_hash_key unique,
  invitado_por uuid references auth.users (id),
  vence_en timestamptz not null default now() + interval '7 days',
  estado text not null default 'pendiente'
    constraint invitaciones_estado_check
      check (estado in ('pendiente', 'aceptada', 'revocada')),
  aceptada_por uuid references auth.users (id),
  creado_en timestamptz not null default now()
);
create index invitaciones_tenant_idx on public.invitaciones (tenant_id);

create function public.hash_token(token text) returns text
  language sql immutable set search_path = public
as $$
  select encode(extensions.digest(token, 'sha256'), 'hex');
$$;

-- Crea una invitación y devuelve el token una sola vez. Revoca las
-- pendientes anteriores del mismo correo en el tenant.
create function public.crear_invitacion(p_correo text, p_rol text)
  returns table (id uuid, token text, vence_en timestamptz)
  language plpgsql security definer set search_path = public
as $$
#variable_conflict use_column
declare
  v_tenant uuid := tenant_actual();
  v_correo text := lower(trim(p_correo));
  v_token text;
begin
  if v_tenant is null or not es_administrador(auth.uid()) then
    raise exception 'solo un administrador invita' using errcode = '42501';
  end if;
  if exists (
    select 1 from perfiles p join auth.users u on u.id = p.id
    where p.tenant_id = v_tenant
      and p.desactivado_en is null
      and lower(u.email) = v_correo
  ) then
    raise exception 'ya_es_miembro' using errcode = 'P0001';
  end if;

  update invitaciones i set estado = 'revocada'
  where i.tenant_id = v_tenant and i.correo = v_correo and i.estado = 'pendiente';

  v_token := rtrim(
    translate(encode(extensions.gen_random_bytes(32), 'base64'), '+/', '-_'),
    '='
  );
  return query
    insert into invitaciones as i (tenant_id, correo, rol, token_hash, invitado_por)
    values (v_tenant, v_correo, p_rol, hash_token(v_token), auth.uid())
    returning i.id, v_token, i.vence_en;
end;
$$;

create function public.revocar_invitacion(p_id uuid) returns void
  language plpgsql security definer set search_path = public
as $$
begin
  if not es_administrador(auth.uid()) then
    raise exception 'solo un administrador revoca' using errcode = '42501';
  end if;
  update invitaciones i set estado = 'revocada'
  where i.id = p_id
    and i.tenant_id = tenant_actual()
    and i.estado = 'pendiente';
end;
$$;

-- Única función pública (anon): datos mínimos para la pantalla de invitación.
-- No distingue un token inexistente de uno vencido o revocado.
create function public.ver_invitacion(p_token text)
  returns table (correo text, tenant text)
  language sql stable security definer set search_path = public
as $$
  select i.correo, t.nombre
  from invitaciones i join tenants t on t.id = i.tenant_id
  where i.token_hash = hash_token(p_token)
    and i.estado = 'pendiente'
    and i.vence_en > now();
$$;

-- Solo service role (Edge Function `aceptar-invitacion`): estado de una
-- invitación y, si el correo ya tiene usuario de Auth, su id y su tenant.
-- `codigo` null = se puede aceptar.
create function public.revisar_invitacion(p_token_hash text)
  returns table (
    correo text, rol text, tenant_id uuid, codigo text, usuario_id uuid
  )
  language plpgsql stable security definer set search_path = public
as $$
#variable_conflict use_column
declare
  v_inv invitaciones%rowtype;
  v_uid uuid;
  v_tenant_perfil uuid;
begin
  select * into v_inv from invitaciones i where i.token_hash = p_token_hash;
  if not found or v_inv.estado <> 'pendiente' then
    return query select null::text, null::text, null::uuid, 'invitacion_invalida', null::uuid;
    return;
  end if;
  if v_inv.vence_en <= now() then
    return query select null::text, null::text, null::uuid, 'invitacion_vencida', null::uuid;
    return;
  end if;

  select u.id into v_uid from auth.users u where lower(u.email) = v_inv.correo;
  select p.tenant_id into v_tenant_perfil from perfiles p where p.id = v_uid;
  return query select
    v_inv.correo,
    v_inv.rol,
    v_inv.tenant_id,
    case when v_tenant_perfil is not null and v_tenant_perfil <> v_inv.tenant_id
      then 'correo_en_otro_tenant' end,
    v_uid;
end;
$$;

-- Solo service role (Edge Function `aceptar-invitacion`): en una transacción,
-- marca la invitación aceptada y crea o reactiva el perfil.
create function public.consumir_invitacion(
  p_token_hash text, p_uid uuid, p_nombre text
) returns void
  language plpgsql security definer set search_path = public
as $$
declare
  v_inv invitaciones%rowtype;
  v_tenant_perfil uuid;
begin
  select * into v_inv from invitaciones
  where token_hash = p_token_hash
  for update;

  if not found or v_inv.estado <> 'pendiente' then
    raise exception 'invitacion_invalida' using errcode = 'P0001';
  end if;
  if v_inv.vence_en <= now() then
    raise exception 'invitacion_vencida' using errcode = 'P0001';
  end if;

  select p.tenant_id into v_tenant_perfil from perfiles p where p.id = p_uid;
  if found and v_tenant_perfil <> v_inv.tenant_id then
    raise exception 'correo_en_otro_tenant' using errcode = 'P0001';
  end if;

  if found then
    update perfiles
    set rol = v_inv.rol, nombre = trim(p_nombre), desactivado_en = null
    where id = p_uid;
  else
    insert into perfiles (id, nombre, rol, tenant_id)
    values (p_uid, trim(p_nombre), v_inv.rol, v_inv.tenant_id);
  end if;

  update invitaciones
  set estado = 'aceptada', aceptada_por = p_uid
  where id = v_inv.id;
end;
$$;

-- Equipo del tenant con correo (de auth.users), solo para administradores.
create function public.equipo_tenant()
  returns table (
    id uuid, nombre text, correo text, rol text, desactivado_en timestamptz
  )
  language sql stable security definer set search_path = public
as $$
  select p.id, p.nombre, u.email::text, p.rol, p.desactivado_en
  from perfiles p join auth.users u on u.id = p.id
  where es_administrador(auth.uid())
    and p.tenant_id = tenant_actual()
  order by p.nombre;
$$;

-- Los default privileges del proyecto dan EXECUTE a anon/authenticated en
-- toda función nueva: se ajusta explícitamente.
revoke execute on function public.consumir_invitacion(text, uuid, text) from public, anon, authenticated;
revoke execute on function public.revisar_invitacion(text) from public, anon, authenticated;
grant execute on function public.revisar_invitacion(text) to service_role;
grant execute on function public.consumir_invitacion(text, uuid, text) to service_role;
revoke execute on function public.crear_invitacion(text, text) from public, anon;
revoke execute on function public.revocar_invitacion(uuid) from public, anon;
revoke execute on function public.equipo_tenant() from public, anon;
revoke execute on function public.tenant_del_perfil() from public, anon;
revoke execute on function public.desactivado_en_propio() from public, anon;
revoke execute on function public.hash_token(text) from public, anon, authenticated;
grant execute on function public.ver_invitacion(text) to anon, authenticated;
-- tenant_actual() se usa como default de columna y en políticas: authenticated
-- la necesita; anon no.
revoke execute on function public.tenant_actual() from public, anon;

-- ---------------------------------------------------------------------------
-- 7. RLS por tenant: reemplaza todas las políticas `using (true)`
-- ---------------------------------------------------------------------------

drop policy "cambios_insumo: leer todos los autenticados" on public.cambios_insumo;
drop policy "cambios_insumo: solo administrador inserta, como sí mismo" on public.cambios_insumo;
drop policy "categorias: leer todos los autenticados" on public.categorias;
drop policy "categorias: solo administrador actualiza" on public.categorias;
drop policy "categorias: solo administrador inserta, como sí mismo" on public.categorias;
drop policy "configuracion_alertas: leer todos los autenticados" on public.configuracion_alertas;
drop policy "configuracion_alertas: solo administrador escribe" on public.configuracion_alertas;
drop policy "configuracion_clinica: leer todos los autenticados" on public.configuracion_clinica;
drop policy "configuracion_clinica: solo administrador escribe" on public.configuracion_clinica;
drop policy "insumos: cualquiera da de alta" on public.insumos;
drop policy "insumos: cualquiera resincroniza, protegido por trigger" on public.insumos;
drop policy "insumos: leer todos los autenticados" on public.insumos;
drop policy "items_compra: actualizar cualquiera" on public.items_compra;
drop policy "items_compra: insertar como uno mismo" on public.items_compra;
drop policy "items_compra: leer todos los autenticados" on public.items_compra;
drop policy "lotes: cualquiera crea" on public.lotes;
drop policy "lotes: cualquiera resincroniza, protegido por trigger" on public.lotes;
drop policy "lotes: leer todos los autenticados" on public.lotes;
drop policy "movimientos: insertar como uno mismo" on public.movimientos;
drop policy "movimientos: leer todos los autenticados" on public.movimientos;
drop policy "perfiles: leer solo el propio perfil" on public.perfiles;

alter table public.tenants       enable row level security;
alter table public.lugares       enable row level security;
alter table public.minimos_lugar enable row level security;
alter table public.invitaciones  enable row level security;

-- tenants: cada uno lee el suyo; el administrador solo cambia el nombre.
create policy "tenants: leer el propio" on public.tenants
  for select to authenticated using (id = public.tenant_actual());
create policy "tenants: administrador renombra" on public.tenants
  for update to authenticated
  using (id = public.tenant_actual() and public.es_administrador(auth.uid()))
  with check (id = public.tenant_actual());
revoke insert, update, delete on public.tenants from anon, authenticated;
grant update (nombre) on public.tenants to authenticated;

-- lugares
create policy "lugares: leer del tenant" on public.lugares
  for select to authenticated using (tenant_id = public.tenant_actual());
create policy "lugares: administrador crea" on public.lugares
  for insert to authenticated
  with check (tenant_id = public.tenant_actual() and public.es_administrador(auth.uid()));
create policy "lugares: administrador actualiza" on public.lugares
  for update to authenticated
  using (tenant_id = public.tenant_actual() and public.es_administrador(auth.uid()))
  with check (tenant_id = public.tenant_actual());

-- perfiles: el propio siempre (aunque esté desactivado, para que la app lo
-- detecte); todo el tenant si es administrador. Las altas las hace service
-- role (Edge Function / script de alta).
create policy "perfiles: leer el propio" on public.perfiles
  for select to authenticated using (id = auth.uid());
create policy "perfiles: administrador lee su tenant" on public.perfiles
  for select to authenticated
  using (tenant_id = public.tenant_actual() and public.es_administrador(auth.uid()));
create policy "perfiles: administrador actualiza su tenant" on public.perfiles
  for update to authenticated
  using (tenant_id = public.tenant_actual() and public.es_administrador(auth.uid()))
  with check (tenant_id = public.tenant_actual());

-- insumos (el trigger de catálogo sigue protegiendo los campos de catálogo)
create policy "insumos: leer del tenant" on public.insumos
  for select to authenticated using (tenant_id = public.tenant_actual());
create policy "insumos: alta en el tenant" on public.insumos
  for insert to authenticated with check (tenant_id = public.tenant_actual());
create policy "insumos: resincronizar en el tenant" on public.insumos
  for update to authenticated
  using (tenant_id = public.tenant_actual())
  with check (tenant_id = public.tenant_actual());

-- categorias
create policy "categorias: leer del tenant" on public.categorias
  for select to authenticated using (tenant_id = public.tenant_actual());
create policy "categorias: administrador inserta, como sí mismo" on public.categorias
  for insert to authenticated
  with check (
    tenant_id = public.tenant_actual()
    and creado_por = auth.uid()
    and public.es_administrador(auth.uid())
  );
create policy "categorias: administrador actualiza" on public.categorias
  for update to authenticated
  using (tenant_id = public.tenant_actual() and public.es_administrador(auth.uid()))
  with check (tenant_id = public.tenant_actual());

-- cambios_insumo
create policy "cambios_insumo: leer del tenant" on public.cambios_insumo
  for select to authenticated using (tenant_id = public.tenant_actual());
create policy "cambios_insumo: administrador inserta, como sí mismo" on public.cambios_insumo
  for insert to authenticated
  with check (
    tenant_id = public.tenant_actual()
    and usuario_id = auth.uid()
    and public.es_administrador(auth.uid())
  );

-- lotes (el trigger de resolución sigue protegiendo revisión → activo)
create policy "lotes: leer del tenant" on public.lotes
  for select to authenticated using (tenant_id = public.tenant_actual());
create policy "lotes: crear en el tenant" on public.lotes
  for insert to authenticated with check (tenant_id = public.tenant_actual());
create policy "lotes: pendiente previo a la desactivación" on public.lotes
  for insert to authenticated
  with check (
    tenant_id = public.tenant_del_perfil()
    and creado_en < public.desactivado_en_propio()
  );
create policy "lotes: resincronizar en el tenant" on public.lotes
  for update to authenticated
  using (tenant_id = public.tenant_actual())
  with check (tenant_id = public.tenant_actual());

-- movimientos (solo INSERT: no se editan ni se borran)
create policy "movimientos: leer del tenant" on public.movimientos
  for select to authenticated using (tenant_id = public.tenant_actual());
create policy "movimientos: insertar como uno mismo" on public.movimientos
  for insert to authenticated
  with check (tenant_id = public.tenant_actual() and usuario_id = auth.uid());
create policy "movimientos: pendiente previo a la desactivación" on public.movimientos
  for insert to authenticated
  with check (
    usuario_id = auth.uid()
    and tenant_id = public.tenant_del_perfil()
    and creado_en < public.desactivado_en_propio()
  );

-- items_compra
create policy "items_compra: leer del tenant" on public.items_compra
  for select to authenticated using (tenant_id = public.tenant_actual());
create policy "items_compra: insertar como uno mismo" on public.items_compra
  for insert to authenticated
  with check (tenant_id = public.tenant_actual() and creado_por = auth.uid());
create policy "items_compra: actualizar en el tenant" on public.items_compra
  for update to authenticated
  using (tenant_id = public.tenant_actual())
  with check (tenant_id = public.tenant_actual());

-- minimos_lugar
create policy "minimos_lugar: leer del tenant" on public.minimos_lugar
  for select to authenticated using (tenant_id = public.tenant_actual());
create policy "minimos_lugar: administrador inserta" on public.minimos_lugar
  for insert to authenticated
  with check (tenant_id = public.tenant_actual() and public.es_administrador(auth.uid()));
create policy "minimos_lugar: administrador actualiza" on public.minimos_lugar
  for update to authenticated
  using (tenant_id = public.tenant_actual() and public.es_administrador(auth.uid()))
  with check (tenant_id = public.tenant_actual());

-- configuracion_alertas / configuracion_clinica
create policy "configuracion_alertas: leer del tenant" on public.configuracion_alertas
  for select to authenticated using (tenant_id = public.tenant_actual());
create policy "configuracion_alertas: administrador escribe" on public.configuracion_alertas
  for all to authenticated
  using (tenant_id = public.tenant_actual() and public.es_administrador(auth.uid()))
  with check (tenant_id = public.tenant_actual() and public.es_administrador(auth.uid()));
create policy "configuracion_clinica: leer del tenant" on public.configuracion_clinica
  for select to authenticated using (tenant_id = public.tenant_actual());
create policy "configuracion_clinica: administrador escribe" on public.configuracion_clinica
  for all to authenticated
  using (tenant_id = public.tenant_actual() and public.es_administrador(auth.uid()))
  with check (tenant_id = public.tenant_actual() and public.es_administrador(auth.uid()));

-- invitaciones: solo lectura para el administrador; las escrituras pasan por
-- los RPC de arriba.
create policy "invitaciones: administrador lee su tenant" on public.invitaciones
  for select to authenticated
  using (tenant_id = public.tenant_actual() and public.es_administrador(auth.uid()));
revoke insert, update, delete on public.invitaciones from anon, authenticated;

commit;
