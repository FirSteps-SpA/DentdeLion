# Quickstart: validar la spec 027

## Pruebas automáticas

```bash
npm run lint
npm run build
npm test            # incluye contraste.test.ts con los pares nuevos
```

Sin migración: `npm run test:rls` no cambia.

## Recorrido visual (skill `run-indentory`)

Datos: administración, un lugar, 3 insumos (uno caducado, uno por vencer, uno bajo mínimo) con
precio, un tratamiento registrado y un ítem en Compras.

1. **Inicio desktop 1280×800** junto a `ref/2026-11-23-redesign/…jpeg`: barra lateral con activo
   turquesa lleno y diente con onda al pie; barra superior con pastillas; saludo con diente y
   destellos; 5 KPI con ícono de fondo y "Ver detalle →"; Alertas y Próximos vencimientos (línea de
   tiempo); sin "¿Qué necesitas comprar?".
2. **Inicio teléfono 375×800**: encabezado con pastillas; Valor a lo ancho y 4 KPI en 2 columnas; sin
   desborde horizontal.
3. **Cada sección** (Inventario, Tratamientos + Historial, Compras, Reportes, Alertas, Ajustes y una
   sección de Ajustes) en 375 y 1440: encabezado con ícono decorativo, tarjetas con
   `EncabezadoSeccion`, pastillas de estado y un estado vacío.
4. **Tablet 900 px**: barra lateral contraída (solo íconos, activo lleno, sin ilustración).
5. **Acceso**: pantalla de ingreso con ondas y diente.
6. **Sincronización**: con el backend apagado, la pastilla muestra el error en ámbar con texto.
7. **Teclado**: Tab por la barra lateral y una KPI: el foco se ve.
8. **Desborde**: en cada vista a 360 px, `scrollWidth <= innerWidth`.
