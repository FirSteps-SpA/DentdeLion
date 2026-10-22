# Contratos de interfaz: Reportes y KPIs

**Feature**: 017-reportes-y-kpis | **Date**: 2026-10-22

Textos en español de Chile. Montos con `formatearCLP` y la utilidad `text-num` de "Números financieros" (DS §5).
Todo control interactivo ≥ 48 × 48 px (Constitución III).

## 1. Navegación

- `SECCIONES` agrega `{ vista: 'reportes', etiquetaMovil: 'Reportes', etiquetaLateral: 'Reportes',
  Icon: ChartColumn, soloLateral: true }` entre Compras y Alertas.
- "Más" (`AjustesView`) agrega el acceso **Reportes** debajo de Compras.
- La tarjeta Valor de inventario de Inicio navega a `'reportes'`.

## 2. Pantalla Reportes (`ReportesView`)

```text
Reportes                                    [Este mes ▾]
Clínica Providencia (del selector de lugar)
[ⓘ Puede faltar información hasta terminar la sincronización]   ← solo R10

┌ Producción ─────┐ ┌ Gasto en materiales ┐ ┌ Ganancia estimada ──┐
│ $1.250.000      │ │ $184.300            │ │ $412.600            │
│ ↑ 8 % vs. mes   │ │ ↓ 3 % vs. mes       │ │ ↑ 11 % vs. mes      │
│ anterior compl. │ │ anterior completo   │ │ anterior completo   │
│ 2 sin precio    │ │ desde · 3 sin precio│ │ No es utilidad      │
└─────────────────┘ └─────────────────────┘ │ contable            │
                                            └─────────────────────┘
[Consumo por categoría (donut)]   [Gastos mensuales (líneas)]
[Materiales más utilizados (barras horizontales)]
[Ganancia por lugar (barras)]   ← solo "Todos" con ≥ 2 lugares con datos
```

- **Selector de período** (BottomSheet en móvil, menú en desktop): Este mes, Mes anterior, Últimos
  3 meses, Este año y "Elegir mes…" con los 12 meses de la ventana.
- **Tarjetas**: componente `KpiCard` del DS §20 con prop nueva `variacion` y `nota`. No son botones
  en Reportes (sin `onClick` → `<div>`).
  - Variación: "↑ 8 % vs. mes anterior completo" / "vs. período anterior" / "Nuevo" / "Sin datos del
    período anterior". Verde (`success`) si mejora, rojo (`danger`) si empeora.
  - Incompletos: "desde $X" y "N tratamientos sin precio" / "N materiales sin precio".
  - Ganancia negativa: signo "−" y `text-danger`.
- **Layout**: móvil 1 columna; tablet 2; desktop KPIs en 3 columnas y gráficos en 2 (DS §17,
  §38–39), padding 32 px y gap 24 px en desktop.
- **Estado vacío** (FR-017): ilustración/ícono y "Registra tratamientos y precios de compra para ver
  tus reportes", con accesos a Tratamientos e Inventario. Un gráfico sin datos muestra "Sin datos en
  este período" en su tarjeta, no ejes vacíos.

## 3. Gráficos (`src/features/reportes/components/charts/`)

Comunes:

- Paleta DS §35 en orden: `#12B8AE`, `#0D5360`, `#7ACCC5`, `#B8E7E2`; "Otras" en un gris del DS;
  negativos en `#E96767`. Sin 3D, sin degradados, ≤ 5 colores.
- **Objetivo táctil = leyenda y etiquetas, no la figura** (Constitución III): cada fila de la
  leyenda (donut), cada etiqueta de barra (barras horizontales y verticales) y cada mes (fila de
  meses bajo el eje de las líneas) es un botón de ancho completo y ≥ 48 × 48 px; al tocarlo resalta
  el elemento y muestra su monto exacto. Tocar la figura directamente es un complemento, nunca el
  único medio; el hover solo agrega el mismo detalle en desktop. Cada botón es enfocable por
  teclado.
- `<figure>` con `<figcaption>` (título) y una tabla `sr-only` con los mismos datos; botón "Ver como
  tabla" que la muestra.

| Gráfico | Componente | Datos | Detalles |
|---|---|---|---|
| Consumo por categoría | `DonutChart` | `porCategoria` | Total al centro; leyenda en filas-botón con monto y % |
| Gastos mensuales | `LineChart` | `gastosMensuales` | Eje X meses abreviados ("may") como fila de botones; eje Y en $ compacto ("$120 mil"); puntos marcados |
| Materiales más utilizados | `HorizontalBarChart` | `masUtilizados` | Cada fila (etiqueta "nombre · cantidad + unidad" + barra + monto) es un botón; "Dado de baja" como chip |
| Ganancia por lugar | `BarChart` | `gananciaPorLugar` | Etiqueta de cada lugar como botón; línea de cero; barras negativas hacia abajo en rojo |

## 4. Inicio

- Nueva primera tarjeta **Valor de inventario** (`Wallet` o `Boxes`), `col-span-2` en móvil; grid
  `desk:grid-cols-5`.
- Valor: `formatearCLP(valor)`, o "desde $X" + "N lotes sin precio".
- Variación: "↑ 12 % vs. mes anterior" / "↓ 4 % vs. mes anterior" en `text-muted`, con flecha
  pero sin verde ni rojo: subir o bajar el inventario no es bueno ni malo por sí mismo.
- Sin lotes con precio: "Sin precios" y la nota "Ingresa el precio al recibir compras".
- `aria-label`: "Valor de inventario: $1.284.500, sube 12 % respecto del mes anterior. Ver
  Reportes".
