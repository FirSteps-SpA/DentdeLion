-- DentdeLion — spec 031 (administración de la plataforma).
-- Contenido: specs/031-administracion-plataforma/data-model.md y research.md.
--
-- 1. Operadores de plataforma y auditoría (sin acceso por la API).
-- 2. FKs de historial a auth.users fuera (R3): permiten borrar una cuenta
--    conservando sus registros; perfiles en cascada.
-- 3. usuarios_eliminados (R4): ids de cuentas borradas, para "Usuario eliminado".
-- 4. Funciones de plataforma, solo para service_role (la Edge Function
--    `plataforma` verifica al operador antes de llamarlas).
--
-- Ningún dato existente cambia. La lista de operadores se carga a mano con
-- SQL tras el despliegue: el repositorio es público.

begin;

-- 1. Operadores y auditoría ----------------------------------------------------

create table public.administradores_plataforma (
  usuario_id uuid primary key,
  agregado_en timestamptz not null default now()
);
alter table public.administradores_plataforma enable row level security;

create table public.auditoria_plataforma (
  id uuid primary key default gen_random_uuid(),
  operador_id uuid not null,
  accion text not null,
  -- Sin FK: el registro sobrevive al borrado del cliente o del usuario.
  tenant_id uuid,
  tenant_nombre text,
  usuario_id uuid,
  usuario_correo text,
  resultado text not null,
  creado_en timestamptz not null default now()
);
alter table public.auditoria_plataforma enable row level security;

revoke all on public.administradores_plataforma, public.auditoria_plataforma
  from anon, authenticated;

-- Para mostrar la tarjeta "Plataforma": solo responde por la propia cuenta.
create function public.es_operador_plataforma() returns boolean
  language sql stable security definer set search_path = public
as $$
  select exists (select 1 from administradores_plataforma where usuario_id = auth.uid())
$$;
revoke execute on function public.es_operador_plataforma() from public, anon;
grant execute on function public.es_operador_plataforma() to authenticated;

-- 2. FKs de historial a auth.users (R3) ---------------------------------------

alter table public.movimientos drop constraint movimientos_usuario_id_fkey;
alter table public.cambios_insumo drop constraint cambios_insumo_usuario_id_fkey;
alter table public.insumos drop constraint insumos_creado_por_fkey;
alter table public.insumos drop constraint insumos_dado_de_baja_por_fkey;
alter table public.categorias drop constraint categorias_creado_por_fkey;
alter table public.items_compra drop constraint items_compra_creado_por_fkey;
alter table public.items_compra drop constraint items_compra_comprado_por_fkey;
alter table public.invitaciones drop constraint invitaciones_invitado_por_fkey;
alter table public.invitaciones drop constraint invitaciones_aceptada_por_fkey;

alter table public.perfiles drop constraint perfiles_id_fkey;
alter table public.perfiles
  add constraint perfiles_id_fkey foreign key (id) references auth.users (id) on delete cascade;

-- 3. Usuarios eliminados (R4) --------------------------------------------------

create table public.usuarios_eliminados (
  usuario_id uuid primary key,
  tenant_id uuid not null references public.tenants (id),
  eliminado_en timestamptz not null default now()
);
create index usuarios_eliminados_tenant_idx on public.usuarios_eliminados (tenant_id);
alter table public.usuarios_eliminados enable row level security;
create policy "usuarios_eliminados: los miembros del tenant los leen" on public.usuarios_eliminados
  for select to authenticated
  using (tenant_id = public.tenant_actual());

-- 4. Funciones de plataforma (solo service_role) ------------------------------

-- Resumen de clientes para el panel (FR-004).
create function public.resumen_clientes()
  returns table (
    id uuid,
    nombre text,
    creado_en timestamptz,
    lugares bigint,
    usuarios_activos bigint,
    ultima_actividad timestamptz
  )
  language sql stable security definer set search_path = public
as $$
  select t.id, t.nombre, t.creado_en,
    (select count(*) from lugares l where l.tenant_id = t.id and l.desactivado_en is null),
    (select count(*) from perfiles p where p.tenant_id = t.id and p.desactivado_en is null),
    greatest(
      (select max(m.creado_en) from movimientos m where m.tenant_id = t.id),
      (select max(r.creado_en) from tratamientos_realizados r where r.tenant_id = t.id)
    )
  from tenants t
  order by t.nombre
$$;

-- Usuarios (con correo) e invitaciones pendientes de un cliente.
create function public.usuarios_de_cliente(p_tenant uuid)
  returns table (id uuid, nombre text, correo text, rol text, desactivado_en timestamptz)
  language sql stable security definer set search_path = public
as $$
  select p.id, p.nombre, u.email::text, p.rol, p.desactivado_en
  from perfiles p join auth.users u on u.id = p.id
  where p.tenant_id = p_tenant
  order by p.nombre
$$;

