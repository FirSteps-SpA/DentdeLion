# Contrato: lógica del cliente y UI

Decisiones en [research.md](../research.md) (R7–R13). Modelo en [data-model.md](../data-model.md).

## `src/lib/catalogo.ts` (nuevo, extraído de `proveedores/lib/proveedores.ts`, R7)

Genérico sobre `ItemCatalogo = { id: string; nombre: string; desactivadoEn: string | null; eliminadoEn: string | null }`:

```ts
ordenarCatalogo<T>(items: readonly T[]): T[]          // plegar(nombre), desempate por id
activosDe<T>(items: readonly T[]): T[]                // no eliminados ni desactivados, ordenados
desactivadosDe<T>(items: readonly T[]): T[]
buscarEnCatalogo<T>(items: readonly T[], texto: string): T[]   // activos que contienen el texto plegado
coincidenciaEn<T>(items: readonly T[], texto: string):
  { tipo: 'activo' | 'desactivado'; item: T } | { tipo: 'ninguna' }
```

`proveedores.ts` conserva sus exportaciones (`ordenarProveedores`, `activos`, `desactivados`,
`buscarProveedores`, `coincidencia` con la forma `{ tipo, proveedor }`) como envoltorios: **ninguna
prueba de la 021 cambia**.

## `src/features/marcas/lib/`

### `marcas.ts`

```ts
claveMarca = claveCategoria
mapaMarcas(marcas: readonly Marca[]): Map<string, Marca>
nombreDeMarca(insumo: Pick<Insumo, 'marcaId'>, porId: ReadonlyMap<string, Marca>): string | null
  // null si no tiene, si no está en el dispositivo o si está eliminada
usosPorMarca(insumos: readonly Insumo[]): Map<string, number>   // incluye dados de baja
marcaParaInsumo(marcaId: string | null): Promise<string | null>
  // dentro de la transacción del alta/edición: null si no existe o está eliminada (Edge Cases)
```

### `marcasAdmin.ts` (escritura local primero, en transacción Dexie, `sincronizado: false`)

```ts
crearMarca({ nombre }): Promise<Marca>
  // cualquier miembro; nombre vacío → MENSAJE_NOMBRE_VACIO ("Escribe el nombre de la marca.");
  // coincide con una activa → devuelve esa; con una desactivada → throw MarcaDesactivada
renombrarMarca(id, nombre)          // administración; repetido → "Ya existe una marca con ese nombre."
desactivarMarca(id) / reactivarMarca(id)   // administración
eliminarMarca(id)                   // administración; con insumos → "No se puede eliminar: la usan N insumos."
```

Todas las de administración llaman a `exigirAdministrador` (como `proveedoresAdmin`).

## `SelectorCatalogo` (`src/components/ui/SelectorCatalogo.tsx`, nuevo, R7)

```ts
props: {
  id: string; valor: string | null; onCambio: (id: string | null) => void
  items: readonly ItemCatalogo[]
  textos: { titulo; placeholderCampo; buscar; placeholderBuscar; agregar: (n) => string;
            vacio; desactivado: (n) => string; ninguno?: string }
  crear: (nombre: string) => Promise<{ id: string }>
  reactivar?: (id: string) => Promise<void>      // solo se ofrece a administración
  permitirNinguno?: boolean                       // opción "Sin …" arriba, elige null
  invalido?: boolean; describedBy?: string
}
```

