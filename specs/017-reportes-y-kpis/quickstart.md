# Quickstart: validar Reportes y KPIs

**Feature**: 017-reportes-y-kpis | **Date**: 2026-10-22

## Prerrequisitos

- `develop` con la spec 016 (Dexie v12, tratamientos realizados).
- Supabase local (`supabase start`) con el seed y dos lugares en el tenant de prueba.
- Skill `run-indentory` para levantar la app y tomar capturas.

## 1. Pruebas automáticas

```bash
npm run lint && npm run build
npx vitest run tests/unit/reportes tests/unit/sync-paginacion.test.ts \
  tests/integration/reportes.test.tsx tests/integration/inicio-valor-inventario.test.tsx \
  tests/unit/lecturas-movimientos.test.ts
npm test            # suite completa sin regresiones
```

Esperado: todo verde. Las pruebas de `tests/unit/reportes/` cubren las invariantes 1–5 de
[contracts/reportes-lib.md](./contracts/reportes-lib.md) y la prueba de rendimiento (20.000
movimientos + 3.000 tratamientos en < 300 ms).

## 2. Escenario base (un lugar)

En "Clínica Providencia", con precios cargados:

1. Registrar 3 tratamientos este mes: dos de $45.000 y uno de $30.000 (spec 016).
2. Consumir 1 guante con "Consumir 1" y deshacerlo.
3. Abrir Reportes.

Esperado: Producción **$120.000**; Gasto = Σ costo de los materiales descontados por los 3
tratamientos (el guante deshecho no suma); Ganancia estimada = Σ de las ganancias de los registros,
con "No es utilidad contable". Cambiar a "Mes anterior" y "Elegir mes…" recalcula.

## 3. "Todos" y Ganancia por lugar

Registrar 1 tratamiento en "Box Las Condes", cambiar el selector a "Todos".

Esperado: KPIs = suma de ambos lugares (verificar contra cada lugar por separado); aparece "Ganancia
por lugar" con 2 barras, de mayor a menor. En un lugar específico, el gráfico no aparece.

## 4. Casos borde

| Paso | Esperado |
|---|---|
| Anular un tratamiento del período | Baja producción, gasto y ganancia al reabrir |
| Ingresar un lote sin precio y consumirlo | Gasto "desde $X · 1 material sin precio" |
| Tratamiento sin precio en el lugar | "1 tratamiento sin precio" en Producción |
| Lugar nuevo sin datos | Estado vacío con accesos a Tratamientos e Inventario |
| Período anterior fuera de 13 meses ("Este año" en octubre) | "Sin datos del período anterior" |
| Modo avión | Reportes y Valor de inventario funcionan igual |

## 5. Pulls paginados (FR-018a)

1. Con el script de semilla de volumen (tarea de tests), crear > 2.500 movimientos en el tenant de
   prueba.
2. Abrir la app en un perfil limpio de Chromium e iniciar sesión.

Esperado: tras la primera sincronización, el conteo local de `movimientos` en IndexedDB es igual al
de Postgres; el stock y los reportes coinciden con un dispositivo con historia completa. Medir y
anotar duración y tamaño del ciclo completo (base para decidir el pull incremental, research R9).

## 6. Inicio

Esperado: primera tarjeta "Valor de inventario" con monto, "↑/↓ N % vs. mes anterior" y al tocarla
abre Reportes. Comparar capturas en móvil (375 px), tablet y desktop con el DS §20 y §34–35.

## 7. Validación con la clienta (SC-007)

Revisar con ella un mes real: producción, gasto y ganancia coinciden con su percepción y entiende
cada gráfico sin explicación.
