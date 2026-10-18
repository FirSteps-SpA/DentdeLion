# Feature Specification: Indicador de Sincronización

**Feature Branch**: `[012-indicador-sincronizacion]`

**Created**: 2026-10-18

**Status**: Draft

**Input**: User description: "nueva spec correspondiente a la 012 indicador-sincronizador, según el roadmap del repo ubicado en 1stDocs, como hermano de este repo en la carpeta 1STEPS"

**Origen**: `1stDocs/005-roadmap/002-DentdeLion.md` § 012 · `indicador-sincronizacion` (S–M) y backlog
"Indicador visible de cambios pendientes de sincronizar + aviso si llevan más de X horas sin subir".

## Contexto

La release 2.1.0 corrigió un bug por el que movimientos registrados sin conexión se marcaban como
sincronizados aunque nunca hubieran llegado al servidor. En una app offline-first (Constitución I) el
personal necesita **ver** si lo que registró ya llegó. Hoy el encabezado muestra "Sincronizado" o
"Sin conexión" según haya conexión con el servidor, sin mirar si quedan cambios por subir: puede decir
"Sincronizado" con consumos pendientes en el dispositivo. Esta spec reemplaza ese indicador binario por
uno basado en los cambios pendientes reales.

> Nota: la spec 005 excluyó explícitamente un contador de operaciones pendientes del encabezado. Esta
> spec revierte esa decisión a pedido del roadmap 2026-10-18.

## Clarifications

### Session 2026-10-18

- Q: ¿Quién define el umbral de horas para avisar de cambios pendientes antiguos, y a qué dispositivos se aplica? → A: Un solo valor para toda la clínica, que edita un administrador en Ajustes (por defecto 24 h); se sincroniza a todos los dispositivos y los demás roles solo lo ven.
- Q: Si en un dispositivo compartido hay cambios de otra persona que llevan más tiempo sin subir que el umbral, ¿el indicador de quien tiene la sesión abierta debe pasar al estado de alerta? → A: Sí: los pendientes de otros que superan el umbral también activan la alerta en el encabezado, y el detalle explica de quién son y que esa persona debe iniciar sesión.
- Q: ¿Cuándo debe mostrar el indicador "Error de sincronización" en vez de "Sin conexión"? → A: "Sin conexión" ante cualquier fallo de red (el dispositivo no tiene red o no alcanza el servidor); "Error" solo si el servidor responde con un rechazo o fallo, o la sesión expiró. Basta un ciclo fallido para mostrarlo y el siguiente ciclo exitoso lo quita.
- Q: ¿Dónde se abre el detalle al tocar el indicador? → A: Panel que sube desde abajo, encima de la pantalla actual, que se cierra sin perder lo que había en pantalla (sin sección nueva en Ajustes).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Ver si hay cambios sin subir (Priority: P1)

Como integrante del personal clínico, veo en el encabezado, en todo momento, si mis registros ya
llegaron al servidor: "Sincronizado" cuando no queda nada pendiente, "N pendientes" cuando hay cambios
locales sin subir, "Sin conexión" cuando el dispositivo no puede comunicarse con el servidor, y
"Error de sincronización" cuando el último intento de subida falló aunque haya conexión. El número
baja solo, sin recargar la app, a medida que los cambios se suben.

**Why this priority**: Es el objetivo central de la spec: recuperar la confianza en que "lo registrado
llegó". Sin este estado, el resto (hora, avisos, botón) no tiene dónde mostrarse.

**Independent Test**: Sin red, registrar 3 consumos y comprobar que el indicador muestra "Sin conexión"
con 3 pendientes; restablecer la red y comprobar que, sin recargar, pasa a "Sincronizado" con 0
pendientes.

**Acceptance Scenarios**:

1. **Given** un dispositivo con conexión y sin cambios locales pendientes, **When** el usuario mira el encabezado, **Then** el indicador muestra "Sincronizado".
2. **Given** un dispositivo sin conexión, **When** el usuario registra 3 consumos, **Then** el indicador muestra "Sin conexión" y 3 cambios pendientes, actualizado inmediatamente tras cada registro.
3. **Given** 3 cambios pendientes y el dispositivo vuelve a tener conexión, **When** se completa el siguiente ciclo de sincronización, **Then** el indicador baja a 0 y muestra "Sincronizado" sin recargar la app.
4. **Given** el servidor responde pero rechaza o falla la subida, **When** termina ese ciclo, **Then** el indicador muestra "Error de sincronización" junto con el número de pendientes, que no baja.
5. **Given** el dispositivo dice tener red pero no alcanza el servidor (p. ej. wifi sin internet), **When** termina el ciclo, **Then** el indicador muestra "Sin conexión", no "Error de sincronización".
6. **Given** el estado "Error de sincronización", **When** el siguiente ciclo termina con éxito, **Then** el indicador vuelve a "Sincronizado" (o "N pendientes") sin intervención del usuario.
7. **Given** cambios pendientes de distinto tipo (consumos/ingresos, ediciones de insumo y categorías nuevas), **When** el usuario mira el indicador, **Then** el número suma todos los tipos contemplados.

