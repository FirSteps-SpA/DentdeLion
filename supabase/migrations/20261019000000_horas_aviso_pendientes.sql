-- DentdeLion — spec 012 (indicador de sincronización), FR-011: umbral global,
-- en horas, a partir del cual un cambio sin subir se avisa como antiguo. Va en
-- la fila única de `configuracion_alertas`, que ya leen todos los
-- autenticados y escribe solo el administrador (políticas existentes). Los
-- clientes 2.1.0 no envían la columna: su upsert la conserva (research R6).

alter table public.configuracion_alertas
  add column horas_aviso_pendientes integer not null default 24
  constraint configuracion_alertas_horas_aviso_pendientes_check
    check (horas_aviso_pendientes between 1 and 168);
