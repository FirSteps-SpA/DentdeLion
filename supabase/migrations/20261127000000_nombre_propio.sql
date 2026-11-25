-- DentdeLion — spec 032 (mejoras de UX: editar el nombre propio).
-- Contenido: specs/032-mejoras-ux-insumos-perfil/contracts/api.md y research.md R5.
--
-- Toda persona activa puede cambiar su propio nombre, y nada más: no se agrega
-- una policy de update a `perfiles` para el propio usuario porque permitiría
-- también cambiar rol, tenant o estado. La función no recibe un id, así que
-- nadie cambia el nombre de otra persona. Ningún dato existente cambia.

begin;

create function public.actualizar_mi_nombre(p_nombre text) returns text
  language plpgsql security definer set search_path = public
as $$
declare
  v_nombre text := trim(coalesce(p_nombre, ''));
begin
  if auth.uid() is null or not exists (
    select 1 from perfiles p where p.id = auth.uid() and p.desactivado_en is null
  ) then
    raise exception 'sin_permiso' using errcode = '42501';
  end if;
  if char_length(v_nombre) < 1 or char_length(v_nombre) > 80 then
    raise exception 'nombre_invalido' using errcode = 'P0001';
  end if;
  update perfiles p set nombre = v_nombre where p.id = auth.uid();
  return v_nombre;
end;
$$;

revoke execute on function public.actualizar_mi_nombre(text) from public, anon;
grant execute on function public.actualizar_mi_nombre(text) to authenticated;

commit;
