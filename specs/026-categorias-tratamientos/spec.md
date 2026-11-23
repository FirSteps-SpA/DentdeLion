# Feature Specification: Categorías de tratamientos y % profesional por categoría

**Feature Branch**: `[026-categorias-tratamientos]`

**Created**: 2026-11-23

**Status**: Draft

**Input**: User description: "Que los tratamientos puedan tener categorías, administradas similar a
las categorías de los insumos. Que haya categorías sembradas por defecto (evaluación, extracción,
etc.) y que se puedan agregar más. Además, que opcionalmente las categorías puedan tener un porcentaje
de cobro distinto al global (ej.: el porcentaje dentista-clínica en general es 40/60, pero las
evaluaciones son 50/50). El % va por lugar."

**Origen**: ideas del 2026-11-23 (`~/1STEPS/notes.txt`), backlog `1stDocs/002-backlog/002-DentdeLion.md`
→ spec 026.

## Contexto

Desde la spec 016, cada tratamiento del catálogo tiene nombre, materiales y precio por lugar, y cada
lugar de trabajo tiene **un** % profesional (Ajustes → Lugares de trabajo) que se aplica a todos sus
tratamientos (spec 016 FR-009). La **ganancia del profesional** de un registro es precio × % (release
2.8.0), y el % queda congelado en el registro al momento de hacerlo.

En la práctica, el reparto no es igual para todo: en una clínica el reparto general es 40/60, pero las
evaluaciones van 50/50. Hoy no hay forma de expresarlo, y tampoco de agrupar los tratamientos por tipo
para revisar cuánto se hizo de cada cosa.

## Clarifications

### Session 2026-11-23

- Q: ¿El % de una categoría es único o por lugar? → A: **Por lugar**, igual que el % general: en cada
  lugar, una categoría puede tener su propio %, y si no lo tiene usa el % general de ese lugar.
- Q: ¿La categoría de un tratamiento es obligatoria? → A: **Opcional.** Un tratamiento sin categoría
  aparece como "Sin categoría" y usa el % general del lugar.
- Q: ¿Las categorías sembradas se pueden renombrar y desactivar? → A: **Sí, como cualquier otra.** Son
  solo un punto de partida.
- Q: ¿Quién administra las categorías y sus %? → A: **Solo administración**, como el catálogo de
  tratamientos y el % profesional. El personal ve la categoría pero no la cambia.
- Q: ¿Se incluye ver producción y ganancia por categoría? → A: **Sí, en Historial y Reportes.**

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Clasificar los tratamientos por categoría (Priority: P1)

Como administración, quiero que cada tratamiento del catálogo tenga una categoría, eligiéndola de una
lista que ya trae las habituales y a la que puedo agregar otras, para ordenar el catálogo y poder
aplicar repartos distintos por tipo de tratamiento.

**Why this priority**: es la base de todo lo demás; sin categoría no hay % por categoría ni
agrupación.

**Independent Test**: en un cliente nuevo, abrir Ajustes → Categorías de tratamientos y ver las
categorías sembradas; editar un tratamiento, elegir "Evaluación" y guardar; el catálogo muestra el
tratamiento con su categoría.

**Acceptance Scenarios**:

1. **Given** un cliente (nuevo o existente), **When** administración abre Ajustes → **Categorías de
   tratamientos**, **Then** ve las categorías sembradas: Evaluación, Prevención, Restauración,
   Endodoncia, Periodoncia, Extracción y cirugía, Prótesis y Urgencia.
2. **Given** esa sección, **When** agrega "Blanqueamiento", **Then** aparece en la lista y queda
   disponible al crear o editar un tratamiento.
3. **Given** el formulario de un tratamiento, **When** administración elige una categoría en el
   selector (o "Agregar categoría" desde el mismo selector) y guarda, **Then** el tratamiento queda con
   esa categoría y el cambio queda en el historial del tratamiento.
4. **Given** un tratamiento sin categoría, **When** se mira en el catálogo, **Then** aparece como "Sin
   categoría" y todo funciona como hoy.
5. **Given** una categoría, **When** administración la renombra, **Then** todos los tratamientos que la
   tienen muestran el nombre nuevo.
6. **Given** una categoría, **When** administración la desactiva, **Then** deja de ofrecerse para
   asignar, pero los tratamientos que ya la tienen la conservan (marcada "desactivada") y su % sigue
   aplicando; se puede reactivar.
7. **Given** personal (no administración), **When** mira el catálogo, **Then** ve la categoría de cada
   tratamiento pero no puede cambiarla ni administrar categorías.
8. **Given** el catálogo de tratamientos, **When** hay tratamientos de varias categorías, **Then** se
   pueden filtrar por categoría.

---

### User Story 2 - % profesional distinto por categoría, en cada lugar (Priority: P1)

Como administración, quiero fijar en cada lugar de trabajo un % profesional distinto para una
categoría (ej.: Evaluación 50 % en la Clínica A, aunque el general sea 40 %), para que la ganancia del
profesional refleje el reparto real.

**Why this priority**: es el motivo principal del pedido y cambia los montos.

