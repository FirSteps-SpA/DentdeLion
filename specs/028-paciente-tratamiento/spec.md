# Feature Specification: Paciente opcional en cada tratamiento realizado

**Feature Branch**: `[028-paciente-tratamiento]`

**Created**: 2026-11-23

**Status**: Draft

**Input**: User description: "Que a los tratamientos se les pueda asociar opcionalmente el nombre de un
paciente (a cada instancia de tratamiento), para que después el dentista pueda revisar los
tratamientos que hizo y tener claro a quién se los hizo."

**Origen**: ideas del 2026-11-23 (`~/1STEPS/notes.txt`), backlog `1stDocs/002-backlog/002-DentdeLion.md`
→ spec 028.

## Contexto

Cada vez que se registra un tratamiento (spec 016) queda un registro con el tratamiento, el lugar, el
precio, el % profesional, los materiales y quién lo registró. Ese registro lo ve todo el equipo del
cliente en el historial y en Reportes, y no se puede cambiar (solo anular).

Saber a qué paciente se le hizo cada tratamiento ayuda al profesional a revisar su trabajo. Pero "a
este paciente se le hizo una endodoncia" es un **dato de salud** de una persona identificable: debe
verlo solo quien lo necesita, poder corregirse, no salir del dispositivo más de lo necesario y no
llegar a herramientas de terceros como Sentry.

## Clarifications

### Session 2026-11-23

- Q: ¿Quién ve el paciente de un registro? → A: **quien registró el tratamiento y la administración**
  del cliente. El resto del equipo ve el registro sin el paciente. Lo impone el servidor.
- Q: ¿Qué se anota? → A: **texto libre corto**: "Paciente (nombre o N° de ficha)", hasta 60
  caracteres; cada profesional decide cuánto identificar.
- Q: ¿Se puede corregir o borrar después? → A: **sí, quien lo registró y la administración**, sin
  anular el tratamiento; el resto del registro sigue inmutable.
- Q: ¿Se puede buscar por paciente? → A: **sí**, un buscador en el historial.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Anotar el paciente al registrar (Priority: P1)

Como profesional, quiero anotar opcionalmente a qué paciente le hice el tratamiento al registrarlo,
para poder revisarlo después.

**Why this priority**: es el pedido.

**Independent Test**: registrar un tratamiento escribiendo "Juan Pérez" y verlo en el historial con
"Paciente: Juan Pérez"; registrar otro sin paciente y que funcione como hoy.

**Acceptance Scenarios**:

1. **Given** la hoja de registro, **When** la abro, **Then** veo un campo opcional "Paciente (nombre o
   N° de ficha)", vacío.
2. **Given** el campo con "Juan Pérez", **When** registro, **Then** el registro queda asociado a ese
   paciente y en el historial se ve "Paciente: Juan Pérez".
3. **Given** el campo vacío, **When** registro, **Then** el registro queda sin paciente, igual que hoy.
4. **Given** un texto de más de 60 caracteres o solo espacios, **When** registro, **Then** se recorta
   a 60 / se trata como vacío, sin bloquear el registro.
5. **Given** sin conexión, **When** registro con paciente, **Then** se guarda en el dispositivo y se
   sube al reconectar, junto con el registro.
6. **Given** que deshago el registro desde el aviso, **When** se anula, **Then** el paciente queda con
   el registro anulado y no aparece en totales.

---

### User Story 2 - Solo quien corresponde lo ve (Priority: P1)

Como clínica, quiero que el paciente de un registro lo vean solo quien lo registró y la
administración, para no exponer datos de salud al resto del equipo.

**Why this priority**: es condición para poder guardar el dato.

**Independent Test**: un profesional registra con paciente; otro profesional del mismo cliente ve el
registro sin paciente; la administradora sí lo ve; el servidor rechaza leerlo a quien no corresponde.

**Acceptance Scenarios**:

1. **Given** un registro con paciente hecho por A, **When** B (personal, mismo cliente) mira el
   historial, **Then** ve el registro sin el paciente y sin indicio de que lo tenga.
2. **Given** ese registro, **When** la administradora mira el historial, **Then** ve el paciente.
3. **Given** el servidor, **When** B pide los pacientes de los registros de A, **Then** no recibe
   ninguno; **When** alguien de otro cliente los pide, **Then** tampoco.
4. **Given** un dispositivo compartido, **When** A cierra sesión, **Then** los pacientes ya subidos se
   borran del dispositivo; los que aún no subieron quedan guardados para subir, pero no se muestran
   a quien inicie sesión después salvo que le corresponda verlos.
5. **Given** un error de la app, **When** se reporta a la herramienta de errores, **Then** el texto del
   paciente no se incluye.
6. **Given** Reportes, **When** se calculan, **Then** no muestran pacientes.

---

### User Story 3 - Corregir y buscar (Priority: P2)

Como profesional o administración, quiero corregir o borrar el paciente de un registro y buscar mis
registros por paciente, para mantener el dato correcto y encontrar lo que le hice a alguien.

**Why this priority**: mejora el uso diario; el dato ya es útil sin esto.

**Independent Test**: en el historial, cambiar "Juan Peres" por "Juan Pérez", borrar otro, y buscar
"perez" para ver solo los registros de ese paciente con sus totales.

**Acceptance Scenarios**:

1. **Given** un registro propio (o cualquiera, si soy administración), **When** toco "Paciente" en el
   historial, **Then** puedo cambiar el texto o dejarlo vacío y guardar; el resto del registro no
   cambia.
