# Research: Paciente opcional en cada tratamiento realizado

**Spec**: [spec.md](./spec.md) · **Fecha**: 2026-11-23

## R1 — Tabla aparte, no una columna del registro

- **Decision**: tabla `pacientes_registro` (una fila por registro que tenga o haya tenido paciente),
  clave `registro_id` con FK compuesta `(registro_id, tenant_id)` → `tratamientos_realizados`.
- **Rationale**: `tratamientos_realizados` lo lee todo el tenant y su snapshot es inmutable (spec 016
  R5, trigger `proteger_tratamiento_realizado`). Una columna ahí obligaría a RLS por columna (que
  PostgREST no da) y a abrir el trigger. Una tabla aparte tiene RLS propia (FR-004) y se puede editar
  (FR-010) sin tocar el snapshot.
- **Alternatives considered**: columna con vista restringida; cifrado del lado del cliente (no
  resuelve quién lo ve dentro del tenant y complica la búsqueda).

## R2 — Permisos (RLS)

- **Decision**: columnas `autor_id` (quien registró; un trigger `before insert or update` lo copia de
  `tratamientos_realizados.usuario_id` y lo vuelve inmutable, sin confiar en el cliente),
  `actualizado_por`, `actualizado_en`. Políticas, todas con `tenant_id = tenant_actual()`:
  - select/insert/update: `autor_id = auth.uid() or es_administrador(auth.uid())`;
  - insert/update exigen además `actualizado_por = auth.uid()`;
  - sin delete: "borrar" deja `paciente = null` (así el borrado se sincroniza como cualquier cambio).
  - El registro no debe estar anulado para escribir (trigger: `anulado_en is null`).
- **Rationale**: FR-004 y FR-010; el autor se toma del servidor.

## R3 — Último cambio gana

- **Decision**: el trigger ignora (conserva la fila) un UPDATE cuyo `actualizado_en` sea anterior al
  guardado (FR-011). El cliente sube con `upsert`.
- **Rationale**: dos dispositivos sin conexión; mismo criterio que el resto del catálogo.

## R4 — Dexie y almacenamiento local

- **Decision**: Dexie v16 con `pacientesRegistro: 'registroId, tenantId, sincronizado'`; fila
  `{ registroId, tenantId, autorId, paciente: string | null, actualizadoPor, actualizadoEn,
  sincronizado }`.
- **Cierre de sesión** (FR-006): `logout` borra las filas `sincronizado: true`; las pendientes quedan.
- **Pull** (FR-007): reemplaza todas las filas sincronizadas por las que devuelve el servidor (lo que
  esa sesión puede leer); no toca las pendientes propias.
- **Visibilidad en la UI**: un selector `pacienteVisible(fila, usuario)` muestra la fila solo si
  `autorId === usuario.id` o el usuario es administración (cubre las pendientes de otra persona en un
  dispositivo compartido).

## R5 — Registro y edición

- `registrarTratamiento` acepta `paciente?: string`; si no está vacío, agrega la fila en la **misma**
  transacción Dexie (FR-002). Normaliza: `trim`, colapsa espacios, corta a 60.
- `guardarPaciente(registroId, texto)`: exige autor o administración y registro no anulado; escribe la
  fila con `paciente` normalizado o `null`.
- Orden del sync: pacientes **después** de `tratamientos_realizados` (FK).

## R6 — Sentry y avisos

- El SDK ya no envía bodies, usuario ni query params (`dataCollection` en `src/lib/sentry.ts`).
- **Decision**: (a) ningún `Error` ni aviso de la app incluye el paciente (mensajes fijos); (b)
  `beforeBreadcrumb` descarta los breadcrumbs `ui.input`, que en algunas integraciones llevan el valor
  del campo; (c) el campo lleva `autoComplete="off"` y `data-sentry-mask`.
- **Alternatives considered**: un `beforeSend` que busque y borre textos de pacientes conocidos
  (frágil: depende de tener la lista en memoria y de coincidencias exactas).
- Prueba (SC-005): forzar un error durante el guardado con paciente y verificar, con un transporte
  falso, que el evento no contiene el texto.

## R7 — Historial

- "Paciente: …" bajo el tratamiento, solo si es visible; botón "Paciente" (lápiz) para autor o
  administración en registros no anulados → hoja con el campo, "Guardar" y "Quitar paciente".
- Buscador "Buscar paciente" (texto, plegado de tildes con `plegar` de insumos) que filtra los
  registros visibles; se combina con el filtro de categoría (spec 026). Los totales usan el resultado.
- Solo se muestra el buscador si la persona puede ver al menos un paciente en el período.
