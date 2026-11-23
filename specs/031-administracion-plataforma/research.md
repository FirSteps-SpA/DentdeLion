# Research: Administración de la plataforma

**Spec**: [spec.md](./spec.md) · **Fecha**: 2026-11-23

## R1 — Quién es operador

- **Decision**: tabla `administradores_plataforma (usuario_id uuid pk, agregado_en)` con RLS activo y
  **sin políticas** (ni lectura ni escritura por la API). Función `es_operador_plataforma()` (security
  definer, `authenticated`) que devuelve si `auth.uid()` está en la tabla, para mostrar la tarjeta.
  La Edge Function vuelve a verificarlo con service role en cada llamada (FR-001).
- La fila del operador se inserta a mano con SQL tras el despliegue (assumption: repo público).

## R2 — Dónde corre: Edge Function `plataforma`

- **Decision**: una Edge Function `plataforma` (`verify_jwt = true`) con `accion` en el cuerpo:
  `listar`, `detalle`, `crear_cliente`, `invitar`, `eliminar_usuario`, `exportar_cliente`,
  `eliminar_cliente`. Verifica sesión y lista; usa service role para leer todos los tenants, para las
  funciones SQL (solo `service_role`) y para la API de administración de Auth (borrar cuentas).
- Cada acción escribe en `auditoria_plataforma` (FR-003), sin FK a tenants ni usuarios para que
  sobreviva al borrado; guarda nombre del cliente y correo afectado como texto (es el registro de
  quién se borró, solo legible por service role).

## R3 — Borrar una cuenta conservando sus registros (bloqueante)

- Hoy `auth.users` es referenciado por FKs sin `on delete`: `movimientos.usuario_id`,
  `cambios_insumo.usuario_id`, `insumos.creado_por`, `insumos.dado_de_baja_por`,
  `categorias.creado_por`, `items_compra.creado_por`, `items_compra.comprado_por`,
  `invitaciones.invitado_por`, `invitaciones.aceptada_por` y `perfiles.id`. Con ellas, Postgres impide
  borrar la cuenta de quien registró algo.
- **Decision**: la migración **quita las FKs de historial** (el uuid queda como dato: identifica al
  autor aunque la cuenta ya no exista) y cambia `perfiles_id_fkey` a `on delete cascade`.
  Las demás columnas de autor (`usuario_id` de tratamientos, cambios, pacientes…) ya son uuid sin FK.
- **Alternatives considered**: `on delete set null` (pierde quién hizo cada cosa entre registros del
  mismo autor y choca con columnas `not null`); reasignar a un usuario "eliminado" fijo (inventa un
  autor).

## R4 — "Usuario eliminado" en la app (FR-008)

- Los nombres ajenos salen de `usuariosConocidos` (Dexie, por dispositivo; quien no está se ve como
  "otra persona").
- **Decision**: tabla `usuarios_eliminados (usuario_id pk, tenant_id, eliminado_en)` (solo ids, sin
  datos personales), legible por los miembros del tenant; el sync la baja, borra esos ids de
  `usuariosConocidos` y la UI muestra "Usuario eliminado" para ellos. Se borra con el tenant.

## R5 — Dispositivos de cuentas eliminadas (FR-013)

- Una cuenta borrada no puede refrescar su sesión y `auth.getUser()` responde `user_not_found`.
- **Decision**: en el sync, si Auth responde explícitamente que el usuario no existe (`user_not_found`
  o refresh token inexistente), la app borra los datos locales del tenant (`aislarDatosLocales`) y
  cierra sesión, con un aviso "Tu cuenta fue eliminada". Errores de red u otros no borran nada.
- Pendientes sin subir de esa cuenta se pierden (la cuenta ya no existe): aceptado.

## R6 — Eliminar cliente (FR-010–FR-012)

- **Exportar**: la Edge Function arma `{ generado_en, cliente, usuarios: [{id, correo, nombre, rol}],
  tablas: { <tabla>: filas[] } }` leyendo con service role cada tabla con `tenant_id` (lista tomada de
  `information_schema` para no olvidar ninguna) y lo devuelve como descarga.
- **Borrar**: función SQL `eliminar_cliente(p_tenant)` (security definer, solo `service_role`): en una
  transacción, guarda los ids de sus usuarios, borra las filas de **todas** las tablas con `tenant_id`
  en orden de dependencias (orden explícito + verificación final de que no queda ninguna fila) y el
  tenant; devuelve los ids. Luego la Edge Function borra esas cuentas con la API de Auth; si alguna
  falla, se informa y se puede reintentar (sin perfil no ven nada).
- Control en `test:rls`: tras eliminar un tenant de prueba, ninguna tabla con `tenant_id` tiene filas
  suyas (SC-003), y otro tenant queda intacto.

## R7 — Crear cliente e invitar (FR-005, FR-006)

- Función SQL `crear_cliente(p_nombre, p_lugar, p_correo, p_token_hash, p_operador)` (solo
  `service_role`): valida, inserta tenant, lugar e invitación en una transacción. El token se genera
  en la Edge Function (32 bytes, se guarda solo el hash, como hoy).
- `invitar_a_cliente(p_tenant, p_correo, p_rol, p_token_hash, p_operador)`: mismas reglas que
  `crear_invitacion` (correo no perteneciente a otro tenant; vence en 7 días).

## R8 — UI

- Ajustes → tarjeta "Plataforma" (sección `plataforma`, visible si `es_operador_plataforma()` es true;
  se consulta al abrir Ajustes con conexión). Subpantallas: lista de clientes → detalle (usuarios,
  invitaciones, "Invitar", "Eliminar usuario", "Eliminar cliente") y "Nuevo cliente".
- Confirmaciones: usuario → escribir su correo; cliente → descargar respaldo y luego escribir el
  nombre exacto.
