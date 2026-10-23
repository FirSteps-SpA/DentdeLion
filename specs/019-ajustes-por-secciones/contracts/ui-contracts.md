# UI Contracts: Ajustes por secciones

**Feature**: 019-ajustes-por-secciones | **Date**: 2026-10-22

Contratos de las piezas que crea o cambia la spec. Los textos visibles son parte del contrato (las
pruebas los buscan por rol y nombre accesible).

## 1. `AjustesView` (cambia)

```ts
AjustesView({ onNavegar?: (vista: Vista) => void })
```

- Sin sección abierta: accesos móviles (Compras, Reportes; `md:hidden`, solo si llega `onNavegar`) +
  `AjustesIndice`.
- Con sección abierta y visible para el rol: `SeccionAjustesPantalla` (sin los accesos móviles).
- Con sección abierta **no** visible para el rol: cierra la sección con `replace` y muestra el índice.

## 2. `AjustesIndice` / `TarjetaSeccion` (nuevos)

- Encabezado de la vista: `<h1>` "Ajustes".
- Lista: `<ul>` con una `<li>` por sección visible; cada tarjeta es un `<button type="button">` cuyo
  nombre accesible es el título (el resumen va como descripción, `aria-describedby`).
- Contenido de la tarjeta: ícono (decorativo, `aria-hidden`), título (`text-h3`), resumen
  (`text-sm text-text-muted`, una línea con `truncate`) y chevron a la derecha.
- Área táctil: toda la tarjeta, alto mínimo 56 px en móvil (para que el índice entre en una pantalla)
  y 72 px desde tablet (≥ 48 px, Constitución III); foco visible del DS.
- Móvil: Compras y Reportes lado a lado en una fila de dos columnas arriba del índice.
- Grilla: 1 columna en móvil, 2 desde `md`, 3 desde `xl`, dentro de `max-w-5xl`.

Títulos por rol:

| id | Administración | Personal |
|---|---|---|
| perfil | Perfil y equipo | Perfil |
| lugares | Lugares de trabajo | — |
| avisos | Notificaciones y avisos | Notificaciones |
| categorias | Categorías | — |
| baja | Insumos dados de baja | — |

Resúmenes: ver research R3.

## 3. `SeccionAjustesPantalla` (nuevo)

- Arriba, en una fila: botón "Volver" (`TouchButton variant="ghost"`, ícono `ArrowLeft`, nombre
  accesible "Volver a Ajustes") y el título de la sección como `<h1>`.
- Al montar, el foco va al `<h1>` (lectores de pantalla y teclado); al volver al índice, el foco va a la
  tarjeta de la sección que se cerró y se restaura el desplazamiento.
- Contenido por sección:

| id | Contenido (orden) |
|---|---|
| perfil | `PerfilSection` (con "Cerrar sesión"); admin: `EquipoSection` |
| lugares | `LugaresSection sinTitulo` |
| avisos | `NotificacionesSection`; admin: `AvisosSection` (niveles de aviso + aviso de cambios sin subir), `MinimosPorInsumoSection` |
| categorias | `CategoriasSection sinTitulo` |
| baja | `InsumosBajaSection sinTitulo` |

## 4. `seccionUrl.ts` (nuevo)

```ts
leerSeccionDeUrl(hash?: string): IdSeccion | null   // '#ajustes/categorias' → 'categorias'
abrirSeccion(id: IdSeccion): void                   // pushState({ ajustes: id }, '', '#ajustes/<id>')
cerrarSeccion(opciones?: { reemplazar?: boolean }): void
limpiarSeccionDeUrl(): void                         // replaceState sin hash (al cambiar de vista)
useSeccionAjustes(): [IdSeccion | null, (id: IdSeccion) => void, () => void]
```

- `cerrarSeccion()`: `history.back()` si `history.state?.ajustes` existe; si no, o con
  `reemplazar: true`, `replaceState` sin hash.
- `useSeccionAjustes` escucha `popstate` y `hashchange`.
- `App.tsx`: estado inicial de `vista` = `'mas'` si `leerSeccionDeUrl()` no es `null`; el
  `onCambiarVista` de `AppShell` llama `limpiarSeccionDeUrl()` antes de `setVista`.

## 5. `MinimosPorInsumoSection` (nuevo, reemplaza el editor de `ConfiguracionAlertasSection`)

- `<h2>` "Stock mínimo por insumo".
- Línea de contexto según el modo:
  - catálogo: ninguna.
  - lugar: "Mínimos de **<lugar>**. Si un insumo no tiene uno propio, usa el general."
  - todos: aviso "Elige un lugar en el encabezado para editar los mínimos." (solo lectura).
- Buscador: `IconField` con ícono `Search`, `type="search"`, etiqueta "Buscar insumo"; debajo,
  `"N insumos"` o `"Ningún insumo coincide con “<texto>”"` + botón "Limpiar búsqueda".
- Fila (modos catálogo y lugar): nombre del insumo; en modo lugar, un `Badge` "Propio" o "General";
  `NumeroInput` (`aria-label="Stock mínimo de <nombre>"`, `min=0`, `step="any"`,
  placeholder "Sin mínimo" en catálogo o `"General (<n>)"` / `"General (sin mínimo)"` en lugar),
  guarda en `onBlur`.
- Fila (modo todos): nombre y, debajo, `"<lugar>: <n> (propio|general)"` por cada lugar activo.
- Error de validación: `role="alert"` bajo la fila, con el texto de `validarStockMinimo`.
- Paginación: 25 filas; botón "Ver más (quedan N)" si hay más. Reinicia a 25 al cambiar búsqueda o
  lugar.

## 6. `seleccionarTodo` (cambia, `src/lib/sync/paginar.ts`)

```ts
seleccionarTodo<T>(client, tabla, opciones?: { clave?: string[]; tamanoPagina?: number })
```

- `clave` por defecto `['id']` (comportamiento actual, sin cambios para los llamados existentes).
- Con dos columnas `[a, b]`: `order(a).order(b).limit(n)` y, desde la segunda página,
  `.or('a.gt.<va>,and(a.eq.<va>,b.gt.<vb>)')`.
- Error en cualquier página → `{ data: null, error }`.
- Se mantiene la firma posicional actual `(client, tabla, tamanoPagina)` mientras existan llamados con
  ella, o se migran todos en la misma tarea.
