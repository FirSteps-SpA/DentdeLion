# Research: Paginación de listas

**Feature**: 020-paginacion-de-listas | **Date**: 2026-10-23

Sin incógnitas técnicas abiertas: no hay dependencias nuevas, servidor ni esquema. Las decisiones son
de diseño del front.

## R1. Un estado de paginación único para "Ver más" y páginas numeradas

**Decision**: un hook `useListaPaginada(items, { clave, modo })` en `src/lib/paginacion.ts` guarda un
solo número, `hasta` (cuántos elementos cubre la vista: grupos cargados con "Ver más" o el final de la
página actual). En modo `'ver-mas'` muestra `items.slice(0, hasta)`; en modo `'paginas'`, la página
`ceil(hasta / 25)`. Funciones puras aparte (`totalPaginas`, `rangoPagina`, `paginasVisibles`,
`textoQuedan`) con `TAMANO_PAGINA = 25`.

**Rationale**: con un solo número, pasar de tarjetas a tabla (o al revés) al cambiar el ancho conserva
la posición aproximada (FR-012) sin estado extra: con 3 grupos cargados (`hasta = 75`) la tabla abre
en la página 3; desde la página 3 las tarjetas muestran 75. Las cuatro listas usan el mismo hook
(FR-001).

**Alternatives considered**: estados separados (`visibles` y `pagina`) — al cambiar de disposición uno
de los dos estaría desactualizado y habría que sincronizarlos; virtualización (react-window) — agrega
una dependencia y no resuelve el pedido de la clienta (la página seguiría siendo larga al desplazarse).

## R2. Volver al comienzo con una clave, sin efectos

**Decision**: el hook recibe `clave` (p. ej. `` `${texto}|${categoria}|${estado}|${lugarActivoId}` `` en
Inventario, `` `${busqueda}|${seleccion}` `` en mínimos). Si cambia, `hasta` vuelve a 25 durante el
render (patrón "ajustar estado al cambiar una prop" que ya usa `MinimosPorInsumoSection`).

**Rationale**: FR-009 y FR-015 sin `useEffect` que pinte primero la página vieja. Abrir el detalle o
usar acciones no cambia la clave, así que la página se mantiene (FR-010).

**Alternatives considered**: `key` en el componente de la lista — también reiniciaría el foco y el
desplazamiento de elementos que no son de la lista.

## R3. Lista que se achica o crece

**Decision**: en modo `'paginas'`, la página mostrada es `min(paginaPedida, totalPaginas)` (calculada,
no guardada), así nunca se ve una página vacía con elementos disponibles; si la lista vuelve a crecer,
se vuelve a la pedida. En `'ver-mas'`, `hasta` no se toca: se muestran los que haya hasta ese número.

**Rationale**: FR-011 y el caso borde "la lista se achica" (baja, consumo que saca un insumo de un
filtro de estado, sincronización). Calcularlo evita efectos y parpadeos.

## R4. Orden estable

**Decision**: Inventario ordena los resultados por `nombre` con `localeCompare(…, 'es', { sensitivity:
'base' })`; Insumos dados de baja, igual. Categorías y mínimos conservan su orden (ya ordenados).

**Rationale**: hoy Inventario e insumos dados de baja salen en el orden de `where('tenantId')` de
Dexie, es decir, por `id` (UUID): aleatorio para la persona. Con páginas, eso haría que "la página 2"
no signifique nada (spec FR-003a). El editor de mínimos ya ordena así.

**Alternatives considered**: ordenar por estado (lo urgente primero) — cambia con cada consumo y mueve
insumos entre páginas; para eso ya están el filtro de estado y el resumen de alertas.

## R5. Detalle del insumo en hoja

**Decision**: Inventario envuelve `InsumoDetalle` en `BottomSheet` ("Detalle del insumo", `enHoja`),
igual que `DetalleDesdeAlerta`. Con todos los usos en hoja, se quita la prop `enHoja` y el botón
"Cerrar detalle" del propio detalle (el cierre lo da la hoja con "Cerrar", fondo o Escape).

**Rationale**: decisión de Clarifications. La lista no se desmonta ni se mueve; al cerrar, el foco
vuelve a la tarjeta o fila que abrió el detalle (lo hace `BottomSheet`). Si el insumo deja de estar
activo, el detalle derivado es `null` y la hoja desaparece (comportamiento actual).

**Riesgo conocido**: `InsumoDetalle` abre `EditarPrecioDialog`, otra `BottomSheet`; Escape cierra las
dos. Ya pasa desde Alertas (spec 018) y se acepta.

**Alternatives considered**: reutilizar `DetalleDesdeAlerta` — exige `vistas` y lugar de la alerta;
Inventario ya tiene sus `lotes` y `movimientos` del lugar activo o de "Todos".

## R6. Foco, desplazamiento y anuncios

**Decision**:
- **"Ver más"** (`VerMas`): tras cargar, el foco pasa al primer elemento agregado (el `<li>` recibe
  `tabIndex={-1}`); el botón muestra "Ver más (quedan N)" y una región `aria-live="polite"` anuncia
  "Se muestran X de Y".
- **Páginas** (`Paginador`, `<nav aria-label="Páginas del inventario">`): al cambiar de página se
  desplaza el comienzo de la tabla a la vista (`scrollIntoView({ block: 'start' })`) y se enfoca su
  `<caption>` (visualmente oculta), que dice "Insumos 26–50 de 200". La página actual lleva
  `aria-current="page"`; anterior/siguiente se deshabilitan en los extremos.
- Números visibles: primera, última, actual ± 1 y "…" (máximo 7 posiciones), para no desbordar en
  1200 px.

**Rationale**: FR-005 y el caso borde de teclado y lectores; Constitución III (todos los controles con
`touch-target`, ≥ 48 px).

## R7. Qué no cambia

- Búsqueda, filtros, resumen de alertas y totales se calculan antes de paginar, sobre todos los
  insumos (FR-008); la paginación solo recorta `filas` al final.
- Ajustes: al volver al índice, la sección se desmonta y su lista empieza de nuevo (FR-016) sin hacer
  nada.
- Salir de Inventario desmonta `InventarioView`: página y filtros se reinician (FR-013).
- Sin cambios en sync, Dexie, Supabase ni RLS.

## R8. Datos de prueba de volumen

**Decision**: `scripts/seed-volumen.mjs` acepta `--insumos N` (hoy fijo en 40) para sembrar 200 en
Supabase local y validar SC-001/SC-002 en la app real. Los tests usan stores con 60–200 insumos
generados.
