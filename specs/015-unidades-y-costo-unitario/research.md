# Research: Unidades y Costo Unitario

**Feature**: 015-unidades-y-costo-unitario | **Date**: 2026-10-19

No quedan NEEDS CLARIFICATION: las tres preguntas de la spec se resolvieron el 2026-10-19
(conversión permitida, último ingreso con precio, precios abiertos a todo el tenant). Este
documento fija las decisiones técnicas.

Punto de partida verificado en el código (`develop` en `cf65fcb`, release 2.3.0):

- `Insumo.unidadMedida` es la única unidad (`caja`, `frasco`, `pieza`, `cartucho`, `mL`, `g`,
  `src/features/insumos/lib/catalogo.ts`); `permiteDecimales` se deriva de ella (`quantity.ts`).
- El stock es siempre la suma de los movimientos del lote (`stock.ts`), sin contador mutable.
- Cada lote tiene **exactamente un** movimiento `ingreso`: solo lo escriben `alta.ts` (stock
  inicial) y `recepcion.ts` (recepción de compras), y ambos crean un lote nuevo.
- Los datos de catálogo se editan con el ledger append-only `cambios_insumo` y se proyectan con
  `proyectarInsumo` (`(creadoEn, id)` gana). Solo administración inserta en él (RLS).
- `lotes` se sube completo en cada ciclo (upsert), `movimientos` es insert-only.
- Hay lecturas directas de `db.movimientos` para stock fuera de los stores: `consumoRapido.ts`,
  `ConsumoForm.tsx`, `traslado.ts` y la reconciliación de sobregiros en `sync/index.ts`.

---

## R1. Catálogo de unidades: constante de código, `pieza` → `unidad`

- **Decision**: el catálogo del DS §25 es una constante de código `UNIDADES` (clave, singular,
  plural, `decimales`), que reemplaza a `UNIDADES_MEDIDA`/`ETIQUETAS_UNIDAD`. Claves: `caja`,
  `frasco`, `botella`, `jeringa`, `cartucho`, `paquete`, `kit`, `unidad`, `rollo`, `mL`, `L`, `g`,
  `mg`, `m`, `cm`. Admiten decimales `mL`, `L`, `g`, `mg`, `m`, `cm` (FR-002). Las claves actuales se
  conservan; `pieza` se renombra a `unidad` en servidor y dispositivo, incluidos los valores de
  `cambios_insumo` con `campo = 'unidadMedida'`. Un `normalizarUnidad()` mapea `pieza` → `unidad` en
  la proyección y en un trigger del servidor, por si un cliente 2.3.0 vuelve a subir `pieza`.
- **Rationale**: el catálogo es fijo y común a los tenants (Assumptions de la spec); una tabla no
  aporta nada y obligaría a sincronizarla. Conservar las claves evita migrar los demás valores.
- **Alternatives considered**: tabla `unidades` en Supabase (configurable, innecesario); mantener
  `pieza` como alias visible (dos nombres para lo mismo, confunde).

## R2. El stock sigue en la unidad de consumo; cada movimiento guarda su unidad

- **Decision**: `Insumo.unidadMedida` pasa a significar **unidad de consumo** (se conserva el nombre
  del campo para no tocar el ledger ni la columna `unidad_medida`). Todo movimiento agrega `unidad`:
  la unidad de consumo vigente en el dispositivo al registrarlo. La migración la rellena con la
  unidad actual del insumo. En el servidor, un trigger `before insert` la completa desde el insumo
  cuando viene `null` (clientes 2.3.0).
- **Rationale**: con contenido 1 y la misma unidad, ningún valor cambia (FR-011, SC-001). La unidad
  explícita es lo único que permite convertir de forma determinista un consumo registrado sin red en
  la unidad anterior y subido después de una conversión (FR-007a): su `creadoEn` no basta, porque el
  reloj del dispositivo puede ser posterior a la conversión aunque no la conociera.
- **Alternatives considered**: reescribir los movimientos al convertir (viola el ledger insert-only
  y la Constitución IV); inferir la unidad por fecha (falla con offline, como se explicó); guardar el
  stock en la unidad de compra (no permite descontar un cartucho).

