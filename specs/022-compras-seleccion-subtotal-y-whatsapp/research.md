# Research: Compras · selección, subtotal y pedido por WhatsApp

**Spec**: [spec.md](./spec.md) · **Plan**: [plan.md](./plan.md)

## R1 · Dónde se guarda el saludo: columna en `configuracion_alertas`

**Hallazgo**: `configuracion_alertas` ya es **la fila de configuración por tenant** desde la 014 (PK
`tenant_id`, RLS "leer del tenant" y "administrador escribe"). En el cliente ya tiene todo lo que pide
FR-023: fila local `'global'` con bandera `sincronizado`, push solo si la cambió un administrador
(`pushConfiguracionAlertas`, spec 012 R5) y pull que respeta el cambio local sin subir
(`conservarCambioLocal`). `horas_aviso_pendientes` (spec 012) se agregó igual: columna opcional, valor por
defecto en el cliente.

**Decisión**: columna `saludo_pedido text null` en `configuracion_alertas`, con
`check (saludo_pedido is null or char_length(btrim(saludo_pedido)) between 1 and 500)`. `null` = el
saludo de la clienta, que vive en el cliente (`SALUDO_PEDIDO_POR_DEFECTO`). En Dexie,
`ConfiguracionAlertas.saludoPedido?: string | null`:

- `undefined`: nunca se tocó en este dispositivo; **no se envía** al subir, para no pisar el valor del
  servidor (mismo criterio que `horasAvisoPendientes`, spec 012 R6).
- `null`: "Restablecer" o guardado vacío; se envía `null`.
- texto: se envía recortado.

**Alternativas**:

- Tabla nueva `configuracion_tenant`: nombre más claro, pero duplica RLS, push/pull, Dexie v14 y
  `test:rls` para un solo campo. Renombrar `configuracion_alertas` queda como deuda si se suman más
  ajustes que no sean de avisos.
- Columna en `tenants`: no tiene política de UPDATE para administración ni fila en Dexie.

**Compatibilidad**: un cliente anterior que sube `configuracion_alertas` (un administrador que cambia
los niveles de aviso con la 2.4.0 o la 021) no envía la columna; el upsert de PostgREST solo actualiza
las columnas enviadas, así que el saludo se conserva. Se prueba en `test:rls`.

## R2 · Selección: un borrador en Dexie, sin versión nueva

**Decisión**: la selección es una fila de la tabla local `borradores` (nunca sincronizada), con
`id: 'seleccion-compras'` y `datos: { tenantId, claves: string[] }`. La clave de cada ítem:

- sugerido: `s:<lugarId>:<insumoId>` (un sugerido no tiene id propio; se recalcula por lugar),
- manual: `m:<itemCompraId>`.

`borradores` tiene índice solo por `id`, así que ampliar la unión de `Borrador.id` **no cambia el
esquema**: no hace falta Dexie v14. Se borra al cerrar sesión (`authStore`, igual que el borrador del
alta), lo que además evita que la selección de una persona aparezca a otra en un dispositivo compartido.
Si `tenantId` no es el actual, se ignora.

**Poda** (Edge Case "sale de la lista"): al cambiar la lista de compras se quitan las claves que ya no
corresponden a un ítem pendiente **de ningún lugar** del tenant (no solo de la vista actual, para no
perder lo marcado en otro lugar al cambiar de lugar). Así, un sugerido que sale y vuelve a entrar
aparece sin marcar (FR-003).

**Alternativas**: `localStorage` (la constitución pone IndexedDB como almacenamiento local y la app no
lo usa para datos); tabla Dexie nueva (v14 solo para esto); estado en memoria (no cumple SC-004).

## R3 · Monto de cada ítem: el costo unitario de la 015 × contenido actual

**Hallazgo**: `costosUnitariosPorInsumo` (015) da, por insumo, el costo por **unidad de consumo** del
último lote con precio de todo el tenant, con correcciones de precio (`cambiosLote`) y factores de
unidad. El precio por unidad de compra del lote (`precioCompra`) corresponde a la presentación de ese
día; si después cambió la presentación (p. ej. caja de 50 → caja de 100), multiplicar las cajas
sugeridas (en la presentación actual) por el precio viejo de la caja sería incorrecto.

