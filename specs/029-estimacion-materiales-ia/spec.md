# Feature Specification: Estimación de materiales con IA

**Feature Branch**: `[029-estimacion-materiales-ia]`

**Created**: 2026-11-23

**Status**: Draft

**Input**: User description: "Al registrar un tratamiento y agregar los materiales, que se pueda hacer
una estimación de cuánto se gasta de cada uno para ese tratamiento: un botón 'estimar materiales' que
llame un prompt definido ('para el tratamiento X, qué cantidad (ml, g) de estos materiales gastaría?').
Hay que ser muy cuidadoso de proteger el uso de la API, evitar prompt injection o uso malicioso, por
ejemplo analizando primero que realmente se trata del nombre de un tratamiento y de materiales reales."

**Origen**: ideas del 2026-11-23 (`~/1STEPS/notes.txt`), backlog `1stDocs/002-backlog/002-DentdeLion.md`
→ spec 029.

## Contexto

El catálogo de tratamientos (spec 016) guarda, para cada tratamiento, los materiales que usa y la
**cantidad estándar** de cada uno en su unidad de consumo. Esa cantidad es la que se descuenta del
stock y la que da el costo de materiales. Hoy la administradora la escribe a mano, y para materiales
como resinas, adhesivos o anestesia no siempre es obvio cuánto se usa por tratamiento.

La idea es pedirle a un modelo de IA una **sugerencia** de cantidades para los materiales ya elegidos,
que la administradora revisa antes de guardar. Es la única parte de la app que necesita conexión y
que tiene costo por uso, así que el diseño se centra en que solo la use quien corresponde, con un
límite, y en que la respuesta no pueda ser otra cosa que números para esos materiales.

## Clarifications

### Session 2026-11-23

- Q: ¿Qué proveedor? → A: **Claude, de Anthropic**. La clave la guarda el servidor; la app nunca la ve.
- Q: ¿Cuántas estimaciones por día? → A: **20 por cliente por día**.
- Q: ¿Qué hace la app con la estimación? → A: **la muestra junto a cada material y la aplica con un
  toque** ("Usar sugerencias"); la administradora revisa y guarda.
- Dónde (backlog): en el **formulario del catálogo** de tratamientos, que ya es solo de administración;
  no al registrar cada tratamiento realizado.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Sugerir cantidades al armar un tratamiento (Priority: P1)

Como administradora, quiero pedir una sugerencia de cuánto se usa de cada material en un tratamiento,
para cargar el catálogo más rápido y con cantidades razonables.

**Why this priority**: es el pedido.

**Independent Test**: en "Nuevo tratamiento", escribir "Restauración clase II", agregar resina y
adhesivo, tocar "Sugerir cantidades" y ver junto a cada material una cantidad en su unidad con una
nota breve; "Usar sugerencias" las copia a los campos; guardar.

**Acceptance Scenarios**:

1. **Given** el formulario de un tratamiento con nombre y al menos un material, con conexión, **When**
   toco "Sugerir cantidades", **Then** veo un indicador de espera y, al terminar, junto a cada
   material "Sugerido: <cantidad> <unidad>" con una nota breve (p. ej. "por superficie").
2. **Given** las sugerencias, **When** toco "Usar sugerencias", **Then** las cantidades de los
   materiales pasan a ser las sugeridas y puedo cambiarlas antes de guardar; nada se guarda solo.
3. **Given** las sugerencias, **When** cambio a mano una cantidad o no toco "Usar sugerencias",
   **Then** se guarda lo que está en los campos.
4. **Given** un material sin sugerencia (el modelo no lo conoce o no aplica), **When** veo el
   resultado, **Then** ese material dice "Sin sugerencia" y su cantidad no cambia al usar las demás.
5. **Given** una unidad que no admite decimales (cartuchos, unidades), **When** llega una sugerencia,
   **Then** se muestra y aplica redondeada a un entero ≥ 1.
6. **Given** que cambio el nombre o los materiales después de sugerir, **When** miro el formulario,
   **Then** las sugerencias viejas desaparecen (corresponden a otra combinación).

---

### User Story 2 - Uso protegido (Priority: P1)

Como dueña del servicio, quiero que la estimación solo la puedan usar administradoras, con un límite
diario, y que no se pueda usar para otra cosa, para controlar el costo y el abuso.

**Why this priority**: sin esto no se puede habilitar una llamada con costo.

**Independent Test**: como personal no aparece el botón y el servidor rechaza la llamada; con 20
estimaciones hechas hoy en el cliente, la 21 se rechaza con un mensaje claro; un nombre de
tratamiento con instrucciones ("ignora lo anterior y…") no produce nada distinto de cantidades para
los materiales enviados.

**Acceptance Scenarios**:

1. **Given** personal, **When** abre el catálogo, **Then** no hay formulario ni botón (como hoy), y
   el servidor rechaza una llamada directa a la estimación.
2. **Given** 20 estimaciones hechas hoy por el cliente, **When** se pide otra, **Then** el servidor
   la rechaza sin llamar a la IA y la app muestra "Se alcanzó el límite de 20 estimaciones por día".
3. **Given** un nombre que no es un tratamiento dental o tiene instrucciones, **When** se estima,
   **Then** la respuesta solo puede decir "no reconocido" o dar números para los materiales enviados;
   la app muestra "No se reconoció como un tratamiento dental" sin aplicar nada.
