# Research: Marcas

Decisiones de diseño de la spec 023. Molde: la spec 021 (proveedores), cuyo catálogo, selector y
sección de Ajustes se reutilizan. La diferencia de fondo es dónde vive el dato: el proveedor va en el
**lote** (fila que no cambia después del insert); la marca va en el **insumo**, que se sube entero en
cada ciclo como proyección del historial `cambios_insumo` (spec 007).

---

## R1 · Catálogo `marcas` por tenant con la clave de la 021

- **Decision**: tabla `marcas` (`id`, `tenant_id`, `nombre` 1–60, `clave` generada con la función
  existente `clave_nombre`, `creado_por`, `creado_en`, `desactivado_en`, `eliminado_en`) con índice
  único parcial `(tenant_id, clave) where eliminado_en is null` y `unique (id, tenant_id)` para la FK
  compuesta. En el cliente, la clave es `claveCategoria`, igual que `claveNombre` de proveedores.
- **Rationale**: misma regla de nombres únicos que proveedores y categorías (FR-002); `clave_nombre` ya
  es `immutable` y está probada en `test:rls`. La FK compuesta impide asociar una marca de otro tenant
  (FR-003).
- **Alternatives considered**: tabla genérica `catalogos(tipo, …)` para proveedores y marcas — rechazada:
  proveedores tiene columnas propias (WhatsApp, contacto) y migrar la 021 no aporta a esta spec;
  `citext` o `unaccent` — rechazados por lo mismo que en la 021 (R1: `unaccent` no es `immutable`).

## R2 · `insumos.marca_id` opcional, sin migración de datos

- **Decision**: `alter table insumos add column marca_id uuid` + FK `(marca_id, tenant_id) →
  marcas (id, tenant_id)` + índice. Nullable; los insumos existentes quedan en `null` (FR-004). En Dexie
  v14, `Insumo.marcaId: string | null` y el `upgrade` rellena `null`.
- **Rationale**: la marca es del producto (Clarifications Q1). No hay texto previo que convertir: el
  roadmap descarta deducirla de `codigo_fabricante` o del nombre (Assumptions).
- **Alternatives considered**: marca en el lote — descartada en Clarifications Q1; tabla intermedia
  insumo–marca — innecesaria con una sola marca por insumo.

## R3 · `marca_id` solo cambia por el historial, nunca por el upsert de insumos

**Problema**: `pushInsumos` sube **todas** las filas locales en cada ciclo, antes de hacer pull. Hoy eso
converge porque cada dispositivo tiene los valores base de cada campo y reproyecta desde el historial.
Con una columna nueva no pasa: un dispositivo que bajó un insumo siendo 2.5.0 (sin `marca_id`) y luego
se actualiza a 2.6.0 queda con `marcaId: null` por el `upgrade` de Dexie. En su primer ciclo subiría
`marca_id: null` antes del pull y borraría la marca elegida en el alta, que no está en el historial.
Un administrador no tiene la protección de `proteger_catalogo_insumo`.

- **Decision**:
  1. `marca_id` se fija en el **INSERT** del insumo (alta con marca).
  2. En **UPDATE**, `proteger_catalogo_insumo` conserva siempre `old.marca_id`, para cualquier usuario
     incluido el administrador, salvo que lo cambie el trigger del punto 3 (marca de sesión
     `set_config('dentdelion.aplicando_marca', 'on', true)`, local a la transacción).
  3. Trigger `after insert on cambios_insumo` para `campo = 'marcaId'`: escribe en el insumo el
     `valor_nuevo` del cambio **más reciente** por `(creado_en, id)` de ese insumo y campo, la misma
     regla que `proyectarInsumo` en el cliente. Así llegan juntos el historial (FR-009) y la columna.
- **Rationale**: cubre los tres riesgos con una sola regla en el servidor. Primero, el dispositivo
  recién actualizado. Segundo, la 2.5.0 en caché, que de por sí no manda la clave `marca_id` porque
  PostgREST solo actualiza las columnas presentes. Tercero, cualquier fila desfasada que se suba antes
  del pull. Los permisos salen gratis: `cambios_insumo` ya solo acepta inserts de administración (RLS),
  así que el personal no cambia la marca de un insumo existente (FR-008, Clarifications Q2) y el
  intento se rechaza y se revierte con el flujo actual (`rechazadoEn`, FR-021b de la 007). Es el mismo
  patrón que `lotes.proveedor_id` en la 021 (R3: coalesce en UPDATE), llevado al historial.
