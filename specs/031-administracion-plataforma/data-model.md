# Data Model: Administración de la plataforma

**Spec**: [spec.md](./spec.md) · **Fecha**: 2026-11-23

## Nuevas tablas

| Tabla | Columnas | RLS |
|---|---|---|
| `administradores_plataforma` | `usuario_id uuid pk`, `agregado_en timestamptz` | activo, sin políticas |
| `auditoria_plataforma` | `id`, `operador_id`, `accion`, `tenant_id` (sin FK), `tenant_nombre`, `usuario_id` (sin FK), `usuario_correo`, `resultado`, `creado_en` | activo, sin políticas |
| `usuarios_eliminados` | `usuario_id uuid pk`, `tenant_id` (FK tenants), `eliminado_en` | `select` para miembros del tenant |

## Cambios

- Se quitan las FKs a `auth.users` de: `movimientos.usuario_id`, `cambios_insumo.usuario_id`,
  `insumos.creado_por`, `insumos.dado_de_baja_por`, `categorias.creado_por`,
  `items_compra.creado_por`, `items_compra.comprado_por`, `invitaciones.invitado_por`,
  `invitaciones.aceptada_por` (R3).
- `perfiles_id_fkey` pasa a `on delete cascade`.

## Funciones (solo `service_role`, salvo la primera)

- `es_operador_plataforma() → boolean` (`authenticated`).
- `crear_cliente(...) → (tenant_id, invitacion_id)`.
- `invitar_a_cliente(...) → invitacion_id`.
- `eliminar_usuario(p_usuario) → void`: valida (no la única admin activa), borra perfil e invitaciones
  a su correo, inserta en `usuarios_eliminados`.
- `eliminar_cliente(p_tenant) → uuid[]`: borra todo lo del tenant y devuelve los ids de cuentas.
- `resumen_clientes() → setof (...)`: lista con conteos y última actividad.

## Dexie

- `usuariosEliminados` (v17, clave `usuarioId`), poblada por el sync; se limpia con el tenant.
