# Research: Ajustes por secciones

**Feature**: 019-ajustes-por-secciones | **Date**: 2026-10-22

No quedaron `NEEDS CLARIFICATION`: la spec se aclaró el 2026-10-22 (recarga, mínimo por lugar activo,
desktop). Estas son las decisiones de diseño, tomadas tras leer el código actual (`AjustesView`,
`App.tsx`, `ConfiguracionAlertasSection`, `EditarInsumoForm`, `minimos.ts`, `sync/index.ts`,
`sync/paginar.ts`).

## R1 — Dónde vive la sección abierta (FR-005, FR-006)

**Hallazgo**: la app no tiene rutas. `App.tsx` guarda la vista en `useState<Vista>('inicio')`, así que
al recargar siempre se vuelve a Inicio, y el "atrás" del navegador sale de la app. La única URL que se
lee es `?invitacion=<token>` (`features/auth/invitacion.ts`).

**Decision**: la sección abierta va en el **hash** de la URL, solo para Ajustes: `#ajustes/<id>` (por
ejemplo `#ajustes/categorias`). Un módulo pequeño `src/features/ajustes/lib/seccionUrl.ts`:

- `leerSeccionDeUrl(): IdSeccion | null` — interpreta `location.hash`; ids desconocidos → `null`.
- `abrirSeccion(id)` — `history.pushState({ ajustes: id }, '', '#ajustes/' + id)`.
- `cerrarSeccion()` — si la entrada actual la creó `abrirSeccion` (`history.state?.ajustes`),
  `history.back()`; si no (se llegó recargando con el hash), `history.replaceState(null, '', ruta sin
  hash)`. Así "Volver" y el "atrás" del dispositivo hacen lo mismo y no se acumulan entradas.
- Un hook `useSeccionAjustes()` que lee la sección inicial y escucha `popstate`.

`App.tsx` arranca en `'mas'` si `leerSeccionDeUrl()` no es `null`, y al cambiar a otra vista desde la
navegación limpia el hash con `replaceState` (FR-006: entrar a Ajustes desde el menú abre el índice).

**Rationale**:
- Es lo mínimo que cumple la aclaración 1 (conservar al recargar + "atrás" vuelve al índice) sin
  introducir un router para una sola pantalla.
- El hash no viaja al servidor: Netlify sigue sirviendo `index.html` sin reglas nuevas, y no choca con
  `?invitacion=` (va en `search`).
- No es estado de inventario, así que no va a Zustand ni a Dexie (Constitución II): es estado de
  navegación del componente, igual que `vista`.

**Alternatives considered**:
- `sessionStorage` + `useState`: conserva al recargar, pero el "atrás" del dispositivo seguiría
  saliendo de la app en vez de volver al índice.
- `react-router`: dependencia nueva y migrar todas las vistas; fuera del alcance de la spec.
- Guardar también la vista principal en la URL para toda la app: útil, pero cambia Inicio, Inventario,
  etc., y no lo pide la spec. El hash elegido no lo impide más adelante.

## R2 — Estructura de componentes del índice y las secciones (FR-001–FR-004, FR-007, FR-011)

**Decision**: un registro declarativo `SECCIONES_AJUSTES` en
`src/features/ajustes/lib/secciones.ts`:

```ts
type IdSeccion = 'perfil' | 'lugares' | 'avisos' | 'categorias' | 'baja'
interface SeccionAjustes {
  id: IdSeccion
  titulo: (esAdmin: boolean) => string   // "Perfil y equipo" | "Perfil"
  Icon: ComponentType<IconProps>
  soloAdministracion: boolean
}
```

- `seccionesVisibles(rol)` filtra por rol (FR-011/FR-012). La 021 agrega `'proveedores'` entre
  `categorias` y `baja` (FR-001).
- `AjustesView` muestra el **índice** (`AjustesIndice`, grilla de `TarjetaSeccion`) o la **sección**
  (`SeccionAjustesPantalla`: encabezado con "Volver" + título, y el contenido).
- El contenido reusa los componentes de sección actuales sin cambiar su comportamiento (FR-007):
  - `perfil`: `PerfilSection` + `EquipoSection` (si es admin).
  - `lugares`: `LugaresSection`.
  - `avisos`: `NotificacionesSection` + (admin) niveles de aviso, aviso de cambios sin subir y el nuevo
    `MinimosPorInsumoSection` (R4). `ConfiguracionAlertasSection` se divide: niveles y horas quedan en
    un `AvisosSection`; el editor de mínimos sale a su propio componente.
  - `categorias`: `CategoriasSection`; `baja`: `InsumosBajaSection`.
- Cada sección actual tiene hoy su propio `<h2>`; dentro de la subpantalla el título de la pantalla es
  el `<h1>`/encabezado y los `<h2>` internos se mantienen como subtítulos (en `perfil` y `avisos` hay
  varias partes). Donde el `<h2>` repetiría exactamente el título de la pantalla (Lugares, Categorías,
  Insumos dados de baja), se oculta con una prop `sinTitulo`.