-- Invitación a un cliente (FR-006): mismas reglas que crear_invitacion, más
-- el correo no puede ser de otro cliente.
create function public.invitar_a_cliente(
  p_tenant uuid, p_correo text, p_rol text, p_operador uuid
) returns table (id uuid, token text, vence_en timestamptz)
  language plpgsql security definer set search_path = public
as $$
#variable_conflict use_column
declare
  v_correo text := lower(trim(p_correo));
  v_token text;
begin
  if not exists (select 1 from tenants t where t.id = p_tenant) then
    raise exception 'no_encontrado' using errcode = 'P0002';
  end if;
  if p_rol not in ('administrador', 'personal') or v_correo !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'solicitud_invalida' using errcode = '22023';
  end if;
  if exists (
    select 1 from perfiles p join auth.users u on u.id = p.id
    where lower(u.email) = v_correo and p.tenant_id <> p_tenant
  ) then
    raise exception 'correo_en_otro_tenant' using errcode = 'P0001';
  end if;
  if exists (
    select 1 from perfiles p join auth.users u on u.id = p.id
    where lower(u.email) = v_correo and p.tenant_id = p_tenant and p.desactivado_en is null
  ) then
    raise exception 'ya_es_miembro' using errcode = 'P0001';
  end if;

  update invitaciones i set estado = 'revocada'
  where i.tenant_id = p_tenant and i.correo = v_correo and i.estado = 'pendiente';

  v_token := rtrim(
    translate(encode(extensions.gen_random_bytes(32), 'base64'), '+/', '-_'),
    '='
  );
  return query
    insert into invitaciones as i (tenant_id, correo, rol, token_hash, invitado_por)
    values (p_tenant, v_correo, p_rol, hash_token(v_token), p_operador)
    returning i.id, v_token, i.vence_en;
end;
$$;

-- Cliente nuevo con su primer lugar y la invitación de su administradora, en
-- una transacción (FR-005). Las categorías iniciales las agrega el trigger de
-- tenants (spec 026).
create function public.crear_cliente(
  p_nombre text, p_lugar text, p_correo text, p_operador uuid
) returns table (tenant_id uuid, token text, vence_en timestamptz)
  language plpgsql security definer set search_path = public
as $$
declare
  v_tenant uuid;
  v_inv record;
begin
  if char_length(btrim(coalesce(p_nombre, ''))) not between 1 and 80
     or char_length(btrim(coalesce(p_lugar, ''))) not between 1 and 80 then
    raise exception 'solicitud_invalida' using errcode = '22023';
  end if;
  insert into tenants (nombre) values (btrim(p_nombre)) returning id into v_tenant;
  insert into lugares (tenant_id, nombre) values (v_tenant, btrim(p_lugar));
  select * into v_inv from invitar_a_cliente(v_tenant, p_correo, 'administrador', p_operador);
  return query select v_tenant, v_inv.token, v_inv.vence_en;
end;
$$;

-- Eliminar un usuario conservando sus registros (FR-007, FR-009). Borra su
-- perfil y las invitaciones a su correo y deja su id en usuarios_eliminados;
-- la cuenta de acceso la borra después la Edge Function.
create function public.eliminar_usuario(p_usuario uuid, p_operador uuid)
  returns table (tenant_id uuid, correo text)
  language plpgsql security definer set search_path = public
as $$
declare
  v_perfil perfiles%rowtype;
  v_correo text;
begin
  if p_usuario = p_operador then
    raise exception 'propia_cuenta' using errcode = 'P0001';
  end if;
  select * into v_perfil from perfiles p where p.id = p_usuario for update;
  if not found then
    raise exception 'no_encontrado' using errcode = 'P0002';
  end if;
  if v_perfil.rol = 'administrador' and v_perfil.desactivado_en is null and not exists (
    select 1 from perfiles p
    where p.tenant_id = v_perfil.tenant_id and p.id <> p_usuario
      and p.rol = 'administrador' and p.desactivado_en is null
  ) then
    raise exception 'unica_administradora' using errcode = 'P0001';
  end if;
  select lower(u.email) into v_correo from auth.users u where u.id = p_usuario;

  delete from invitaciones i where i.tenant_id = v_perfil.tenant_id and i.correo = v_correo;
  insert into usuarios_eliminados (usuario_id, tenant_id) values (p_usuario, v_perfil.tenant_id)
    on conflict (usuario_id) do nothing;
  delete from perfiles p where p.id = p_usuario;
  return query select v_perfil.tenant_id, v_correo;
end;
$$;

-- Respaldo de un cliente antes de eliminarlo (FR-010): todas sus filas de
-- cada tabla con tenant_id (descubiertas en el catálogo, para no olvidar
-- ninguna) y sus usuarios con correo.
create function public.exportar_cliente(p_tenant uuid)
  returns jsonb
  language plpgsql stable security definer set search_path = public
