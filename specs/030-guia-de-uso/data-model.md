# Data Model: Guía de uso

Sin cambios en Supabase ni Dexie.

- **Ayuda** (estática, `src/features/ayuda/contenido.ts`): `id`, `titulo`, `paraQue`,
  `tareas[] { nombre, pasos[], soloAdministracion? }`, `consejos[] { texto, soloAdministracion? }`.
- **Ayudas vistas** (`localStorage["dentdelion:ayudas-vistas:<usuarioId>"]`): `string[]` de ids.
