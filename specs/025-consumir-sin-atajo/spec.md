# Feature Specification: "Consumir" sin atajo

**Feature Branch**: `[025-consumir-sin-atajo]`

**Created**: 2026-11-23

**Status**: Draft

**Input**: User description: "Dejar el botón de 'Consumir 1' como 'Consumir', y que lleve directo a la
vista de elegir cuánto consumir, eliminando el 'atajo' de consumir 1."

**Origen**: ideas del 2026-11-23 (`~/1STEPS/notes.txt`), backlog `1stDocs/002-backlog/002-DentdeLion.md`
→ spec 025.

## Contexto

Desde la spec 007, cada insumo de Inventario (tarjeta en móvil y tablet, fila de la tabla en desktop)
tiene un botón **"Consumir 1"** que descuenta una unidad con un solo toque, del lote vigente más próximo
a vencer, y muestra un aviso con "Deshacer". Para consumir otra cantidad hay que abrir el menú "⋮" y
elegir **"Consumir otra cantidad"**, que abre el formulario de consumo con el insumo ya elegido.

En la práctica, el atajo de un toque no calza con cómo se usa: casi nunca se consume exactamente una
unidad de consumo (ml, g, cartuchos sueltos), y un toque accidental (con guantes) registra un consumo que
no ocurrió. Lo que se pide es que el botón principal se llame **"Consumir"** y abra directamente la vista
para elegir cuánto consumir.

## Clarifications

### Session 2026-11-23

- Q: Si un insumo solo tiene stock vencido en el lugar, ¿qué hace "Consumir"? → A: Se habilita y abre
  la vista de consumo con el lote vencido, mostrando claramente "Lote vencido" antes de confirmar.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Consumir eligiendo la cantidad desde el botón principal (Priority: P1)

Como persona del equipo, quiero que el botón "Consumir" de cada insumo me lleve directo a elegir cuánto
consumir, para registrar la cantidad real sin pasar por el menú y sin riesgo de descontar una unidad por
un toque accidental.

**Why this priority**: es el cambio pedido y el flujo de uso más frecuente de la app.

**Independent Test**: en Inventario, tocar "Consumir" en un insumo con stock, escribir una cantidad y
confirmar; el stock baja exactamente en esa cantidad y ningún toque anterior registró consumo.

**Acceptance Scenarios**:

1. **Given** un insumo con stock vigente en el lugar activo, **When** toco "Consumir" en su tarjeta (o
   fila de la tabla), **Then** se abre la vista de consumo con ese insumo ya elegido, sin búsqueda, y
   todavía no se registra ningún consumo.
2. **Given** la vista de consumo abierta desde "Consumir", **When** la abro, **Then** la cantidad parte
   en 1 (en la unidad de consumo del insumo) y el campo queda listo para escribir otra cantidad.
3. **Given** un insumo con un lote vencido y otro vigente, ambos con stock, **When** abro "Consumir",
   **Then** el lote propuesto es el vigente, no el vencido.
4. **Given** la vista de consumo con la cantidad deseada, **When** confirmo, **Then** se registra un
   consumo por esa cantidad del lote más próximo a vencer (o del lote elegido a mano), la vista se cierra
   y vuelvo al listado con los mismos filtros, búsqueda y posición.
5. **Given** la vista de consumo abierta, **When** la cierro sin confirmar, **Then** no se registra
   nada.
6. **Given** la vista "Todos" (todos los lugares), **When** toco "Consumir", **Then** primero se me
   pregunta en qué lugar y luego se abre la vista de consumo para ese lugar.

---

### User Story 2 - Deshacer un consumo recién registrado (Priority: P2)

Como persona del equipo, quiero poder deshacer un consumo justo después de confirmarlo, como hoy con
"Consumir 1", para corregir un error sin pedirle a administración un ajuste.

**Why this priority**: hoy el consumo desde el botón principal se puede deshacer; sin esto, el cambio
quitaría una red de seguridad que el equipo ya usa.

**Independent Test**: confirmar un consumo desde "Consumir" y tocar "Deshacer" en el aviso; el stock
vuelve a su valor anterior.

**Acceptance Scenarios**:

1. **Given** que acabo de confirmar un consumo desde "Consumir", **When** se cierra la vista, **Then**
   aparece un aviso "Consumiste N <unidad> de <insumo>" con "Deshacer", igual que el aviso actual.
2. **Given** ese aviso visible, **When** toco "Deshacer", **Then** el stock del lote vuelve a lo que era
   antes del consumo, y un segundo toque no restaura dos veces.

---

### User Story 3 - Sin acciones duplicadas en el menú (Priority: P3)

Como persona del equipo, quiero que el menú "⋮" no repita lo que ya hace el botón principal, para no
tener dos caminos a la misma vista.

**Why this priority**: limpieza; no bloquea el uso.

**Independent Test**: abrir el menú "⋮" de un insumo y comprobar que no aparece "Consumir otra cantidad"
y que las demás opciones siguen.

**Acceptance Scenarios**:

1. **Given** el menú "⋮" (o el toque largo) de un insumo, **When** lo abro, **Then** veo "Ver detalle",
   "Trasladar" (si corresponde) y, para administración, "Editar" y "Eliminar", pero no "Consumir otra
   cantidad".

---

### Edge Cases

- **Sin stock en el lugar**: el botón queda deshabilitado y dice "Sin stock", como hoy.
- **Solo stock vencido**: el botón se habilita y la vista de consumo abre con el lote vencido,
  indicando de forma visible "Lote vencido" (texto, no solo color) antes de confirmar.
