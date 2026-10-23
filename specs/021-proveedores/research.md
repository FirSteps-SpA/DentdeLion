# Research: Proveedores

**Spec**: [spec.md](./spec.md) · **Fecha**: 2026-10-23

Decisiones técnicas que resuelven el plan. Cada una: **Decisión**, **Motivo** y **Alternativas**.

---

## R1 — Tabla `proveedores` por tenant con clave normalizada generada

**Decisión**: tabla nueva `public.proveedores` (id, tenant_id, nombre, `clave` generada, whatsapp,
contacto, creado_por, creado_en, desactivado_en, eliminado_en). `clave` es una columna **generada y
guardada** con `public.clave_nombre(nombre)`, una función `immutable` que hace lo mismo que
`claveCategoria` del cliente: trim, sin tildes (incluida la ñ → n, igual que `\p{Diacritic}` tras
`NFD`), minúsculas y espacios colapsados. Índice único `(tenant_id, clave) where eliminado_en is null`.

**Motivo**: FR-002 exige unicidad sin distinguir mayúsculas, tildes ni espacios, y la misma regla la
necesitan el cliente (sin conexión), el trigger que resuelve lotes de la 2.4.0 (R4) y el remapeo de
duplicados (R6). Con la clave guardada, el cliente puede buscar `eq('clave', …)` y el índice impide
duplicados aunque dos dispositivos creen el mismo proveedor sin conexión. La función usa `translate`
sobre un juego cerrado de letras con tilde (español) en vez de la extensión `unaccent`, que no es
`immutable` y no sirve para una columna generada.

**Alternativas**: `unaccent` (no immutable, exige extensión); índice sobre `lower(trim(nombre))` como
`lugares` (no pliega tildes ni espacios internos, no cumple FR-002); clave calculada solo en el cliente
(un cliente 2.4.0 no la manda).

