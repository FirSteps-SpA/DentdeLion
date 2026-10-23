# UI Contracts: Paginación de listas

**Feature**: 020-paginacion-de-listas | **Date**: 2026-10-23

## `src/lib/paginacion.ts`

```ts
export const TAMANO_PAGINA = 25

export type ModoPaginacion = 'ver-mas' | 'paginas'

export function totalPaginas(total: number): number
export function paginaDe(hasta: number, total: number): number
export function rangoPagina(pagina: number, total: number): { desde: number; hasta: number }
export function paginasVisibles(actual: number, total: number): (number | '…')[]
export function textoQuedan(n: number): string

export function useListaPaginada<T>(
  items: T[],
  opciones: { clave: string; modo: ModoPaginacion },
): {
  visibles: T[]          // lo que se renderiza
  total: number
  quedan: number         // solo 'ver-mas'
  pagina: number         // solo 'paginas' (1-based, ya acotada)
  paginas: number
  hayControles: boolean  // total > TAMANO_PAGINA (FR-002)
  verMas: () => void
  irAPagina: (p: number) => void
  indicePrimerNuevo: number | null  // para enfocar tras "Ver más" (R6)
}
```

Reglas: `items` llega **ya filtrado y ordenado**; el hook no filtra ni ordena. `TAMANO_PAGINA_MINIMOS`
desaparece y `MinimosPorInsumoSection` usa `TAMANO_PAGINA`.

## `src/components/ui/VerMas.tsx`

```ts
interface VerMasProps {
  quedan: number
  mostrados: number
  total: number
  onVerMas: () => void
}
```

- No renderiza nada si `quedan === 0`.
- `TouchButton variant="secondary"`, texto "Ver más (quedan N)" / "Ver más (queda 1)".
- Región `aria-live="polite"` (visualmente oculta): "Se muestran {mostrados} de {total}".

## `src/components/ui/Paginador.tsx`

```ts
interface PaginadorProps {
  pagina: number
  paginas: number
  total: number
  etiqueta: string           // aria-label del <nav>, p. ej. "Páginas del inventario"
  onIrAPagina: (p: number) => void
}
```

- `<nav aria-label>` con "Anterior", números de `paginasVisibles` ("…" no es botón), "Siguiente" y el
  texto "26–50 de 200".
- Página actual: `aria-current="page"`, estilo seleccionado. Extremos: "Anterior"/"Siguiente"
  `disabled`.
- Todos los botones con `touch-target` (≥ 48 × 48 px).
- No renderiza nada si `paginas <= 1`.

## `InventarioView`

- Ordena `resultados` por nombre (R4) antes de armar `filas`.
- `useListaPaginada(filas, { clave: [texto, categoria, estado.join(','), lugarActivoId].join('|'),
  modo: disposicion === 'desktop' ? 'paginas' : 'ver-mas' })`.
- Tarjetas: `visibles` + `<VerMas>`; tabla: `InventarioTabla filas={visibles}` + `<Paginador>`.
- Detalle: `<BottomSheet titulo="Detalle del insumo"><InsumoDetalle … /></BottomSheet>` (R5).
- Resumen de alertas, filtros, mensajes de vacío y overlays: sin cambios.

## `InventarioTabla`

- Nueva prop opcional `titulo?: string` → `<caption className="sr-only" tabIndex={-1}>` con el rango
  ("Insumos 26–50 de 200"); `ref` reenviada al contenedor para `scrollIntoView` y foco (R6).

## `InsumoDetalle`

- Se quitan la prop `enHoja` y el botón "Cerrar detalle"; `onClose` se mantiene para cerrar tras una
  acción interna si hiciera falta. `DetalleDesdeAlerta` deja de pasar `enHoja`.

## Ajustes

| Componente | Cambio |
|---|---|
| `MinimosPorInsumoSection` | `useListaPaginada(filas, { clave: busqueda + '\|' + seleccion, modo: 'ver-mas' })` + `<VerMas>`; se quita el estado `visibles` local. Errores por fila se reinician con la misma clave, como hoy. |
| `CategoriasSection` | `useListaPaginada(catalogo, { clave: '', modo: 'ver-mas' })` + `<VerMas>` |
| `InsumosBajaSection` | ordena por nombre; `useListaPaginada` + `<VerMas>` |

Textos y comportamiento de cada fila (renombrar, borrar, restaurar, editar mínimo) sin cambios.

## Tests (contrato de verificación)

| Archivo | Cubre |
|---|---|
| `tests/unit/paginacion.test.ts` (nuevo) | funciones puras: bordes 0/25/26/50/1.000, "…", singular/plural |
| `tests/unit/useListaPaginada.test.tsx` (nuevo) | Ver más, ir a página, clave reinicia, lista que se achica/crece, cambio de modo conserva `hasta` |
| `tests/integration/inventario-paginacion.test.tsx` (nuevo) | 60–200 insumos: 25 + Ver más; búsqueda encuentra el último; filtros vuelven al comienzo; alertas cuentan todo; detalle en hoja conserva grupos; orden alfabético; foco tras Ver más |
| `tests/integration/inventario-tabla.test.tsx` | paginador: rango, anterior/siguiente deshabilitados, "…", página tras cerrar detalle |
| `tests/integration/inventario.test.tsx`, `acciones-rapidas.test.tsx`, `alertas-detalle.test.tsx` | "Cerrar detalle" → "Cerrar" de la hoja |
| `tests/integration/ajustes.test.tsx`, `ajustes-minimos.test.tsx` | categorías y dados de baja con Ver más; mínimos sin regresiones |