**Independent Test**: con el % general del lugar en 40 y Evaluación en 50 en ese lugar, registrar un
tratamiento de Evaluación de $20.000: la ganancia del profesional es $10.000; uno de Restauración de
$20.000 da $8.000.

**Acceptance Scenarios**:

1. **Given** Ajustes → Categorías de tratamientos, **When** administración abre una categoría, **Then**
   ve un campo "% profesional" por cada lugar de trabajo activo, vacío por defecto con la indicación
   "Usa el general (40 %)".
2. **Given** Evaluación con 50 % en la Clínica A, **When** se registra un tratamiento de Evaluación en
   la Clínica A, **Then** el registro guarda 50 % y la ganancia del profesional es precio × 50 %.
3. **Given** el mismo tratamiento registrado en la Clínica B, donde Evaluación no tiene %, **Then** se
   usa el % general de la Clínica B.
4. **Given** un tratamiento sin categoría, o de una categoría sin % en ese lugar, **When** se registra,
   **Then** usa el % general del lugar, como hoy.
5. **Given** un registro ya hecho, **When** administración cambia el % de su categoría o la categoría
   del tratamiento, **Then** el registro conserva el % y la ganancia con que se hizo; el cambio aplica
   solo hacia adelante.
6. **Given** el detalle de un tratamiento, la hoja de registro y el catálogo, **When** muestran la
   ganancia del profesional estimada, **Then** usan el % que aplicaría (el de la categoría en ese lugar
   si existe) e indican de dónde viene ("50 % · Evaluación" o "40 % · general del lugar").
7. **Given** una categoría con % en un lugar, **When** administración borra ese %, **Then** la
   categoría vuelve a usar el general del lugar.
8. **Given** un % fuera de 0–100, **When** se intenta guardar, **Then** se
   rechaza con un mensaje claro, igual que el % general.

---

### User Story 3 - Ver lo realizado por categoría (Priority: P2)

Como profesional o administración, quiero ver en el historial y en Reportes cuánto se hizo de cada
categoría, para entender de dónde viene la producción y la ganancia.

**Why this priority**: aprovecha la clasificación, pero los montos ya son correctos sin esto.

**Independent Test**: con registros de dos categorías en el mes, el historial filtrado por
"Evaluación" muestra solo esos y sus totales; Reportes muestra la producción y la ganancia del
profesional de cada categoría.

**Acceptance Scenarios**:

1. **Given** el historial de tratamientos, **When** lo miro, **Then** cada registro muestra su
   categoría (la que tenía al registrarse) y puedo filtrar por categoría, con los totales del filtro.
2. **Given** registros anteriores a esta spec, **When** los miro, **Then** aparecen como "Sin
   categoría".
3. **Given** Reportes en un período, **When** hay tratamientos registrados, **Then** aparece "Por
   categoría de tratamiento" con la producción y la ganancia del profesional de cada categoría, de
   mayor a menor producción, con tabla accesible igual que los demás gráficos.
4. **Given** una categoría renombrada después de registrar, **When** miro registros antiguos, **Then**
   muestran el nombre que tenía al registrarse, y Reportes los agrupa con la categoría actual.
5. **Given** registros anulados, **When** se calculan los totales, **Then** no cuentan, igual que hoy.

---

### Edge Cases

- **Cliente nuevo**: las categorías sembradas existen desde el alta del cliente, sin que nadie las
  cree.
- **Cliente existente**: al publicar, las categorías sembradas aparecen una sola vez; ningún
  tratamiento cambia de categoría y ningún monto cambia.
- **Nombre repetido**: crear o renombrar a un nombre que ya existe (sin distinguir mayúsculas,
  tildes ni espacios) se rechaza; no se fusionan categorías.
- **Sin conexión**: asignar una categoría o cambiar un % se guarda en el dispositivo y se sube al
  reconectar, como el resto del catálogo. Un registro hecho sin conexión usa el % que el dispositivo
  conoce en ese momento.
- **Dos administradoras cambian lo mismo sin conexión**: gana el último cambio, como en el resto del
  catálogo de tratamientos.
- **Categoría desactivada**: sigue en los tratamientos que la tienen y su % sigue aplicando (desactivar
  no cambia montos); solo deja de ofrecerse.
- **Lugar desactivado**: su % por categoría se conserva pero no se muestra mientras el lugar esté
  desactivado.
- **% de categoría igual al general**: se puede guardar; si después cambia el general, la categoría
  mantiene el suyo.
- **Lugar sin % general y categoría con %**: el registro usa el de la categoría.
- **Lugar sin % general y sin % de categoría**: igual que hoy ("Define el % profesional del lugar").
- **Versión anterior en caché**: un dispositivo que no se actualizó sigue usando el % general para
  todo y no muestra categorías; los registros que haga llevan el % general. Se documenta en las notas
  de despliegue.

## Requirements *(mandatory)*

### Functional Requirements

**Categorías (US1)**

- **FR-001**: Cada cliente DEBE tener un catálogo de categorías de tratamientos, con las 8 sembradas
  (Evaluación, Prevención, Restauración, Endodoncia, Periodoncia, Extracción y cirugía, Prótesis,
  Urgencia), creadas una sola vez para clientes existentes y en el alta de clientes nuevos.
