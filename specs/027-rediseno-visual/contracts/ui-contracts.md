# UI Contracts: Rediseño visual de la app

**Spec**: [spec.md](./spec.md) · **Fecha**: 2026-11-23

## 1. Tokens (`src/styles/index.css`, `@theme`)

| Token | Valor | Uso | Par verificado (AA) |
|---|---|---|---|
| `--color-tinte-primario` | #D8F3EF | cuadrado de ícono neutro | `brand-icon` ≥ 3:1 |
| `--color-tinte-peligro` | #FDEEEE | cuadrado de ícono de peligro | `danger` ≥ 3:1 |
| `--color-tinte-aviso` | #FFF1DC | cuadrado de ícono de aviso | `warning-icon` ≥ 3:1 |
| `--color-tinte-info` | #EDF7FD | cuadrado de ícono informativo | `info-icon` ≥ 3:1 |
| `--color-destacada-desde` / `-hasta` | #E7F7F5 / #BFEBE6 | degradado "Valor de inventario" | `text` y `text-muted` ≥ 4,5:1 sobre el tono más oscuro |
| `--color-onda-1` / `-2` | #DDF3F0 / #C4ECE7 | ondas decorativas | — (sin texto) |
| `--shadow-tarjeta` | `0 8px 24px rgb(13 83 96 / 0.08)` | tarjetas | — |

Ítem activo de navegación: `bg-primary` + `text-white` (4,86:1, ya verificado).

## 2. Componentes nuevos

```ts
// src/components/decoracion/
DienteLinea({ size, destellos?: boolean, className? })   // aria-hidden, print:hidden
OndasFondo({ className? })                                // absolute inset-0, pointer-events-none
OndaSidebar({ className? })
MiniBarras({ className? })
IconoFondo({ Icono, className? })                         // ícono grande desvaído

// src/components/ui/
EncabezadoVista({ titulo: ReactNode, subtitulo?: ReactNode, accion?: ReactNode,
                  Icono?: ComponentType<IconProps>, ilustracion?: 'diente' })
EncabezadoSeccion({ Icono, titulo: ReactNode, id?: string, nivel?: 2 | 3,
                    tono?: 'primario' | 'peligro' | 'aviso' | 'info', accion?: ReactNode })
EstadoVacio({ Icono, texto: ReactNode, accion?: ReactNode })
```

## 3. Componentes que cambian (API compatible)

- `KpiCard`: + `variante?: 'normal' | 'destacada'`; el `tono` también colorea el cuadrado del ícono;
  `IconoFondo` siempre; "Ver detalle →" solo con `onClick`.
- `Badge`: mismas variantes, pastilla más alta.
- `TarjetaGrafico`: + `Icono` (encabezado con `EncabezadoSeccion`); vacío con `EstadoVacio`.
- `RenglonAlerta`: sin cambios de API; `variante="linea"` nueva para la línea de tiempo.
- `Sidebar`, `TopBar`, `AppHeader`, `BottomNav`, `SyncIndicator`, `SelectorLugar`: sin cambios de API.

## 4. Por vista

| Vista | Encabezado (`EncabezadoVista`) | Tarjetas/secciones | Vacíos |
|---|---|---|---|
| Inicio | "¡Hola, <nombre>!" + fecha, `ilustracion="diente"` | KPI (Valor destacada + 4), Alertas y Próximos vencimientos (línea de tiempo) con `EncabezadoSeccion`; sin "¿Qué necesitas comprar?" | "Todo en orden", "Sin vencimientos próximos" |
| Inventario | "Inventario" (`Boxes`), acción "+ Material" | Resumen de alertas con tintes; tarjetas/tabla igual | sin resultados |
| Tratamientos | "Tratamientos" (`Stethoscope`), acción "+ Tratamiento" | tarjetas igual; historial con `EncabezadoSeccion` en totales | sin tratamientos / sin registros |
| Compras | "Compras" (`ShoppingCart`) | grupos con `EncabezadoSeccion` | lista vacía |
| Reportes | "Reportes" (`ChartColumn`) + lugar | KPI estilo nuevo; `TarjetaGrafico` con ícono | "Sin datos en este período" |
| Alertas | "Alertas" (`Bell`) | Stock bajo / Próximos a caducar / Lotes en revisión con `EncabezadoSeccion` | "Todo en orden" |
| Ajustes | "Ajustes" (`Settings`); cada sección con su ícono | tarjetas del índice con tinte | catálogos vacíos |
| Acceso | — | tarjeta igual, `DienteLinea` y `OndasFondo` | — |

## 5. Pruebas

- `tests/unit/contraste.test.ts`: pares nuevos (§1).
- Unit/RTL nuevos: `EncabezadoVista`, `EncabezadoSeccion`, `EstadoVacio` (decorados con
  `aria-hidden`, h1/h2 correctos, acción), `KpiCard` (pastilla solo con `onClick`; destacada),
  `Sidebar` (activo con clases de pastilla llena; ilustración solo expandida), `SyncIndicator` (fondo
  por estado).
- Ajustes de pruebas existentes: solo donde un texto nuevo de encabezado choque con una consulta por
  texto (preferir `getByRole`), y la de Inicio que verifica la tarjeta de compras (FR-010).
- Recorrido con `run-indentory` (capturas por vista, 375 y 1440 px; desborde horizontal).
