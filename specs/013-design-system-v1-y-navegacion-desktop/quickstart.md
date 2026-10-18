# Quickstart: validar el Design System v1.0 y la navegación desktop

**Feature**: 013-design-system-v1-y-navegacion-desktop

## Requisitos

- `npm install` (agrega `lucide-react`).
- Para los escenarios en navegador, el skill `run-indentory` (`setup.sh` una vez).
- Datos de prueba: un usuario sembrado (`seed-user`) y algunos insumos y lotes (`seed-insumo`,
  `seed-lote`): uno bajo mínimo, uno que vence en 3 días, uno vencido y uno sin caducidad.

## Pruebas automáticas

```bash
npm test          # incluye contraste, resumenInicio, useDisposicion e integración de navegación, Inicio y tabla
npm run lint && npm run build
```

Esperado: todo verde. La prueba de contraste falla si algún token rompe un par del contrato
[design-tokens.md](./contracts/design-tokens.md).

## Escenarios visuales (`npm run dev` y `run-indentory`)

Hay que tomar capturas en **375, 768, 1024 y 1440 px** de Login, Inicio, Inventario, Compras,
Alertas y Ajustes, y compararlas con `ref/2026-10-17-design-system/001-app-design.jpeg`.

| # | Ancho | Pasos | Esperado | Spec |
|---|---|---|---|---|
| 1 | 375 | Entrar | Se abre en Inicio con el saludo, la fecha, las 4 KPI (bajo mínimo 1, por vencer ≥ 2, para comprar ≥ 1, alertas ≥ 2) y las listas | US3-1/2/5/6 |
| 2 | 375 | Tocar "Productos bajo mínimo" | Abre Alertas; el número coincide con "Stock bajo" | US3-3/4 |
| 3 | 375 | Recorrer las 5 secciones | Barra inferior del DS, de 80 px, con 5 ítems; ícono activo turquesa oscuro; sin sidebar; sin desplazamiento horizontal | US4-1, FR-017 |
| 4 | 768 | Recargar | Sidebar contraída (solo íconos), sin barra inferior, con la barra superior (clínica, sincronización, avatar) | US4-2, FR-014 |
| 5 | 768 | "Expandir menú", recargar | La sidebar queda expandida tras recargar (preferencia recordada) | US4-3, FR-013 |
| 6 | 1440 | Recorrer las secciones | Sidebar de 240 px con el ítem activo en menta; contenido a ancho completo con 32 px de margen; Inicio con las 4 KPI en una fila | US2, US3-10 |
| 7 | 1440 | Inventario | Tabla con Producto, Categoría, Stock, Stock mínimo, Vencimiento, Estado y Acciones; "Consumir 1" y "⋮" funcionan; los filtros filtran la tabla | US5 |
| 8 | 1440 | Abrir "⋮" de un insumo y el panel de sincronización | Modal centrado (≤ 560 px, radio 20) en vez de panel inferior | US4-5, FR-016 |
| 9 | 375 → 1440 | Con el formulario de alta de material a medio llenar, redimensionar | El formulario conserva lo ingresado y la sección no cambia | FR-015 |
| 10 | Todos | Medir con el driver | `document.documentElement.scrollWidth <= innerWidth`, y todo botón, enlace o input visible mide ≥ 48 × 48 px | SC-002, SC-006 |
| 11 | 375 | Modo avión (DevTools *Offline*) y recargar | Manrope y los íconos se ven igual (precache) | FR-020, SC-007 |
| 12 | Todos | Título de la pestaña, login, encabezado y sidebar | Dicen "Dentdelion"; el ícono de la app instalada es el diente nuevo | FR-008 |
| 13 | 375 | Sistema en modo oscuro | La app sigue clara, sin controles nativos oscuros | R12 |
| 14 | 375 | `prefers-reduced-motion: reduce` | Sin transiciones en la sidebar ni en los modales | FR-021 |

## Regresión funcional

Las pruebas existentes de consumo, alta, edición, compras, ajustes y el indicador de sincronización
siguen en verde sin cambios de comportamiento (FR-009). Solo se ajustan los textos de marca
("Dentdelion") y los nombres de íconos.
