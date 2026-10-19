-- DentdeLion — spec 015 (unidades y costo unitario).
-- Orden y contenido: specs/015-unidades-y-costo-unitario/contracts/supabase-schema.md
-- y data-model.md. Todo en una transacción: o aplica completa o no aplica.
--
-- Ningún stock, mínimo ni movimiento cambia de valor (SC-001): la unidad
-- actual de cada insumo pasa a ser su unidad de consumo y de compra, con
-- contenido 1. Los clientes 2.3.0 en caché siguen funcionando: no envían las
-- columnas nuevas y las completan los `default` y los triggers (research.md
-- R10).

begin;

-- ---------------------------------------------------------------------------
-- 1. Catálogo: `pieza` pasa a `unidad` (research.md R1)
-- ---------------------------------------------------------------------------

-- `proteger_catalogo_insumo` revierte cambios de catálogo sin una sesión de
-- administración, y la migración corre sin sesión: se desactiva solo durante
-- el backfill (ensayo sobre el respaldo de producción, T071).
alter table public.insumos disable trigger insumos_proteger_catalogo;
update public.insumos set unidad_medida = 'unidad' where unidad_medida = 'pieza';
alter table public.insumos enable trigger insumos_proteger_catalogo;

update public.cambios_insumo
   set valor_anterior = case when valor_anterior = '"pieza"'::jsonb
                             then '"unidad"'::jsonb else valor_anterior end,
       valor_nuevo    = case when valor_nuevo = '"pieza"'::jsonb
                             then '"unidad"'::jsonb else valor_nuevo end
 where campo = 'unidadMedida';

-- ---------------------------------------------------------------------------
-- 2. Insumos: unidad de compra y contenido (R5)
-- ---------------------------------------------------------------------------

alter table public.insumos
  add column unidad_compra text,
  add column contenido numeric not null default 1
    constraint insumos_contenido_check check (contenido > 0);

update public.insumos set unidad_compra = unidad_medida;

alter table public.insumos alter column unidad_compra set not null;

-- Clientes 2.3.0: pueden volver a subir `pieza` y no envían `unidad_compra`.
create function public.normalizar_unidad() returns trigger
  language plpgsql security definer set search_path = public
as $$
begin
  if new.unidad_medida = 'pieza' then
    new.unidad_medida := 'unidad';
  end if;
  if new.unidad_compra = 'pieza' then
    new.unidad_compra := 'unidad';
  end if;
  if tg_op = 'INSERT' and new.unidad_compra is null then
    new.unidad_compra := new.unidad_medida;
  end if;
  if tg_op = 'UPDATE' and new.unidad_compra is null then
    new.unidad_compra := old.unidad_compra;
  end if;
  return new;
end;
$$;

create trigger insumos_normalizar_unidad
  before insert or update on public.insumos
  for each row execute function public.normalizar_unidad();

-- Un no administrador no cambia el catálogo (spec 007), ahora tampoco la
-- presentación (spec 015 FR-006).
create or replace function public.proteger_catalogo_insumo() returns trigger
  language plpgsql set search_path = public
as $$
begin
  if not es_administrador(auth.uid()) then
    new.nombre := old.nombre;
    new.categoria := old.categoria;
    new.unidad_medida := old.unidad_medida;
    new.unidad_compra := old.unidad_compra;
    new.contenido := old.contenido;
    new.stock_minimo := old.stock_minimo;
    new.codigo_fabricante := old.codigo_fabricante;
    new.caduca := old.caduca;
    new.dado_de_baja_en := old.dado_de_baja_en;
    new.dado_de_baja_por := old.dado_de_baja_por;
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. cambios_insumo: factor de conversión y campos nuevos (R3)
-- ---------------------------------------------------------------------------

alter table public.cambios_insumo
  add column factor numeric
    constraint cambios_insumo_factor_check check (factor is null or factor > 0);

alter table public.cambios_insumo
  add constraint cambios_insumo_factor_campo
    check (factor is null or campo = 'unidadMedida');

alter table public.cambios_insumo drop constraint cambios_insumo_campo_check;
alter table public.cambios_insumo
  add constraint cambios_insumo_campo_check
    check (campo = any (array[
      'nombre', 'categoria', 'unidadMedida', 'unidadCompra', 'contenido',
      'stockMinimo', 'codigoFabricante', 'caduca', 'baja'
    ]));

-- ---------------------------------------------------------------------------
-- 4. Lotes: snapshot del ingreso y precio (R5, R6)
-- ---------------------------------------------------------------------------

alter table public.lotes
  add column cantidad_ingresada numeric
    constraint lotes_cantidad_ingresada_check
      check (cantidad_ingresada is null or cantidad_ingresada > 0),
  add column unidad_ingresada text,
  add column contenido numeric not null default 1
    constraint lotes_contenido_check check (contenido > 0),
  add column unidad_consumo text,
  add column precio_compra numeric
    constraint lotes_precio_compra_check
      check (precio_compra is null or precio_compra >= 0);

