# Research: Mejoras de UX en Nuevo insumo, perfil y tabla de inventario

## R1 — Campos dobles de cantidad (FR-004/005)

**Decision**: un componente nuevo `CantidadDobleField` (en `features/insumos/components`) con dos
`NumeroInput` lado a lado (compra | consumo), sin botones +/−. El valor controlado es **lo escrito y
en qué unidad** (`CantidadTecleada`). El otro campo se calcula y se muestra con hasta 2 decimales y
"≈" si no es exacto. Al cambiar el contenido se recalcula el campo no editado (spec US1 AC5). Con
unidades iguales se usa el `Stepper` de siempre. Sin contenido válido, el campo de compra queda
deshabilitado. Los inputs usan `step="any"` (con un `step` entero, un valor calculado decimal
bloquearía el envío del formulario) y los decimales no permitidos se rechazan al escribir. Detalle en
data-model.md.

**Rationale**: dos steppers con ± no caben lado a lado en 480 px sin quedar bajo 48 px. Guardar en
unidad de consumo evita la ambigüedad actual de `unidadStockInicial`.

**Alternatives considered**: extender `CantidadIngresoField` (selector de unidad + equivalencia). Se
descarta porque lo usan Ingreso y la recepción de Compras, que quedan fuera de alcance. Además, el
selector es justo lo que la idea pide reemplazar.

**Compatibilidad**: el stock inicial se guarda en la unidad en que se escribió
(`stockInicial` + `unidadStockInicial`). `stockInicialDe`/`convertirIngreso` siguen igual, así que el
lote conserva `cantidadIngresada`/`unidadIngresada` exactos. Los mínimos se guardan en unidad de
consumo. En Alta, el mínimo va antes que el stock inicial, como hasta ahora (`ORDEN_CAMPOS`).

## R2 — Dónde se aplica el campo doble

**Decision**: Nuevo insumo (stock inicial y stock mínimo) y Editar insumo (mínimo del catálogo y
mínimo del lugar). "Stock mínimo por insumo" en Ajustes queda como está.

**Rationale**: la spec pide los mismos campos en Nuevo y Editar. Ajustes es una lista de muchos
insumos con steppers compactos, y ahí el campo doble no cabe.

## R3 — Rótulos y ejemplo

**Decision**: los textos viven en `PresentacionFields` (compartido por Alta y Editar), así que se
cambian una vez. El ejemplo es un `<details>` en `AltaMaterialView`, encima de la presentación, con
`summary` de 48 px. `contenido.ts` (guía, spec 030) se actualiza: "completa nombre, categoría y cómo lo
usas".

## R4 — Ocultar el código de barras (FR-006)

**Decision**: se quita el `IconField` de `AltaMaterialView` y de `EditarInsumoForm` detrás de una
constante `MOSTRAR_CODIGO_BARRAS = false` en `src/lib/scanner/`, junto al escáner oculto. Editar sigue
mandando `codigoFabricante` con el valor original, que ya está en el estado inicial, así que no se
borra. La verificación de código duplicado queda inactiva mientras el campo no se muestre.

## R5 — Editar el nombre propio (FR-009)

**Decision**: RPC `actualizar_mi_nombre(p_nombre text)` `security definer` que hace
`update perfiles set nombre = trim(p_nombre) where id = auth.uid() and desactivado_en is null`.
Valida 1–80 caracteres (`nombre_invalido`) y rechaza a usuarios desactivados (`42501`). No se agrega
una policy de update a `perfiles` para el propio usuario.

**Rationale**: una policy `update ... using (id = auth.uid())` permitiría también cambiar `rol`,
`tenant_id` o `desactivado_en`. Habría que agregar privilegios por columna o un trigger. La RPC es
una sola superficie, fácil de probar en `test:rls`, y sigue el patrón de `revocar_invitacion`.

**Online-only**: igual que `guardarNombreTenant` y Equipo (`SIN_CONEXION`). Los perfiles no tienen
cola de subida, y una cola solo para esto agregaría conflictos con los cambios de rol que hace
administración. Es una excepción acotada a la Constitución I: no es una operación clínica. Ver
Constitution Check.

**Propagación**: tras guardar, `authStore.actualizarNombre(nombre)` actualiza `usuarioActual` y
`usuariosConocidos`. En los otros dispositivos de la persona, el chequeo de perfil del sync
(`revisarPerfil` en `src/lib/sync/index.ts`, que ya refresca rol y desactivación) también refresca el nombre.

**Historial**: los movimientos guardan `usuarioId` y el nombre se resuelve al mostrar
(`useNombreAutor`), así que el nombre nuevo aparece en todo el historial. La spec se corrigió para
decir esto.

