# Research: Lugares que comparten bodega

## R1 — Cómo se guarda la bodega

**Decision**: una columna nueva `lugares.bodega_id uuid null`. La bodega de un lugar es
`bodega_id ?? id`. Un lugar solo (lo de hoy) tiene `bodega_id = null`. Lugares que comparten bodega
tienen el mismo `bodega_id`: un uuid nuevo, distinto de cualquier id de lugar, que se genera al
juntar.

**Rationale**: la bodega no tiene nombre ni datos propios (spec, Key Entities), así que una tabla
`bodegas` solo agregaría sincronización. Los lugares ya se editan sin conexión y suben con un upsert
de fila completa (`toLugarRow`) que solo administración puede hacer (policy "lugares: administrador
actualiza"). La columna viaja con eso. Un cliente viejo que hace upsert sin la clave `bodega_id` la
conserva, como pasó con `marca_id` en la spec 023.

**Por qué un uuid nuevo y no el id de uno de los lugares**: si la bodega usara el id del lugar
"ancla" y ese lugar se separara, quedaría con la misma bodega efectiva que el resto (`null ?? id` =
id del ancla). El uuid nuevo evita ese caso.

**Alternatives considered**: tabla `bodegas` + `lugares.bodega_id` FK (más sync, sin beneficio);
tabla de pares de lugares (consultas más difíciles, ciclos).

## R2 — Stock común: generalizar la vista del lugar

**Decision**: `datosDeLugar(datos, minimos, lugarId)` pasa a `datosDeBodega(datos, minimos,
lugarIds: Set<string>)`. El filtro `movimiento.lugarId === lugarId` cambia a `lugarIds.has(...)`, y
lo mismo para lotes visibles e ítems de compra. Un helper `lugaresDeBodega(lugarId, lugares)` da el
conjunto (con un lugar solo, el conjunto tiene ese único lugar y el resultado es idéntico a hoy, FR-019).

**Rationale**: desde la spec 014 todos los cálculos (estado, alertas, sugeridos, Inicio) reciben la
"vista del lugar" (research 014 R10) y no saben de lugares. Cambiar el filtro en un solo punto cubre
FR-012 sin tocar cada cálculo.

**Inventario de cambios** (`grep` de filtros por lugar): `vistaLugar.ts`, `stock.ts`
(`lotesEnLugar`), `minimos.ts`, `consumo.ts`, `ajusteStock.ts`, `conversion.ts`,
`ConvertirUnidadDialog.tsx`, `ConsumoForm.tsx`, `TrasladoForm.tsx`, `EditarInsumoForm.tsx`,
`tratamientos/lib/registro.ts`, `RegistrarTratamientoSheet.tsx`, `reconcileOverdraft.ts`,
`ComprasView.tsx`, `AlertasView.tsx`, `InicioView.tsx`, `InventarioView.tsx`, `LugaresSection.tsx`,
`minimosEditor.ts`, `reportes/lib/valorInventario.ts` y `traslado.ts`. Este último valida con
`stockLoteEnLugar` y además debe rechazar un destino de la misma bodega (FR-016). `gasto.ts`, `kpis.ts` y
`tratamientos/lib/historial.ts` siguen por lugar del movimiento (FR-015).

## R3 — Validación de stock y sobregiros (FR-017)

**Decision**: todo lo que hoy valida "stock del lote en el lugar" (consumo, ajuste por lote,
traslado, consumo de un tratamiento, conversión) valida contra el stock del lote en la bodega. Esto
se calcula con la suma de los movimientos de todos los lugares del conjunto, dentro de la misma
transacción Dexie que hoy. `reconcileOverdraft` agrupa por bodega en vez de por lugar.

**Rationale**: el servidor no valida stock (solo `verificar_traslado`, que exige las dos mitades). Es
la decisión offline-first de la spec 002/014: los sobregiros se marcan **En revisión**. La spec se
corrigió: FR-017 decía "el servidor DEBE validar".

## R4 — Mínimo por bodega sin tabla nueva (FR-006)

**Decision**: se sigue usando `minimos_lugar` (una fila por insumo y lugar). Para una bodega
compartida:
- **Lectura**: el mínimo efectivo de la bodega es el **mayor** de los mínimos efectivos de sus lugares
  (cada uno: el propio o el del catálogo, como hoy).
- **Escritura**: editar el mínimo en cualquier lugar de la bodega escribe la misma fila en **todos**
  sus lugares.
- **Al juntar**: se escribe el mínimo elegido (por defecto el mayor) en todos los lugares.
- **Al separar**: el lugar separado ya tiene su fila con el mínimo de la bodega (supuesto de la
  spec), sin trabajo extra.

**Rationale**: no hay migración de mínimos y no hay datos que mover. Si dos dispositivos sin
conexión editan filas distintas, la lectura por "el mayor" es determinista y se corrige en la
siguiente edición, en línea con el "por defecto, el mayor" de la aclaración.

**Alternatives considered**: tabla `minimos_bodega` (migración y sync nuevos, y hay que mover las
filas al juntar o separar); fila solo en un lugar "ancla" (se rompe al separar el ancla).

## R5 — Juntar lugares (US1)

**Decision**: función local `compartirBodega(lugarId, conLugarId, minimosElegidos)` en una
transacción Dexie: calcula el `bodega_id` resultante (el de `conLugarId` si ya está en una bodega;
si no, un uuid nuevo), lo asigna a todos los lugares de ambos grupos (`sincronizado: false`) y escribe
los mínimos elegidos. Se sube con el push de lugares y mínimos de siempre. No crea movimientos: el
stock común es la suma (FR-003).

**Confirmación (FR-004)**: el resumen sale de las vistas antes y después, calculadas en memoria.
Cuenta los insumos con stock en más de un lugar y lista los mínimos distintos.

## R6 — Separar un lugar (US3, FR-007..FR-010)

**Decision**: función local `separarDeBodega(lugarId)` en una sola transacción Dexie:
1. Por cada lote con saldo propio ≠ 0 en el lugar (la suma de **sus** movimientos), un **traslado**
   que lo lleva a 0: `traslado_salida` desde el lugar separado y `traslado_entrada` en otro lugar de
   la bodega (o al revés, si el saldo es negativo). Mismo `traslado_id`, autor y fecha.
2. `bodega_id = null` en el lugar separado. Si en la bodega queda un solo lugar, ese también pasa a
   `null` (US3 AC4).

**Rationale**: el tipo traslado ya existe, el servidor lo acepta (`verificar_traslado`) y aparece en
el historial de ambos lugares (FR-008). Mientras los dos lugares todavía comparten bodega, el
traslado no cambia el stock común. Después de separar, el lugar queda en 0 y la bodega con todo
(FR-009).

**Orden en el servidor**: los movimientos y el cambio de lugar suben en ciclos distintos. Si se
procesan en otro orden, el stock que se ve en cada dispositivo se recalcula con lo que haya llegado.
Siempre converge, porque el stock es una función pura de movimientos + `bodega_id`.

## R7 — "Todos" y valor del inventario (FR-014, FR-015)

**Decision**: `vistasDeLugar` en "Todos" produce **una vista por bodega** (no por lugar), con
`lugares: Lugar[]` y un rótulo "Box 1 + Box 2". `valorInventario(filtro)`: con un lugar de una bodega
compartida, filtra por el conjunto de la bodega y la UI agrega "Stock compartido con …". En "Todos",
las filas son bodegas y lugares independientes, así que la suma no cuenta dos veces (SC-004).

## R8 — Compras comunes (FR-013)

**Decision**: `itemsCompra` se filtran por el conjunto de la bodega. Cada ítem conserva su
`lugarId` (dónde se agregó) y se muestra como etiqueta solo en bodegas compartidas. La recepción
registra el ingreso en el lugar activo, como hoy.

## R9 — Compatibilidad entre versiones

**Decision**: con la migración aplicada, un dispositivo con versión anterior ve el stock por lugar,
como hoy, y puede rechazar un consumo por "stock insuficiente" en un lugar sin stock propio. No se
fuerza nada. La PWA se actualiza sola al abrir, y el despliegue pide no configurar bodegas hasta que
los dispositivos tengan la versión nueva (quickstart §Despliegue). Los datos no se corrompen: los
movimientos de un cliente viejo llevan su lugar y se suman igual.

## R10 — Rendimiento

**Decision**: `lugaresDeBodega` se memoiza por `lugares` (pocos por tenant). Las vistas filtran con
`Set.has`, igual de caro que el `===` de hoy. Sin metas nuevas: aplica la prueba existente de
Reportes de < 300 ms.
