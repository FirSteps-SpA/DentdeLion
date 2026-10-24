-- Spec 021 (tasks T030): lotes con proveedores escritos de varias formas en dos
-- tenants, para ensayar la migración de proveedores en local. Se aplica sobre
-- una base SIN la migración 20261023000000_proveedores.sql (ver
-- specs/021-proveedores/quickstart.md, "Ensayo local de la migración").

insert into tenants (id, nombre) values ('00000000-0000-4000-8000-0000000000b0','Tenant B');
insert into lugares (id, tenant_id, nombre) values ('00000000-0000-4000-8000-0000000000b1','00000000-0000-4000-8000-0000000000b0','B1');
insert into insumos (id, nombre, categoria, unidad_medida, permite_decimales, tenant_id) values
 ('00000000-0000-4000-8000-00000000a001','Anestesia','Cirugía','cartucho',false,'00000000-0000-4000-8000-000000000001'),
 ('00000000-0000-4000-8000-00000000b001','Guantes','Cirugía','caja',false,'00000000-0000-4000-8000-0000000000b0');
insert into lotes (id, insumo_id, numero_lote, proveedor, tenant_id, lugar_id, creado_en, unidad_consumo) values
 (gen_random_uuid(),'00000000-0000-4000-8000-00000000a001','1','Dental Sur','00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000011','2026-01-01','cartucho'),
 (gen_random_uuid(),'00000000-0000-4000-8000-00000000a001','2','dental sur ','00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000011','2026-01-02','cartucho'),
 (gen_random_uuid(),'00000000-0000-4000-8000-00000000a001','3','DENTAL  SÚR','00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000011','2026-01-03','cartucho'),
 (gen_random_uuid(),'00000000-0000-4000-8000-00000000a001','4','dental sur','00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000011','2026-01-04','cartucho'),
 (gen_random_uuid(),'00000000-0000-4000-8000-00000000a001','5','Dentalsur Ltda.','00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000011','2026-01-05','cartucho'),
 (gen_random_uuid(),'00000000-0000-4000-8000-00000000a001','6','   ','00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000011','2026-01-06','cartucho'),
 (gen_random_uuid(),'00000000-0000-4000-8000-00000000b001','7','Dental Sur','00000000-0000-4000-8000-0000000000b0','00000000-0000-4000-8000-0000000000b1','2026-01-07','caja');
