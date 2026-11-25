# Quickstart: validar la spec 033

**Prerrequisitos**: `npm install`; Supabase local con la migración aplicada (`supabase migration up
--local`) y `supabase functions serve` para `test:rls`.

## Automático

```bash
npm run lint && npx tsc -b
npx vitest run --testTimeout=20000   # unit: bodega, vistas, mínimos, separar; integración: Ajustes, Inventario, Compras, Reportes
npm run test:rls                     # contracts/api.md §1–6
```

## §1 Juntar (US1)

1. Con el driver: `seed-user administrador …`, `seed-lugar …0012 Box 2`; insumo `i1` con 2 cajas
   (lote A) en lugar 1 y 1 caja (lote B) en Box 2 (`seed-lote … …0012`).
2. Ajustes → Lugares → Box 2 → "Compartir bodega con…" → Clínica. La confirmación dice "1 insumo con
   stock en ambos".
3. Inventario en cada lugar: 3 cajas, lotes A y B. Historial sin movimientos nuevos.

## §2 Operar (US2)

1. En Box 2, consumir 1 de A (lote que entró en el otro lugar) → se permite. Ambos lugares ven 2.
2. Compras: agregar un ítem en Box 2 → visible en Clínica con "Agregado en Box 2".
3. "Todos": una sola fila de stock "Clínica + Box 2". Valor del inventario sin doble conteo.
4. Trasladar desde Box 2: Clínica no aparece como destino.
5. Reportes por Box 2: el consumo de §2.1 aparece en Box 2, no en Clínica.

## §3 Separar (US3)

1. Separar Box 2 → Box 2 en 0, Clínica con todo. El historial de A muestra un traslado de separación.
2. Trasladar 1 de Clínica a Box 2 con el traslado normal → funciona.

## §4 Sin conexión

1. DevTools offline en dos pestañas con la misma bodega: consumir el último stock en ambas → al volver
   la red, el lote queda **En revisión** (stock común negativo).

## Despliegue

`db push` de la migración (agrega una columna nullable; no toca datos) → front. **No configurar
bodegas compartidas hasta que todos los dispositivos del cliente tengan la versión nueva** (research
R9). Avisarle a la clínica y pedirle que abra la app en cada equipo.
