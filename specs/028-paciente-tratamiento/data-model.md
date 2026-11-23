# Data Model: Paciente opcional en cada tratamiento realizado

**Spec**: [spec.md](./spec.md) · **Fecha**: 2026-11-23

## Supabase — `pacientes_registro` (nueva)

| Columna | Tipo | Reglas |
|---|---|---|
| `registro_id` | uuid PK | FK `(registro_id, tenant_id)` → `tratamientos_realizados (id, tenant_id)` |
| `tenant_id` | uuid | default `tenant_actual()` |
| `autor_id` | uuid | lo fija el trigger desde el registro; inmutable |
| `paciente` | text null | `null` = sin paciente / borrado; si no es null, 1–60 caracteres tras `btrim` |
| `actualizado_por` | uuid | `= auth.uid()` |
| `actualizado_en` | timestamptz | el cliente lo envía; el trigger ignora un UPDATE más antiguo que el guardado |

RLS (tenant actual en todas):

- select: `autor_id = auth.uid() or es_administrador(auth.uid())`
- insert/update: lo mismo y `actualizado_por = auth.uid()`; registro no anulado (trigger)
- sin delete

## Dexie v16

```ts
export interface PacienteRegistro {
  registroId: string
  tenantId: string
  autorId: string
  paciente: string | null
  actualizadoPor: string
  actualizadoEn: string
  sincronizado: boolean
}
// pacientesRegistro: 'registroId, tenantId, sincronizado'
```

## Reglas

- Normalización: `trim`, espacios colapsados, máximo 60; vacío → `null`.
- Visible para la sesión: `autorId === usuario.id || usuario.rol === 'administrador'`.
- Editable: visible y el registro no está anulado.
- Logout: borra las filas sincronizadas. Pull: reemplaza las sincronizadas por las del servidor.
