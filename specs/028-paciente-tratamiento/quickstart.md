# Quickstart: validar la spec 028

## Pruebas automáticas

```bash
npm run lint && npm run build && npm test
supabase start && supabase migration up --local && npm run test:rls   # controles de contracts/supabase-schema.md
```

## Ensayo de la migración

Restaurar el último respaldo de producción en un proyecto Supabase temporal, aplicar
`20261124000000_pacientes_registro.sql` y comprobar que las filas de `public` no cambian (tabla nueva
vacía).

## Recorrido (skill `run-indentory`)

1. Como personal A: registrar un tratamiento con "Juan Pérez" y otro sin paciente. Historial: "Paciente:
   Juan Pérez" en el primero.
2. Corregir a "Juan Pérez Soto"; quitarlo; volver a ponerlo.
3. Buscar "perez": solo ese registro y sus totales; combinar con categoría.
4. Como personal B (mismo dispositivo, otro usuario): el registro se ve sin paciente y sin lápiz.
5. Como administración: se ve y se puede corregir.
6. Cerrar sesión con todo sincronizado: el almacenamiento local no tiene pacientes.
