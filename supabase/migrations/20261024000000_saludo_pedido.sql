-- Spec 022 · Compras: selección, subtotal y pedido por WhatsApp
-- (specs/022-compras-seleccion-subtotal-y-whatsapp, research.md R1).
--
-- Saludo con que empieza el pedido por WhatsApp, por tenant. Vive en
-- configuracion_alertas, que desde la spec 014 es la fila de configuración
-- del tenant: ya tiene RLS de lectura por tenant y de escritura solo para
-- administración, y el cliente ya la sube y baja. `null` = el saludo de la
-- clienta, que guarda el cliente (SALUDO_PEDIDO_POR_DEFECTO).
--
-- Despliegue: el servidor antes que el front (un front nuevo que sube la
-- columna contra un servidor sin ella falla). Un cliente anterior que sube la
-- fila sin la columna no la toca: el upsert solo actualiza lo que envía.

alter table public.configuracion_alertas
  add column saludo_pedido text
    constraint configuracion_alertas_saludo_pedido_check
      check (saludo_pedido is null or char_length(btrim(saludo_pedido)) between 1 and 500);
