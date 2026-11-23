-- DentdeLion — spec 029 (estimación de materiales con IA).
-- Contenido: specs/029-estimacion-materiales-ia/data-model.md y research.md (R2).
-- Registro de cada estimación y reserva atómica del límite diario por tenant.
-- Ningún dato existente cambia.

begin;

create table public.estimaciones_ia (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id),
  usuario_id uuid not null,
  creado_en timestamptz not null default now(),
  tratamiento text not null
    constraint estimaciones_ia_tratamiento_check
      check (char_length(btrim(tratamiento)) between 1 and 80),
  materiales integer not null
    constraint estimaciones_ia_materiales_check check (materiales between 1 and 20),
  resultado text not null default 'pendiente'
    constraint estimaciones_ia_resultado_check
      check (resultado in ('pendiente', 'ok', 'no_reconocido', 'error_modelo', 'error_servicio'))
);

create index estimaciones_ia_tenant_creado_idx on public.estimaciones_ia (tenant_id, creado_en);

alter table public.estimaciones_ia enable row level security;

-- Solo lectura para la administración del tenant (revisar el uso). Sin
-- insert/update/delete por la API: escribe la Edge Function con service role.
create policy "estimaciones_ia: administración lee las de su tenant" on public.estimaciones_ia
  for select to authenticated
  using (tenant_id = public.tenant_actual() and public.es_administrador(auth.uid()));

-- Límite diario (FR-007): 20 por tenant por día de Chile. Bloqueo por tenant
-- para que dos pedidos simultáneos no pasen del límite. Devuelve el id de la
-- fila reservada o null si ya se alcanzó.
create function public.reservar_estimacion(
  p_tenant uuid,
  p_usuario uuid,
  p_tratamiento text,
  p_materiales integer
) returns uuid
  language plpgsql security definer set search_path = public
as $$
declare
  v_hoy date := (now() at time zone 'America/Santiago')::date;
  v_usadas integer;
  v_id uuid;
begin
  perform pg_advisory_xact_lock(hashtext('estimaciones_ia:' || p_tenant::text));
  select count(*) into v_usadas
  from estimaciones_ia
  where tenant_id = p_tenant
    and (creado_en at time zone 'America/Santiago')::date = v_hoy;
  if v_usadas >= 20 then
    return null;
  end if;
  insert into estimaciones_ia (tenant_id, usuario_id, tratamiento, materiales)
  values (p_tenant, p_usuario, btrim(p_tratamiento), p_materiales)
  returning id into v_id;
  return v_id;
end;
$$;

revoke execute on function public.reservar_estimacion(uuid, uuid, text, integer)
  from public, anon, authenticated;
grant execute on function public.reservar_estimacion(uuid, uuid, text, integer) to service_role;

commit;