- **Alternatives considered**:
  - Omitir `marca_id` del push hasta el primer pull tras actualizar: frágil (bandera local por
    dispositivo) y no protege contra otras filas desfasadas.
  - Conservar `old.marca_id` cuando llega `null`: impide quitar la marca ("Sin marca").
  - Proyectar en el servidor todos los campos desde `cambios_insumo`: cambio mayor del modelo de la
    007, fuera de alcance.

## R4 · El historial acepta `marcaId`

- **Decision**: `cambios_insumo_campo_check` suma `'marcaId'`; `CampoEditableInsumo` suma `'marcaId'`.
  `valor_anterior`/`valor_nuevo` son el id (texto en jsonb) o `null`. `editarInsumo` genera el cambio
  como con cualquier otro campo; `proyectarInsumo` y `filaParaSubir` no cambian (son genéricas por
  campo).
- **Rationale**: FR-009 y la convergencia por campo de la 007 (FR-021a) sin código especial.
- **Compatibilidad 2.5.0**: su `pullCambiosInsumo` baja los cambios `marcaId` y su proyección escribe
  una propiedad `marcaId` en el objeto local, que `toInsumoRow` ignora: sin efecto visible ni en lo
  que sube. Hoy no hay pantalla de historial de campos, así que no aparece una etiqueta desconocida.

## R5 · Orden de sincronización y marcas creadas sin conexión

- **Decision**: `pushMarcas` → `pullMarcas` justo después de proveedores y antes de lugares e insumos
  (la FK de `insumos.marca_id`). Mismo esquema que `pushProveedores`: el administrador hace upsert y el
  personal hace insert de lo que creó. Una clave repetida (`23505`) en una marca creada aquí se remapea
  a la del servidor (`remapearMarca`: `insumos.marcaId`, cambios `marcaId` **pendientes**, borrador del
  alta). En un renombrado que choca, se avisa (`marca-repetida`). `marca_con_insumos` revierte la baja
  y avisa (`marca-no-eliminada`).
- **Guarda adicional**: `pushCambiosInsumo` deja pendientes los cambios `marcaId` cuyo `valorNuevo` es
  una marca local aún sin subir, para que nunca llegue al servidor un id que después se remapea.
- **Rationale**: FR-010 y Constitución I: nada se pierde en silencio y los duplicados sin conexión
  convergen por nombre (Edge Cases).
- **Alternatives considered**: ids deterministas por clave (uuid v5 de tenant + clave) — evitaría el
  remapeo, pero choca con renombrar y con las desactivadas; la 021 ya resolvió el remapeo.

## R6 · Eliminar = baja lógica, solo sin insumos

