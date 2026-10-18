-- DentdeLion — search_path fijo en las funciones señaladas por el advisor de
-- seguridad de Supabase. Sin él, un rol que pueda crear objetos en un esquema
-- anterior del search_path podría suplantar las tablas usadas dentro de ellas.
-- Ninguna usa extensiones. (`rls_auto_enable` es de la plataforma y ya lo fija.)

alter function public.es_administrador(uuid)       set search_path = public;
alter function public.proteger_catalogo_insumo()   set search_path = public;
alter function public.proteger_resolucion_lote()   set search_path = public;
