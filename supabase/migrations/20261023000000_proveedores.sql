-- DentdeLion — spec 021 (proveedores).
-- Orden y contenido: specs/021-proveedores/contracts/supabase-schema.md,
-- data-model.md y research.md (R1–R5, R7, R12). Todo en una transacción.
--
-- El proveedor deja de ser solo texto en cada lote: catálogo por tenant con
-- una clave normalizada única, predeterminado por lugar y `lotes.proveedor_id`.
-- El texto se conserva un release para los clientes 2.4.0 en caché, que siguen
-- registrando solo el texto: un trigger les resuelve el proveedor (R4).

begin;

-- ---------------------------------------------------------------------------
-- 1. Clave normalizada (R1): la misma regla que `claveCategoria` del cliente —
--    sin tildes (ñ → n, como \p{Diacritic} tras NFD), minúsculas, espacios
--    colapsados y recortados. `translate` y no `unaccent`, que no es immutable.
-- ---------------------------------------------------------------------------

create function public.clave_nombre(texto text) returns text
  language sql immutable parallel safe set search_path = public
as $$
  select btrim(regexp_replace(lower(translate(
    coalesce(texto, ''),
    'ÁÉÍÓÚÜÑáéíóúüñÀÈÌÒÙàèìòùÂÊÎÔÛâêîôûÄËÏÖäëïöÇç',
    'AEIOUUNaeiouunAEIOUaeiouAEIOUaeiouAEIOaeioCc'
  )), '\s+', ' ', 'g'));
$$;

-- ---------------------------------------------------------------------------
-- 2. proveedores
-- ---------------------------------------------------------------------------

create table public.proveedores (
  id uuid primary key,
  tenant_id uuid not null default public.tenant_actual() references public.tenants (id),
  nombre text not null
    constraint proveedores_nombre_check check (char_length(btrim(nombre)) between 1 and 60),
  clave text generated always as (public.clave_nombre(nombre)) stored,
  whatsapp text
    constraint proveedores_whatsapp_check check (whatsapp ~ '^[0-9]{10,15}$'),
  contacto text
    constraint proveedores_contacto_check check (char_length(btrim(contacto)) between 1 and 60),
  -- `null` solo en los creados por la migración sin autor conocido o por un
  -- lote 2.4.0 subido sin sesión de usuario (service role).
  creado_por uuid,
  creado_en timestamptz not null default now(),
  desactivado_en timestamptz,
  eliminado_en timestamptz,
  constraint proveedores_id_tenant_key unique (id, tenant_id)
);

create unique index proveedores_clave_por_tenant
  on public.proveedores (tenant_id, clave) where eliminado_en is null;

alter table public.proveedores enable row level security;

create policy "proveedores: leer del tenant" on public.proveedores
  for select to authenticated using (tenant_id = public.tenant_actual());
create policy "proveedores: crear en el tenant, como sí mismo" on public.proveedores
  for insert to authenticated
  with check (tenant_id = public.tenant_actual() and creado_por = auth.uid());
create policy "proveedores: pendiente previo a la desactivación" on public.proveedores
  for insert to authenticated
  with check (
    tenant_id = public.tenant_del_perfil()
    and creado_por = auth.uid()
    and creado_en < public.desactivado_en_propio()
  );
create policy "proveedores: administrador actualiza" on public.proveedores
  for update to authenticated
  using (tenant_id = public.tenant_actual() and public.es_administrador(auth.uid()))
  with check (tenant_id = public.tenant_actual());

-- Identidad inmutable; un eliminado no vuelve; no se elimina con lotes (R7);
-- al desactivar o eliminar deja de ser predeterminado (FR-013).
create function public.proteger_proveedor() returns trigger
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
     and exists (select 1 from lotes l where l.proveedor_id = old.id) then
    raise exception 'proveedor_con_lotes' using errcode = 'P0001';
  end if;

  if (old.desactivado_en is null and new.desactivado_en is not null)
     or (old.eliminado_en is null and new.eliminado_en is not null) then
    update lugares set proveedor_predeterminado_id = null
    where proveedor_predeterminado_id = old.id;
  end if;
  return new;
