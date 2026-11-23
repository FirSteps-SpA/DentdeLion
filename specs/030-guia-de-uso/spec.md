# Feature Specification: Guía de uso con botón de ayuda

**Feature Branch**: `[030-guia-de-uso]`

**Created**: 2026-11-23

**Status**: Draft

**Input**: User description: "Una guía de uso de la app: en cada vista principal un botón de ayuda
("?") que despliegue un pop-up describiendo el uso de la pantalla correspondiente."

**Origen**: pedido del 2026-11-23, backlog `1stDocs/002-backlog/002-DentdeLion.md` → spec 030.

## Contexto

La app ya tiene varias pantallas con funciones que no son evidentes para alguien nuevo: el % del
profesional por lugar y por categoría, los lotes FEFO, las compras sugeridas, los traslados, la
estimación con IA. Hoy no hay ninguna explicación dentro de la app; se enseña de palabra.

## Clarifications

### Session 2026-11-23

- Q: ¿La guía completa también reunida en un lugar? → A: **Sí, en Ajustes → "Guía de uso"**, con los
  mismos textos.
- Q: ¿El pop-up se abre solo la primera vez? → A: **Sí, una vez por vista y por persona**; después,
  solo con "?".
- Q: ¿Incluye las hojas (Consumir, Registrar tratamiento, Recibir compra)? → A: **No, solo las vistas
  principales**; esas tareas se explican en el "Cómo se hace…" de su vista.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Ayuda en cada pantalla (Priority: P1)

Como persona del equipo, quiero tocar "?" en una pantalla y leer para qué sirve y cómo se hacen sus
tareas principales, para usarla sin preguntar.

**Why this priority**: es el pedido.

**Independent Test**: en Inventario tocar "?" y ver una hoja "Ayuda: Inventario" con "Para qué
sirve", "Cómo se hace…" y "Consejos"; cerrarla y seguir donde estaba.

**Acceptance Scenarios**:

1. **Given** cualquiera de Inicio, Inventario, Tratamientos, Compras, Reportes, Alertas, Ajustes o
   una sección de Ajustes, **When** miro el encabezado, **Then** hay un botón "?" de 48 px con nombre
   accesible "Ayuda de <pantalla>".
2. **Given** el botón, **When** lo toco, **Then** se abre una hoja (modal en desktop) con el título
   "Ayuda: <pantalla>" y las secciones "Para qué sirve", "Cómo se hace…" y "Consejos"; al cerrarla
   vuelvo a la pantalla tal como estaba.
3. **Given** personal, **When** abro una ayuda, **Then** no veo los pasos de tareas que solo puede
   hacer administración; **Given** administración, **Then** esos pasos aparecen marcados "Solo
   administración".
4. **Given** sin conexión, **When** abro una ayuda, **Then** se ve igual (contenido dentro de la app).

---

### User Story 2 - Primera visita (Priority: P2)

Como persona nueva, quiero que la ayuda de cada pantalla aparezca sola la primera vez que entro,
para descubrirla sin saber que existe el "?".

**Independent Test**: con una sesión nueva en un dispositivo, entrar a Compras abre sola "Ayuda:
Compras"; cerrarla, salir y volver a Compras no la abre de nuevo; otra persona en el mismo
dispositivo sí la ve.

**Acceptance Scenarios**:

1. **Given** una persona que nunca vio la ayuda de una pantalla en este dispositivo, **When** entra a
   esa pantalla, **Then** la ayuda se abre sola una vez.
2. **Given** que ya la vio (sola o con "?"), **When** vuelve, **Then** no se abre sola.
3. **Given** otra persona en el mismo dispositivo, **When** entra, **Then** se le abre a ella.
4. **Given** que el navegador no permite guardar (modo privado bloqueado), **When** entra, **Then** la
   app funciona igual (a lo sumo, la ayuda se vuelve a abrir sola).

---

### User Story 3 - Guía de uso reunida (Priority: P2)

Como administradora, quiero leer toda la guía de corrido en Ajustes → "Guía de uso", para repasarla
o mostrarla a alguien nuevo.

**Independent Test**: Ajustes → "Guía de uso" lista las pantallas en el orden del menú, cada una
desplegable con los mismos textos de su "?".

**Acceptance Scenarios**:

1. **Given** Ajustes, **When** miro el índice, **Then** hay una tarjeta "Guía de uso" para ambos
   roles.
2. **Given** la sección, **When** la abro, **Then** veo una entrada por pantalla visible para mi rol,
   cada una desplegable con el mismo contenido que su "?".

### Edge Cases

- **Pantalla sin permiso**: personal no ve en la guía las secciones de Ajustes que no puede abrir.
- **Dos ayudas en la misma vista** (Ajustes con su sección): cada pantalla tiene su propia ayuda.
- **Ayuda abierta y cambio de vista**: al navegar, la hoja se cierra.
- **Varias primeras visitas seguidas**: cada pantalla abre la suya una sola vez; no hay más de una
  hoja abierta a la vez.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Cada pantalla principal (Inicio, Inventario, Tratamientos, Compras, Reportes, Alertas,
  Ajustes y cada sección de Ajustes) DEBE tener en su encabezado un botón "?" de 48 px con nombre
  accesible "Ayuda de <pantalla>".
- **FR-002**: El botón DEBE abrir una hoja "Ayuda: <pantalla>" con "Para qué sirve", "Cómo se
  hace…" (tareas con pasos breves) y "Consejos".
- **FR-003**: El contenido DEBE estar dentro de la app (sin red, sin migración) y en español.
- **FR-004**: Los pasos solo de administración DEBEN ocultarse para personal y marcarse "Solo
  administración" para administración.
- **FR-005**: La ayuda de cada pantalla DEBE abrirse sola la primera vez que cada persona entra a
  ella en un dispositivo; abrirla (sola o con "?") la marca como vista.
- **FR-006**: Ajustes DEBE tener la sección "Guía de uso" (ambos roles) con todas las ayudas
  visibles para el rol, desplegables, en el orden del menú.
- **FR-007**: Los textos DEBEN ser breves (≤ 6 tareas por pantalla, pasos de una línea).

### Key Entities

- **Ayuda de pantalla** (estática): pantalla, título, para qué sirve, tareas (nombre, pasos, solo
  administración), consejos.
- **Ayudas vistas** (en el dispositivo): por persona, las pantallas cuya ayuda ya se abrió.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Las 15 pantallas (7 vistas y 8 secciones de Ajustes) tienen su ayuda, verificable con
  una prueba que recorre todas.
- **SC-002**: Abrir una ayuda toma 1 toque y funciona sin conexión.
- **SC-003**: La ayuda se abre sola exactamente una vez por pantalla y persona en un dispositivo.
- **SC-004**: La clienta revisa los textos antes del release.

## Assumptions

- Sin capturas de pantalla (envejecen con cada cambio de diseño).
- "Vista" se recuerda en el dispositivo (no se sincroniza): en otro dispositivo se ve de nuevo una
  vez, aceptable.
- Los textos los redacta First Steps a partir del comportamiento actual; la clienta los revisa.
