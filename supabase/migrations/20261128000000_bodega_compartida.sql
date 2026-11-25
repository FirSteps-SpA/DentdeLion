-- DentdeLion — spec 033 (lugares que comparten bodega).
-- Contenido: specs/033-bodega-compartida/data-model.md y research.md R1.
--
-- `bodega_id` agrupa lugares del mismo tenant que comparten un solo stock.
-- null = bodega propia (lo de siempre). Lugares que comparten bodega llevan el
-- mismo uuid, que nunca es el id de un lugar. Sin FK: la bodega no es una fila.
-- Se cambia con el upsert de lugares, que solo hace administración (policy
-- "lugares: administrador actualiza"); un cliente viejo que no envía la clave
-- la conserva. Ningún dato existente cambia.

begin;

alter table public.lugares add column bodega_id uuid;

alter table public.lugares add constraint lugares_bodega_no_es_lugar
  check (bodega_id is null or bodega_id <> id);

create index lugares_bodega_idx on public.lugares (tenant_id, bodega_id);

commit;
