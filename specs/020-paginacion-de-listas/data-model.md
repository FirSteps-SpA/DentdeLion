# Data Model: Paginación de listas

**Feature**: 020-paginacion-de-listas | **Date**: 2026-10-23

Sin cambios de esquema: Postgres y Dexie (v12) quedan iguales, no hay migración ni cambios de
sincronización. Solo hay tipos de presentación.

## Estado de paginación (en memoria, por lista)

| Campo | Tipo | Regla |
|---|---|---|
| `hasta` | `number` | Cuántos elementos cubre la vista. Empieza en `TAMANO_PAGINA` (25). "Ver más" suma 25; ir a la página `p` lo fija en `p × 25`. |
| `clave` | `string` | Al cambiar, `hasta` vuelve a 25 (búsqueda, filtros, lugar). |

Vive en `useState` del componente de la lista: no se guarda en Zustand, Dexie ni la URL (FR-013,
Constitución II: es estado de presentación, como los filtros de Inventario hoy).

### Derivados (funciones puras, `src/lib/paginacion.ts`)

| Función | Resultado |
|---|---|
| `totalPaginas(total)` | `max(1, ceil(total / 25))` |
| `paginaDe(hasta, total)` | `min(ceil(hasta / 25), totalPaginas(total))` (R3) |
| `rangoPagina(pagina, total)` | `{ desde, hasta }` 1-based, p. ej. `{ 26, 50 }`; `{ 0, 0 }` sin elementos |
| `paginasVisibles(actual, total)` | `(number \| '…')[]`, máximo 7 posiciones: 1, …, actual−1, actual, actual+1, …, última |
| `textoQuedan(n)` | `"queda 1"` / `"quedan N"` |

### Transiciones

```text
inicio / cambio de clave ──► hasta = 25
"Ver más"                ──► hasta = hasta + 25        (sin superar el total + 24)
ir a página p            ──► hasta = p × 25
lista se achica          ──► hasta igual; página mostrada = paginaDe(hasta, total)
cambio tarjetas ↔ tabla  ──► hasta igual (R1)
```

## Orden de las listas (FR-003a)

| Lista | Orden |
|---|---|
| Inventario (lugar activo y "Todos") | `nombre`, `localeCompare('es', { sensitivity: 'base' })` — nuevo |
| Insumos dados de baja | ídem — nuevo |
| Categorías | `catalogoCategoriasCompleto` (sin cambios) |
| Stock mínimo por insumo | `filasMinimos` (por nombre, sin cambios) |