## R3. Conversión de la unidad de consumo: factor en el ledger y plegado determinista

- **Decision**: cambiar la unidad de consumo escribe un `CambioInsumo` `campo = 'unidadMedida'` con
  una columna nueva `factor` (cuántas unidades nuevas hay en una anterior; `> 0`). Los cambios
  `unidadMedida` previos a esta spec tienen `factor = null` y valen como factor 1 (eran un cambio de
  etiqueta, sin cambio de cantidades). La tabla de factores de un insumo se obtiene plegando sus
  cambios `unidadMedida` vigentes en orden `(creadoEn, id)`:

  ```text
  actual := unidad original (valorAnterior del primer cambio, o la del insumo si no hay)
  f := { actual: 1 }                 # f[u] = cuántas unidades actuales vale 1 u
  por cada cambio c (desde → hasta, factor k):
      base := f[c.desde] ?? 1        # c.desde siempre fue actual en algún momento
      para cada u en f: f[u] := f[u] / base * k
      f[c.hasta] := 1; actual := c.hasta
  ```

  Un movimiento vale `cantidad × f[movimiento.unidad]` en la unidad actual. La función es pura y da
  el mismo resultado en todos los dispositivos, sin importar el orden de llegada (como
  `proyectarInsumo`). Dos conversiones concurrentes desde la misma unidad se componen por orden y
  ninguna cantidad se pierde.
- **Mínimos**: la conversión escribe, en la misma transacción Dexie, un cambio `stockMinimo`
  convertido y actualiza `minimosLugar` del insumo. Un mínimo editado sin red en la unidad anterior
  por otra administradora mientras tanto quedaría sin convertir: riesgo aceptado y documentado (dos
  administradoras offline editando el mismo insumo; se corrige editando el mínimo).
- **Validación** (FR-007a, Edge Cases): factor `> 0`; si la nueva unidad no admite decimales, el
  stock convertido de cada lote en cada lugar y el mínimo deben dar enteros, si no se rechaza con
  "El stock de N lotes no es múltiplo de …". Solo administración (el RLS de `cambios_insumo` ya lo
  exige).
- **Conversión rechazada por el servidor** (rol perdido antes de sincronizar): la proyección la
  deshace, como hoy. Para los movimientos que se hayan registrado en la unidad rechazada, el
  plegado usa además las conversiones rechazadas solo para resolver `f` de unidades desconocidas;
  si aun así no hay factor, vale 1 y se reporta a Sentry.
- **Rationale**: reutiliza el ledger, su RLS, su push con reintento por fila y su proyección; no
  hace falta una tabla nueva ni reescribir historia (Constitución I y IV).
- **Alternatives considered**: tabla `conversiones_unidad` aparte (duplica el ledger);
  `valor_nuevo` como objeto JSON `{unidad, factor}` (rompe el tipo escalar de `valorNuevo` y
  `deshacerCambios`); prohibir la conversión (descartado en Clarifications Q1).

## R4. Un solo punto de conversión para leer stock

- **Decision**: `stock.ts` agrega `cantidadEnUnidadActual(movimiento, factores)` y
  `factoresDeUnidad(insumo, cambios)`. `inventoryStore` expone los movimientos ya normalizados a la
  unidad actual (copia con `cantidad` convertida; la fila Dexie no cambia), así las funciones puras
  de alertas, FEFO, Inicio, sugeridos y tabla no cambian. Las lecturas directas de
  `db.movimientos` para stock (`consumoRapido.ts`, `ConsumoForm.tsx`, `traslado.ts`, reconciliación
  de sobregiros en `sync`) pasan por un helper `movimientosNormalizadosDeLote(loteId)`. Una prueba
  de arquitectura (grep en Vitest) falla si aparece otra lectura de `db.movimientos` fuera de la
  lista permitida.
- **Escritura**: `crearMovimiento` pone `unidad = insumo.unidadMedida` (lo resuelve desde el lote).
  Consumos, ajustes y traslados siguen en unidad de consumo (FR-008). El servidor exige en
  `verificar_traslado` que salida y entrada tengan la misma `unidad`.
