# Quickstart: validar Paginación de listas

**Feature**: 020-paginacion-de-listas | **Date**: 2026-10-23

## Prerrequisitos

- `develop` con la spec 019. Sin migraciones que aplicar.
- Supabase local (`supabase start`) y un tenant de volumen con **200 insumos**:
  `node scripts/seed-volumen.mjs --insumos 200` (imprime la cuenta de administración).
- Skill `run-indentory` para levantar la app y tomar capturas.

## 1. Pruebas automáticas

```bash
npm run lint && npm run build
npx vitest run tests/unit/paginacion.test.ts tests/unit/useListaPaginada.test.tsx \
  tests/integration/inventario-paginacion.test.tsx tests/integration/inventario-tabla.test.tsx \
  tests/integration/inventario.test.tsx tests/integration/acciones-rapidas.test.tsx \
  tests/integration/alertas-detalle.test.tsx tests/integration/ajustes.test.tsx \
  tests/integration/ajustes-minimos.test.tsx
npm test            # suite completa sin regresiones
```

## 2. Inventario en teléfono (US1, SC-001, SC-002, SC-003)

DevTools, 360 × 640, cuenta del tenant de volumen:

1. Abrir Inventario. **Esperado**: en menos de 1 s, 25 tarjetas en orden alfabético y "Ver más
   (quedan 175)".
2. Tocar "Ver más" dos veces. **Esperado**: 75 tarjetas; la pantalla no salta; "quedan 125".
3. Desplazarse a la tarjeta 60 y tocarla. **Esperado**: el detalle se abre en una hoja encima.
   Cerrarla. **Esperado**: siguen 75 tarjetas y se ve la tarjeta 60.
4. "Consumir 1" en una tarjeta del tercer grupo. **Esperado**: no cambian los grupos ni la posición.
5. Ir a Alertas y volver a Inventario. **Esperado**: 25 tarjetas y filtros vacíos.

## 3. Búsqueda, filtros y alertas (US2, SC-004)

1. Con 3 grupos cargados, buscar el nombre del último insumo alfabético. **Esperado**: aparece primero;
   sin "Ver más" si hay menos de 26 coincidencias.
2. Limpiar, tocar el acceso "stock bajo" del resumen. **Esperado**: la lista vuelve al comienzo, solo
   insumos bajo mínimo; el resumen da la misma cifra que antes de la spec.
3. Cambiar de lugar en el encabezado. **Esperado**: vuelve al comienzo.

## 4. Tabla en desktop (US3)

1280 px de ancho:

1. **Esperado**: 25 filas y, debajo, "Anterior" (deshabilitado), 1 2 3 … 8, "Siguiente", "1–25 de 200".
2. Ir a la página 5. **Esperado**: filas 101–125, el comienzo de la tabla a la vista; números
   1 … 4 5 6 … 8.
3. Abrir y cerrar el detalle de una fila. **Esperado**: sigue la página 5.
4. Achicar la ventana a 1000 px. **Esperado**: tarjetas con 125 visibles (grupos hasta la página 5).
5. Solo teclado: Tab hasta "Siguiente", Enter. **Esperado**: el foco pasa al título de la tabla y el
   lector anuncia el rango.

## 5. Ajustes (US4, SC-005)

1. "Categorías" con más de 25 categorías (crear las que falten). **Esperado**: 25 + "Ver más".
   Renombrar una del segundo grupo: los grupos se mantienen.
2. "Insumos dados de baja" con más de 25 (dar de baja desde Inventario o SQL). **Esperado**: orden
   alfabético, 25 + "Ver más"; restaurar uno ajusta "quedan".
3. "Notificaciones y avisos" ▸ "Stock mínimo por insumo". **Esperado**: igual que en la 019, con el
   mismo botón "Ver más" que las demás listas.
4. Volver al índice y entrar otra vez. **Esperado**: cada lista empieza desde el comienzo.

## 6. Capturas (SC-005)

Con `run-indentory`: Inventario (primera página y con "Ver más" usado) en móvil (360), tablet (768) y
desktop (1280); detalle en hoja en los tres; Categorías e Insumos dados de baja en móvil.

## 7. Sincronización sin cambios (SC-006)

Revisar el diff: no toca `src/lib/sync`, `src/lib/db` ni `supabase/`.