## R6 — Menú del avatar (FR-007/008/014)

**Decision**: componente `MenuPerfil` (popover propio, sin librería): botón avatar con
`aria-haspopup="menu"`/`aria-expanded`, panel `role="menu"` con `menuitem`s, cierre con click fuera y
Escape, foco al primer ítem al abrir y vuelta al avatar al cerrar. Lo usan `AppHeader` (móvil, 34 px
visibles dentro de un área táctil de 48) y `TopBar` (desktop). "Cerrar sesión" llama al mismo
`useLogout().signOut` de `PerfilSection`.

**"Ver perfil"**: nueva función `irASeccionAjustes(id)` en `useVista`. Hace `setVista('mas')` y luego
`abrirSeccion(id)` (hash `#ajustes/perfil`) y emite `popstate`, para que un `AjustesView` ya montado
(`useSeccionAjustes` escucha `popstate`) también la abra. `AppShell` recibe la función y la pasa al
encabezado.

**Alternatives considered**: `BottomSheet` en móvil. Se descarta porque la spec pide un menú pequeño
anclado al avatar, y dos opciones no justifican una hoja.

## R7 — Encabezado fijo de la tabla (FR-011)

**Decision**: el contenedor de `InventarioTabla` pasa de `overflow-x-auto` a `overflow-x-clip`, y cada
`<th>` pasa a `sticky top-[72px] z-10 bg-surface` (72 px = alto de `TopBar`, que ya es `sticky top-0
z-20`). Las columnas de texto largo (Producto, Presentación) pueden partirse en varias líneas para que
la tabla quepa en el ancho de contenido desde 1200 px.

**Rationale**: un ancestro con `overflow-x: auto` es un contenedor de scroll y el `sticky` queda
relativo a él, no a la página. `overflow: clip` no crea contenedor de scroll. La tabla solo existe en
`desktop` (≥ 1200 px) con páginas de 25 filas (`TAMANO_PAGINA`).

**Verificación (T022, 2026-11-24)**: a 1440 px la tabla cabe y el encabezado queda fijo. A 1200 px con
la sidebar expandida **no cabe**: la tabla necesita 1076 px y el contenedor tiene 895, así que se corta
Acciones. Se probó la alternativa del contenedor con scroll propio: el encabezado se esconde detrás de
la `TopBar` en cuanto baja la página y Acciones queda detrás de un scroll horizontal, así que se
descartó.

**Decision final (elegida por la clienta)**: modo según el ancho medido (`useModoTabla`, con
`ResizeObserver`):

| Modo | Cuándo | Cómo se ve |
|---|---|---|
| `normal` | La tabla cabe | Como hoy, con `th` fijo a la página |
| `compacta` | No cabe en normal | Padding 10 px, encabezados en dos líneas y "Consumir" como ícono `PackageMinus` (con `aria-label` y `title`). `th` fijo a la página. A 1200 px cabe en los 895 px (con 12 px de padding necesitaba 901) |
| `desborda` | Ni compacta cabe (nombres largos sin espacios) | `overflow-x-auto` como antes de esta spec, sin `th` fijo, para no cortar columnas |

Se mide `offsetWidth` de la tabla (con `w-full` crece solo si su contenido mínimo no entra) contra
`clientWidth` del contenedor. `scrollWidth` daba falsos positivos. La decisión parte del modo que
está dibujado (`data-modo`), no del estado de React, porque el observador puede medir antes de que se
pinte el cambio. Para volver a `normal` se compara con el ancho que necesitaba la normal, lo que evita
el parpadeo.

**Alternatives considered**: contenedor con `max-height` y scroll propio (descartado en la
verificación); encabezado fijo solo cuando cabe (sin encabezado fijo entre 1200 y ~1400 px).

## R8 — Títulos en el nombre (agregado al implementar US2)

**Decision**: las iniciales del avatar y el saludo de Inicio saltan las palabras abreviadas con punto
("Dra. Ana Pérez" → "AP" y "¡Hola, Ana!"), salvo que el nombre sea solo eso
(`src/app/iniciales.ts`). Antes daban "DA" y "¡Hola, Dra.!".

**Rationale**: al poder editar su nombre, es esperable que dentistas agreguen "Dr."/"Dra.". El ejemplo
de la spec (US2) ya suponía "AP".

**Otros ajustes**: `AppHeader`/`TopBar` reciben `onVerPerfil` opcional. Sin él (tests que los
renderizan solos), el menú no ofrece "Ver perfil".