2. **Given** un registro de otra persona y soy personal, **When** lo miro, **Then** no hay opción de
   agregar ni corregir paciente.
3. **Given** un registro sin paciente, **When** quien corresponde lo edita, **Then** puede agregarlo.
4. **Given** el buscador "Buscar paciente" del historial, **When** escribo "perez", **Then** veo solo
   los registros del período cuyo paciente contiene ese texto (sin distinguir mayúsculas ni tildes),
   y los totales corresponden a esos registros.
5. **Given** que borro el texto del buscador, **When** lo dejo vacío, **Then** vuelven todos los
   registros del período.
6. **Given** dos personas editan el mismo paciente sin conexión, **When** sincronizan, **Then** queda
   el último cambio.

---

### Edge Cases

- **Registro de otra versión en caché**: un dispositivo que no se actualizó registra sin el campo; el
  registro queda sin paciente y se le puede agregar después.
- **Cambio de rol**: si una administradora pasa a personal, al sincronizar deja de ver en ese
  dispositivo los pacientes de registros ajenos.
- **Registro anulado**: conserva el paciente (para quien puede verlo) pero no se puede editar.
- **Historial con filtro de categoría** (spec 026) y búsqueda de paciente a la vez: se aplican los dos.
- **Vista "Todos" los lugares**: el paciente se muestra igual, con el lugar de cada registro.
- **Exportaciones**: no hay exportación de registros hoy; esta spec no agrega ninguna.

## Requirements *(mandatory)*

### Functional Requirements

**Anotar (US1)**

- **FR-001**: La hoja de registro DEBE tener un campo opcional "Paciente (nombre o N° de ficha)" de
  hasta 60 caracteres; el texto se recorta y un texto vacío o solo espacios equivale a "sin paciente".
- **FR-002**: Registrar con paciente DEBE guardar el paciente asociado al registro en la misma
  operación local que el registro (o se guardan los dos o ninguno) y subirlo con la sincronización.
- **FR-003**: El paciente NO DEBE formar parte de los datos del registro que ve todo el equipo; se
  guarda aparte, asociado al registro.

**Acceso (US2)**

- **FR-004**: Solo DEBEN poder leer el paciente de un registro quien lo registró y la administración
  del mismo cliente; el servidor DEBE rechazar cualquier otra lectura o escritura.
- **FR-005**: El historial DEBE mostrar "Paciente: …" solo a quien puede verlo; a los demás, nada.
- **FR-006**: Al cerrar sesión, el dispositivo DEBE borrar los pacientes ya sincronizados; los no
  sincronizados se conservan para subir y la app solo los muestra a quien puede verlos.
- **FR-007**: Al sincronizar, el dispositivo DEBE quedarse solo con los pacientes que el servidor le
  permite leer (si cambia el rol, se retiran los que ya no corresponden).
- **FR-008**: Ningún reporte de errores, aviso ni registro técnico DEBE incluir el texto del paciente.
- **FR-009**: Reportes NO DEBE mostrar pacientes.

**Corregir y buscar (US3)**

- **FR-010**: Quien registró y la administración DEBEN poder agregar, corregir o borrar el paciente de
  un registro no anulado desde el historial, sin cambiar el resto del registro.
- **FR-011**: Si dos cambios del mismo paciente compiten, DEBE quedar el más reciente.
- **FR-012**: El historial DEBE tener un buscador "Buscar paciente" que filtre (sin distinguir
  mayúsculas, tildes ni espacios extra) los registros visibles del período y sus totales; se combina
  con el filtro de categoría.

**General**

- **FR-013**: Todo DEBE funcionar sin conexión y sincronizar como el resto de los registros.
- **FR-014**: Los controles nuevos DEBEN medir ≥ 48 px y seguir el diseño de la spec 027.

### Key Entities

- **Paciente de un registro**: pertenece a un tratamiento realizado (uno a uno, opcional) y a su
  cliente; texto de hasta 60 caracteres (o vacío = borrado); quién lo registró (el autor del
  registro), quién lo cambió por última vez y cuándo.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Anotar el paciente al registrar agrega solo escribirlo: el registro sigue siendo de 2
  toques más el texto.
- **SC-002**: En las pruebas de permisos del servidor, el 100 % de las lecturas y escrituras de
  pacientes por personal ajeno o por otro cliente se rechazan.
- **SC-003**: Tras cerrar sesión en un dispositivo compartido, 0 pacientes sincronizados quedan en el
  almacenamiento local.
- **SC-004**: Buscar un paciente en el historial muestra solo sus registros y los totales coinciden
  con la suma de esos registros.
- **SC-005**: 0 apariciones del texto del paciente en los eventos enviados a la herramienta de errores
  (verificado con un error provocado en pruebas).

## Assumptions

- Es un dato de salud de una persona identificable. Antes de usarlo en producción conviene revisar con
  asesoría legal las obligaciones de la ley de protección de datos vigente (en Chile, la Ley 21.719
  entra en vigencia en diciembre de 2026, según lo informado; confirmar). Esta spec aplica
  minimización (texto libre corto, opcional), acceso restringido, corrección y borrado.
- No se agrega un registro de pacientes ni una ficha clínica: solo un texto asociado a cada registro.
- No hay exportación de pacientes; Reportes no los usa.
- Requiere migración (tabla nueva con permisos propios); se aplica en producción antes del front, con
  respaldo previo y visto bueno explícito.