Una prueba unitaria fija la paridad: una lista de nombres ("Dental Sur", " dental  sur", "DENTAL
SÚR", "Peña", "Pena") da la misma clave en `claveNombre` (cliente) y en los casos documentados de
`clave_nombre` (verificados en `test:rls`).

---

## R2 — Predeterminado como columna de `lugares`

**Decisión**: `lugares.proveedor_predeterminado_id uuid null`, con FK compuesta
`(proveedor_predeterminado_id, tenant_id) → proveedores (id, tenant_id) on delete set null`. Se edita
como cualquier cambio de un lugar (solo administración, `sincronizado: false` hasta subir).

**Motivo**: "como máximo uno por lugar" (FR-003) sale gratis de una columna; los permisos y la
sincronización de `lugares` (spec 014) ya son de administración y toleran sin conexión. Una 2.4.0 que
sube un lugar no manda la columna, así que PostgREST no la pisa.

**Alternativas**: tabla `proveedores_predeterminados (lugar_id pk, proveedor_id)` (otra tabla, otro
push y pull, sin ganancia); bandera `predeterminado` en `proveedores` (no permite uno por lugar, que
confirmó Clarifications Q1).

---

## R3 — `lotes.proveedor_id` nuevo, texto conservado e inmutable

**Decisión**: `lotes.proveedor_id uuid null` con FK compuesta `(proveedor_id, tenant_id) →
proveedores (id, tenant_id)` (sin `on delete`: un proveedor con lotes no se borra). Se conserva
`lotes.proveedor text not null` durante un release (FR-019): el cliente nuevo lo sigue escribiendo con
el nombre del proveedor al registrar. Tras la migración, `proveedor_id` no queda nulo en ninguna fila,
pero la columna sigue admitiendo `null` para los inserts de la 2.4.0 (R4). El `not null` y el retiro del
texto van en un release posterior.

En UPDATE, un trigger mantiene `proveedor_id` y `proveedor` como estaban
(`new.proveedor_id := coalesce(old.proveedor_id, new.proveedor_id)`, `new.proveedor := old.proveedor`). *Ajuste al
implementar:* solo cuando escribe un usuario (`auth.uid()` no nulo); la service role puede cambiarlo,
que es lo que usa `proveedores.mjs fusionar`.

**Motivo**: `pushLotes` sube **todos** los lotes en cada ciclo (upsert). Un cliente nuevo recién
actualizado tiene `proveedorId: null` hasta su primer pull y, sin la protección, borraría el vínculo
que dejó la migración. Una 2.4.0 sube su texto viejo después de un renombrado. Cambiar el proveedor de
un lote está fuera de alcance, así que no hace falta otra regla. El cliente nuevo, además, omite
`proveedor_id` del upsert cuando es `null`.

**Alternativas**: reemplazar el texto por el id de una vez (rompe las 2.4.0 en caché); actualizar el
texto de los lotes al renombrar (las 2.4.0 lo pisarían igual en su siguiente ciclo; el cliente nuevo
muestra el nombre por id).

---

## R4 — Lotes de la 2.4.0: el servidor resuelve el proveedor por nombre

**Decisión**: trigger `before insert` en `lotes`, `resolver_proveedor_lote()` (`security definer`): si
`proveedor_id` es nulo, busca en el tenant del lote un proveedor no eliminado con
`clave = clave_nombre(new.proveedor)` (activo o desactivado, sin reactivarlo: US5-3). Si no hay, crea
uno con `creado_por = auth.uid()` y el texto recortado como nombre (un texto vacío da "Sin proveedor").
Si `proveedor_id` viene y el texto está vacío, completa el texto con el nombre del proveedor.

*Ajuste al implementar:* un upsert de un lote que ya existe también dispara los triggers `before
insert` aunque termine en UPDATE. Sin cuidado, una 2.4.0 que resube sus lotes con el texto viejo tras un
renombrado crearía un proveedor nuevo. El trigger ignora los lotes cuyo id ya existe.

**Motivo**: FR-020. Los dispositivos con la 2.4.0 en caché siguen registrando texto hasta que cargan
la versión nueva (roadmap, "Riesgo"). Resolverlo en el servidor es lo único que funciona sin tocar a
esos clientes, y `security definer` deja que el personal cree el proveedor implícito (lo mismo que
podría hacer desde el selector, Clarifications Q4).

**Alternativas**: rechazar lotes sin `proveedor_id` (perdería registros de la 2.4.0); resolverlo en
el cliente nuevo al bajar (los lotes quedarían sin proveedor en el servidor hasta que algún
dispositivo nuevo sincronice, y dos dispositivos podrían crear dos proveedores distintos).

---

## R5 — Migración de datos y fusiones decididas por la clienta

**Decisión**: una migración `supabase/migrations/20261023000000_proveedores.sql` en una transacción:
crea la función, la tabla, las columnas, los triggers y las políticas; luego, por tenant, inserta un
proveedor por cada `clave_nombre(proveedor)` distinta de `lotes`, con el nombre escrito más usado
(desempate: el más antiguo) y `creado_por` = quien registró el ingreso del lote más antiguo con ese
nombre (`lotes` no guarda autor; si no hay ingreso, el administrador más antiguo del tenant), y asigna
`proveedor_id` a cada lote. Al final verifica que no quede ningún lote sin proveedor (`raise exception`
si queda alguno) y que la cantidad de lotes no cambió.

Las fusiones de la clienta (FR-017) van fuera de la migración, con un script de servicio
`scripts/proveedores.mjs`:

- `listar`: antes de migrar, lista por tenant los textos distintos de `lotes.proveedor`, su clave y
  cuántos lotes tiene cada uno, para enviárselos a la clienta.
- `fusionar --tenant <id> --a "<nombre final>" --de "<nombre>" [--de …]`: después de migrar, mueve
  los lotes y los predeterminados de los proveedores `--de` al `--a`, marca los `--de` como eliminados
  (R7) y renombra el `--a` si hace falta. Es idempotente y se ensaya en la misma restauración.

**Motivo**: las migraciones del repo se aplican igual en todos los entornos; las decisiones de una
clienta son datos de un tenant, no esquema. Separarlas permite ensayar ambas cosas sobre la
restauración del respaldo de producción (FR-018) y repetir la fusión si la clienta cambia de idea.

**Alternativas**: un mapa de fusiones dentro de la migración (datos de producción en el repo y en
cada entorno); fusionar desde la app (la spec deja fuera fusionar proveedores en la app, Edge Cases).

---

## R6 — Sincronización de proveedores y duplicados creados sin conexión

**Decisión**: tabla Dexie `proveedores` con `sincronizado: boolean` (patrón de `lugares`). En
`ejecutarCiclo`, antes de los lugares:

1. `pushProveedores`: sube las filas pendientes del tenant actual. Administración usa `upsert`; el
   personal solo crea, así que usa `insert` (no necesita la política de UPDATE).
   - **Duplicado** (`23505` por la clave): consulta el proveedor del servidor con esa `clave` y
     **remapea** en una transacción local: los lotes y los predeterminados que apuntan al id local
     pasan al del servidor, y la fila local se borra. Así quedan unidos dos proveedores creados con el
     mismo nombre en dos dispositivos (Edge Cases) antes de que `pushLotes` los use.
     *Ajuste al implementar:* solo si el servidor **no** tiene ya esa fila por id. Si la tiene, el
     `23505` es un renombrado que choca con otro proveedor: no se remapea (eso fundiría dos proveedores
     que en el servidor siguen separados); el cambio se descarta, el pull trae la versión del servidor
     y se avisa ("El cambio en «X» no se guardó: ya existe un proveedor con ese nombre.").
   - **Rechazo de permisos** (personal que intentó editar): la fila queda pendiente, y como
     `conservarCambioLocal` no protege a quien no es administrador, el pull la pisa con la del
     servidor.
2. `pullProveedores` con `seleccionarTodo` (paginado por cursor, spec 017/019), sin pisar cambios
   locales pendientes de administración (`conservarCambioLocal`).

Después siguen `pushLugares`/`pullLugares` (el predeterminado referencia al proveedor) y, más
adelante, `pushLotes` (FK de `proveedor_id`). `pullLotes` trae `proveedor_id` de los lotes viejos.

**Motivo**: FR-009 y FR-021. El proveedor debe llegar antes que el lote y el lugar que lo usan. El
remapeo hace converger los duplicados de forma determinista (Constitución I), sin perder lotes.

**Alternativas**: RPC `crear_o_obtener_proveedor` (no funciona con la escritura local primero: el id
del lote ya está escrito con el id local); dejar duplicados y fusionarlos a mano (contradice SC-004).

---

## R7 — Permisos, desactivar y eliminar

**Decisión**:

- RLS: leer del tenant; **insertar cualquier miembro activo como sí mismo** (`creado_por =
  auth.uid()`), y la política "pendiente previo a la desactivación" igual que en `lotes`; **actualizar
  solo administración**. Sin política de DELETE.
- **Eliminar** es una baja lógica: `eliminado_en` con fecha (la fila sigue en el servidor para que todos
  los dispositivos se enteren por el pull, que no borra filas). Un trigger `proteger_proveedor()`
  rechaza poner `eliminado_en` si el proveedor tiene lotes (`proveedor_con_lotes`) y mantiene
  inmutables `tenant_id`, `creado_por` y `creado_en`. Un eliminado no aparece en ninguna lista y libera
  su nombre (el índice único excluye eliminados).
- **Desactivar** (`desactivado_en`): el mismo trigger, al desactivar o eliminar, pone en `null` los
  `lugares.proveedor_predeterminado_id` que lo usaban (FR-013). El cliente hace lo mismo localmente en
  la misma transacción.
- La UI ofrece "Eliminar" solo si no hay lotes locales con ese proveedor (índice `proveedorId` en
  Dexie). Si el servidor lo rechaza igual (un lote que todavía no llegó a este dispositivo), la baja se
  revierte en el siguiente pull y se avisa con "No se pudo eliminar «X»: tiene lotes".

**Motivo**: Clarifications Q4 (cualquiera agrega, solo administración administra) y FR-011 ("no se
borra si tiene lotes"). La baja lógica es la única forma de propagar una eliminación hecha sin conexión
con el pull actual.

**Alternativas**: DELETE físico (otro dispositivo nunca se entera, porque el pull no borra); permitir
eliminar con lotes reasignándolos (fuera de alcance).

---

## R8 — Selector de proveedor en los formularios

**Decisión**: componente nuevo `SelectorProveedor` (`src/features/proveedores/components`): un campo
con aspecto de botón (≥ 48 px) que muestra el proveedor elegido o "Elige un proveedor", y que abre un
`BottomSheet` con:

- un buscador con foco (filtra con `plegar`, igual que categorías), la lista de activos en orden
  alfabético (filas de 48 px, sin paginar: se filtra escribiendo),
- "Agregar proveedor «texto»" cuando la clave del texto no coincide con ningún activo,
- y si coincide con un desactivado: "«X» está desactivado", con "Reactivar y usar" solo para
  administración.

Agregar escribe el proveedor en Dexie de inmediato (`crearProveedor`) y lo deja elegido. Si el
formulario se abandona, el proveedor queda en el catálogo, igual que si se hubiera creado en Ajustes.

Los formularios guardan `proveedorId` en vez del texto. El valor inicial es el predeterminado del lugar
del registro: en el alta, el `lugarId` elegido (o el activo), y se actualiza al cambiar el lugar si la
persona no tocó el campo; en la recepción, el lugar del ítem de compra. La validación sigue diciendo
"Ingresa el proveedor." (mismo id de error y mismo lugar). El lote se guarda con `proveedorId` y
`proveedor` = nombre actual del proveedor.

El borrador del alta (`useBorradorAlta`) pasa a guardar `proveedorId`; un borrador viejo con texto se
resuelve por clave al cargarlo (si no coincide con ninguno, el campo queda en el predeterminado).

**Motivo**: FR-005 a FR-009. Un `<select>` nativo no tiene buscador ni "Agregar" en línea. Una hoja
con la lista completa es cómoda con guantes (Constitución III), y con 50 proveedores elegir otro toma
3 toques (SC-002). La búsqueda manual sigue siendo el camino principal (Constitución V).

**Alternativas**: `<select>` + "Nuevo proveedor…" como categorías (sin buscador, incómodo con 50);
`<datalist>` (no se puede estilar ni ofrecer "Agregar", y en Android es irregular); combobox en línea
debajo del campo (en teléfono queda tapado por el teclado).

---

## R9 — Sección Proveedores en Ajustes

**Decisión**: `'proveedores'` en `SECCIONES_AJUSTES` entre `categorias` y `baja`, `soloAdministracion:
true`, ícono `Truck`. El resumen de la tarjeta es "N proveedores" (activos). `ProveedoresSection`:

- Lista de activos en orden alfabético con `useListaPaginada` + `VerMas` (spec 020). Cada fila muestra
  el nombre, el WhatsApp con formato legible y el contacto si los hay, y una insignia
  "Predeterminado" por cada lugar donde lo es (con el nombre del lugar si el tenant tiene más de uno).
- "Agregar proveedor" y tocar una fila abren una hoja con nombre, WhatsApp y contacto y, debajo,
  "Predeterminado en" con un interruptor por lugar activo. Activarlo para un lugar reemplaza al
  anterior de ese lugar. Acciones: Guardar, Desactivar o Reactivar y Eliminar (solo sin lotes).
- "Desactivados (N)" plegable al final de la lista, con "Reactivar".

**Motivo**: FR-010 a FR-016 y la estructura de la 019 (índice, tarjeta, subpantalla). Un interruptor
por lugar resuelve "el predeterminado del lugar activo" también en la vista "Todos", sin depender del
lugar activo.

**Alternativas**: marcar el predeterminado solo para el lugar activo (en "Todos" no habría a cuál);
una pantalla aparte por proveedor (más navegación para 3 campos).

---

## R10 — Teléfono de WhatsApp

**Decisión**: `normalizarWhatsapp(texto)` en `src/features/proveedores/lib/whatsapp.ts`: quita todo lo
que no sea dígito. Si el texto empezaba con `+` o los dígitos ya empiezan con `56` y suman 11, se deja
como está; si no, se antepone `56`. Es válido con 10 a 15 dígitos. Vacío = `null`. Se muestra como
`+56 9 1234 5678` para Chile y como `+<dígitos>` para otros países. El servidor tiene el `check
(whatsapp ~ '^[0-9]{10,15}$')`.

**Motivo**: FR-015 y lo que necesita la 022 (`https://wa.me/<dígitos>`, sin `+`). Chile por defecto
(Assumptions).

**Alternativas**: librería de teléfonos (`libphonenumber-js`, ~100 kB para un campo opcional; la pila
pide justificar dependencias).

---

## R11 — Nombre del proveedor en el detalle del insumo

**Decisión**: en `InsumoDetalle`, cada lote muestra "Lote A123 · Dental Sur — vence 3 nov 2026". El
nombre sale del mapa `proveedores` del `inventoryStore` por `lote.proveedorId`; si el lote todavía no
tiene `proveedorId` (antes del primer pull) o el proveedor no está en el dispositivo, se usa
`lote.proveedor` (texto). Los selectores de lote de consumo y traslado no cambian.

**Motivo**: Clarifications Q5 y FR-014. El respaldo en el texto evita un hueco en la ventana entre la
actualización de Dexie y el primer pull.

**Alternativas**: solo por id (se vería vacío sin conexión justo después de actualizar).

---

## R12 — Dexie v13 y retiro de `configuracion_clinica`

**Decisión**: `db.version(13)`:

- `proveedores: 'id, tenantId, sincronizado'` (nueva).
- `lotes`: se agrega el índice `proveedorId` (para "¿tiene lotes?" en R7).
- `configuracionClinica: null` (se borra la tabla local).
- `upgrade`: `lote.proveedorId ??= null`, `lugar.proveedorPredeterminadoId ??= null`.

En el servidor, la migración hace `drop table public.configuracion_clinica` (con sus políticas). Se
quitan sus usos en `tenancy` (limpieza al cambiar de tenant), en `test-rls.mjs`, en los helpers y en los
mocks de pruebas. `tenancy` agrega `proveedores` a la limpieza de filas sincronizadas de otro tenant.

**Motivo**: deuda de la 014 (R7 de esa spec, roadmap). Desde la 014 ningún cliente la lee ni la sube:
la 2.4.0 no la toca, así que borrarla no rompe a los clientes en caché. Va en esta spec porque ya trae
migración y versión nueva de Dexie.

**Alternativas**: dejarla otro release más (la deuda sigue creciendo en mocks y pruebas).

---

## R13 — Publicación

**Decisión**: orden de despliegue:

1. Ensayo completo sobre una restauración del respaldo de producción: `proveedores.mjs listar`,
   migración, `fusionar` con la lista de la clienta, verificaciones de SC-003 y una 2.4.0 local que
   registra un lote (SC-006).
2. En producción: respaldo, migración, fusiones y luego el front (2.5.0).

La migración funciona con el front anterior: la 2.4.0 sigue escribiendo texto (R4) y no manda
`proveedor_id` (R3). La columna de texto se retira en una spec posterior, cuando todos los
dispositivos de la clienta muestren la 2.5.0.

**Motivo**: es la única spec con migración de datos de la tanda (roadmap, "Riesgo"); el servidor
primero deja una ventana segura en la que conviven los dos clientes.

**Alternativas**: front primero (el cliente nuevo fallaría al subir `proveedor_id` a una columna que no
existe).