- **FR-002**: Administración DEBE poder crear, renombrar, desactivar y reactivar categorías desde una
  sección nueva de Ajustes, **Categorías de tratamientos**. Las sembradas se administran igual que las
  creadas.
- **FR-003**: El nombre DEBE tener 1–40 caracteres y ser único en el cliente sin distinguir
  mayúsculas, tildes ni espacios. "Sin categoría" está reservado.
- **FR-004**: Las categorías no se eliminan; solo se desactivan.
- **FR-005**: El formulario de tratamiento DEBE tener un selector **Categoría** opcional con las
  categorías activas, "Sin categoría" y "Agregar categoría" (solo administración), como el selector de
  marcas y proveedores.
- **FR-006**: Cambiar la categoría de un tratamiento DEBE quedar en su historial de cambios, con autor
  y fecha, como los demás campos del catálogo.
- **FR-007**: El catálogo de tratamientos DEBE mostrar la categoría de cada uno ("Sin categoría" si no
  tiene; "(desactivada)" si lo está) y permitir filtrar por categoría.
- **FR-008**: Solo administración DEBE poder administrar categorías y asignarlas; el servidor DEBE
  rechazar esos cambios hechos por otro rol.

**% por categoría y lugar (US2)**

- **FR-009**: Administración DEBE poder fijar, para cada categoría y cada lugar de trabajo, un %
  profesional opcional entre 0 y 100, y borrarlo. Cada cambio queda en el
  historial y aplica solo hacia adelante.
- **FR-010**: El % que aplica a un tratamiento en un lugar DEBE ser: el % de su categoría en ese lugar,
  si existe; si no, el % general del lugar; si tampoco, ninguno (como hoy).
- **FR-011**: Al registrar un tratamiento, el registro DEBE guardar el % aplicado (FR-010) y el nombre
  y la identidad de la categoría que tenía el tratamiento en ese momento.
- **FR-012**: La hoja de registro, el detalle del tratamiento y el catálogo DEBEN mostrar el % que
  aplicaría y su origen ("50 % · Evaluación" / "40 % · general del lugar").
- **FR-013**: Cambiar categorías, sus % o la categoría de un tratamiento NO DEBE alterar registros ya
  hechos.

**Por categoría (US3)**

- **FR-014**: El historial DEBE mostrar la categoría de cada registro y permitir filtrar por categoría;
  los totales del historial DEBEN corresponder al filtro.
- **FR-015**: Reportes DEBE mostrar, para el período y el lugar elegidos, la producción y la ganancia
  del profesional por categoría de tratamiento, con tabla accesible, excluyendo registros anulados.
  Los registros sin categoría se agrupan en "Sin categoría".
- **FR-016**: Reportes DEBE agrupar por la categoría registrada (su identidad), mostrando su nombre
  actual.

**General**

- **FR-017**: Todo lo anterior DEBE funcionar sin conexión y sincronizarse como el resto del catálogo
  de tratamientos.
- **FR-018**: Los controles nuevos DEBEN cumplir el área táctil de 48 px y mostrar el estado
  (desactivada, origen del %) con texto, no solo color.

### Key Entities

- **Categoría de tratamiento**: pertenece a un cliente; nombre único (1–40), activa o desactivada;
  creada por siembra o por administración.
- **% por categoría y lugar**: valor opcional (0–100) para un par categoría–lugar; su ausencia
  significa "usa el general del lugar". Con historial de cambios.
- **Tratamiento** (existente): gana una categoría opcional, con historial.
- **Tratamiento realizado** (existente): gana la categoría (identidad y nombre) con que se registró;
  ya guarda el % aplicado.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Con el ejemplo de la clienta (general 40 %, Evaluación 50 %), el 100 % de los registros
  de Evaluación hechos después de configurarlo calculan la ganancia con 50 %, y el resto con 40 %.
- **SC-002**: Asignar categoría a un tratamiento existente toma como máximo 3 toques desde su detalle
  (Editar → Categoría → Guardar).
- **SC-003**: Al publicar, ningún registro previo cambia su % ni su ganancia (diferencia 0 en los
  totales de Reportes de meses anteriores).
- **SC-004**: El historial filtrado por una categoría y el bloque de Reportes dan el mismo total para
  el mismo período y lugar.
- **SC-005**: Un cliente nuevo ve las 8 categorías sembradas sin hacer nada.

## Assumptions

- Las categorías sembradas son las 8 de FR-001; cada clínica puede renombrarlas o desactivarlas.
- No hay % por tratamiento individual ni por profesional: solo por categoría y lugar.
- No se asignan categorías automáticamente a los tratamientos existentes; lo hace administración.
- El filtro por categoría del catálogo y del historial es de un valor a la vez.
- Requiere migración (tablas o columnas nuevas, siembra y permisos), aplicada en producción antes del
  front, con respaldo previo, como en los releases con migración anteriores.
- Las categorías de insumos no cambian; son un catálogo distinto.