---

### User Story 2 - Saber cuándo fue la última sincronización exitosa (Priority: P2)

Como usuario, al tocar el indicador se abre un panel desde abajo, sin salir de la pantalla en la que estoy, que muestra la hora de la última
sincronización exitosa (p. ej. "Última sincronización: hoy 14:32" o "hace 5 min"), el estado actual
y el desglose de pendientes por tipo.

**Why this priority**: Complementa el estado: "Sin conexión" con última sincronización hace 2 minutos
no preocupa; con última sincronización hace 2 días, sí.

**Independent Test**: Sincronizar con éxito, cortar la red, esperar y abrir el detalle: la hora
mostrada es la del último ciclo exitoso, no la del último intento.

**Acceptance Scenarios**:

1. **Given** un ciclo de sincronización terminado con éxito a las 14:32, **When** el usuario abre el detalle, **Then** ve "Última sincronización" con esa hora.
2. **Given** intentos fallidos posteriores a las 14:32, **When** el usuario abre el detalle, **Then** la hora sigue siendo 14:32.
3. **Given** un dispositivo que nunca completó una sincronización exitosa, **When** el usuario abre el detalle, **Then** ve "Nunca sincronizado" en lugar de una hora.
4. **Given** un formulario de consumo a medio llenar, **When** el usuario abre y cierra el panel de sincronización, **Then** el formulario conserva lo ingresado.
5. **Given** la app cerrada y vuelta a abrir sin conexión, **When** el usuario abre el detalle, **Then** la hora de la última sincronización exitosa se conserva.

---

### User Story 3 - Sincronizar ahora (Priority: P2)

Como usuario que acaba de recuperar la señal (o antes de cerrar la jornada), quiero un botón
"Sincronizar ahora" en el detalle del indicador para no esperar al siguiente ciclo automático.

**Why this priority**: Da control y confirmación inmediata, pero la sincronización automática ya
funciona sin él.

**Independent Test**: Con pendientes y conexión, pulsar "Sincronizar ahora" y comprobar que los
pendientes bajan a 0 sin esperar al ciclo automático.

**Acceptance Scenarios**:

1. **Given** cambios pendientes y conexión disponible, **When** el usuario pulsa "Sincronizar ahora", **Then** se lanza un ciclo de sincronización de inmediato, el botón muestra que está en curso y, al terminar, el indicador refleja el resultado.
2. **Given** un ciclo de sincronización ya en curso, **When** el usuario pulsa el botón, **Then** no se lanza un segundo ciclo en paralelo (el botón queda deshabilitado mientras tanto).
3. **Given** el dispositivo sin conexión, **When** el usuario pulsa "Sincronizar ahora", **Then** el intento termina rápido con un mensaje claro ("Sin conexión: se subirán al volver la red") y no bloquea el uso de la app.

---

### User Story 4 - Aviso de pendientes antiguos (Priority: P3)

Como usuario, si hay cambios que llevan sin subir más de un umbral de horas, el indicador cambia a un
estado de alerta visual y el detalle explica cuántos son y desde cuándo, para que alguien conecte el
dispositivo o avise a soporte. El umbral se configura en Ajustes.

**Why this priority**: Detecta el caso grave (un dispositivo que lleva días sin subir), pero es menos
frecuente que el uso diario cubierto por las historias 1–3.

**Independent Test**: Con el umbral en 1 hora, crear un pendiente con antigüedad mayor a 1 hora sin
conexión y comprobar que el indicador muestra la alerta; al sincronizarlo, la alerta desaparece.

**Acceptance Scenarios**:

1. **Given** un umbral de 24 horas y un cambio pendiente creado hace 25 horas, **When** el usuario mira el encabezado, **Then** el indicador se muestra en estado de alerta (color e ícono distintos, no solo texto, Constitución IV).
2. **Given** ese estado de alerta, **When** el usuario abre el detalle, **Then** ve cuántos cambios superan el umbral y la fecha del más antiguo.
3. **Given** el estado de alerta, **When** todos los cambios antiguos se sincronizan, **Then** la alerta desaparece sin recargar.
4. **Given** un administrador en Ajustes, **When** cambia el umbral, **Then** el nuevo valor se aplica al indicador de inmediato.

---

### User Story 5 - Pendientes de otro usuario en un dispositivo compartido (Priority: P3)

