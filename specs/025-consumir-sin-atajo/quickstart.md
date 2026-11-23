# Quickstart: validar la spec 025

## Pruebas automáticas

```bash
npm run lint
npm run build       # tsc -b + vite build
npm test            # incluye lecturas-movimientos.test.ts (arquitectura)
```

Las pruebas nuevas y ajustadas están en [contracts/ui-contracts.md §6](./contracts/ui-contracts.md).
No hay migración: `npm run test:rls` no cambia.

## Recorrido manual (skill `run-indentory`)

Datos: "Anestesia" (unidad `cartucho`, sin decimales) con un lote **L-VIG** de 10 cartuchos que vence
el año próximo y un lote **L-VEN** de 3 cartuchos vencido ayer; "Gel" (unidad `ml`) con 0,5 ml
vigentes; "Guantes" sin stock; "Fresa" con solo un lote vencido.

1. **Abrir sin registrar (US1)**: en Inventario (móvil), tocar "Consumir" en Anestesia. Se abre la
   hoja con cantidad 1, lote propuesto **L-VIG** y sin teclado abierto. El stock no cambió.
2. **1 unidad en 2 toques**: tocar "Confirmar consumo". La hoja se cierra, Anestesia queda en 12
   (10 + 3 − 1) y aparece el aviso con "Deshacer".
3. **Deshacer (US2)**: tocar "Deshacer" → vuelve a 13; un segundo toque no cambia nada.
4. **Otra cantidad**: "Consumir" → escribir 4 (reemplaza el 1) → Confirmar → 9 cartuchos vigentes.
5. **Rechazos**: 1,5 en Anestesia → error de unidad; 20 → stock insuficiente. No se escribe nada.
6. **Fraccionario**: "Gel" muestra "Consumir" habilitado; consumir 0,5 lo deja en 0 y el botón pasa
   a "Sin stock".
7. **Solo vencido**: "Fresa" → la hoja propone su lote con "Lote vencido" visible.
8. **Menú (US3)**: "⋮" no tiene "Consumir otra cantidad".
9. **Desktop**: tabla con "Consumir"; la hoja abre con el campo enfocado y el 1 seleccionado.
10. **Todos**: en "Todos", "Consumir" pregunta el lugar y luego abre la hoja de ese lugar.
11. **Sin conexión**: en modo avión, repetir el paso 2; se guarda y sube al reconectar.
