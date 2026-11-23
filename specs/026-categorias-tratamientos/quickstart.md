# Quickstart: validar la spec 026

## Pruebas automáticas

```bash
npm run lint
npm run build
npm test
supabase start && supabase db reset   # aplica las migraciones, incluida la 026
npm run test:rls                      # controles nuevos de contracts/supabase-schema.md §5
```

## Ensayo de la migración (antes de producción)

1. Respaldo de producción (`004-operacion/respaldo/respaldo.sh` en 1stDocs).
2. Restaurarlo en Supabase local, aplicar `20261123000000_categorias_tratamiento.sql` y comprobar:
   - cada tenant tiene 9 categorías;
   - `cambios_tratamiento` y `tratamientos_realizados` conservan sus filas, con las columnas nuevas en
     `null`;
   - totales de `tratamientos_realizados` (precio, % y ganancia) idénticos antes y después (SC-003).
3. Insertar un tenant de prueba y ver sus 9 categorías.

## Recorrido manual (skill `run-indentory`)

Datos: dos lugares (Clínica A con % general 40, Clínica B con 45), tratamientos "Evaluación inicial"
($20.000) y "Resina simple" ($20.000) con precio en ambos.

1. **Sembradas (US1)**: Ajustes → Categorías de tratamientos muestra las 9.
2. **Asignar**: Tratamientos → "Evaluación inicial" → Editar → Categoría "Evaluación" → Guardar. El
   catálogo muestra "Evaluación"; el chip "Evaluación" filtra.
3. **% por lugar (US2)**: en la categoría Evaluación, Clínica A = 50; Clínica B vacía (placeholder
   "Usa el general (45 %)").
4. **Montos**: detalle de "Evaluación inicial" en Clínica A: "Profesional 50 % · Evaluación"; en
   Clínica B: "45 % · general del lugar".
5. **Registrar** ambos tratamientos en Clínica A: ganancia del profesional $10.000 y $8.000.
6. **Hacia adelante**: cambiar Evaluación a 60 %; el registro anterior sigue en 50 %.
7. **Historial (US3)**: filtrar "Evaluación": un registro y totales de ese registro.
8. **Reportes**: "Por categoría de tratamiento" con Evaluación y Sin categoría.
9. **Renombrar** Evaluación a "Evaluación y diagnóstico": el catálogo y Reportes muestran el nombre
   nuevo; el historial muestra el que tenía al registrar.
10. **Personal**: no ve la sección en Ajustes ni puede cambiar la categoría; sí la ve en el catálogo.
11. **Sin conexión**: asignar una categoría en modo avión; sube al reconectar.
