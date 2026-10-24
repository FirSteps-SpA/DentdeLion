# Quickstart: Compras · selección, subtotal y pedido por WhatsApp

Guía para comprobar que la spec funciona de punta a punta. Detalle en
[contracts/supabase-schema.md](./contracts/supabase-schema.md) y
[contracts/ui-contracts.md](./contracts/ui-contracts.md).

## Requisitos

- Supabase local con la migración aplicada (`supabase db reset`).
- En el tenant A, una cuenta de administración y una de personal; un segundo tenant (los que siembra
  `test:rls`).
- Insumos con stock bajo el mínimo y lotes con precio (alta con stock inicial y precio), un ítem manual
  sin vínculo y uno vinculado; dos proveedores (021), uno con WhatsApp y predeterminado del lugar activo
  y otro sin WhatsApp.

## Pruebas automáticas

```bash
npm test          # unit + integración (contracts/ui-contracts.md, "Pruebas")
npm run test:rls  # saludo_pedido e items_compra ajenos (contracts/supabase-schema.md)
npm run lint && npm run build
```

## Recorrido manual (skill `run-indentory`, teléfono 360 × 640, tablet y desktop)

1. **Compras**: cada tarjeta tiene casilla; nada marcado; la barra dice "Selecciona lo que vas a pedir"
   y sus botones están deshabilitados.
2. Marcar 3 sugeridos con precio: la barra muestra "3 seleccionados" y el subtotal; cada tarjeta, su
   monto. Comprobar a mano: cajas sugeridas × precio de la caja del último ingreso (SC-001).
3. Marcar el manual sin vínculo: "1 sin precio", el subtotal no cambia. Un sugerido solo caducado: "Sin
   cantidad".
4. "Seleccionar todo" marca todo; de nuevo, desmarca todo.
5. Recargar la página: la selección sigue (SC-004). Recibir un ítem marcado (✓): sale de la lista y del
   subtotal.
6. **Copiar**: el portapapeles tiene el saludo, una línea en blanco y "- Nombre — 2 cajas" por ítem, sin
   precios ni "Sugerido"/"Manual".
7. **Enviar por WhatsApp**: la hoja trae el predeterminado elegido; el enlace "Abrir WhatsApp" apunta a
   `https://wa.me/569…?text=…`. Elegir el proveedor sin WhatsApp: aviso y enlace `https://wa.me/?text=…`.
8. Vista **"Todos"**: los renglones del mensaje llevan "(Lugar)".
9. **Ajustes → Proveedores** (administración): "Mensaje del pedido" con el saludo de la clienta.
   Cambiarlo y guardar; volver a Compras y Copiar: empieza con el nuevo. "Restablecer" vuelve al
   original. Con `personal`, la sección no aparece.
10. Sin conexión (DevTools → Offline): cambiar el saludo y la selección; todo funciona; al volver la
    conexión, el saludo sube (otro dispositivo lo ve tras sincronizar, SC-007).

Capturas: Compras con selección y barra, hoja "Enviar pedido" y tarjeta del saludo, en los tres
tamaños (SC-006).

## Prueba en dispositivos reales (SC-003, antes de publicar)

Con un número de prueba propio como WhatsApp de un proveedor:

- **Android** (Chrome y la PWA instalada): "Abrir WhatsApp" abre la aplicación en ese chat con el
  mensaje escrito; tildes, "ñ" y saltos de línea se ven bien. Enviar y revisar lo recibido.
- **Desktop** (Chrome/Edge): abre WhatsApp Web (o la aplicación de escritorio) con el mensaje.
- Con la lista de pedido más larga que tenga la clienta: no supera el límite o muestra el aviso de
  copiar.

## Deuda de sincronización (US4, SC-005)

Se cubre con `tests/unit/sync-items-compra.test.ts` (ítem ajeno nuevo rechazado sin frenar el resto ni
dejar el indicador en "Error") y con `test:rls` (ajeno nuevo rechazado, ajeno existente aceptado).
Manual opcional, en dos navegadores: A marca comprado un ítem creado por B; le llega a B.

## Publicación

1. `supabase db push` de `20261024000000_saludo_pedido.sql` (antes del front).
2. Desplegar el front.
3. Con la 2.4.0 o la 021 todavía en caché en algún dispositivo: un administrador que cambie los avisos
   no borra el saludo (cubierto en `test:rls`).
