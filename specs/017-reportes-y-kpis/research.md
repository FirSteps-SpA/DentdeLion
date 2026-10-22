# Research: Reportes y KPIs

**Feature**: 017-reportes-y-kpis | **Date**: 2026-10-22

No quedan NEEDS CLARIFICATION: las cinco preguntas se resolvieron el 2026-10-22 (gasto = consumido,
producción = precio completo, valor de inventario en Inicio con variación, períodos fijos + mes
pasado, 13 meses garantizados en el dispositivo).

Punto de partida (`develop` en `37731c3`, spec 016 incluida):

- `inventoryStore` ya tiene en memoria **todos** los insumos (activos y dados de baja), lotes,
  `cambiosLote`, `cambiosInsumo` y los movimientos del tenant **normalizados** a la unidad de
  consumo actual (`normalizarMovimientos`, spec 015 R4).
- `tratamientosStore.realizados` tiene todos los tratamientos realizados con su snapshot (precio,
  porcentaje, `costoMateriales`, `gananciaEstimada`, `anuladoEn`).
- `costoLote(lote, cambiosLote, factores)` da el costo por unidad de consumo **actual** de un lote
  con su precio vigente (correcciones incluidas); `stockLoteEnLugar` y `formatearCLP` existen.
- Las reversiones (deshacer de un consumo rápido y anulación de un tratamiento) son siempre
  `ajuste` con `movimientoOrigenId` = el consumo revertido. No hay ajustes sin origen.
- Todos los usuarios del tenant ven todos sus lugares (spec 014, Clarifications Q1) y el dispositivo
  guarda todos los lugares del tenant.
- `Insumo.categoria` es texto; las categorías se agrupan por `claveCategoria` (spec 010).
- **Hallazgo**: los pulls de `movimientos`, `lotes`, `tratamientos_realizados`, `cambios_lote`,
  `cambios_insumo` y `cambios_tratamiento` hacen `select('*')` sin paginar, y PostgREST corta en
  `max_rows = 1000` (`supabase/config.toml`; el mismo valor por defecto en el proyecto alojado). Con
  más de 1.000 filas, un dispositivo nuevo baja la historia **truncada** sin error.

---

## R1. Cálculo: funciones puras sobre los stores, sin tablas ni stores nuevos

- **Decision**: una feature `src/features/reportes/` con lógica pura en `lib/` (períodos, KPIs,
  gasto, gráficos, valor de inventario) que recibe arrays y devuelve resultados, y un hook
  `useReportes(periodo, lugar)` que la alimenta desde `inventoryStore`, `tratamientosStore` y
  `lugarStore` con `useMemo`. Nada se guarda: todo es derivado (spec, Key Entities).
- **Rationale**: Constitución II (estado reactivo en Zustand, derivados en memoria) y IV (cálculo
  local). Los stores ya tienen los datos normalizados, así que no hace falta leer Dexie (y se
  respeta la prueba de arquitectura `lecturas-movimientos.test.ts`). Las funciones puras se prueban
  con datos sintéticos sin montar la UI.
- **Alternatives considered**: tablas de agregados mensuales en Dexie (más rápido con historias
  enormes, pero hay que mantenerlas consistentes con sync y correcciones de precio); vistas o RPC en
  Postgres (rompe offline, Constitución I).

## R2. Gasto en materiales = consumo valorizado al costo del lote

- **Decision**: para cada movimiento `consumo` del período y del lugar:
  `gasto += cantidad (normalizada) × costoLote(lote)`. Para cada `ajuste` con `movimientoOrigenId`
  que apunte a un consumo: `gasto −= cantidad × costoLote(lote)`, **imputado a la fecha y el lugar
  del consumo original** (deshacer el consumo de ayer baja el gasto de ayer). Los consumos de lotes
  sin precio no suman y se cuentan en `materialesSinPrecio` ("N materiales sin precio", insumos
  distintos). Ingresos y traslados nunca son gasto.
- **Rationale**: Clarifications Q1 (lo consumido, al costo de su lote). Como `costoLote` y la
  cantidad normalizada están ambos en la unidad de consumo actual, el producto es correcto aunque el
  insumo se haya convertido (spec 015). Imputar la reversión al consumo evita gastos negativos en un
  mes por deshacer algo del mes anterior.
- **Notas**:
  - Incluye los consumos de tratamientos y los consumos rápidos. Por eso el gasto puede diferir de
    la suma de `costoMateriales` de los tratamientos (que usa el costo unitario vigente al
    registrar, spec 016 FR-016). Se documenta en la ayuda de la tarjeta.
  - Precio corregido después: el consumo se revaloriza (edge case de la spec).