update public.lotes l
   set unidad_consumo = i.unidad_medida
  from public.insumos i
 where i.id = l.insumo_id;

alter table public.lotes alter column unidad_consumo set not null;

-- Reemplaza `proteger_resolucion_lote` (conserva su regla). El upsert de
-- lotes de cada ciclo no puede pisar el snapshot ni el precio original: las
-- correcciones de precio van a `cambios_lote`.
create function public.proteger_lote() returns trigger
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
  if old.estado = 'revision' and new.estado = 'activo'
     and not es_administrador(auth.uid()) then
    new.estado := old.estado;
  end if;
  return new;
end;
$$;

drop trigger lotes_proteger_resolucion on public.lotes;
drop function public.proteger_resolucion_lote();

create trigger lotes_proteger
  before insert or update on public.lotes
  for each row execute function public.proteger_lote();

-- ---------------------------------------------------------------------------
-- 5. Movimientos: unidad en que está la cantidad (R2)
-- ---------------------------------------------------------------------------

alter table public.movimientos add column unidad text;

update public.movimientos m
   set unidad = i.unidad_medida
  from public.lotes l
  join public.insumos i on i.id = l.insumo_id
 where l.id = m.lote_id;

alter table public.movimientos alter column unidad set not null;

-- Clientes 2.3.0: registran en la unidad actual del insumo.
create function public.completar_unidad_movimiento() returns trigger
  language plpgsql security definer set search_path = public
as $$
begin
  if new.unidad is null then
    select i.unidad_medida into new.unidad
    from lotes l join insumos i on i.id = l.insumo_id
    where l.id = new.lote_id;
  end if;
  return new;
end;
$$;

create trigger movimientos_completar_unidad
  before insert on public.movimientos
  for each row execute function public.completar_unidad_movimiento();

-- Igual que en la 014, más la misma unidad en ambas mitades.
create or replace function public.verificar_traslado() returns trigger
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
    and s.unidad = e.unidad
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

-- ---------------------------------------------------------------------------
-- 6. cambios_lote: correcciones de precio, append-only (R6)
-- ---------------------------------------------------------------------------

create table public.cambios_lote (
  id uuid primary key,
  tenant_id uuid not null default public.tenant_actual()
    references public.tenants (id),
  lote_id uuid not null,
  campo text not null
    constraint cambios_lote_campo_check check (campo in ('precioCompra')),
  valor_anterior jsonb
    constraint cambios_lote_valor_anterior_check
      check (valor_anterior is null or valor_anterior = 'null'::jsonb
             or (jsonb_typeof(valor_anterior) = 'number' and (valor_anterior)::numeric >= 0)),
  valor_nuevo jsonb
    constraint cambios_lote_valor_nuevo_check
      check (valor_nuevo is null or valor_nuevo = 'null'::jsonb
             or (jsonb_typeof(valor_nuevo) = 'number' and (valor_nuevo)::numeric >= 0)),
  usuario_id uuid not null,
  creado_en timestamptz not null,
  constraint cambios_lote_lote_tenant_fkey
    foreign key (lote_id, tenant_id) references public.lotes (id, tenant_id)
);

create index cambios_lote_tenant_idx on public.cambios_lote (tenant_id);
create index cambios_lote_lote_idx on public.cambios_lote (lote_id);

alter table public.cambios_lote enable row level security;

create policy "cambios_lote: leer del tenant" on public.cambios_lote
  for select to authenticated using (tenant_id = public.tenant_actual());
create policy "cambios_lote: insertar como uno mismo" on public.cambios_lote
  for insert to authenticated
  with check (tenant_id = public.tenant_actual() and usuario_id = auth.uid());
create policy "cambios_lote: pendiente previo a la desactivación" on public.cambios_lote
  for insert to authenticated
  with check (
    usuario_id = auth.uid()
    and tenant_id = public.tenant_del_perfil()
    and creado_en < public.desactivado_en_propio()
  );

-- ---------------------------------------------------------------------------
-- 7. Unidades válidas (después de todos los backfill)
-- ---------------------------------------------------------------------------

create function public.es_unidad_valida(u text) returns boolean
  language sql immutable set search_path = public
as $$
  select u = any (array[
    'caja', 'frasco', 'botella', 'jeringa', 'cartucho', 'paquete', 'kit',
    'unidad', 'rollo', 'mL', 'L', 'g', 'mg', 'm', 'cm'
  ]);
$$;

alter table public.insumos
  add constraint insumos_unidad_medida_check check (public.es_unidad_valida(unidad_medida)),
  add constraint insumos_unidad_compra_check check (public.es_unidad_valida(unidad_compra));
alter table public.lotes
  add constraint lotes_unidad_ingresada_check
    check (unidad_ingresada is null or public.es_unidad_valida(unidad_ingresada)),
  add constraint lotes_unidad_consumo_check check (public.es_unidad_valida(unidad_consumo));
alter table public.movimientos
  add constraint movimientos_unidad_check check (public.es_unidad_valida(unidad));

commit;
