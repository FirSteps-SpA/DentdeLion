# Feature Specification: Administración de la plataforma (clientes y usuarios)

**Feature Branch**: `[031-administracion-plataforma]`

**Created**: 2026-11-23

**Status**: Draft

**Input**: User description: "Me gustaría poder administrar los tenants/usuarios, crear y eliminarlos,
incluyendo sus datos."

## Contexto

Hoy First Steps da de alta un cliente (tenant) con el script `npm run alta-tenant`
(`1stDocs/004-operacion/alta-tenant.md`), que necesita la service role key en la terminal. No hay forma
de **eliminar** un cliente: habría que borrar a mano, en orden, filas de 21 tablas que dependen de él.
Dentro de cada cliente, su administradora puede invitar y **desactivar** personas, pero nadie puede
eliminar una cuenta.

## Clarifications

### Session 2026-11-23

- Q: ¿Dónde se administra? → A: **Panel "Plataforma" en la app**, visible solo para cuentas de First
  Steps que estén en una lista del servidor (no editable desde la app). Todo pasa por una función de
  servidor que verifica esa lista.
- Q: ¿Qué pasa al eliminar un cliente? → A: **Borrado inmediato**: se descarga primero un respaldo de
  sus datos, se confirma escribiendo el nombre del cliente y se borra todo (datos y cuentas).
- Q: ¿Y al eliminar un usuario? → A: **Se borran su cuenta, correo y nombre; sus registros quedan** en
  el cliente sin su nombre ("Usuario eliminado"). Stock, historial y reportes no cambian.
- Q: ¿Cómo se crean usuarios? → A: **Por invitación**, como hoy (enlace con nombre y contraseña propios).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Ver los clientes y sus usuarios (Priority: P1)

Como operador de First Steps, quiero ver todos los clientes con su actividad y sus usuarios, para saber
qué hay en la plataforma sin entrar a Supabase.

**Independent Test**: con una cuenta de la lista de plataforma, Ajustes → "Plataforma" lista los
clientes (nombre, fecha de alta, lugares, usuarios activos, última actividad); al abrir uno se ven sus
usuarios (nombre, correo, rol, estado) y sus invitaciones pendientes. Con cualquier otra cuenta, la
tarjeta no existe y el servidor rechaza las llamadas.

**Acceptance Scenarios**:

1. **Given** una cuenta en la lista de plataforma, con conexión, **When** abre Ajustes, **Then** ve la
   tarjeta "Plataforma".
2. **Given** cualquier otra cuenta (incluida una administradora de cliente), **When** abre Ajustes,
   **Then** no ve la tarjeta, y una llamada directa al servidor responde "sin permiso".
3. **Given** el panel, **When** lo abre, **Then** ve cada cliente con nombre, fecha de alta, cantidad
   de lugares y de usuarios activos, y la fecha de su último registro.
4. **Given** un cliente, **When** lo abre, **Then** ve sus usuarios (nombre, correo, rol, activo o
   desactivado) y sus invitaciones pendientes.
5. **Given** sin conexión, **When** abre el panel, **Then** ve "Necesita conexión" (no hay datos de
   plataforma guardados en el dispositivo).

---

### User Story 2 - Crear clientes e invitar usuarios (Priority: P1)

Como operador, quiero dar de alta un cliente e invitar usuarios a cualquier cliente desde la app, para
no depender del script ni de la service role key.

**Independent Test**: "Nuevo cliente" con nombre, primer lugar y correo de la administradora crea el
cliente y muestra el enlace de invitación para copiar; "Invitar" en un cliente existente crea otra
invitación con el rol elegido.

**Acceptance Scenarios**:

1. **Given** el panel, **When** crea un cliente con nombre (1–80), primer lugar (1–80) y correo,
   **Then** se crean cliente, lugar e invitación de administradora en un solo paso, y ve el enlace
   (que vence en 7 días) con "Copiar".
2. **Given** un cliente, **When** invita un correo con rol administración o personal, **Then** ve el
   enlace con "Copiar"; el correo no puede pertenecer ya a otro cliente.
3. **Given** que algo falla a mitad de la creación, **When** pasa, **Then** no queda un cliente a
   medias (todo o nada).

---

### User Story 3 - Eliminar un usuario (Priority: P2)

Como operador, quiero eliminar la cuenta de una persona, para cumplir cuando alguien pide que se borren
sus datos o deja de trabajar con el cliente.

**Independent Test**: eliminar a "Paula" de un cliente: su cuenta y su perfil desaparecen, ya no puede
entrar, y en el historial del cliente sus tratamientos siguen, con "Usuario eliminado" como autor.

**Acceptance Scenarios**:

1. **Given** un usuario, **When** el operador toca "Eliminar" y confirma escribiendo su correo,
   **Then** se borran su cuenta de acceso, su perfil (nombre) y las invitaciones a su correo.
2. **Given** sus registros (consumos, ingresos, compras, tratamientos, pacientes anotados), **When** se
   elimina, **Then** siguen en el cliente; donde se mostraba su nombre se muestra "Usuario eliminado".
3. **Given** la única administradora activa de un cliente, **When** el operador intenta eliminarla,
   **Then** se bloquea con "Es la única administradora: invita a otra o elimina el cliente".
4. **Given** su propia cuenta, **When** el operador intenta eliminarla, **Then** se bloquea.
5. **Given** un dispositivo donde esa persona tenía la sesión abierta, **When** vuelve a conectarse,
   **Then** la sesión se cierra y los datos del cliente se borran de ese dispositivo.

---

### User Story 4 - Eliminar un cliente con todos sus datos (Priority: P2)