- **Lote vencido y lote vigente a la vez**: hoy la vista de consumo propone el vencido, porque vence
  antes; "Consumir 1" en cambio lo saltaba. Con esta spec se propone el vigente (FR-005), y el vencido
  solo se usa si se elige a mano.
- **Stock fraccionario menor que 1** (ej.: quedan 0,5 ml): hoy "Consumir 1" queda deshabilitado; con la
  vista de cantidad se puede consumir lo que queda, así que el botón se habilita mientras haya stock.
- **Cantidad mayor que el stock del lote elegido**: se rechaza sin registrar nada, con el mensaje actual
  de stock insuficiente.
- **Unidad que no admite decimales** (cartuchos, unidades): una cantidad con decimales se rechaza, como
  hoy.
- **Dos dispositivos consumen el mismo lote sin conexión**: sin cambios respecto de hoy; el sobregiro se
  reconcilia al sincronizar.
- **El insumo se da de baja (en otro dispositivo) con la vista abierta**: la vista se cierra sin
  registrar, como hoy.
- **Versión anterior en caché en otro dispositivo**: sigue mostrando "Consumir 1" hasta actualizarse; no
  hay cambios de datos, así que ambas conviven.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Cada insumo del listado de Inventario (tarjeta y fila de tabla) DEBE mostrar un botón
  **"Consumir"** en lugar de "Consumir 1", con el nombre del insumo en su etiqueta accesible ("Consumir
  <insumo>").
- **FR-002**: Tocar "Consumir" NO DEBE registrar ningún consumo; DEBE abrir la vista de consumo con el
  insumo ya elegido y sin búsqueda.
- **FR-003**: En la vista "Todos", tocar "Consumir" DEBE preguntar primero el lugar y luego abrir la
  vista de consumo de ese lugar.
- **FR-004**: La vista de consumo abierta desde "Consumir" DEBE partir con cantidad 1 en la unidad de
  consumo del insumo. Al enfocar el campo, su contenido DEBE quedar seleccionado para reemplazarlo al
  escribir. Con teclado físico (desktop) el campo DEBE quedar enfocado al abrir; en pantallas táctiles
  no se abre el teclado solo, para que "Confirmar consumo" quede a la vista.
- **FR-005**: El lote por defecto DEBE ser el **vigente** más próximo a vencer que cubra la cantidad
  (y, si ninguno la cubre, el vigente más próximo a vencer); solo si no hay stock vigente, el vencido
  más próximo a vencer. La vista DEBE conservar el resto de su comportamiento: elección manual de
  cualquier lote con stock (también vencido), botones + / −, validación de unidad y rechazo de
  cantidades mayores que el stock del lote.
- **FR-006**: Tras confirmar, la vista DEBE cerrarse y volver al listado sin perder filtros, búsqueda,
  página ni posición.
- **FR-007**: Tras confirmar, DEBE aparecer un aviso con la cantidad, la unidad y el insumo, con
  "Deshacer", con el mismo comportamiento del aviso actual de consumo (duración, deshacer una sola vez,
  vibración leve al registrar).
- **FR-008**: El botón DEBE quedar deshabilitado con el texto "Sin stock" cuando el insumo no tiene
  stock en el lugar; el motivo siempre se muestra como texto, no solo como color.
- **FR-009**: El botón DEBE habilitarse cuando haya stock mayor que 0 en el lugar, aunque sea menor que
  una unidad.
- **FR-010**: Cuando el lote que se va a descontar (por defecto o elegido a mano) está vencido, la
  vista de consumo DEBE indicarlo con el texto "Lote vencido" junto al lote, visible antes de
  confirmar.
- **FR-011**: El menú de opciones del insumo NO DEBE incluir "Consumir otra cantidad".
- **FR-012**: El consumo de una unidad con un solo toque DEBE dejar de existir en toda la app.
- **FR-013**: El botón "Consumir" DEBE cumplir el área táctil mínima de 48×48 px.

### Key Entities

Sin entidades nuevas ni cambios de datos. Se usan las existentes:

- **Movimiento de consumo**: el que ya registra la vista de consumo (lote, cantidad, unidad, lugar).
- **Ajuste de reversión**: el que ya escribe "Deshacer" para compensar un consumo.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Consumir una cantidad cualquiera de un insumo desde el listado toma como máximo 3 toques
  más lo que se escriba (Consumir → cantidad → Confirmar), y consumir 1 unidad toma 2 (Consumir →
  Confirmar).
- **SC-002**: Ningún toque aislado en el listado registra un consumo: el 100 % de los consumos pasan por
  una confirmación explícita.
- **SC-003**: El 100 % de los consumos confirmados desde "Consumir" se pueden deshacer desde su aviso.
- **SC-004**: El menú de opciones no tiene ninguna acción que duplique el botón principal.

## Assumptions

- La cantidad parte en 1 para que el caso de una unidad siga siendo rápido (2 toques); se puede cambiar
  a vacía si el equipo prefiere escribir siempre.
- El aviso con "Deshacer" se extiende a los consumos de la vista de consumo abierta desde Inventario. La
  vista de consumo de otras pantallas, si la hubiera, no cambia.
- Solo cambia el front: sin migración ni cambios en la sincronización. Esta spec deja sin efecto las
  decisiones de la spec 007 sobre "Consumir 1" (FR-001 a FR-003 y FR-007 de esa spec); el aviso, la
  vibración y "Deshacer" (FR-005, FR-006, FR-008 y FR-009) se mantienen, ahora para el consumo con
  cantidad.
- Registrar un tratamiento (spec 016) no cambia: sigue descontando sus materiales por su propio flujo.
