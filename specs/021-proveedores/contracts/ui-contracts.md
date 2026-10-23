# Contrato: módulos y componentes

Decisiones en [research.md](../research.md) (R8–R11). Textos en español de Chile, tuteo, como el resto
de la app.

## `src/features/proveedores/lib/`

### `proveedores.ts`

```ts
claveNombre(nombre: string): string          // = claveCategoria; se reexporta con nombre neutro
ordenarProveedores(p: Proveedor[]): Proveedor[]   // por plegar(nombre), luego id
activos(p: Proveedor[]): Proveedor[]         // sin desactivadoEn ni eliminadoEn
buscarProveedores(p: Proveedor[], texto: string): Proveedor[]  // activos cuyo plegar(nombre) incluye plegar(texto)
coincidencia(p: Proveedor[], texto: string):
  | { tipo: 'activo'; proveedor: Proveedor }
  | { tipo: 'desactivado'; proveedor: Proveedor }
  | { tipo: 'ninguna' }                      // por claveNombre, entre no eliminados
predeterminadoDe(lugar: Lugar | undefined, p: Proveedor[]): Proveedor | null  // solo si está activo
nombreDelLote(lote: Lote, porId: Map<string, Proveedor>): string  // por id; si falta, lote.proveedor (R11)
```

### `proveedoresAdmin.ts` (escritura local primero, en transacción Dexie)

```ts
crearProveedor(datos: { nombre: string; whatsapp?: string; contacto?: string }): Promise<Proveedor>
  // cualquier miembro; valida; si hay coincidencia activa la devuelve sin crear (selector)
  // o lanza "Ya existe un proveedor con ese nombre." (Ajustes, opción `estricto`)
editarProveedor(id, cambios: { nombre?; whatsapp?; contacto? }): Promise<void>   // admin
desactivarProveedor(id): Promise<void>      // admin; limpia predeterminados locales
reactivarProveedor(id): Promise<void>       // admin
eliminarProveedor(id): Promise<void>        // admin; lanza si hay lotes locales con ese proveedorId
fijarPredeterminado(lugarId, proveedorId | null): Promise<void>  // admin; marca el lugar sincronizado:false
```

Todas marcan `sincronizado: false` y usan `exigirAdministrador` donde corresponde.

### `whatsapp.ts`

```ts
normalizarWhatsapp(texto: string): { ok: true; valor: string | null } | { ok: false }
formatearWhatsapp(digitos: string): string   // "+56 9 1234 5678" / "+<dígitos>"
```

## `SelectorProveedor` (`src/features/proveedores/components/SelectorProveedor.tsx`)

```ts
props: {
  id: string                       // para <label htmlFor> y ErrorCampo
  valor: string | null             // proveedorId
  onCambio: (id: string) => void
  invalido?: boolean; describedBy?: string
}
```

- Campo: `<button type="button" aria-haspopup="dialog">` de alto ≥ 48 px con el nombre o "Elige un
  proveedor". Si el valor apunta a un proveedor desactivado (abierto antes de desactivarlo), lo sigue
  mostrando (Edge Cases).
- Hoja (`BottomSheet`, título "Proveedor"): `<input type="search">` con foco y la etiqueta "Buscar
  proveedor"; lista `role="listbox"` de opciones (`role="option"`, `aria-selected`) de 48 px; la elegida,
  con check.
- Texto sin coincidencia por clave: última opción "Agregar proveedor «texto»" → `crearProveedor`,
  elige y cierra.
- Coincidencia con un desactivado: aviso "«X» está desactivado." y, para administración, el botón
  "Reactivar y usar".
- Catálogo vacío y buscador vacío: "Todavía no hay proveedores. Escribe el nombre para agregar uno."
- Teclado: flechas recorren las opciones, Enter elige, Escape cierra sin cambiar.

## Formularios

### `AltaMaterialView` + `lib/alta.ts` + `useBorradorAlta`

- `lote.proveedor: string` → `lote.proveedorId: string | null`.
- Valor inicial: `predeterminadoDe(lugar del registro)`. Al cambiar el lugar, se recalcula solo si la
  persona no eligió a mano (`proveedorTocado`).