- **Alternatives considered**: costo unitario vigente del insumo (no refleja lo que costó lo usado);
  imputar la reversión a su propia fecha (meses con gasto negativo).

## R3. Producción y ganancia estimada desde los snapshots

- **Decision**: sobre `tratamientosStore.realizados` sin `anuladoEn`, del período y lugar:
  `produccion = Σ precio` (no nulos), `ganancia = Σ gananciaEstimada` (no nulas),
  `tratamientosSinPrecio = #{precio === null}`; los registros con precio pero sin % profesional
  (`gananciaEstimada === null`) suman a producción y se cuentan en `tratamientosSinPorcentaje` ("N sin % profesional"). Se
  reutiliza la idea de `totalesHistorial` (spec 016) pero con períodos propios.
- **Rationale**: Clarifications Q2 (precio completo) y spec 016 FR-016 (snapshot inmutable).
- **Alternatives considered**: recalcular con precios actuales (contradice el snapshot).

## R4. Períodos y ventana de 13 meses

- **Decision**: tipo `Periodo` = `{ tipo: 'esteMes' | 'mesAnterior' | 'ultimos3' | 'esteAnio' }` o
  `{ tipo: 'mes', anio, mes }`. Rango `[desde, hasta)` en **hora local del dispositivo** (Chile), con
  la misma convención de `historial.ts`:
  | Período | Rango | Período anterior |
  |---|---|---|
  | Este mes | día 1 → ahora | mes anterior **completo** |
  | Mes anterior / mes elegido | mes completo | mes que lo precede |
  | Últimos 3 meses | 3 meses calendario terminando en el actual | los 3 previos |
  | Este año | 1 de enero → ahora | 1 de enero → fin del mismo mes del año anterior |
  - **Ventana**: desde el día 1 del mes actual − 12 meses. El selector de mes pasado ofrece solo los
    12 meses completos de la ventana. Si el período anterior empieza antes de la ventana, la
    variación es "Sin datos del período anterior" (FR-018a).
- **Rationale**: Clarifications Q4 y Q5; el mes en curso contra el mes anterior completo (edge
  case de la spec).
- **Alternatives considered**: zona fija `America/Santiago` con `Intl` (los dispositivos de la
  clienta ya están en Chile y el resto de la app usa hora local; se evalúa si aparece un tenant fuera
  de Chile).

## R5. Variación de un KPI

- **Decision**: `variacion = (actual − anterior) / |anterior|`. Casos: período anterior fuera de la
  ventana → `sin-datos`; anterior = 0 y actual ≠ 0 → `nuevo`; ambos 0 → sin variación. Sentido:
  producción y ganancia "mejoran" al subir; gasto "mejora" al bajar (verde/rojo según eso, flecha
  según el signo).
- **Rationale**: FR-005 y edge case "Variación sobre base 0".

## R6. Gráficos

- **Decision**:
  - **Consumo por categoría**: R2 agrupado por `claveCategoria(insumo.categoria)` (nombre visible:
    el del catálogo; vacío → "Sin categoría"); orden descendente; si hay más de 5, las 4 mayores +
    "Otras".
  - **Gastos mensuales**: R2 por mes, 6 meses que terminan en el último mes del período (12 si es
    "Este año"), recortado a la ventana.
  - **Materiales más utilizados**: R2 por insumo (incluye dados de baja, marcados), top 10 por
    costo, con la cantidad neta en la unidad de consumo actual.
  - **Ganancia por lugar**: R3 por lugar; solo en "Todos" con ≥ 2 lugares con datos en el período
    (FR-012); incluye
    lugares desactivados con datos del período.
- **Rationale**: spec FR-009 a FR-012 y DS §34–35.

## R7. Gráficos en SVG propio, sin dependencias

- **Decision**: cuatro componentes React que dibujan SVG (`DonutChart`, `LineChart`,
  `HorizontalBarChart`, `BarChart`) con los tokens de color del DS §35 como variables CSS, detalle del
  monto exacto al tocar la leyenda o la etiqueta (hover solo como complemento en desktop), y una tabla alternativa visualmente oculta (`sr-only`) más un botón
  "Ver como tabla". El **objetivo táctil** es la leyenda o la etiqueta de cada elemento (filas-botón
  de ancho completo, ≥ 48 px), no la figura: un sector del 2 % o una barra corta no alcanzan 48 px
  (Constitución III). La implementación sigue la guía de la skill `dataviz` (marcas, ejes, contraste en
  claro y oscuro).
- **Rationale**: son 4 gráficos simples con ≤ 12 puntos o barras; una librería (Recharts ≈ 100 kB
  gz, Chart.js ≈ 70 kB) pesa más que todo el código propio, agrega una dependencia a la PWA y
  dificulta respetar el área táctil de 48 px y el tema. La pila obligatoria no cubre gráficos, pero
  agregar una dependencia grande no está justificado.