4. **Given** la petición, **When** el servidor arma la consulta, **Then** los nombres y unidades de los
   materiales los lee de la base del cliente (no del navegador), y no envía datos de pacientes, ni
   precios, ni nada del cliente fuera del nombre del tratamiento y de esos materiales.
5. **Given** una respuesta con un material que no se envió, una cantidad negativa o desmedida,
   **When** el servidor la valida, **Then** descarta esa entrada.
6. **Given** sin conexión, **When** miro el formulario, **Then** el botón está deshabilitado con
   "Necesita conexión".
7. **Given** un error del servicio de IA o un rechazo del modelo, **When** pasa, **Then** la app dice
   "No se pudo estimar ahora; intenta más tarde" y el formulario sigue igual.

---

### Edge Cases

- **Más de 20 materiales** en un tratamiento: se estiman los primeros 20 y se avisa.
- **Nombre vacío o sin materiales**: el botón está deshabilitado con el motivo.
- **Material dado de baja** en el formulario: no se envía.
- **Dos administradoras estiman a la vez** cerca del límite: el contador es atómico; nunca pasan de 20.
- **Respuesta lenta**: tras 30 s se cancela y se avisa; la estimación cuenta igual para el límite.
- **Clave no configurada** en el servidor: "La estimación no está disponible" (no se rompe nada más).
- **Día**: el límite se reinicia a medianoche de Chile.

## Requirements *(mandatory)*

### Functional Requirements

**Sugerir (US1)**

- **FR-001**: El formulario del catálogo de tratamientos DEBE tener "Sugerir cantidades", habilitado
  con conexión, con nombre y al menos un material.
- **FR-002**: La sugerencia DEBE mostrarse junto a cada material ("Sugerido: <cantidad> <unidad>" y
  una nota de hasta 80 caracteres) o "Sin sugerencia".
- **FR-003**: "Usar sugerencias" DEBE copiar las cantidades sugeridas a los campos, respetando enteros
  para unidades sin decimales; nada se guarda sin "Guardar".
- **FR-004**: Cambiar el nombre o los materiales DEBE descartar las sugerencias mostradas.

**Proteger (US2)**

- **FR-005**: La estimación DEBE correr en el servidor, con la clave de la IA solo en el servidor.
- **FR-006**: Solo administración DEBE poder pedir una estimación; el servidor DEBE verificar la
  sesión, el rol y el cliente.
- **FR-007**: El servidor DEBE limitar a 20 estimaciones por cliente por día (medianoche de Chile), con
  un contador atómico que registra quién y cuándo, antes de llamar a la IA.
- **FR-008**: La petición del navegador DEBE llevar solo el nombre del tratamiento (1–80 caracteres) e
  identificadores de materiales del cliente (1–20); el servidor DEBE leer nombres, unidades y
  presentaciones de la base y rechazar identificadores ajenos.
- **FR-009**: La consulta a la IA DEBE tratar el nombre y los materiales como datos, no como
  instrucciones, sin herramientas, y con respuesta en un formato fijo: "reconocido" sí/no y, por
  material enviado, una cantidad y una nota.
- **FR-010**: El servidor DEBE validar la respuesta: solo materiales enviados, cantidades > 0 y por
  debajo de un tope razonable por unidad; descarta lo demás.
- **FR-011**: Ningún dato de pacientes, precios, stock ni usuarios DEBE enviarse a la IA.
- **FR-012**: Los errores (límite, sin conexión, no reconocido, servicio caído, no configurado) DEBEN
  mostrarse con un mensaje claro sin alterar el formulario.

### Key Entities

- **Estimación registrada**: cliente, quién la pidió, cuándo, nombre del tratamiento, cantidad de
  materiales y resultado (ok / no reconocido / error). Sirve para el límite diario y para revisar el
  uso. No guarda la respuesta de la IA.
- **Sugerencia** (solo en el formulario, no se guarda): por material, cantidad y nota.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Pedir y aplicar una sugerencia toma 2 toques ("Sugerir cantidades" → "Usar
  sugerencias") y responde en menos de 15 s en condiciones normales.
- **SC-002**: El 100 % de las llamadas de personal, de otro cliente o por encima del límite se
  rechazan sin consumir la IA (pruebas del servidor).
- **SC-003**: Con nombres de prueba que contienen instrucciones o temas ajenos, el 100 % de las
  respuestas aceptadas son solo cantidades para los materiales enviados o "no reconocido".
- **SC-004**: El gasto diario máximo por cliente queda acotado por el límite (20 × costo de una
  estimación).

## Assumptions

- La cuenta de Anthropic, la clave de API y un **tope de gasto mensual** en su consola los configura
  First Steps; la clave se guarda como secreto de Supabase. Sin clave la función responde "no
  disponible".
- Las cantidades sugeridas son una **orientación** que la administradora revisa; no hay garantía
  clínica. El formulario lo dice junto al botón.
- No se calibran las sugerencias con el consumo real en esta spec (backlog).
- Requiere una migración (registro de estimaciones y contador) y una función de servidor nueva; se
  publican con respaldo previo y visto bueno, como las anteriores.