- **Decision**: `proteger_marca()` (before update): identidad inmutable; un eliminado no vuelve; si pasa
  a `eliminado_en` y existe algún insumo con `marca_id = old.id` (incluidos los dados de baja), lanza
  `marca_con_insumos`. RLS: leer del tenant; insertar como sí mismo (más la política "pendiente previo
  a la desactivación" de la 021); actualizar solo administración.
- **Rationale**: FR-016 y FR-019; la fila queda para que la baja llegue a todos los dispositivos (021
  R7).
- **Marca eliminada en un insumo** (carrera rara: se elimina sin insumos mientras otro dispositivo, sin
  conexión, la elige): el servidor lo acepta (la fila existe). El cliente muestra un insumo cuya marca
  está eliminada como "sin marca", y la sección Marcas la cuenta como en uso si alguien la vuelve a
  crear con ese nombre. Se documenta como caso borde y no se bloquea.

## R7 · Selector genérico de catálogo, compartido con proveedores

- **Decision**: extraer de `SelectorProveedor` un `SelectorCatalogo` (hoja con buscador, opciones con
  teclado, "Agregar «…»", aviso de desactivado con "Reactivar" para administración), parametrizado por
  ítems, textos y acciones de crear y reactivar, más una opción "Ninguno" opcional. `SelectorProveedor`
  queda como envoltorio sin cambios de comportamiento (sus pruebas deben seguir pasando tal cual), y
  `SelectorMarca` es otro envoltorio con "Sin marca" y sin obligatorio.
- **Helpers**: `ordenar`, `activos`, `desactivados`, `buscar` y `coincidencia` de
  `proveedores/lib/proveedores.ts` pasan a ser genéricos sobre `{ id, nombre, desactivadoEn,
  eliminadoEn }` en `src/lib/catalogo.ts`; proveedores los reexporta con sus nombres actuales.
- **Rationale**: SC-002 y la consistencia que pide la clienta ("similar a proveedor"). Duplicar 255
  líneas de accesibilidad y teclado obligaría a corregir todo dos veces.
- **Alternatives considered**: copiar el selector — más rápido, pero duplica la lógica de teclado y de
  anuncio; un `<select>` nativo — sin buscador ni "Agregar".

## R8 · Dónde se ve la marca

- **Decision**:
  - **Detalle del insumo**: fila "Marca" en los datos del catálogo, solo si tiene (FR-011).
  - **Inventario** (`InsumoCard`, `InventarioTabla`) y **Compras** (`ItemSugeridoCard`, y
    `ItemManualCard` cuando está vinculado a un insumo): `Nombre · Marca`, con la marca en
    `text-text-muted` y `truncate` dentro del mismo renglón (FR-012).
  - El nombre de la marca se resuelve con un `Map` por id desde `inventoryStore.marcas`. Una marca
    eliminada o que todavía no está en el dispositivo no se muestra.
- **Rationale**: menos ruido visual que una línea extra; el DS ya usa `·` como separador secundario.

## R9 · Búsqueda por marca

- **Decision**: `searchInsumosPorTexto(insumos, texto, marcasPorId?)` también encuentra el insumo cuando
  `plegar(nombre de la marca)` contiene `plegar(texto)` (FR-013). La comparación por nombre del insumo
  se mantiene como hoy (solo minúsculas) para no cambiar resultados existentes. El `SearchPicker` de
  consumo usa la misma función y también gana la búsqueda por marca: se acepta, porque es coherente.
- **Alternatives considered**: plegar también el nombre del insumo — mejora, pero fuera de alcance y
  cambiaría pruebas existentes de la 006.

## R10 · Mensaje de WhatsApp

- **Decision**: `ItemPedido` suma `marca: string | null` (de `insumo.marcaId`, o `null` sin insumo).
  `construirMensajePedido` arma el renglón como `- Nombre · Marca — cantidad (lugar)` (FR-014,
  Clarifications Q4). Sin opción para apagarlo.
- **Rationale**: es el formato del roadmap ("Composite Z350 · 3M"); la cantidad sigue al final como hoy.

## R11 · Ajustes → Marcas

- **Decision**: `IdSeccion` suma `'marcas'` entre `'proveedores'` y `'baja'`, solo para administración
  (FR-015). Resumen: `N marcas` (activas). `MarcasSection`: lista activa ordenada con la cantidad de
  insumos de cada marca (contando los dados de baja, para que la cuenta explique por qué no se puede
  eliminar), con "Ver más" de a 25 (`paginacion.ts`, spec 020). Hoja de crear y renombrar (solo nombre),
  desactivar y reactivar, eliminar solo si la cuenta es 0, y una lista de desactivadas. Molde:
  `ProveedoresSection`, sin WhatsApp, contacto ni predeterminado.
- **Rationale**: FR-015–FR-019 con los patrones ya probados en la 019, 020 y 021.

## R12 · Formularios: alta y edición

- **Decision**:
  - **Alta** (`AltaMaterialView`, `alta.ts`, `useBorradorAlta`): `marcaId: string | null` en el input y
    en el borrador, que arranca en `null`. Lo usa cualquier miembro (FR-007). Al guardar, una marca
    eliminada en el ínterin se guarda como `null` y se avisa (Edge Cases).
  - **Edición** (`EditarInsumoForm`, `catalogo.ts`): campo Marca con el valor actual. Una marca actual
    desactivada se muestra marcada como tal y no se ofrece a otros. Solo administración abre la edición
    (hoy el menú solo la ofrece a administración), así que el escenario US1-3 de "el personal ve la
    marca sin cambiarla" se cumple en el detalle.
  - La recepción de compras y `VincularOCrearDialog` no piden marca (FR-004, Clarifications Q1).
    Un insumo creado desde ahí queda sin marca.

## R13 · Dexie v14 y limpieza por tenant

- **Decision**: v14: `marcas: 'id, tenantId, sincronizado'`; `insumos` suma el índice `marcaId`;
  `upgrade` pone `marcaId ??= null`. `inventoryStore.marcas` por `liveQuery`, sin las eliminadas (como
  `proveedores`). `tenancy` borra las marcas sincronizadas de otro tenant al cambiar de tenant.
- **Rationale**: FR-021; mismo patrón que v13 (021).

## R14 · Publicación

- **Decision**: migración `20261025000000_marcas.sql`, en una transacción, sin cambios de datos. Se
  despliega antes que el front (FR-022). Después se publica el front 2.6.0. Hay que verificar con
  `test:rls` los casos de convivencia (R3) antes de mergear.
- **Rationale**: la 2.5.0 sigue funcionando contra el servidor nuevo porque no manda `marca_id` y el
  check del historial solo se amplía. El front nuevo necesita la tabla desde el primer ciclo.
- **Rollback**: si hace falta, el front se revierte sin tocar el servidor: la 2.5.0 convive con él.