**Rationale**: un solo lugar decide qué secciones existen y quién las ve; el índice, la URL (R1) y las
pruebas leen el mismo registro, así que una sección nueva no puede quedar visible en uno y oculta en
otro.

**Alternatives considered**: un `switch` dentro de `AjustesView` por sección — más simple, pero la regla
de permisos quedaría repetida en el índice y en la validación del hash.

## R3 — Resúmenes de las tarjetas (FR-002, edge cases de datos)

**Decision**: helper puro `resumenSeccion(id, datos)` en `secciones.ts`, alimentado por los stores ya
suscritos (`authStore`, `lugarStore`, `inventoryStore`, `alertasStore`). Textos:

| Sección | Resumen |
|---|---|
| perfil | `"<nombre> · Administradora"` / `"<nombre> · Personal"` |
| lugares | `"1 lugar"` / `"3 lugares"` (activos) |
| avisos | personal: `"Stock bajo y caducidad"` · `"Solo stock bajo"` · `"Solo caducidad"` · `"Desactivadas"`; admin: lo mismo + `" · Avisos a 30, 15 y 7 días"` |
| categorias | `"12 categorías"` / `"1 categoría"` / `"Sin categorías"` (activas) |
| baja | `"3 insumos dados de baja"` / `"1 insumo dado de baja"` / `"Sin insumos dados de baja"` |

- Mientras un store no está listo (`isReady` falso o datos vacíos al arrancar), el helper devuelve
  `null` y la tarjeta muestra solo el título (edge case "datos todavía cargando").
- **Equipo no entra en el resumen**: `listarEquipo` e invitaciones son consultas en línea
  (`EquipoSection` muestra "sin conexión" si fallan). Contar integrantes obligaría a una consulta de red
  cada vez que se abre Ajustes y dejaría el resumen vacío sin red. La spec (FR-002) se ajustó a esto.

**Rationale**: todo sale de IndexedDB vía los stores (Constitución I); los resúmenes se actualizan solos
cuando cambia un dato, porque los stores ya son reactivos (FR-008).

## R4 — Editor de mínimos por insumo (FR-014–FR-021)

**Hallazgo**: hoy `ConfiguracionAlertasSection` lista `useInventoryStore.insumos` (los 73, sin filtro de
activos explícito) y guarda `Insumo.stockMinimo` (catálogo) con `actualizarStockMinimo` en `onBlur`.
`EditarInsumoForm` edita el catálogo siempre y, **solo con varios lugares y uno activo**, además el
mínimo del lugar con `guardarMinimoLugar` (`features/insumos/lib/minimos.ts`). `minimoEfectivo()` ya
resuelve "propio del lugar o el del catálogo".

**Decision**: componente nuevo `MinimosPorInsumoSection` con un helper puro
`filasMinimos(insumos, minimosLugar, seleccion, lugares, busqueda)` en
`src/features/ajustes/lib/minimosEditor.ts` que devuelve, por insumo activo ordenado por nombre:

- `modo: 'catalogo' | 'lugar' | 'todos'`:
  - `'catalogo'` si hay un solo lugar activo → edita `Insumo.stockMinimo` con `actualizarStockMinimo`
    (comportamiento actual, FR-017 último párrafo).
  - `'lugar'` con varios lugares y uno activo → muestra `minimoEfectivo(...)`, `origen: 'lugar' |
    'catalogo'`, y guarda con `guardarMinimoLugar(insumo, lugarId, valor)`; vacío → `null` (vuelve al
    del catálogo, FR-018).
  - `'todos'` → por insumo, una lista `{ lugar, minimo, origen }` para cada lugar activo, solo lectura
    (FR-019).
- **Búsqueda**: `plegar()` de `features/insumos/lib/categorias.ts` (sin tildes ni mayúsculas, ya usado
  por las sugerencias) sobre el nombre; contador "N insumos" / "Ningún insumo coincide con …" (FR-014).
- **Página**: 25 filas y un botón "Ver más" que suma 25 (FR-015). Al cambiar la búsqueda o el lugar se
  vuelve a 25. Es local y de presentación; la 020 puede reemplazarlo por su componente común.
- **Validación**: `validarStockMinimo(valor, unidadMedida)` antes de guardar, con el mismo mensaje que
  la edición del insumo (FR-020). Se mantiene el guardado en `onBlur` del `NumeroInput` (spec 018 ya
  probó que la rueda no lo altera).
- El input se identifica por insumo **y lugar** (`key={insumo.id + lugarId}`), para que al cambiar de
  lugar el `defaultValue` se recargue en vez de quedar el del lugar anterior.

**Rationale**: reusa exactamente las funciones de escritura de la edición del insumo, así que las dos
pantallas no pueden divergir (SC-004), y la lógica de qué mostrar queda en un helper probable sin DOM.

**Alternatives considered**:
- Componente de paginación genérico ya en esta spec: lo diseña la 020 para Inventario, categorías y
  dados de baja; hacerlo aquí adelantaría decisiones de la 020 (páginas vs "Ver más").
