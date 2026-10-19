# Quickstart: validar unidades y costo unitario

**Feature**: 015-unidades-y-costo-unitario

## Requisitos

- Supabase local con la migración aplicada (`supabase db reset`).
- `npm install`.
- Para los escenarios en navegador, el skill `run-indentory`.

## Pruebas automáticas

```bash
npm test          # unitarias + integración (catálogo, factores, ingreso, precio, costo, conversión, compras, Dexie v11)
npm run test:rls  # cambios_lote, inmutabilidad del lote, triggers de unidad (contracts/supabase-schema.md §8)
npm run lint && npm run build
```

## Escenarios manuales

| # | Pasos | Esperado | Spec |
|---|---|---|---|
| 1 | Abrir la app con los datos migrados | Stock, mínimos y alertas idénticos a antes; "Pieza" aparece como "Unidad" | FR-011, SC-001 |
| 2 | Alta de "Articaína 4%": consumo Cartucho, compra Caja, contenido 50 | Presentación "Caja × 50 cartuchos" en tabla y detalle | US1-1, FR-005 |
| 3 | Alta de un Kit sin unidad de compra distinta | No pide contenido; presentación "Kit" | US1-2, FR-004 |
| 4 | Recibir 2 cajas a $32.500 por caja | Vista previa "2 cajas = 100 cartuchos" y "$650 por cartucho"; stock +100 | US2-1, US3-1, SC-003 |
| 5 | Recibir 30 cartuchos sueltos con total $21.000 | Stock +30; costo unitario pasa a $700 (último ingreso con precio) | US2-2, US3-2, FR-012 |
| 6 | Recibir un lote sin precio | Se guarda; el costo sigue en $700 | US3-3, Edge Cases |
| 7 | Consumir 1 cartucho | Stock −1 cartucho; tabla "≈ 2 cajas + 29" | FR-008, FR-021 |
| 8 | Como personal: editar el precio del lote sin precio a $30.000 | Costo pasa a $600; historial con autor y fecha | US5-1, Q3 |
| 9 | Como personal: intentar editar la presentación | No hay controles de edición | US1-6 |
| 10 | Insumo "Guantes" en Caja con 3 cajas; convertir a Unidad, 1 caja = 100 | Stock 300 unidades, mínimo convertido, historial previo en cajas | US1-4, FR-007a |
| 11 | Repetir 10 en otro dispositivo sin red, con un consumo de 1 caja antes de reconectar | Al sincronizar, el consumo cuenta como 100 unidades | Edge Cases, SC-005 |
| 12 | Convertir de Cartucho a Caja (×1/50) con 120 cartuchos | Rechazado: no es múltiplo | Edge Cases |
| 13 | Insumo bajo mínimo con Caja × 50 | Compras muestra "Pedir N cajas (… cartuchos)" | US4-2, FR-020 |
| 14 | Trasladar un lote con precio a otro lugar | El costo del lote se conserva en el destino | FR-018 |
| 15 | Todo lo anterior en modo avión y luego reconectar | Sin pérdidas ni duplicados; el indicador baja a 0 | FR-022, SC-005 |

## Migración

1. **Servidor**: ensayo sobre la restauración del respaldo de producción con la migración aplicada.
   Comparar, antes y después, el stock por lote y lugar (suma de `movimientos.cantidad` con signo) y
   los mínimos: deben ser idénticos. Ningún `insumos.unidad_medida = 'pieza'`; todos los movimientos
   con `unidad`.
2. **Dispositivo (Dexie v11) en Chromium real**: build 2.3.0 con un consumo sin conexión, después el
   build de la rama. El consumo sube con la `unidad` del insumo y el stock no cambia.
3. **Despliegue**: respaldo, `supabase db push` y luego el front. Antes de la **primera conversión**
   de unidad de consumo, verificar que todos los dispositivos del tenant tengan la versión nueva
   (research.md R10).