Comportamiento: el de `SelectorProveedor` en la 021 (campo `<button aria-haspopup="dialog">` ≥ 48 px,
hoja con buscador con foco, `listbox`/`option`, "Agregar «…»", aviso de desactivado con "Reactivar y
usar", teclado con flechas, Enter y Escape). Con `permitirNinguno`, la primera opción es `textos.ninguno`
y elegirla llama a `onCambio(null)`.

- `SelectorProveedor`: envoltorio con los textos actuales, sin `permitirNinguno`.
- `SelectorMarca` (`src/features/marcas/components/SelectorMarca.tsx`): título "Marca", campo "Sin
  marca" cuando `valor = null`, "Buscar marca", "Agregar marca «…»", vacío "Todavía no hay marcas.
  Escribe el nombre para agregar una.", `permitirNinguno` con "Sin marca". Si el valor apunta a una
  marca desactivada, el campo muestra "«X» (desactivada)".

## Formularios

### `AltaMaterialView` + `insumos/lib/alta.ts` + `useBorradorAlta`

- `AltaMaterialInput.marcaId: string | null` (inicial `null`, sin predeterminado, FR-005).
- Campo "Marca" (opcional) después de Categoría, con `SelectorMarca`.
- `darDeAltaMaterial` guarda `insumo.marcaId = await marcaParaInsumo(input.marcaId)`; si quedó en
  `null` habiendo elegido una, avisa: "La marca elegida ya no existe; el material se guardó sin marca."
- Borrador anterior sin `marcaId` → `null`.

### `EditarInsumoForm` + `insumos/lib/catalogo.ts`

- `CAMPOS_EDITABLES` y `CambiosInsumoInput` suman `marcaId`; `editarInsumo` crea el cambio `marcaId` si
  difiere (`nuevoCambio`), en la misma transacción que los demás.
- Campo "Marca" con `SelectorMarca` y el valor actual.

### Sin cambios

`RecibirItemForm`, `VincularOCrearDialog`, `ConsumoForm`, `TrasladoForm`: no piden marca (FR-004).

## Visualización

| Lugar | Contrato |
|---|---|
| `InsumoDetalle` | Fila "Marca: X" en los datos del insumo, solo si `nombreDeMarca` ≠ null (FR-011). |
| `InsumoCard`, `InventarioTabla` | Tras el nombre: `<span class="text-text-muted"> · X</span>` en el mismo renglón, con `truncate` (FR-012). |
| `ItemSugeridoCard`; `ItemManualCard` vinculado | Igual que arriba, con la marca del insumo. |
| `compras/lib/pedido.ts` | `ItemPedido.marca: string \| null`; `construirMensajePedido` → `- Nombre · Marca — cantidad (lugar)` (FR-014). |

## Búsqueda (`inventoryStore.searchInsumosPorTexto`)

```ts
searchInsumosPorTexto(insumos, texto, marcasPorId?: ReadonlyMap<string, Marca>): Insumo[]
// coincide por nombre (como hoy) o por plegar(nombre de la marca) que contiene plegar(texto)
```

`InventarioView` y `SearchPicker` le pasan `mapaMarcas(marcas)`.

## Ajustes

- `secciones.ts`: `IdSeccion` suma `'marcas'`, entre `'proveedores'` y `'baja'`; título "Marcas",
  ícono `Tag` (o el que ya exista en `components/icons`), `soloAdministracion: true`.
- `useResumenesAjustes.ts`: `marcasActivas` → "N marcas" / "1 marca" / "Sin marcas".
- `SeccionAjustesPantalla`: `{id === 'marcas' && <MarcasSection />}`.
- `MarcasSection.tsx` (`features/ajustes/components`):
  - "Agregar marca" arriba (≥ 48 px).
  - Lista de activas (`ordenarCatalogo`), `useListaPaginada` + `VerMas` de a 25. Fila: nombre y "N
    insumos" / "Sin insumos". Tocarla abre la hoja.
  - Hoja "Nueva marca" / "Editar marca": Nombre*, Guardar; en edición, Desactivar (o Reactivar) y
    Eliminar solo si `usos = 0`, con la confirmación "¿Eliminar «X»? No la usa ningún insumo."
  - "Desactivadas (N)" plegable, con "Reactivar".
  - Vacía: "Todavía no hay marcas." + "Agregar marca".

## `inventoryStore`

`marcas: Marca[]` (no eliminadas del tenant, `liveQuery`), con la misma suscripción y limpieza que
`proveedores`.

## Avisos (`avisosStore`)

- `marca-no-eliminada`: "No se pudo eliminar «X»: la usan insumos."
- `marca-repetida`: "No se pudo renombrar a «X»: ya existe una marca con ese nombre."

## Pruebas

| Archivo | Cubre |
|---|---|
| `tests/unit/catalogo-generico.test.ts` (nuevo) | helpers genéricos (orden, activos, búsqueda, coincidencia) |
| `tests/unit/marcas/marcas.test.ts` (nuevo) | nombre visible, usos, `marcaParaInsumo` |
| `tests/unit/marcas/marcasAdmin.test.ts` (nuevo) | permisos, duplicados, desactivada, eliminar con y sin insumos |
| `tests/unit/sync-marcas.test.ts` (nuevo) | orden del ciclo, insert y upsert, `23505` → remapeo (insumos, cambios pendientes, borrador), `marca_con_insumos`, cambios `marcaId` retenidos hasta subir la marca, `marca_id` en `toInsumoRow`/`fromInsumoRow` |
| `tests/unit/dexie-v14.test.ts` (nuevo) | upgrade v13 → v14 (`marcaId: null`, tabla `marcas`) |
| `tests/integration/selector-marca.test.tsx` (nuevo) | "Sin marca", buscar, agregar, desactivada, teclado |
| `tests/integration/ajustes-marcas.test.tsx` (nuevo) | sección, crear, renombrar, desactivar, eliminar, "Ver más", personal sin acceso |
| `selector-proveedor`, `ajustes-proveedores` (sin cambios) | deben seguir pasando tras extraer `SelectorCatalogo` |
| `alta-material`, edición de insumo, `alertas-detalle`, `compras`, `ajustes`, unit `pedido`, `inventoryStore` (ajustados) | marca en alta y edición, en el detalle, en las listas, en el mensaje, en la búsqueda; tarjeta nueva en el índice |
| `helpers/tablasMemoria` y mocks de Dexie | suman `marcas` |