Como usuario de un dispositivo compartido, si en él quedan cambios de **otra persona** sin subir (solo
pueden subirse con su sesión), el detalle me lo dice: "Hay N cambios de [Nombre] que se subirán cuando
esa persona inicie sesión en este dispositivo". Esos cambios no cuentan como mis pendientes ni ponen
mi indicador en error.

**Why this priority**: Es un caso real en el gabinete (tablet compartida), y sin él el contador
parecería atascado, pero afecta a menos usuarios que las historias anteriores.

**Independent Test**: Usuario A registra un consumo sin conexión y cierra sesión; usuario B inicia
sesión con conexión: el indicador de B muestra "Sincronizado" y el detalle avisa del pendiente de A.

**Acceptance Scenarios**:

1. **Given** un pendiente de A en el dispositivo y B con sesión iniciada y conexión, **When** B mira el encabezado, **Then** el indicador de B no cuenta el pendiente de A.
2. **Given** el mismo caso, **When** B abre el detalle, **Then** ve el aviso con el nombre de A (o "otro usuario" si el nombre no está disponible localmente) y el número de cambios.
3. **Given** un pendiente de A con antigüedad mayor al umbral, **When** B mira el encabezado, **Then** el indicador de B se muestra en estado de alerta y el detalle explica que el cambio antiguo es de A y que A debe iniciar sesión en este dispositivo para subirlo.
4. **Given** el mismo caso, **When** A vuelve a iniciar sesión con conexión, **Then** sus pendientes se suben y el aviso desaparece para ambos.

---

### Edge Cases

- Cambios rechazados definitivamente por el servidor (p. ej. por permisos) que la app ya revirtió y notificó: no cuentan como pendientes, porque nunca van a subirse.
- Sesión expirada con pendientes: el indicador muestra "Error de sincronización" y el detalle indica que hay que volver a iniciar sesión.
- La conexión fluctúa durante un ciclo: el contador refleja solo lo efectivamente aceptado por el servidor; nunca baja por cambios que no llegaron (bug de 2.1.0).
- Muchos pendientes (cientos tras días sin red): el número se muestra completo o abreviado ("99+") sin romper el encabezado en pantallas angostas.
- Reloj del dispositivo adelantado o atrasado: la antigüedad de los pendientes se calcula con la hora en que se registró el cambio en el dispositivo; un desfase no debe producir antigüedades negativas.
- Ningún usuario con sesión en el dispositivo (pantalla de login): el indicador no se muestra.
- Reinstalación o borrado de datos del navegador: los pendientes locales se pierden (fuera de alcance; esta spec solo los hace visibles).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema DEBE mostrar un indicador de sincronización en el encabezado de todas las pantallas autenticadas, reemplazando el indicador actual basado solo en la conexión.
- **FR-002**: El indicador DEBE tener cuatro estados mutuamente excluyentes, con prioridad: Error de sincronización > Sin conexión > Pendientes (N > 0) > Sincronizado. En los estados Error y Sin conexión DEBE mostrarse también el número de pendientes si es mayor que 0. "Sin conexión" corresponde a cualquier fallo de red (el dispositivo no tiene red o no alcanza el servidor); "Error de sincronización" corresponde a que el servidor respondió con un rechazo o fallo, o a sesión expirada. Basta un ciclo fallido para mostrar cualquiera de los dos y el siguiente ciclo exitoso los quita.
- **FR-003**: El número de pendientes DEBE contar los cambios locales del usuario con sesión iniciada que aún no fueron aceptados por el servidor: movimientos de inventario (consumos, ingresos, ajustes), cambios de insumo y categorías creadas. No DEBE contar cambios ya rechazados y revertidos.
- **FR-004**: El indicador DEBE actualizarse de forma reactiva, sin recargar la app: al crear un cambio local (subir) y al confirmarse su subida (bajar).
- **FR-005**: Un cambio DEBE dejar de contarse solo cuando el servidor lo haya aceptado; un fallo de subida nunca lo descuenta.
- **FR-006**: El sistema DEBE registrar la hora de la última sincronización exitosa (ciclo completo sin errores de subida) y conservarla entre cierres de la app en el mismo dispositivo.
- **FR-007**: Al tocar el indicador, el sistema DEBE abrir un panel que sube desde el borde inferior, encima de la pantalla actual, y que al cerrarse deja intacto lo que había en pantalla (formularios a medio llenar incluidos). Ese panel (en esta spec, "el detalle") DEBE mostrar: estado actual, hora de la última sincronización exitosa (o "Nunca sincronizado"), desglose de pendientes por tipo, aviso de pendientes antiguos (FR-010) y aviso de pendientes de otros usuarios (FR-012).
- **FR-008**: El detalle DEBE ofrecer un botón "Sincronizar ahora" que lance un ciclo de sincronización inmediato, muestre el progreso y quede deshabilitado mientras haya un ciclo en curso (manual o automático).
- **FR-009**: "Sincronizar ahora" sin conexión DEBE terminar con un mensaje claro y no bloquear la interfaz (Constitución I).
- **FR-010**: Si algún pendiente del dispositivo —del usuario actual o de otro usuario (FR-012)— supera el umbral de antigüedad, el indicador DEBE pasar a un estado de alerta visual (color e ícono, no solo texto) y el detalle DEBE mostrar cuántos lo superan y la fecha del más antiguo.
- **FR-011**: El umbral de antigüedad DEBE ser un único valor para toda la clínica, en horas (1 a 168, por defecto 24), editable solo por administradores en Ajustes y visible en modo lectura para los demás roles. DEBE sincronizarse a todos los dispositivos y, sin conexión, usarse el último valor conocido localmente (o 24 h si nunca se recibió).
- **FR-012**: El sistema DEBE detectar pendientes de usuarios distintos al de la sesión actual en el mismo dispositivo, excluirlos del contador y de los estados Error/Pendientes del usuario actual (salvo la alerta de antigüedad, FR-010), y mostrar en el detalle un aviso con el nombre de cada persona (o "otro usuario") y su número de cambios, indicando que se subirán cuando esa persona inicie sesión.
- **FR-013**: Todo el cálculo del indicador (pendientes, antigüedad, otros usuarios, última sincronización) DEBE hacerse con datos locales del dispositivo y funcionar sin conexión.
- **FR-014**: El indicador y el botón "Sincronizar ahora" DEBEN tener un área táctil mínima de 48×48 px (Constitución III).
- **FR-015**: Si la subida falla por sesión expirada, el detalle DEBE indicar que hay que volver a iniciar sesión para subir los pendientes.