end;
$$;

create trigger proveedores_proteger
  before update on public.proveedores
  for each row execute function public.proteger_proveedor();

-- ---------------------------------------------------------------------------
-- 3. lugares: predeterminado por lugar (R2)
-- ---------------------------------------------------------------------------

alter table public.lugares add column proveedor_predeterminado_id uuid;
alter table public.lugares add constraint lugares_proveedor_predeterminado_fkey
  foreign key (proveedor_predeterminado_id, tenant_id)
  references public.proveedores (id, tenant_id);

-- Un predeterminado subido sin conexión después de desactivar el proveedor no
-- lo revive.
create function public.validar_predeterminado_lugar() returns trigger
  language plpgsql security definer set search_path = public
as $$
begin
  if new.proveedor_predeterminado_id is not null and not exists (
    select 1 from proveedores p
    where p.id = new.proveedor_predeterminado_id
      and p.desactivado_en is null and p.eliminado_en is null
  ) then
    new.proveedor_predeterminado_id := null;
  end if;
  return new;
end;
$$;

create trigger lugares_validar_predeterminado
  before insert or update on public.lugares
  for each row execute function public.validar_predeterminado_lugar();

-- ---------------------------------------------------------------------------
-- 4. lotes: proveedor_id (R3) y resolución de los lotes 2.4.0 (R4)
-- ---------------------------------------------------------------------------

alter table public.lotes add column proveedor_id uuid;
alter table public.lotes add constraint lotes_proveedor_tenant_fkey
  foreign key (proveedor_id, tenant_id) references public.proveedores (id, tenant_id);
create index lotes_proveedor_idx on public.lotes (proveedor_id);

-- spec 015 + 021: además del snapshot, el proveedor del lote no cambia tras el
-- insert cuando escribe un usuario. `pushLotes` sube todos los lotes en cada
-- ciclo: un cliente recién actualizado (sin `proveedor_id` todavía) o una 2.4.0
-- con el texto viejo no deben pisarlo. Sin usuario (service role, migración)
-- se permite, para las fusiones de `scripts/proveedores.mjs`.
create or replace function public.proteger_lote() returns trigger
  language plpgsql security definer set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.unidad_consumo is null then
      select i.unidad_medida into new.unidad_consumo
      from insumos i where i.id = new.insumo_id;
    end if;
    return new;
  end if;

  new.cantidad_ingresada := old.cantidad_ingresada;
  new.unidad_ingresada := old.unidad_ingresada;
  new.contenido := old.contenido;
  new.unidad_consumo := old.unidad_consumo;
  new.precio_compra := old.precio_compra;
  new.insumo_id := old.insumo_id;
  new.tenant_id := old.tenant_id;
  if auth.uid() is not null then
    new.proveedor_id := coalesce(old.proveedor_id, new.proveedor_id);
    new.proveedor := old.proveedor;
  end if;
  if old.estado = 'revision' and new.estado = 'activo'
     and not es_administrador(auth.uid()) then
    new.estado := old.estado;
  end if;
  return new;
end;
$$;

-- Clientes 2.4.0: el lote llega con el texto y sin `proveedor_id`. Se asocia al
-- proveedor del tenant con la misma clave (activo o desactivado, sin
-- reactivarlo) o a uno nuevo. Un upsert de un lote que ya existe dispara este
-- trigger aunque termine en UPDATE: se ignora, para que el texto viejo de una
-- 2.4.0 tras un renombrado no cree un proveedor.
create function public.resolver_proveedor_lote() returns trigger
  language plpgsql security definer set search_path = public
as $$
declare
  nombre_texto text;
  clave_texto text;
