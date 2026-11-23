# Supabase Schema Contract: spec 028

Migración `supabase/migrations/20261124000000_pacientes_registro.sql`, en una transacción.

```sql
create table public.pacientes_registro (
  registro_id uuid primary key,
  tenant_id uuid not null default public.tenant_actual() references public.tenants (id),
  autor_id uuid not null,
  paciente text
    constraint pacientes_registro_paciente_check
      check (paciente is null or char_length(btrim(paciente)) between 1 and 60),
  actualizado_por uuid not null,
  actualizado_en timestamptz not null,
  constraint pacientes_registro_registro_fkey
    foreign key (registro_id, tenant_id) references public.tratamientos_realizados (id, tenant_id)
);
create index pacientes_registro_tenant_idx on public.pacientes_registro (tenant_id);
alter table public.pacientes_registro enable row level security;
```

Trigger `preparar_paciente_registro` (before insert or update, security definer):

- `new.autor_id := (select usuario_id from tratamientos_realizados where id = new.registro_id)`;
  en UPDATE además `new.registro_id/tenant_id := old.*`.
- Si el registro está anulado → `raise exception 'registro_anulado'` (`P0001`).
- En UPDATE, si `new.actualizado_en < old.actualizado_en` → `return old` (gana el más reciente).

Políticas: `leer: autor o administración`, `insertar: autor o administración, como sí mismo`,
`actualizar: autor o administración, como sí mismo` (ver data-model).

## Controles de `npm run test:rls`

1. El autor (personal) inserta el paciente de su registro y lo lee.
2. Otro personal del tenant no lo lee (0 filas) ni lo inserta/actualiza.
3. La administración lo lee y lo actualiza.
4. Otro tenant no lo lee ni lo escribe.
5. `autor_id` enviado por el cliente se ignora (queda el del registro).
6. Un UPDATE con `actualizado_en` más antiguo no cambia el paciente.
7. Paciente de 61 caracteres o solo espacios → rechazado; `null` → aceptado.
8. Sobre un registro anulado → rechazado.
9. Nadie borra filas (DELETE no tiene política).