- Validación: con stock inicial > 0, `proveedorId` obligatorio → `errores.proveedor = 'Ingresa el
  proveedor.'` (mismo id `error-proveedor`; el foco del primer error va al botón del selector).
- `darDeAltaMaterial` guarda el lote con `proveedorId` y `proveedor = nombre actual`.
- Borrador viejo con `lote.proveedor` (texto): al cargar, `coincidencia` → id si es activa; si no, el
  predeterminado.

### `RecibirItemForm` + `compras/lib/recepcion.ts`

- `proveedor: string` → `proveedorId: string | null`, inicial = predeterminado del `lugarId` del ítem.
- Misma validación y mismo guardado que el alta.

## `InsumoDetalle`

Cada lote: `Lote {numeroLote} · {nombreDelLote} — vence {fecha}` (sin " · proveedor" si el nombre
resultara vacío). Sin cambios en `ConsumoForm` ni `TrasladoForm`.

## Ajustes

### `secciones.ts`

`IdSeccion` agrega `'proveedores'`. Va entre `categorias` y `baja`, con el título "Proveedores", el
ícono `Truck` y `soloAdministracion: true`.

### `useResumenesAjustes.ts`

`proveedores`: "N proveedores" / "1 proveedor" / "Sin proveedores" (activos).

### `ProveedoresSection.tsx`

- Botón "Agregar proveedor" arriba (≥ 48 px).
- Lista de activos (`ordenarProveedores`), con `useListaPaginada` + `VerMas`. Fila: nombre;
  debajo, WhatsApp formateado y contacto si los hay; insignias "Predeterminado" (con el nombre del
  lugar si hay más de un lugar activo). Tocar la fila abre la hoja de edición.
- Hoja "Nuevo proveedor" / "Editar proveedor": Nombre*, WhatsApp (`inputmode="tel"`, ayuda "Con o sin
  +56"), Contacto; "Predeterminado en" con un `Switch` por lugar activo; Guardar. En edición:
  Desactivar (o Reactivar) y Eliminar solo si no tiene lotes, con confirmación ("¿Eliminar «X»? No
  tiene lotes registrados.").
- "Desactivados (N)": botón plegable al final; cada fila con "Reactivar".
- Lista vacía: "Todavía no hay proveedores." + "Agregar proveedor".

## `inventoryStore`

`proveedores: Proveedor[]` (no eliminados del tenant, `liveQuery`), con la misma suscripción y limpieza
que `categorias`.

## Avisos

`useAvisosStore` agrega el tipo `proveedor-no-eliminado`: "No se pudo eliminar «X»: tiene lotes
registrados."

## Pruebas

| Archivo | Cubre |
|---|---|
| `tests/unit/proveedores/proveedores.test.ts` (nuevo) | clave y paridad (R1), orden, búsqueda, coincidencia, predeterminado, nombre del lote |
| `tests/unit/proveedores/whatsapp.test.ts` (nuevo) | normalización y formato (R10) |
| `tests/unit/proveedores/proveedoresAdmin.test.ts` (nuevo) | permisos, duplicados, desactivar limpia predeterminados, eliminar con/sin lotes |
| `tests/unit/sync-proveedores.test.ts` (nuevo) | orden del ciclo, insert vs upsert, remapeo por `23505`, rechazo, `proveedor_id` omitido si null |
| `tests/unit/dexie-v13.test.ts` (nuevo) | upgrade v12→v13, borra `configuracionClinica` |
| `tests/integration/selector-proveedor.test.tsx` (nuevo) | predeterminado elegido, buscar, agregar, desactivado, teclado |
| `tests/integration/ajustes-proveedores.test.tsx` (nuevo) | sección, crear/editar/predeterminado/desactivar/eliminar, personal sin acceso |
| `alta-material`, `compras`, `alertas-detalle`, `ajustes` y unit `alta`/`recepcion` (ajustados) | proveedorId en vez de texto; proveedor en el detalle; tarjeta nueva en el índice |
| Mocks con `configuracionClinica` (`tablasMemoria`, `sync-*`, `alta`, `recepcion`, `dexie-v10..12`) | se agrega `proveedores`; se quita `configuracionClinica` donde ya no exista |