as $$
declare
  v_tablas jsonb := '{}';
  v_tabla text;
  v_filas jsonb;
  v_cliente jsonb;
begin
  select to_jsonb(t) into v_cliente from tenants t where t.id = p_tenant;
  if v_cliente is null then
    raise exception 'no_encontrado' using errcode = 'P0002';
  end if;
  for v_tabla in
    select c.table_name from information_schema.columns c
    join information_schema.tables t
      on t.table_schema = c.table_schema and t.table_name = c.table_name
    where c.table_schema = 'public' and c.column_name = 'tenant_id' and t.table_type = 'BASE TABLE'
      and c.table_name <> 'auditoria_plataforma'
    order by c.table_name
  loop
    execute format(
      'select coalesce(jsonb_agg(to_jsonb(x)), ''[]'') from public.%I x where x.tenant_id = $1',
      v_tabla
    ) into v_filas using p_tenant;
    v_tablas := v_tablas || jsonb_build_object(v_tabla, v_filas);
  end loop;
  return jsonb_build_object(
    'generado_en', now(),
    'cliente', v_cliente,
    'usuarios', coalesce(
      (select jsonb_agg(to_jsonb(u)) from usuarios_de_cliente(p_tenant) u), '[]'
    ),
    'tablas', v_tablas
  );
end;
$$;

-- Eliminar un cliente con todos sus datos (FR-011, FR-012), en una
-- transacción, en orden de dependencias. Devuelve los ids de las cuentas de
-- sus usuarios para que la Edge Function las borre.
create function public.eliminar_cliente(p_tenant uuid, p_operador uuid)
  returns uuid[]
  language plpgsql security definer set search_path = public
as $$
declare
  v_cuentas uuid[];
  v_tabla text;
  v_quedan bigint;
begin
  if not exists (select 1 from tenants t where t.id = p_tenant) then
    raise exception 'no_encontrado' using errcode = 'P0002';
  end if;
  if exists (select 1 from perfiles p where p.id = p_operador and p.tenant_id = p_tenant) then
    raise exception 'propio_cliente' using errcode = 'P0001';
  end if;

  select coalesce(array_agg(p.id), '{}') into v_cuentas from perfiles p where p.tenant_id = p_tenant;

  delete from pacientes_registro where tenant_id = p_tenant;
  delete from movimientos where tenant_id = p_tenant;
  delete from cambios_lote where tenant_id = p_tenant;
  delete from cambios_insumo where tenant_id = p_tenant;
  delete from minimos_lugar where tenant_id = p_tenant;
  delete from items_compra where tenant_id = p_tenant;
  delete from lotes where tenant_id = p_tenant;
  delete from cambios_tratamiento where tenant_id = p_tenant;
  delete from tratamientos_realizados where tenant_id = p_tenant;
  delete from tratamientos where tenant_id = p_tenant;
  delete from categorias_tratamiento where tenant_id = p_tenant;
  delete from estimaciones_ia where tenant_id = p_tenant;
  delete from usuarios_eliminados where tenant_id = p_tenant;
  delete from invitaciones where tenant_id = p_tenant;
  delete from insumos where tenant_id = p_tenant;
  delete from marcas where tenant_id = p_tenant;
  delete from categorias where tenant_id = p_tenant;
  delete from configuracion_alertas where tenant_id = p_tenant;
  update lugares set proveedor_predeterminado_id = null where tenant_id = p_tenant;
  delete from proveedores where tenant_id = p_tenant;
  delete from lugares where tenant_id = p_tenant;
  delete from perfiles where tenant_id = p_tenant;

  -- Verificación (SC-003): ninguna tabla con tenant_id conserva filas suyas,
  -- también las que se agreguen en el futuro sin sumarlas arriba.
  for v_tabla in
    select c.table_name from information_schema.columns c
    join information_schema.tables t
      on t.table_schema = c.table_schema and t.table_name = c.table_name
    where c.table_schema = 'public' and c.column_name = 'tenant_id' and t.table_type = 'BASE TABLE'
      and c.table_name <> 'auditoria_plataforma'
  loop
    execute format('select count(*) from public.%I where tenant_id = $1', v_tabla)
      into v_quedan using p_tenant;
    if v_quedan > 0 then
      raise exception 'quedan % filas en %', v_quedan, v_tabla;
    end if;
  end loop;

  delete from tenants where id = p_tenant;
  return v_cuentas;
end;
$$;

do $$
declare
  f text;
begin
  foreach f in array array[
    'public.resumen_clientes()',
    'public.usuarios_de_cliente(uuid)',
    'public.invitar_a_cliente(uuid, text, text, uuid)',
    'public.crear_cliente(text, text, text, uuid)',
    'public.exportar_cliente(uuid)',
    'public.eliminar_usuario(uuid, uuid)',
    'public.eliminar_cliente(uuid, uuid)'
  ] loop
    execute format('revoke execute on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end;
$$;

commit;