**Decisión**: precio por unidad de compra = `costo × insumo.contenido` (contenido actual). Monto =
cantidad en unidades de compra × ese precio. Sin redondear hasta mostrar (`formatearCLP`, FR-008).

| Ítem | Cantidad | Precio |
|---|---|---|
| Sugerido por stock bajo | `presentacionesSugeridas` | del insumo |
| Sugerido solo caducado | — ("Sin cantidad") | del insumo |
| Manual vinculado a un insumo activo | `item.cantidad` (unidades de compra) o "Sin cantidad" | del insumo |
| Manual sin vínculo, o con el insumo dado de baja | — | "Sin precio" |

Si no hay precio, el ítem dice "Sin precio" aunque tampoco tenga cantidad (se cuenta una sola vez, como
"sin precio").

## R4 · Abrir WhatsApp: enlace `wa.me` en un `<a>` real

**Decisión**: `https://wa.me/<dígitos>?text=<encodeURIComponent(mensaje)>`; sin número,
`https://wa.me/?text=…` (WhatsApp pide elegir el chat). `proveedores.whatsapp` ya guarda solo dígitos con
código de país (021 R10), listo para el enlace.

El botón final de la hoja de envío es un **`<a href target="_blank" rel="noopener noreferrer">`** con
aspecto de botón, no un `window.open` desde JS:

- es un toque directo de la persona, así que ningún navegador lo bloquea como ventana emergente;
- en Android e iOS (también con la PWA instalada) `wa.me` es un enlace universal que abre la aplicación
  de WhatsApp; en desktop abre WhatsApp Web o la aplicación de escritorio si está instalada;
- sin conexión, el sistema igual entrega el enlace a WhatsApp, que encola el mensaje.

`encodeURIComponent` codifica tildes, "ñ", "&", "#", "?" y saltos de línea (`%0A`), que WhatsApp
respeta (Edge Case de caracteres especiales).

**Largo**: no hay un límite documentado; en la práctica los enlaces de más de ~4.000 caracteres fallan
en algunos navegadores y en WhatsApp Web. Si el enlace pasa de **4.000 caracteres** (≈ 60–100 renglones
según los nombres), la hoja no muestra el botón de WhatsApp: avisa "La lista es muy larga para
WhatsApp. Cópiala y pégala en el chat." y ofrece "Copiar" (FR-016).

**Alternativas**: `api.whatsapp.com/send` (mismo efecto, enlace más largo); `whatsapp://send` (no
funciona en desktop sin la aplicación); Web Share con WhatsApp como destino (no permite fijar el
contacto).

## R5 · Formato del mensaje

```text
<saludo>

- Anestesia Articaína — 2 cajas
- Guantes de nitrilo M — 3 cajas
- Eyectores — 3
- Fresas diamante
```

**Decisión**:

- Saludo del tenant, una línea en blanco y un renglón `- ` por ítem seleccionado, en el orden de la
  pantalla (sugeridos y luego manuales).
- Cantidad: `formatearCantidad(n, unidadCompra)` ("2 cajas"), **sin** la equivalencia en unidades de
  consumo: la casa dental vende por presentación. Manual sin insumo vinculado: el número tal cual
  ("Eyectores — 3"). Sin cantidad: solo el nombre.
- Vista "Todos": ` (Lugar)` al final del renglón (FR-011).
- Nunca precios, montos, "Sugerido" ni "Manual" (FR-010). La nota de un ítem manual no va (es interna).
- Un solo constructor, `construirMensajePedido`, para WhatsApp, Copiar y Compartir (FR-012). Reemplaza a
  `construirTextoCompartir`.

## R6 · Deuda: los propios por upsert; los ajenos cambiados aquí, por UPDATE

**Hallazgo** (spec 012 R4, corregido al implementar): `pushItemsCompra` subía **todas** las filas del
tenant en un upsert. La política de INSERT exige `creado_por = auth.uid()`. La 012 suponía que Postgres
solo aplica ese `WITH CHECK` a las filas que de verdad se insertan; **no es así**: lo aplica a todas las
filas propuestas de un `INSERT … ON CONFLICT DO UPDATE`, también a las que terminan en UPDATE
(comprobado en `test:rls`: el upsert de un ítem ajeno que ya existe devuelve `42501`). Como el pull trae
los ítems de todo el tenant, en cuanto un dispositivo tiene un ítem de otra persona **la subida entera
de `items_compra` falla en cada ciclo**, también la de los ítems propios.