- **Alternatives considered**: Recharts, Chart.js, `uplot` (descartadas por peso y accesibilidad).

## R8. Valor de inventario (Inicio)

- **Decision**: `valor(lugar, fecha) = Σ lotes stockLoteEnLugar(movimientos hasta fecha) ×
  costoLote(lote)` para lotes **no caducados a esa fecha** con stock > 0. "Todos" = suma de
  lugares. Variación contra `valor(lugar, fin del mes anterior)`, reconstruido desde los movimientos
  (Clarifications Q3). Lotes con stock sin precio → "desde $X · N lotes sin precio". Se usa el
  precio vigente hoy también para el cierre anterior (no hay historial de precios por fecha más allá
  de `cambiosLote`; la diferencia sería mínima y se documenta).
- **Rationale**: DS §20 y spec FR-015.
- **UI**: `KpiCard` gana un prop opcional `variacion` (flecha, texto y tono) y la tarjeta Valor de
  inventario va **primero** en el grid de Inicio, ocupando 2 columnas en móvil (5 tarjetas en
  `desk:grid-cols-5`). Al tocarla navega a Reportes.

## R9. Historia completa en el dispositivo: pulls paginados

- **Decision**: un helper `seleccionarTodo(client, tabla)` en `src/lib/sync/` que pagina **por
  cursor** (`.order('id').gt('id', últimoId).limit(1000)`, la primera página sin `gt`) hasta
  recibir una página incompleta, usado por los pulls
  de `movimientos`, `lotes`, `cambios_lote`, `cambios_insumo`, `cambios_tratamiento` y
  `tratamientos_realizados`. El dispositivo **no borra** historia (ya es así), así que con pulls
  completos la ventana de 13 meses queda garantizada (FR-018a). Si una página falla, el ciclo
  registra el error y no aplica esa tabla parcialmente (mismo comportamiento que hoy ante error).
- **Rationale**: sin esto, un dispositivo nuevo o reinstalado tendría reportes (y stock) incorrectos
  pasadas las 1.000 filas. Es un arreglo de confiabilidad que esta spec necesita y que también
  protege al inventario.
- **Volumen**: 20.000 movimientos ≈ 20 páginas ≈ 5–6 MB por ciclo completo. Aceptable para la
  clienta actual (cientos de movimientos al mes). Un pull **incremental** (columna de servidor
  `recibido_en` + cursor) queda como mejora posterior si el volumen lo exige; se mide en el ensayo
  (quickstart §5).
- **Por qué cursor y no `range`**: con desplazamiento, una inserción entre páginas corre las filas
  (duplicados, inocuos con `bulkPut`) y un borrado haría saltar una; el cursor por `id` no depende
  del desplazamiento.
- **Alternatives considered**: paginar con `.range()` (ver arriba); subir `max_rows` (no escala y es configuración del proyecto
  alojado); pull incremental ya (requiere migración y trigger de actualización en anulaciones; más
  riesgo para esta spec).

## R10. Aviso "puede faltar información"

- **Decision**: Reportes muestra el aviso si `syncStore.ultimaExitosaEn` es `null` (el dispositivo
  nunca completó un ciclo) o si `syncStore.fase === 'sincronizando'` en la primera carga, enlazando
  al indicador de la spec 012.
- **Rationale**: FR-018 y edge case "Datos aún sincronizando".

## R11. Navegación

- **Decision**: nueva vista `'reportes'` en `SECCIONES` con `soloLateral: true` (sidebar en tablet y
  desktop), ícono `ChartColumn` de Lucide, y un acceso "Reportes" en "Más" (`AjustesView`), igual
  que Compras (spec 016 R7). Orden en la sidebar: Inicio, Inventario, Tratamientos, Compras,
  Reportes, Alertas, Ajustes.
- **Rationale**: FR-001; la barra inferior móvil ya tiene 5 ítems.

## R12. Rendimiento

- **Decision**: un solo recorrido de movimientos por cálculo, con un `Map` de costo por lote
  precalculado (`costoLote` una vez por lote) y un `Map` lote → insumo; los resultados se memorizan
  por `(periodo, lugar, versiones de los stores)`. Prueba de rendimiento con 20.000 movimientos y
  3.000 tratamientos sintéticos: cálculo completo < 300 ms en Node (margen para SC-004, < 2 s en el
  dispositivo).
- **Rationale**: SC-004. La medición en el dispositivo (Chromium con CPU 4× más lenta, semilla de
  volumen) se anota aquí al hacer T043.
