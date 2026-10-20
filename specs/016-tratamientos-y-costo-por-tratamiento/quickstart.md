# Quickstart: validar tratamientos y costo por tratamiento

**Feature**: 016-tratamientos-y-costo-por-tratamiento

## Requisitos

- Supabase local (`DOCKER_HOST=unix:///var/run/docker.sock supabase start` y `supabase db reset`).
- `npm install`; para el navegador, el skill `run-indentory`.

## Pruebas automáticas

```bash
npm test
npm run test:rls   # contracts/supabase-schema.md §6
npm run lint && npm run build
```

## Escenarios manuales

| # | Pasos | Esperado | Spec |
|---|---|---|---|
| 1 | Ajustes → Lugares: Providencia 40 %, Las Condes 50 % | Se ve el % de la clínica como resto | US4 |
| 2 | Crear "Restauración clase II": $45.000 en Providencia, $50.000 en Las Condes; 1 cartucho de anestesia, 2 g de resina | Aparece en la lista con el precio del lugar activo | US1-1 |
| 3 | Con anestesia a $650 y resina a $1.200/g + otros materiales del DS | Costo $3.480, comisión $18.000, Ganancia estimada $14.520 en Providencia | US2-1, SC-002 |
| 4 | Cambiar a Las Condes | Precio $50.000, comisión $25.000, ganancia recalculada | US2-3 |
| 5 | Un material sin precio | "desde $X" y aviso en la ganancia | US2-2 |
| 6 | Registrar realizado | Se descuentan 1 cartucho y 2 g por FEFO; aviso con Deshacer | US3-1/2, SC-001 |
| 7 | Registrar con resina insuficiente | Aviso con lo disponible; registrar deshabilitado hasta ajustar | US3-3 |
| 8 | Deshacer | Stock vuelve; registro anulado con autor | US3-6 |
| 9 | Cambiar el precio después | Los registros previos conservan su monto | US3-4, SC-003 |
| 10 | Como personal | Ve montos, registra y deshace; no edita tratamientos | FR-004, Q3 |
| 11 | Sin red: registrar y deshacer; reconectar | Todo sube una vez | SC-005 |
| 12 | Historial "este mes" | Totales sin anulados | US5 |
| 13 | Móvil 375 px | Barra: Inicio, Inventario, Tratamientos, Alertas, Más; Compras en Más | FR-005 |

## Migración

1. **Respaldo nuevo** de producción y ensayo: respaldo → migraciones pendientes → 016 en una base
   desechable; conteos iguales.
2. Dexie v12 en Chromium real desde el build de `develop` actual (v11) con un consumo pendiente.
3. Despliegue: respaldo → `supabase db push` → front.
