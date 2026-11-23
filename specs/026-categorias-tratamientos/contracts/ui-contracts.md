# UI Contracts: spec 026

## 1. Ajustes → "Categorías de tratamientos" (solo administración)

- Tarjeta en el índice de Ajustes después de "Lugares de trabajo", con resumen "9 categorías · 1 con %
  propio".
- Lista ordenada por nombre: nombre, "Desactivada" (texto) si lo está, y por cada lugar con % propio
  "Clínica A: 50 %". "Ver más" a partir de 25 (spec 020).
- "Nueva categoría" → hoja con nombre (1–40). Errores en el campo: vacío/largo, repetido, reservado.
- Tocar una categoría → hoja "Editar categoría":
  - Nombre.
  - Interruptor "Activa".
  - "% profesional por lugar": un `NumeroInput` (0–100) por lugar activo; vacío = usa el general, con
    placeholder "Usa el general (40 %)" o "Sin % general en este lugar"; texto de ayuda "Profesional
    50 % · Clínica 50 %" cuando hay valor.
  - "Guardar" escribe solo lo cambiado (nombre/activa en la fila; cada % cambiado como un cambio
    `porcentajeCategoria`). Error por campo; no se guarda nada si alguno es inválido.

## 2. Formulario de tratamiento

- Campo **Categoría** (después del nombre) con `SelectorCatalogo`: ítems = categorías activas no
  rechazadas; `permitirNinguno` con "Sin categoría"; `crear` = `crearCategoriaTratamiento`;
  `reactivar` = `reactivarCategoriaTratamiento`.
- Guardar con categoría distinta de la actual escribe un cambio `categoria`.

## 3. Catálogo (`TratamientosView`) y detalle

- Cada tratamiento muestra su categoría ("Sin categoría"; "Evaluación (desactivada)").
- Chips de filtro: "Todas", cada categoría con tratamientos, "Sin categoría" si hay. Un valor a la vez.
- Montos (`MontosTratamiento`): la línea del % dice "Profesional 50 % · Evaluación" o "Profesional
  40 % · general del lugar".

## 4. Hoja de registro

- Misma línea de % con origen. El registro guarda `porcentajeProfesional` = % aplicable,
  `categoriaId` y `categoriaNombre`.

## 5. Historial

- Cada registro: "Evaluación · Clínica A · 23 nov 2026 14:10 · Autor".
- Selector "Categoría" (Todas / cada categoría presente en los registros del período / Sin
  categoría). Los totales (tarjeta) usan los registros filtrados.

## 6. Reportes

- `TarjetaGrafico` "Por categoría de tratamiento" en la sección Gráficos, después de "Materiales más
  utilizados": `HorizontalBarChart` de producción; tabla con columnas Categoría, Producción, Ganancia
  del profesional. Vacío: "Sin tratamientos en el período".

## 7. Módulos

```ts
// src/features/tratamientos/lib/categorias.ts (nuevo)
export const CATEGORIAS_TRATAMIENTO_SEMBRADAS: readonly string[]
export function validarNombreCategoriaTratamiento(nombre, existentes, idActual?): string | null
export async function crearCategoriaTratamiento(nombre: string): Promise<{ id: string }>
export async function guardarCategoriaTratamiento(id: string, cambios: {
  nombre?: string; activa?: boolean; porcentajes?: Record<string /* lugarId */, number | null>
}): Promise<void>
export async function reactivarCategoriaTratamiento(id: string): Promise<void>

// proyeccion.ts
export function porcentajesPorCategoria(cambios): Map<string, number>
export function porcentajeAplicable(args): { valor: number | null; origen: 'categoria' | 'lugar' | null }

// catalogo.ts
TratamientoInput gana `categoriaId: string | null`; CampoTratamiento gana 'categoria'.
export async function fijarPorcentajeCategoria(categoriaId, lugarId, porcentaje, actual): Promise<void>

// reportes/lib/kpis.ts
ResumenReportes gana `porCategoriaTratamiento: { id: string | null; nombre: string; produccion: number; gananciaProfesional: number }[]`
```

## 8. Pruebas

Unit:

- `tests/unit/tratamientos/categorias.test.ts`: validación de nombre; crear (admin, rechaza personal,
  repetido); guardar nombre/activa/%; reactivar.
- `tests/unit/tratamientos/proyeccion-categorias.test.ts`: `categoriaId` proyectado (último gana,
  `null`), `porcentajesPorCategoria`, `porcentajeAplicable` (categoría > lugar > null; desactivada
  aplica; borrar vuelve al general).
- `tests/unit/tratamientos/registro.test.ts` (ampliar): snapshot con % de categoría y nombre; sin
  categoría usa el general.
- `tests/unit/reportes/kpis.test.ts` (ampliar): agrupación por id, nombre actual, "Sin categoría",
  anulados fuera, filtro por lugar.
- `tests/unit/sync-categorias-tratamiento.test.ts`: push (solo admin, 23505 → rechazada y aviso),
  pull, columnas nuevas de cambios y registros.
- `tests/unit/dexie-v15.test.ts`: upgrade con `null`.

Integración:

- `tests/integration/ajustes-categorias-tratamiento.test.tsx`: sembradas visibles, crear, renombrar,
  desactivar, % por lugar con placeholder del general, personal sin la sección.
- `tests/integration/tratamientos.test.tsx` (ampliar): selector en el formulario, filtro del catálogo,
  origen del %.
- `tests/integration/registrar-tratamiento.test.tsx` (ampliar): ejemplo 40/50 de SC-001.
- `tests/integration/historial-tratamientos.test.tsx` (ampliar): filtro y totales.
- `tests/integration/reportes.test.tsx` (ampliar): tarjeta por categoría y tabla.