Como operador, quiero eliminar un cliente por completo, para cerrar una cuenta que terminó o una
creada por error.

**Independent Test**: eliminar "Clínica Prueba": primero se descarga un archivo con todos sus datos;
luego, al escribir el nombre exacto, se borran sus filas de todas las tablas y las cuentas de sus
usuarios; el cliente desaparece del panel y nada suyo queda en la base.

**Acceptance Scenarios**:

1. **Given** un cliente, **When** el operador toca "Eliminar cliente", **Then** la app primero
   descarga un respaldo (JSON con todas sus filas y la lista de usuarios) y solo después habilita la
   confirmación.
2. **Given** el respaldo descargado, **When** escribe el nombre exacto del cliente y confirma, **Then**
   se borran en una transacción todas las filas del cliente en todas las tablas y luego las cuentas de
   acceso de sus usuarios.
3. **Given** el cliente al que pertenece la cuenta del operador, **When** intenta eliminarlo, **Then**
   se bloquea.
4. **Given** que el borrado de las filas falla, **When** pasa, **Then** no se borra nada (ni filas ni
   cuentas).
5. **Given** dispositivos de ese cliente, **When** se conectan, **Then** la sesión se cierra y sus
   datos locales se borran.

---

### Edge Cases

- **Cuentas que no se pudieron borrar** tras borrar las filas (falla de Auth): el panel lo dice y
  permite reintentar; esas cuentas ya no tienen perfil, así que no ven datos.
- **Invitación pendiente** de un cliente eliminado: deja de servir (la invitación se borra).
- **Operador en dos dispositivos**: las acciones se registran; la lista se recarga al volver al panel.
- **Archivo de respaldo grande**: los clientes actuales tienen cientos de filas; se genera en el
  servidor y se descarga como un archivo.
- **Usuario desactivado**: también se puede eliminar.

## Requirements *(mandatory)*

### Functional Requirements

**Acceso (US1)**

- **FR-001**: Solo las cuentas de la lista de plataforma (tabla del servidor, sin escritura desde la
  app ni desde la API) DEBEN ver el panel y usar sus acciones; el servidor DEBE verificarlo en cada
  llamada.
- **FR-002**: El panel DEBE requerir conexión y no guardar datos de otros clientes en el dispositivo.
- **FR-003**: Cada acción del panel DEBE quedar en un registro de auditoría (quién, qué, sobre qué
  cliente o usuario, cuándo), que se conserva aunque el cliente se elimine.

**Ver (US1)**

- **FR-004**: El panel DEBE listar clientes con nombre, alta, lugares, usuarios activos y última
  actividad, y por cliente, sus usuarios e invitaciones pendientes.

**Crear (US2)**

- **FR-005**: El panel DEBE crear cliente, primer lugar e invitación de administradora en una sola
  transacción y mostrar el enlace.
- **FR-006**: El panel DEBE invitar a un cliente existente con rol administración o personal, con las
  mismas reglas que las invitaciones actuales (correo no perteneciente a otro cliente, 7 días).

**Eliminar usuario (US3)**

- **FR-007**: Eliminar un usuario DEBE borrar su cuenta de acceso, su perfil y las invitaciones a su
  correo, y conservar sus registros en el cliente.
- **FR-008**: Donde la app muestra el autor de un registro, un usuario eliminado DEBE mostrarse como
  "Usuario eliminado".
- **FR-009**: NO DEBE poder eliminarse la propia cuenta ni la única administradora activa de un
  cliente.

**Eliminar cliente (US4)**

- **FR-010**: Antes de eliminar un cliente, la app DEBE descargar un respaldo JSON con todas sus filas
  y sus usuarios; la confirmación DEBE pedir el nombre exacto.
- **FR-011**: Eliminar un cliente DEBE borrar todas sus filas en una transacción y después las cuentas
  de sus usuarios; si la transacción falla, nada se borra.
- **FR-012**: NO DEBE poder eliminarse el cliente de la cuenta del operador.

**Dispositivos (US3, US4)**

- **FR-013**: Un dispositivo cuya sesión pertenece a un usuario o cliente eliminado DEBE, al
  conectarse, cerrar la sesión y borrar los datos locales del cliente.

### Key Entities

- **Operador de plataforma**: cuenta de acceso en la lista del servidor.
- **Registro de auditoría**: operador, acción, cliente (id y nombre), usuario afectado (id y correo),
  fecha, resultado.

## Success Criteria *(mandatory)*

- **SC-001**: Dar de alta un cliente toma menos de 1 minuto desde el panel, sin terminal.
- **SC-002**: El 100 % de las llamadas al servidor de plataforma desde cuentas fuera de la lista se
  rechazan (pruebas del servidor).
- **SC-003**: Tras eliminar un cliente, ninguna tabla tiene filas con su id (prueba del servidor sobre
  las 21 tablas).
- **SC-004**: Tras eliminar un usuario, el stock, el historial y los reportes de su cliente quedan
  idénticos (prueba del servidor).

## Assumptions

- La cuenta de First Steps se agrega a la lista de plataforma a mano con SQL tras el despliegue
  (**nunca en una migración**: el repositorio es público y no debe tener correos ni ids de cuentas).
- La cuenta del operador pertenece a un cliente propio de First Steps (p. ej. uno de demostración), ya
  que la app requiere un perfil para entrar.
- Se recomienda activar 2FA en esa cuenta (fuera del alcance de la spec).
- El script `alta-tenant` se mantiene como alternativa de terminal.
- Requiere migración y una función de servidor nueva; se publican con respaldo y visto bueno.