- Mostrar el editor en "Todos" como tabla insumo × lugar: con muchos lugares no cabe en móvil; la lista
  por insumo con los lugares debajo sí.

## R5 — Descarga completa de `minimos_lugar` (FR-022, FR-023)

**Hallazgo**: `pullMinimosLugar` hace `client.from('minimos_lugar').select('*')`, que PostgREST corta en
`max_rows` (1.000). `seleccionarTodo` (`sync/paginar.ts`, spec 017) pagina por cursor sobre `id`, pero
`minimos_lugar` no tiene `id`: su clave es `(insumo_id, lugar_id)`.

**Decision**: generalizar `seleccionarTodo` con una opción de **clave compuesta**:

```ts
seleccionarTodo(client, 'minimos_lugar', { clave: ['insumo_id', 'lugar_id'] })
```

- Ordena por `insumo_id, lugar_id` y pide la siguiente página con
  `.or('insumo_id.gt.<a>,and(insumo_id.eq.<a>,lugar_id.gt.<b>)')` (cursor por tupla, no por
  desplazamiento: una fila insertada entre páginas no corre las siguientes).
- Sin opción, sigue igual (`clave: ['id']`), así que los pulls de la 017 no cambian.
- Igual que hoy: ante el error de cualquier página devuelve `data: null` y no se aplica nada
  (FR-023, "no aplicar la tabla a medias"); el filtro `conservarCambioLocal` se mantiene tal cual.
- El cliente falso de pruebas (`tests/helpers/consultaFalsa.ts`) aprende `.or()` con ese patrón y
  `order()` por varias columnas.

**Rationale**: mismo mecanismo y mismas garantías que ya tienen movimientos, lotes y tratamientos
realizados; los ids son UUID, así que el orden lexicográfico es estable.

**Alternatives considered**:
- Paginar por desplazamiento (`range`): más simple, pero una fila insertada o borrada entre páginas
  duplica o salta registros, justo lo que la 017 descartó.
- Paginar por lugar (`eq('lugar_id', x)` + cursor en `insumo_id`): depende de tener la lista de lugares
  completa en ese momento del ciclo, incluidos los desactivados.
- Agregar una columna `id` a `minimos_lugar`: migración innecesaria para una tabla con clave natural.

## R6 — Navegación en tablet y desktop (FR-010)

**Decision**: misma navegación en todos los tamaños (aclaración 3). Índice: `grid-cols-1
md:grid-cols-2 xl:grid-cols-3` dentro de `max-w-5xl`; subpantalla a ancho completo del contenido
dentro de `max-w-3xl` para formularios y listas. Los accesos a Compras y Reportes siguen `md:hidden`
arriba del índice y no se renderizan dentro de una sección (FR-009).

**Rationale**: la barra lateral de desktop (spec 013) ya es la navegación principal; un maestro-detalle
agregaría una segunda columna de menú. Las secciones de Equipo y Lugares necesitan el ancho.

## R7 — Permisos y cambio de rol (FR-012, FR-013)

**Decision**: `AjustesView` calcula `seccionesVisibles(usuario.rol)` en cada render. Si la sección de
la URL no está entre las visibles (personal con `#ajustes/categorias`, o la administradora que pasa a
personal mientras la tiene abierta), un efecto llama `cerrarSeccion()` con `replaceState` y se muestra
el índice. Las partes de administración dentro de secciones compartidas (`perfil`, `avisos`) se
renderizan con `esAdministrador &&`, como hoy.

**Rationale**: el rol ya llega reactivo por `authStore` cuando el sync lo actualiza; no hace falta un
mecanismo nuevo. Es UI: la autorización real sigue en RLS (sin cambios).

## R8 — Pruebas

**Decision**:

- Unit: `secciones.test.ts` (visibles por rol, orden, resúmenes con singular/plural/cero/sin datos),
  `seccionUrl.test.ts` (leer, abrir, cerrar con y sin entrada propia, id desconocido),
  `minimosEditor.test.ts` (modos catálogo/lugar/todos, origen, búsqueda con tildes, orden, inactivos
  fuera), `sync-minimos-lugar-paginacion.test.ts` (más de 1.000 filas, clave compuesta, error en
  página, cambio local sin subir conservado).
- Integration: `ajustes.test.tsx` se reorganiza para entrar por el índice (helper `abrirSeccion(nombre)`)
  y conserva todos sus casos actuales (FR-007, SC-007); casos nuevos de índice, "Volver", `popstate`,
  recarga con hash, personal con hash de admin, cambio de rol. `ajustes-minimos.test.tsx` nuevo:
  buscar, paginar, editar por lugar y ver el mismo valor en la edición del insumo y en la alerta,
  "Todos" solo lectura, un solo lugar → catálogo.
- `navegacion-responsiva.test.tsx`: cambiar de vista limpia el hash.
- Visual: capturas con `run-indentory` del índice y una sección en móvil, tablet y desktop, para
  administración y personal (SC-007).