- **Rationale**: limita el cambio a un lugar y protege las ~15 funciones de stock existentes.
- **Alternatives considered**: pasar los factores a cada función pura (toca todas las firmas y
  todos los tests); guardar `cantidad` convertida en Dexie (dos verdades).

## R5. Presentación de compra en el insumo y snapshot en el lote

- **Decision**: `Insumo` agrega `unidadCompra` y `contenido` (por defecto la unidad de consumo y 1).
  Se editan con `cambios_insumo` (campos nuevos `unidadCompra` y `contenido`), solo administración,
  y no tocan stock (FR-006, FR-007). `Lote` agrega un **snapshot** del ingreso: `cantidadIngresada`
  y `unidadIngresada` (lo que escribió la persona: `2` `caja`), `contenido` y `unidadConsumo`
  vigentes al ingresar. El movimiento `ingreso` guarda `cantidad = cantidadIngresada × contenido`
  (o la cantidad tal cual si se ingresó en unidad de consumo) y `unidad = unidadConsumo`. El
  historial muestra "2 cajas (100 cartuchos)" desde el lote (FR-010): cada lote tiene un solo
  ingreso.
- **Inmutabilidad**: el trigger `proteger_lote` del servidor conserva en `update` los valores
  originales de `cantidad_ingresada`, `unidad_ingresada`, `contenido`, `unidad_consumo` y
  `precio_compra` (el upsert de lotes de cada ciclo no los puede pisar). Los clientes 2.3.0 no
  envían estas columnas: en `insert` el trigger las completa desde el insumo (contenido 1, sin
  precio).
- **Rationale**: el snapshot hace que cambiar Caja × 50 a Caja × 100 no altere lotes ni costos
  pasados (Edge Cases) y evita columnas nuevas en el movimiento más allá de `unidad`.
- **Alternatives considered**: presentación en el movimiento (movimientos son insert-only y no
  tendría dónde corregirse el precio); recalcular con la presentación actual (cambia el pasado).

## R6. Precio: por unidad de compra en el lote, correcciones en `cambios_lote`

- **Decision**: `Lote.precioCompra` = pesos por **unidad de compra** del snapshot (`null` = sin
  precio, `0` = gratis; FR-014), `numeric` sin redondear. El formulario acepta precio por unidad o
  total pagado; con total, `precioCompra = total / presentaciones`, donde presentaciones =
  `cantidadIngresada` (si se ingresó en unidad de compra) o `cantidad / contenido`. Costo del lote
  por unidad de consumo actual = `precioCompra / (contenido × f[unidadConsumo])`.
  Las correcciones (FR-015) van a una tabla nueva append-only **`cambios_lote`** (`campo =
  'precioCompra'`, `valor_anterior`, `valor_nuevo`, `usuario_id`, `creado_en`), con el mismo patrón
  de `cambios_insumo`: inserta cualquier miembro del tenant como sí mismo, gana `(creadoEn, id)`,
  bandera local `sincronizado`, y el precio vigente = último cambio o, si no hay, `lote.precioCompra`.
- **Rationale**: Q3 abre el precio a todo el equipo, así que no hay rechazos por rol que manejar,
  pero sí ediciones concurrentes sin red: un ledger las resuelve sin perder valores (FR-015,
  Constitución I) y deja la auditoría. `lote.precio_compra` queda inmutable (R5).
- **Alternatives considered**: actualizar `lotes.precio_compra` por upsert (el último dispositivo en
  sincronizar pisa a los demás y no queda historial); guardar el costo por unidad de consumo
  (pierde el valor que la persona escribió y redondea divisiones no exactas).

## R7. Costo unitario del insumo: último ingreso con precio

- **Decision** (Clarifications Q2, FR-012): función pura `costoUnitarioInsumo(insumo, lotes,
  cambiosLote, factores)`: entre los lotes del insumo **de todo el tenant** con precio vigente no
  nulo, el de mayor `(creadoEn, id)` del lote (= fecha del ingreso); devuelve su costo por unidad de
  consumo actual o `null` ("Sin precio"). Se calcula en memoria en `inventoryStore`, sin conexión
  (FR-022). Se muestra con `Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP',
  maximumFractionDigits: 0 })` (FR-017).
