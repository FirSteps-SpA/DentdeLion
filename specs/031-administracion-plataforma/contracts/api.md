# Contrato: Edge Function `plataforma`

`POST /functions/v1/plataforma` con el JWT de la sesión. Cuerpo `{ accion, ... }`.

| accion | entrada | salida |
|---|---|---|
| `listar` | — | `{ clientes: [{ id, nombre, creadoEn, lugares, usuariosActivos, ultimaActividad }] }` |
| `detalle` | `tenantId` | `{ cliente, usuarios: [{ id, nombre, correo, rol, desactivado }], invitaciones: [{ id, correo, rol, venceEn }] }` |
| `crear_cliente` | `nombre`, `lugar`, `correo` | `{ tenantId, enlace }` |
| `invitar` | `tenantId`, `correo`, `rol` | `{ enlace }` |
| `eliminar_usuario` | `usuarioId`, `confirmacion` (= correo) | `{ ok: true }` |
| `exportar_cliente` | `tenantId` | archivo JSON (`Content-Disposition: attachment`) |
| `eliminar_cliente` | `tenantId`, `confirmacion` (= nombre) | `{ cuentasBorradas, cuentasPendientes: [id] }` |

Errores `{ codigo }`: `sin_sesion` 401, `sin_permiso` 403, `solicitud_invalida` 400,
`no_encontrado` 404, `confirmacion_incorrecta` 409, `unica_administradora` 409, `propia_cuenta` 409,
`propio_cliente` 409, `correo_en_otro_tenant` 409, `error_interno` 500.

## Controles de `npm run test:rls`

1. Nadie lee ni escribe `administradores_plataforma` ni `auditoria_plataforma` por la API.
2. Las funciones de plataforma (salvo `es_operador_plataforma`) no se pueden llamar por la API.
3. Edge Function: sin sesión 401; administradora de cliente 403; operador 200 en `listar`.
4. `crear_cliente` crea tenant, lugar e invitación; con un correo de otro tenant, nada.
5. `eliminar_usuario`: la cuenta deja de existir; sus movimientos, registros y cambios siguen; su id
   está en `usuarios_eliminados`, visible para su tenant y no para otro; no se puede con la única
   administradora ni con la propia cuenta.
6. `eliminar_cliente` sobre un tenant de prueba con datos en todas las tablas: ninguna tabla con
   `tenant_id` conserva filas suyas, sus cuentas no existen, otro tenant queda igual; sin la
   confirmación correcta, nada; el propio cliente, nunca.
7. Cada acción deja una fila en `auditoria_plataforma`.
