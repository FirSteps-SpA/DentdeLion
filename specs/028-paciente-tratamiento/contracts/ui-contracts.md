# UI Contracts: spec 028

## 1. Hoja de registro (`RegistrarTratamientoSheet`)

- Campo `IconField` "Paciente (nombre o N° de ficha)" (opcional, `maxLength` 60,
  `autoComplete="off"`, `data-sentry-mask`), antes de "Registrar". No cambia el número de toques.
- `registrarTratamiento(tratamiento, { lugarId, cantidades, paciente })`.

## 2. Historial (`HistorialTratamientos`)

- Bajo el nombre del registro, si es visible: "Paciente: Juan Pérez".
- Si es editable (autor o administración, no anulado): botón con ícono lápiz,
  `aria-label="Paciente de <tratamiento>"`, que abre la hoja "Paciente" con el campo, "Guardar" y,
  si tiene paciente, "Quitar paciente".
- Buscador "Buscar paciente" (input de texto con `aria-label`), visible si hay algún paciente visible
  en el período; filtra junto con "Categoría".

## 3. Módulos

```ts
// src/features/tratamientos/lib/pacientes.ts
export function normalizarPaciente(texto: string): string | null
export function pacienteVisible(fila: PacienteRegistro | undefined, usuario: UsuarioActual | null): boolean
export function puedeEditarPaciente(registro: TratamientoRealizado, usuario: UsuarioActual | null): boolean
export async function guardarPaciente(registroId: string, texto: string): Promise<void>
export function filtrarPorPaciente(registros, pacientes: Map<string, string>, busqueda: string)

// registro.ts — RegistroInput gana `paciente?: string`
// tratamientosStore — `pacientes: Map<registroId, PacienteRegistro>` (solo visibles)
// authStore.logout — borra pacientesRegistro sincronizados
// sync — pushPacientesRegistro / pullPacientesRegistro (reemplazo de sincronizados)
// sentry.ts — beforeBreadcrumb descarta 'ui.input'
```

## 4. Pruebas

- `tests/unit/tratamientos/pacientes.test.ts`: normalización, visibilidad, edición, guardar (autor,
  admin, ajeno rechazado, anulado rechazado), filtro.
- `tests/unit/tratamientos/registro.test.ts`: registrar con paciente escribe registro + fila en una
  transacción; sin paciente, sin fila; error → ninguno.
- `tests/unit/sync-pacientes.test.ts`: push después de registros; pull reemplaza sincronizados y
  conserva pendientes; rechazo por permisos.
- `tests/unit/logout-pacientes.test.ts`: logout borra sincronizados, conserva pendientes.
- `tests/unit/dexie-v16.test.ts`.
- `tests/unit/sentry-paciente.test.ts`: un error con paciente no lleva el texto en el evento.
- `tests/integration/registrar-tratamiento.test.tsx` y `historial-tratamientos.test.tsx`: campo,
  "Paciente: …", visibilidad para personal ajeno, edición, quitar, buscador con totales.