- **Rationale**: es la regla elegida, la más simple, y refleja el precio de reposición; usar todo el
  tenant evita que un lugar sin compras propias quede "Sin precio" (el catálogo es del tenant).
- **Alternatives considered**: por lugar activo (un box abastecido por traslados nunca tendría
  precio); promedio ponderado o FEFO (descartados en Q2).

## R8. Cantidad sugerida en la lista de compras

- **Decision**: hoy `ItemSugerido` no tiene cantidad. Se agrega `presentacionesSugeridas` solo para
  insumos bajo mínimo: `max(1, ceil((mínimo efectivo − stock) / contenido))`, y se muestra "Pedir
  2 cajas (100 cartuchos)" (FR-020). Los ítems solo caducados no llevan cantidad. La recepción
  propone esa cantidad en unidad de compra. Los ítems manuales no cambian (cantidad libre).
- **Rationale**: es la cantidad mínima de presentaciones completas para salir de la alerta; no hay
  "stock ideal" en el modelo para apuntar más alto.
- **Alternatives considered**: llegar al doble del mínimo (arbitrario); stock ideal del DS §24 (no
  existe en el modelo; queda fuera de alcance).

## R9. Formato del equivalente en unidades de compra

- **Decision**: `formatearEquivalente(stock, insumo)` → "120 cartuchos ≈ 2 cajas + 20" cuando
  `unidadCompra ≠ unidadMedida`; si el resto es 0, "≈ 2 cajas"; con unidades decimales, "1.250 mL ≈
  2,5 frascos". Plural desde el catálogo (R1). Se usa en tabla, tarjeta, detalle y compras (FR-021).

## R10. Migraciones y compatibilidad

- **Servidor** (`20261021000000_unidades_y_costo.sql`): columnas nuevas con default, backfill
  (`pieza` → `unidad`, `unidad` de movimientos desde el insumo, snapshot de lotes con contenido 1),
  `cambios_insumo.factor`, campos nuevos en el check, tabla `cambios_lote` con RLS por tenant,
  triggers `normalizar_unidad`, `completar_unidad_movimiento`, `proteger_lote` (reemplaza
  `proteger_resolucion_lote`, conserva su regla) y `proteger_catalogo_insumo` ampliado
  (`unidad_compra`, `contenido`). Detalle en [contracts/supabase-schema.md](./contracts/supabase-schema.md).
- **Dexie v11**: mismo backfill local más la tabla `cambiosLote`. Se prueba con `fake-indexeddb`
  (como `dexie-v10.test.ts`) y en Chromium real.
- **Clientes 2.3.0 durante el despliegue**: siguen funcionando gracias a los triggers (insertan
  movimientos y lotes sin las columnas nuevas; `pieza` se normaliza). Pero no conocen las
  conversiones: un 2.3.0 mostraría el stock sin convertir. Por eso, como en la 014, **antes de la
  primera conversión** todos los dispositivos del tenant deben estar en la versión nueva.
- **Ensayo**: la migración se prueba sobre una restauración del respaldo de producción y se compara
  el stock por lote y lugar antes y después (SC-001).

## R11. Pruebas

- Unit: catálogo y decimales, `factoresDeUnidad` (cadena, concurrentes, rechazadas, legado sin
  factor), conversión de ingreso, precio por total, `costoUnitarioInsumo`, sugeridas,
  `formatearEquivalente`, proyección con `pieza`, upgrade Dexie v11, sync de `cambiosLote` y de las
  columnas nuevas, prueba de arquitectura de lecturas de `db.movimientos`.
- Integration (RTL): alta y edición de presentación, ingreso en cajas y en unidades, precio y
  total, tabla con Presentación y Costo unitario, corrección de precio, conversión de unidad,
  compras con presentaciones sugeridas, todo sin red.
- `test:rls`: `cambios_lote` aislado entre tenants; personal inserta precio; inmutabilidad de
  `precio_compra`; non-admin no cambia `unidad_compra`/`contenido`; trigger de `unidad` en
  movimientos; traslado con unidades distintas rechazado.