### Key Entities

- **Cambio pendiente**: cambio local aún no aceptado por el servidor. Atributos relevantes: tipo (movimiento, cambio de insumo, categoría), usuario autor, fecha de creación, estado (pendiente / sincronizado / rechazado). Ya existe en los datos locales; esta spec solo lo cuenta.
- **Estado de sincronización del dispositivo**: estado actual del indicador, hora de la última sincronización exitosa, resultado del último intento y si hay un ciclo en curso. Local al dispositivo.
- **Umbral de aviso de pendientes**: número de horas (1–168, por defecto 24) a partir del cual un pendiente se considera antiguo. Un único valor por clínica, sincronizado, editable solo por administradores.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: En el 100% de las pruebas sin red, el indicador muestra el número exacto de cambios registrados, en menos de 1 segundo tras cada registro.
- **SC-002**: Al volver la red, el contador llega a 0 sin recargar la app en menos de 1 minuto (o en menos de 10 segundos usando "Sincronizar ahora").
- **SC-003**: El indicador nunca muestra "Sincronizado" mientras exista un cambio del usuario no aceptado por el servidor (0 falsos "Sincronizado" en las pruebas de integración de cada estado).
- **SC-004**: Un usuario identifica en menos de 5 segundos, mirando el encabezado, si tiene cambios sin subir.
- **SC-005**: Ningún pendiente supera el umbral sin que el indicador muestre la alerta.
- **SC-006**: Después del release, cero reportes de "registré algo y no aparece en otro dispositivo" sin que el dispositivo de origen mostrara pendientes.

## Assumptions

- El "dispositivo compartido" es el caso de varias personas usando la misma app en el mismo navegador, cerrando y abriendo sesión. Los pendientes de cada uno solo se suben con su propia sesión (comportamiento actual, por permisos del servidor), y esta spec no cambia eso.
- Lotes, ítems de la lista de compras y configuración se suben completos en cada ciclo sin marca de pendiente; no entran en el contador (alcance del roadmap: movimientos, cambios de insumo y categorías). Un fallo al subirlos sí cuenta como error del ciclo.
- El umbral sigue el mismo patrón que los niveles de aviso de caducidad (spec 010): configuración global de la clínica, editada por administradores.
- La alerta de pendientes antiguos es visual dentro de la app; no se envían notificaciones push ni correos.
- El nombre de otro usuario se toma de los datos locales ya disponibles en el dispositivo; si no está, se muestra "otro usuario".
- Se mantiene el ciclo automático de sincronización actual; esta spec no cambia su frecuencia ni el orden de subida.
- Fuera de alcance: subir pendientes de otro usuario sin su sesión, resolver conflictos desde el indicador, historial de sincronizaciones y multi-tenant (spec 014).
- El indicador vive en el encabezado actual; su rediseño según el Design System v1.0 corresponde a la spec 013.
- Aceptación del roadmap: pruebas de integración para cada estado (Sincronizado, Pendientes, Sin conexión, Error, alerta de antigüedad, pendientes de otro usuario).
