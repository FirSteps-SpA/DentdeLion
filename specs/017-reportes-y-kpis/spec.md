# Feature Specification: Reportes y KPIs

**Feature Branch**: `[017-reportes-y-kpis]`

**Created**: 2026-10-22

**Status**: Draft

**Input**: User description: "spec 017 reportes-y-kpis según el roadmap en 1STEPS/1stDocs"

**Origen**: `1stDocs/005-roadmap/002-DentdeLion.md` § 017 · `reportes-y-kpis` (M–L) y Design
System v1.0 §20 ("Tarjetas KPI"), §28 ("Multi-clínica": cada lugar tiene sus reportes), §34
("Reportes"), §35 ("Gráficos") y §41 ("Principios UX": "¿Cuánto me cuesta? ¿Cuánto gano?", "Evitar
dashboards con demasiados gráficos").

## Contexto

Con las specs 015 y 016, DentdeLion ya guarda el **precio de cada lote** (costo por unidad de
consumo), cada **consumo** con el lote del que salió y cada **tratamiento realizado** con un snapshot
inmutable de precio, porcentaje profesional, costo de materiales y ganancia estimada. Falta poder
**mirar esos datos juntos**: cuánto se produjo, cuánto se gastó en materiales y cuánto se ganó en un
período, y en qué se va el dinero.

Esta spec agrega la sección **Reportes** (DS §34) con:

- **3 KPIs**: Producción, Gasto en materiales y Ganancia estimada, con su variación respecto del
  período anterior (formato de tarjeta del DS §20: "↑ 12 % vs. mes anterior").
- **4 gráficos**: consumo por categoría (donut), gastos mensuales (líneas), materiales más
  utilizados (barras horizontales) y ganancia por lugar de trabajo (barras).
- Filtro por **lugar de trabajo** o "Todos" (spec 014) y por **período**.

Además, **Inicio** suma el KPI **Valor de inventario** (el ejemplo del DS §20), que la spec 013 dejó
fuera hasta tener costos.

**Fuera de alcance**: exportar a Excel, CSV o PDF; envío programado de reportes por correo;
reportes contables (utilidad, impuestos, flujo de caja, conciliación); comparaciones entre tenants;
proyecciones o presupuestos; reportes por profesional o por paciente (no se registran pacientes,
spec 016); gráficos configurables por el usuario; proveedores como dimensión de análisis.

## Clarifications

### Session 2026-10-22

- Q: ¿"Gasto en materiales" es lo comprado o lo consumido? → A: Lo consumido: costo de los materiales que salieron del inventario en el período, valorizados al costo de su lote; así se compara con Producción y Ganancia estimada del mismo período.
- Q: ¿"Producción" suma el precio completo de los tratamientos o solo la comisión profesional? → A: El precio completo (lo que paga el paciente según el precio del lugar); la comisión ya está implícita en la Ganancia estimada.
- Q: ¿Se agrega la tarjeta "Valor de inventario" y dónde? → A: En Inicio, con su variación frente al cierre del mes anterior (DS §20), reconstruido desde los movimientos.
- Q: ¿Alcanzan los períodos fijos o se necesita rango libre o meses pasados? → A: Los 4 fijos más elegir cualquier mes calendario pasado (sin rango libre).
- Q: ¿Cuánto historial deben cubrir los reportes sin conexión? → A: Se garantizan los últimos 13 meses en el dispositivo; los meses más antiguos no se reportan.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Ver producción, gasto y ganancia del período (Priority: P1)

Como administradora, quiero abrir Reportes y ver de inmediato cuánto produje, cuánto gasté en
materiales y cuánto gané (estimado) este mes en el lugar donde atiendo, comparado con el mes
anterior, para saber cómo voy sin hacer cálculos.

**Why this priority**: Responde "¿Cuánto me cuesta? ¿Cuánto gano?" (DS §41); es el valor central de
la spec y lo que justifica haber cargado precios y tratamientos.

**Independent Test**: Con 3 tratamientos registrados este mes en "Clínica Providencia" (precios
$45.000, $45.000 y $30.000) y 2 el mes anterior, Reportes muestra Producción $120.000, el gasto y la
ganancia estimada del mes, y la variación de cada KPI frente al mes anterior.

**Acceptance Scenarios**:

1. **Given** la sección Reportes, **When** se abre, **Then** muestra el período "Este mes" en el
   lugar activo, con las tarjetas Producción, Gasto en materiales y Ganancia estimada, en ese orden.
2. **Given** tratamientos realizados en el período, **When** se calcula **Producción**, **Then** es
   la suma de los precios guardados en el snapshot de cada tratamiento vigente (no anulado).
3. **Given** tratamientos realizados en el período, **When** se calcula **Ganancia estimada**,
   **Then** es la suma de las ganancias estimadas guardadas en sus snapshots, y la tarjeta se rotula
   "Ganancia estimada" con la aclaración de que no es utilidad contable (DS §27).
4. **Given** el período elegido, **When** se calcula **Gasto en materiales**, **Then** es el costo de lo
   consumido en el período, valorizado al costo de cada lote (FR-004); las compras del período no
   cuentan como gasto.
5. **Given** datos del período anterior equivalente, **When** se muestra cada KPI, **Then** indica
   la variación porcentual con flecha y color (verde si mejora, rojo si empeora; para el gasto,
   subir es empeorar), o "Sin datos del período anterior" si no hay base de comparación.
6. **Given** el selector de período, **When** se elige "Mes anterior", "Últimos 3 meses" o "Este
   año", **Then** los KPIs y los gráficos se recalculan para ese período y comparan con su período de
   comparación (FR-005).
7. **Given** el selector de período, **When** se elige un mes calendario pasado (p. ej. marzo de
   2026), **Then** los KPIs y gráficos muestran ese mes y lo comparan con el mes anterior (febrero).
8. **Given** tratamientos sin precio en su lugar (spec 016), **When** se calculan los KPIs, **Then**
   no suman a Producción ni a Ganancia estimada y la tarjeta indica "N tratamientos sin precio".

---

### User Story 2 - Filtrar por lugar de trabajo y ver "Todos" (Priority: P1)

Como dentista que atiende en varios lugares, quiero ver los reportes de cada lugar por separado y
también todos juntos, y comparar cuánto gano en cada uno.

**Why this priority**: Cada lugar tiene precios y porcentajes distintos (spec 016); sin separarlos,
los números no sirven para decidir. Es requisito del DS §28 ("cada clínica tendrá… reportes").

**Independent Test**: Con tratamientos en "Clínica Providencia" y "Box Las Condes", Reportes en
"Todos" muestra la suma de ambos y el gráfico "Ganancia por lugar" con una barra por lugar; al
cambiar a un lugar, los KPIs muestran solo ese lugar.

**Acceptance Scenarios**:

1. **Given** el selector de lugar de la app (spec 014), **When** se cambia de lugar, **Then**
   Reportes muestra solo los datos de ese lugar.
2. **Given** "Todos", **When** se abre Reportes, **Then** los KPIs suman todos los lugares del
   tenant a los que el usuario tiene acceso.
3. **Given** "Todos" y dos o más lugares con datos en el período, **When** se muestra el gráfico **Ganancia por lugar**,
   **Then** hay una barra por lugar con su ganancia estimada del período, ordenadas de mayor a
   menor.
4. **Given** un lugar específico, o "Todos" con un solo lugar con datos en el período, **When** se abre Reportes, **Then**
   el gráfico Ganancia por lugar no se muestra (no aporta comparación).

---

### User Story 3 - Ver en qué se gastan los materiales (Priority: P2)

Como administradora, quiero ver qué categorías y qué materiales concentran el gasto, y cómo
evoluciona mes a mes, para decidir dónde ahorrar o qué comprar mejor.

**Why this priority**: Es el análisis que pide el DS §34, pero depende de que haya precios cargados
y aporta menos que los KPIs del día a día.

**Independent Test**: Con consumos valorizados de anestesia, resina y guantes en los últimos meses,
Reportes muestra el donut por categoría, la línea de gastos de los últimos 6 meses y el top de
materiales más utilizados del período.

**Acceptance Scenarios**:

1. **Given** consumos con costo en el período, **When** se muestra **Consumo por categoría**
   (donut), **Then** cada sector es el costo de lo consumido de esa categoría, con su monto y su
   porcentaje; si hay más de 5 categorías, se muestran las 4 mayores y el resto agrupado en "Otras"
   (DS §35: máximo 5 colores).
2. **Given** el período elegido, **When** se muestra **Gastos mensuales** (líneas), **Then** hay
   un punto por mes con el gasto en materiales (FR-004) de los 6 meses que terminan en el último mes
   del período (12 si el período es "Este año").
3. **Given** consumos en el período, **When** se muestra **Materiales más utilizados** (barras
   horizontales), **Then** se listan hasta 10 materiales ordenados por costo consumido, cada uno con
   su monto y la cantidad consumida en su unidad de consumo.
4. **Given** cualquier gráfico, **When** se toca la entrada de la leyenda o la etiqueta de un
   elemento (objetivo de al menos 48 × 48 px), **Then** se resalta el elemento y se ve su valor
   exacto; y cada gráfico tiene una alternativa en texto (lista o tabla) para lectores de pantalla.
5. **Given** consumos de lotes sin precio, **When** se calculan los gráficos, **Then** esos
   consumos no se valorizan y se indica "Incluye N materiales sin precio, no valorizados".

---

### User Story 4 - Valor de inventario en Inicio (Priority: P3)

Como administradora, quiero ver en Inicio cuánto dinero tengo en inventario en el lugar activo y
cómo cambió respecto del mes anterior, como en el ejemplo del DS §20.

**Why this priority**: Es útil y el DS lo usa de ejemplo, pero no responde a una decisión diaria
como los KPIs de Reportes.

**Independent Test**: Con lotes con precio en el lugar, Inicio muestra "Valor de inventario
$1.284.500 · ↑ 12 % vs. mes anterior", y al tocarlo abre Reportes.

**Acceptance Scenarios**:

1. **Given** lotes con stock y precio en el lugar activo, **When** se abre Inicio, **Then** la
   tarjeta Valor de inventario muestra Σ (stock de cada lote × su costo por unidad de consumo),
   excluyendo lotes caducados.
2. **Given** el cierre del mes anterior, **When** se muestra la tarjeta, **Then** indica la
   variación porcentual frente al valor de inventario al último día de ese mes.
3. **Given** lotes con stock sin precio, **When** se calcula el valor, **Then** se muestra como
   "desde $X" con la nota "N lotes sin precio".
4. **Given** la tarjeta, **When** se toca, **Then** abre Reportes con el mismo lugar.
5. **Given** "Todos", **When** se abre Inicio, **Then** el valor suma los lugares accesibles.

---

### Edge Cases

- **Sin datos todavía** (lugar nuevo, sin precios ni tratamientos): Reportes muestra un estado vacío
  que explica qué se necesita ("Registra tratamientos y precios de compra para ver tus reportes"),
  sin gráficos en blanco ni KPIs en $0 que parezcan resultados.
- **Tratamiento anulado** (spec 016): no suma a ningún KPI ni gráfico; si se anula un registro de un
  período ya visto, los valores se recalculan al reabrir Reportes.
- **Consumo deshecho** (spec 007) o ajustes vinculados: se netean con su consumo original; el gasto
  refleja lo efectivamente consumido.
- **Traslados entre lugares** (spec 014): no son gasto; en el lugar de origen salen del valor de
  inventario y en el de destino entran.
- **Lote con precio corregido después** (spec 015): los consumos de ese lote se revalorizan con el
  precio corregido; los tratamientos ya registrados conservan su snapshot (spec 016) y no cambian.
- **Unidad de consumo convertida** (spec 015): las cantidades de "Materiales más utilizados" se
  muestran en la unidad de consumo vigente.
- **Material dado de baja** (spec 007): sigue apareciendo en los reportes de los períodos en que se
  consumió, marcado "Dado de baja".
- **Categoría eliminada o renombrada**: los consumos se agrupan en la categoría actual del insumo;
  los insumos sin categoría van a "Sin categoría".
- **Ganancia estimada negativa** (total o de un lugar): se muestra con signo y color de error; la
  barra del gráfico crece hacia abajo desde el cero.
- **Variación sobre base 0** (período anterior en $0): no se muestra porcentaje; se indica "Nuevo".
- **Datos aún sincronizando** (dispositivo recién instalado o con pendientes de bajar): Reportes
  avisa "Puede faltar información hasta terminar la sincronización" junto al indicador de la spec
  012.
- **Período en curso**: "Este mes" compara contra el mes anterior **completo**; la tarjeta lo
  indica ("vs. mes anterior completo") para no confundir un mes parcial con una caída.
- **Zona horaria**: los períodos se cortan según la hora local del dispositivo, no la del servidor.
- **Usuario con acceso a algunos lugares** (spec 014): "Todos" solo suma los lugares a los que tiene
  acceso.

## Requirements *(mandatory)*

### Functional Requirements

**Sección Reportes**

- **FR-001**: La navegación DEBE incluir la sección **Reportes**: en la sidebar de tablet y desktop,
  y dentro de "Más" en la barra inferior móvil (que ya tiene 5 ítems, spec 016).
- **FR-002**: Reportes DEBE mostrar, en este orden, los KPIs Producción, Gasto en materiales y
  Ganancia estimada, y debajo los gráficos Consumo por categoría, Gastos mensuales, Materiales más
  utilizados y Ganancia por lugar (DS §34). No DEBE agregar otros gráficos (DS §41).
- **FR-003**: **Producción** DEBE ser la suma de los precios completos del snapshot (no la
  comisión, Clarifications Q2) de los tratamientos realizados vigentes del período; **Ganancia estimada**, la suma de sus ganancias estimadas de
  snapshot. Los tratamientos sin precio no suman y se cuentan aparte.
- **FR-004**: **Gasto en materiales** DEBE ser el costo de lo **consumido** en el período: Σ
  (cantidad consumida × costo por unidad de consumo de su lote), neteando los ajustes vinculados
  (deshacer) y sin contar traslados ni ingresos (Clarifications Q1).
- **FR-005**: Cada KPI DEBE mostrar la variación porcentual frente a su **período de comparación**:
  "Este mes" frente al mes anterior completo; un mes completo (anterior o elegido) frente al mes que
  lo precede; "Últimos 3 meses" frente a los 3 meses previos; "Este año" frente al mismo tramo del
  año anterior. Usa el formato de tarjeta del DS §20 (título, valor, variación con flecha y color).
- **FR-006**: Toda ganancia DEBE rotularse "Ganancia estimada" con la nota de que no es utilidad
  contable (DS §27); ningún texto de la sección DEBE decir "utilidad".

**Períodos y filtros**

- **FR-007**: El sistema DEBE ofrecer los períodos Este mes (por defecto), Mes anterior, Últimos 3
  meses y Este año, y además elegir cualquier mes calendario pasado (Clarifications Q4), cortados en
  meses calendario según la hora local del dispositivo. Un mes elegido se compara con el mes que lo precede. No
  hay rango de fechas libre.
- **FR-008**: Reportes DEBE respetar el lugar activo del selector de la spec 014; en "Todos" DEBE
  sumar los lugares accesibles por el usuario y mostrar el gráfico Ganancia por lugar.

**Gráficos**

- **FR-009**: **Consumo por categoría** DEBE ser un donut con el costo consumido por categoría en
  el período, con un máximo de 5 sectores (4 mayores + "Otras").
- **FR-010**: **Gastos mensuales** DEBE ser un gráfico de líneas con el gasto en materiales (FR-004)
  de cada mes: los 6 meses que terminan en el último mes del período, o los 12 del año.
- **FR-011**: **Materiales más utilizados** DEBE ser un gráfico de barras horizontales con hasta 10
  materiales ordenados por costo consumido en el período, mostrando monto y cantidad en su unidad de
  consumo.
- **FR-012**: **Ganancia por lugar** DEBE ser un gráfico de barras con la ganancia estimada de cada
  lugar en el período, visible solo en "Todos" cuando dos o más lugares tienen
  datos en el período.
- **FR-013**: Los gráficos DEBEN usar la paleta del DS §35 (#12B8AE, #0D5360, #7ACCC5, #B8E7E2 y,
  para alertas o negativos, #F2B84B y #E96767), sin efectos 3D y con no más de 5 colores por
  gráfico.
- **FR-014**: Cada gráfico DEBE mostrar el valor exacto de un elemento al tocar su entrada en la
  leyenda o su etiqueta (al menos 48 × 48 px, Constitución III), y ofrecer una alternativa en texto
  accesible. Tocar la figura directamente es un complemento, nunca el único medio, y nada funciona
  solo con hover.

**Valor de inventario**

- **FR-015**: Inicio DEBE incluir la tarjeta **Valor de inventario** del lugar activo (o de "Todos"):
  Σ (stock de cada lote no caducado × su costo por unidad de consumo), con la variación frente al
  valor al cierre del mes anterior (Clarifications Q3), y al tocarla abrir Reportes.

**Datos incompletos**

- **FR-016**: Cuando un cálculo excluya datos sin precio (lotes o tratamientos), el sistema DEBE
  indicarlo junto al valor ("desde $X", "N materiales sin precio") y nunca presentarlo como total
  completo.
- **FR-017**: Si no hay datos suficientes para un KPI o gráfico, DEBE mostrarse un estado vacío que
  explique qué falta, no un $0 ni un gráfico en blanco.

**Cálculo, offline, permisos y aislamiento**

- **FR-018**: Los reportes DEBEN calcularse en el dispositivo con los datos locales y sincronizados,
  y funcionar sin conexión (Constitución I y IV); si hay datos pendientes de bajar, DEBE avisarse que
  puede faltar información.
- **FR-018a**: El dispositivo DEBE conservar al menos los **últimos 13 meses** de movimientos y
  tratamientos realizados de los lugares accesibles (Clarifications Q5). Los meses anteriores no se
  reportan: el selector de mes pasado ofrece solo meses dentro de esa ventana, y una comparación cuyo
  período anterior cae fuera de ella muestra "Sin datos del período anterior".
- **FR-019**: Los montos DEBEN mostrarse en pesos chilenos redondeados al peso, con el estilo de
  "Números financieros" del DS §5; los cálculos se hacen sin redondear.
- **FR-020**: Todo el equipo del tenant DEBE poder ver Reportes y el Valor de inventario, sin
  restricción por rol (coherente con las specs 015 y 016).
- **FR-021**: Ningún reporte DEBE incluir datos de otro tenant ni de lugares a los que el usuario no
  tiene acceso (spec 014).
- **FR-022**: Reportes DEBE adaptarse a móvil, tablet y desktop (DS §38–39): en móvil, KPIs y
  gráficos en una columna; los controles DEBEN tener un área táctil de al menos 48 × 48 px
  (Constitución III).

### Key Entities *(include if feature involves data)*

Esta spec **no crea datos nuevos**: todo se deriva de entidades existentes.

- **Tratamiento realizado** (spec 016): fuente de Producción y Ganancia estimada (snapshot de
  precio y ganancia, lugar, fecha, estado vigente o anulado).
- **Movimiento** (specs 002, 007, 014, 015): consumos, ajustes vinculados, ingresos y traslados, con
  lote, lugar, fecha y cantidad en unidad de consumo.
- **Lote** (spec 015): precio y costo por unidad de consumo, para valorizar consumos, compras y el
  inventario.
- **Insumo y categoría** (existentes): agrupación de Consumo por categoría y Materiales más
  utilizados.
- **Lugar de trabajo** (spec 014): filtro y dimensión de Ganancia por lugar.
- **Período de reporte** (derivado, no se guarda): rango de fechas y su período de
  comparación (FR-005).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: La administradora ve Producción, Gasto en materiales y Ganancia estimada del mes con
  1 toque desde cualquier pantalla (desktop) o 2 toques (móvil, vía "Más").
- **SC-002**: En un conjunto de datos de prueba conocido, el 100 % de los KPIs y de los valores de
  los gráficos coinciden con el cálculo manual de las definiciones FR-003, FR-004 y FR-009 a FR-012.
- **SC-003**: La suma de los KPIs de cada lugar es igual al KPI de "Todos" en el 100 % de los
  casos.
- **SC-004**: Reportes se muestra completo en menos de 2 segundos con un año de datos de una
  clínica típica (≈ 3.000 tratamientos y 20.000 movimientos), también sin conexión.
- **SC-005**: Ningún valor que excluya datos sin precio se muestra sin su advertencia.
- **SC-006**: Ningún usuario ve en Reportes datos de otro tenant ni de lugares sin acceso.
- **SC-007**: La clienta revisa los reportes de un mes real y confirma que los números coinciden
  con su percepción de la práctica y que entiende cada gráfico sin explicación.

## Assumptions

- **Compuerta del roadmap**: confirmada el 2026-10-19 para 015–017.
- Los consumos se valorizan al **costo de su lote** (spec 015), no al costo unitario vigente del
  insumo: refleja lo que realmente costó lo que se usó. Los tratamientos usan su snapshot (spec 016).
- "Materiales más utilizados" se ordena por **costo**, porque las cantidades en unidades distintas
  (g, cartuchos, unidades) no son comparables entre sí; la cantidad se muestra como dato.
- El período anterior de "Este año" es el año anterior hasta el mismo mes; con la ventana de 13 meses
  (FR-018a) esa comparación solo existe en enero, así que en la práctica "Este año" muestra "Sin datos
  del período anterior" el resto del año.
- El plan debe verificar que guardar 13 meses de movimientos y tratamientos (FR-018a) no degrade el
  arranque ni la sincronización inicial de un dispositivo nuevo.
- El valor de inventario al cierre del mes anterior se reconstruye desde los movimientos; no se
  guardan fotos mensuales. Los lotes se valorizan con su **precio vigente hoy** también para ese
  cierre (una corrección de precio posterior cambia ambos valores por igual).
- Los períodos se cortan en la hora local del dispositivo, como el historial de la spec 016. Los
  dispositivos de la clienta están en Chile; si llega un tenant de otro país, se evalúa fijar la
  zona horaria por tenant.
- Mantener Reportes en "Más" en móvil sigue la decisión de la barra inferior de la spec 016; la
  revisión de la navegación móvil queda para validar con la clienta.
