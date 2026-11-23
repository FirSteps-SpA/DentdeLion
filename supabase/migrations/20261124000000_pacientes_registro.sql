-- DentdeLion — spec 028 (paciente opcional en cada tratamiento realizado).
-- Orden y contenido: specs/028-paciente-tratamiento/contracts/supabase-schema.md,
-- data-model.md y research.md (R1–R3). Todo en una transacción.
--
-- Dato de salud: va aparte del registro (que lee todo el tenant y es
-- inmutable), con RLS que solo deja leerlo y escribirlo al autor del registro
-- y a la administración. Ningún dato existente cambia.

begin;

create table public.pacientes_registro (
  registro_id uuid primary key,
  tenant_id uuid not null default public.tenant_actual() references public.tenants (id),
  -- Lo fija el trigger desde `tratamientos_realizados.usuario_id`.
  autor_id uuid not null,
  -- `null` = sin paciente / borrado (así el borrado se sincroniza como un cambio).
  paciente text
    constraint pacientes_registro_paciente_check
      check (paciente is null or char_length(btrim(paciente)) between 1 and 60),
  actualizado_por uuid not null,
  actualizado_en timestamptz not null,
  constraint pacientes_registro_registro_fkey
    foreign key (registro_id, tenant_id)
    references public.tratamientos_realizados (id, tenant_id)
);

create index pacientes_registro_tenant_idx on public.pacientes_registro (tenant_id);

alter table public.pacientes_registro enable row level security;

create policy "pacientes_registro: leer autor o administración" on public.pacientes_registro
  for select to authenticated
  using (
    tenant_id = public.tenant_actual()
    and (autor_id = auth.uid() or public.es_administrador(auth.uid()))
  );
create policy "pacientes_registro: insertar autor o administración, como sí mismo"
  on public.pacientes_registro
  for insert to authenticated
  with check (
    tenant_id = public.tenant_actual()
    and actualizado_por = auth.uid()
    and (autor_id = auth.uid() or public.es_administrador(auth.uid()))
  );
create policy "pacientes_registro: actualizar autor o administración, como sí mismo"
  on public.pacientes_registro
  for update to authenticated
  using (
    tenant_id = public.tenant_actual()
    and (autor_id = auth.uid() or public.es_administrador(auth.uid()))
  )
  with check (
    tenant_id = public.tenant_actual()
    and actualizado_por = auth.uid()
    and (autor_id = auth.uid() or public.es_administrador(auth.uid()))
  );
-- Sin política de DELETE: nadie borra filas.

-- El autor sale del registro (no del cliente); el registro no debe estar
-- anulado; en UPDATE la identidad no cambia y gana el cambio más reciente.
create function public.preparar_paciente_registro() returns trigger
  language plpgsql security definer set search_path = public
as $$
declare
  v_autor uuid;
  v_anulado timestamptz;
begin
  if tg_op = 'UPDATE' then
    new.registro_id := old.registro_id;
    new.tenant_id := old.tenant_id;
    if new.actualizado_en < old.actualizado_en then
      return old;
    end if;
  end if;

  select usuario_id, anulado_en into v_autor, v_anulado
  from tratamientos_realizados
  where id = new.registro_id and tenant_id = new.tenant_id;

  if v_anulado is not null then
    raise exception 'registro_anulado' using errcode = 'P0001';
  end if;
  if v_autor is not null then
    new.autor_id := v_autor;
  end if;
  if new.paciente is not null then
    new.paciente := btrim(new.paciente);
  end if;
  return new;
end;
$$;

create trigger pacientes_registro_preparar
  before insert or update on public.pacientes_registro
  for each row execute function public.preparar_paciente_registro();

commit;