**Decisión**:

1. Ítem local con marca `cambioLocal: true` (solo en Dexie, sin versión nueva) cuando se crea, se marca
   comprado (recepción o sin inventario) o se elimina en este dispositivo.
2. Los **propios** (`creadoPor === usuario actual`) suben en un upsert, como antes (nunca chocan con la
   política de INSERT).
3. Los **ajenos** suben solo si tienen `cambioLocal`, uno por uno con **UPDATE** (`update().eq('id')
   .select('id')`), que pasa la política "actualizar en el tenant" y nunca crea filas. Si el ítem
   todavía no está en el servidor (su autora no sincronizó), actualiza 0 filas y queda pendiente para el
   próximo ciclo, sin error. Un rechazo por permisos se informa con `reportarErrorSync` y no marca el
   ciclo; cualquier otro error, sí.
4. La marca se limpia si la fila no cambió mientras subía (`mismaFila`), y el pull **no pisa** un ítem
   con `cambioLocal` (si el UPDATE falló, el cambio local no se pierde).

**Alternativas**: reintentar el upsert fila por fila (sigue fallando con cualquier ajeno, exista o no);
una política de INSERT más laxa (permitiría crear ítems a nombre de otra persona, Constitución VI);
una bandera `sincronizado` completa para `items_compra` (más cambios que la deuda; los propios siguen
subiendo enteros cada ciclo, como desde la spec 009).

## R7 · Hoja de envío: reutilizar la lista de proveedores, no `SelectorProveedor`

**Decisión**: "Enviar por WhatsApp" abre una `BottomSheet` "Enviar pedido" con:

- la lista de proveedores activos (`activos(proveedores)` de la 021) como opciones de radio de ≥ 48 px,
  con el predeterminado del lugar (`usePredeterminado`) ya elegido; los que no tienen WhatsApp dicen
  "Sin WhatsApp"; con más de 8, un buscador arriba (`buscarProveedores`);
- una vista previa del mensaje (solo lectura, recortada a unas líneas);
- el botón-enlace "Abrir WhatsApp" (R4) y, debajo, el aviso si el proveedor no tiene número o el enlace
  es muy largo.

`SelectorProveedor` no sirve tal cual: agrega proveedores y obliga a elegir uno, mientras que aquí se
puede enviar sin proveedor (sin catálogo) y no tiene sentido crear uno al enviar.

En la vista "Todos" no hay lugar activo; se preelige el predeterminado del último lugar activo
(`lugarStore`) si lo tiene.

## R8 · Resumen y acciones: barra fija al pie de Compras

**Decisión**: un `ResumenSeleccion` fijo al pie de la pantalla de Compras (encima de la barra inferior
en teléfono; al pie del contenido en tablet y desktop), con:

- "3 seleccionados · Subtotal estimado $45.990" y, debajo, "1 ítem sin precio · 1 sin cantidad" si hay;
- el rótulo completo "Subtotal estimado (precios de la última compra)" como texto accesible
  (`aria-label`) y visible en tablet y desktop; en teléfono, "Subtotal estimado" con el detalle en una
  línea pequeña;
- "Enviar por WhatsApp" (primario) y un menú/botones "Copiar" y "Compartir" (secundarios), DS §33;
- sin selección: botones deshabilitados y el texto "Selecciona lo que vas a pedir" (FR-012).

"Seleccionar todo" va como una casilla en la cabecera de la lista (encima de "Sugeridos"), con estado
indeterminado si hay algunos marcados. Cada tarjeta gana una casilla a la izquierda (≥ 48 px) y, si está
seleccionada, el monto o "Sin precio"/"Sin cantidad" a la derecha del texto de pedido.

## R9 · Saludo en Ajustes: dentro de la sección Proveedores

**Decisión**: una tarjeta "Mensaje del pedido" al comienzo de Ajustes → Proveedores (solo
administración, como la sección), con un `textarea` de 4 líneas, contador "123/500", "Guardar" y
"Restablecer". Es la sección donde ya se configuran los contactos a los que va el mensaje; una sección
propia para un solo campo agregaría una tarjeta más al índice. El resumen de la sección en el índice no
cambia.