begin
  if exists (select 1 from lotes l where l.id = new.id) then
    return new;
  end if;

  if new.proveedor_id is null then
    nombre_texto := left(coalesce(
      nullif(btrim(regexp_replace(coalesce(new.proveedor, ''), '\s+', ' ', 'g')), ''),
      'Sin proveedor'
    ), 60);
    clave_texto := clave_nombre(nombre_texto);

    select p.id into new.proveedor_id from proveedores p
    where p.tenant_id = new.tenant_id and p.clave = clave_texto and p.eliminado_en is null;

    if new.proveedor_id is null then
      insert into proveedores (id, tenant_id, nombre, creado_por)
      values (gen_random_uuid(), new.tenant_id, nombre_texto, auth.uid())
      on conflict do nothing;
      select p.id into new.proveedor_id from proveedores p
      where p.tenant_id = new.tenant_id and p.clave = clave_texto and p.eliminado_en is null;
    end if;
  elsif btrim(coalesce(new.proveedor, '')) = '' then
    select p.nombre into new.proveedor from proveedores p where p.id = new.proveedor_id;
  end if;
  return new;
end;
$$;

create trigger lotes_resolver_proveedor
  before insert on public.lotes
  for each row execute function public.resolver_proveedor_lote();

-- ---------------------------------------------------------------------------
-- 5. Datos existentes (R5): un proveedor por tenant y clave, con el texto más
--    usado; texto vacío = "Sin proveedor". Las fusiones que decida la clienta
--    van aparte, con `scripts/proveedores.mjs fusionar`.
-- ---------------------------------------------------------------------------

create temporary table lotes_antes on commit drop as
  select count(*) as total from public.lotes;

with base as (
  select
    l.id,
    l.tenant_id,
    l.creado_en,
    coalesce(nullif(btrim(regexp_replace(l.proveedor, '\s+', ' ', 'g')), ''), 'Sin proveedor') as texto
  from public.lotes l
),
con_clave as (
  select b.*, public.clave_nombre(left(b.texto, 60)) as clave from base b
),
frecuencia as (
  select tenant_id, clave, left(texto, 60) as texto, count(*) as n, min(creado_en) as primero
  from con_clave group by tenant_id, clave, left(texto, 60)
),
nombre_elegido as (
  select distinct on (tenant_id, clave) tenant_id, clave, texto
  from frecuencia
  order by tenant_id, clave, n desc, primero, texto
),
lote_mas_antiguo as (
  select distinct on (tenant_id, clave) tenant_id, clave, id as lote_id, creado_en
  from con_clave
  order by tenant_id, clave, creado_en, id
)
insert into public.proveedores (id, tenant_id, nombre, creado_por, creado_en)
select
  gen_random_uuid(),
  n.tenant_id,
  n.texto,
  coalesce(
    (select m.usuario_id from public.movimientos m
      where m.lote_id = a.lote_id and m.tipo = 'ingreso'
      order by m.creado_en, m.id limit 1),
    (select p.id from public.perfiles p join auth.users u on u.id = p.id
      where p.tenant_id = n.tenant_id and p.rol = 'administrador'
      order by u.created_at, p.id limit 1)
  ),
  a.creado_en
from nombre_elegido n
join lote_mas_antiguo a using (tenant_id, clave);

update public.lotes l
   set proveedor_id = p.id
  from public.proveedores p
 where p.tenant_id = l.tenant_id
   and p.eliminado_en is null
   and p.clave = public.clave_nombre(left(coalesce(
         nullif(btrim(regexp_replace(l.proveedor, '\s+', ' ', 'g')), ''), 'Sin proveedor'), 60));

do $$
begin
  if (select count(*) from public.lotes) <> (select total from lotes_antes) then
    raise exception 'proveedores: cambió la cantidad de lotes';
  end if;
  if exists (select 1 from public.lotes where proveedor_id is null) then
    raise exception 'proveedores: quedaron lotes sin proveedor';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. Deuda de la spec 014 (R7 de esa spec, R12 de esta): la configuración
--    global de la clínica, reemplazada por la de cada lugar, ya no la usa
--    ningún cliente.
-- ---------------------------------------------------------------------------

drop table public.configuracion_clinica;

commit;
