# Contract: Armazón, navegación, Inicio e inventario en tabla

**Feature**: 013-design-system-v1-y-navegacion-desktop

## `AppShell` (`src/app/AppShell.tsx`)

Props: `vista`, `onCambiarVista`, `alertasBadge`, `children` (la vista activa).

| Disposición | Estructura |
|---|---|
| `movil` | `AppHeader`, el contenido en una columna (16 px de margen, ancho máximo 480 px) y la `BottomNav` fija |
| `tablet` | `Sidebar` (72 px contraída o 240 px expandida), a la derecha `TopBar` y el contenido (24 px de margen) |
| `desktop` | `Sidebar` de 240 px fija, a la derecha `TopBar` y el contenido (32 px de margen, 24 px entre bloques, ancho máximo 1440 px) |

`children` se monta siempre en la misma posición relativa del árbol: cambiar de disposición no
desmonta la vista (FR-015). La región de contenido es `<main>` y la navegación es
`<nav aria-label="Secciones">`, con una sola por disposición.

## `BottomNav` (móvil, DS §29)

- 5 ítems, de la lista compartida de `data-model.md`. Cada uno mide al menos 48 × 48 px y en 375 px
  quedan unos 70 px por ítem.
- Altura de 80 px incluida el área segura. Íconos de 24 px y etiquetas de 11/600.
- Activo: ícono `brand-icon` y texto `primary-text`, con `aria-current="page"`. Inactivo:
  `text-muted`.
- La burbuja de Alertas no cambia (spec 010): `aria-label="{n} alertas pendientes"`.
- Se mantiene `aria-pressed` además de `aria-current`, para compatibilidad con las pruebas
  existentes.

## `Sidebar` (tablet y desktop, DS §18–19)

- Fondo `surface` y borde derecho `border`. Arriba, el logo: diente de 32 px y "Dentdelion"
  22/800 `teal-dark`; en modo contraído, solo el diente.
- Ítems de 48 px de alto (DS: 42), padding 0 12, radio 10, gap 10 y texto 14/600. Activo con fondo
  `primary-soft`, texto `primary-text`, ícono `brand-icon` y `aria-current="page"`.
- Contraída (tablet): solo íconos, con `aria-label` y `title` en cada ítem. El botón "Expandir
  menú" / "Contraer menú" (`PanelLeftOpen`/`PanelLeftClose`, 48 px) llama a `alternarSidebar()`.
  En desktop no hay botón.
- Burbuja de Alertas: en modo expandido junto a la etiqueta, en modo contraído sobre el ícono.

## `TopBar` (tablet y desktop)

A la izquierda, el chip con el nombre de la clínica ("Gabinete" si no hay uno). A la derecha, el
`SyncIndicator` y su panel (spec 012, sin cambios de comportamiento) y el avatar con iniciales. Mide
64 px de alto, con fondo `surface` o `bg` y borde inferior `border`.

## `AppHeader` (móvil)

La misma información que hoy, con el estilo del DS: el logo nuevo (diente outline `brand` y
"Dentdelion" `teal-dark`), el chip de la clínica, el `SyncIndicator` y el avatar.

## `InicioView` (`src/features/inicio/components/InicioView.tsx`)

Props: `onNavegar(vista: Vista)`.

1. **Encabezado**: "¡Hola, {primer nombre}!" (`text-h1`) y la fecha de hoy ("domingo, 18 de
   octubre", formato `es-CL`, `text-body` `text-muted`).
2. **4 tarjetas KPI** (`Card` KPI), cada una un `<button>` de al menos 48 px:

   | Título | Valor | Ícono | Destino |
   |---|---|---|---|
   | Productos bajo mínimo | `bajoMinimo` | `Package` | `alertas` |
   | Próximos a vencer | `porVencer` | `Clock` | `alertas` |
   | Para comprar | `paraComprar` | `ShoppingCart` | `compras` |
   | Alertas | `alertas` | `Bell` | `alertas` |

   El valor se pinta con color de estado solo si es mayor que 0: bajo mínimo en `danger`, por vencer
   en `warning-30-text`. El `aria-label` es "{título}: {valor}. Ver {sección}".
3. **Lista "Alertas"** (hasta 5): ícono y color por tipo (DS §21), nombre, detalle ("Stock: 2
   (mínimo 5)" o "Lote L1 · vence en 3 días" / "venció hace 2 días") y badge. Enlace "Ver todas" a
   `alertas`. Si está vacía: "Todo en orden" con `CircleCheck`.
4. **Lista "Próximos vencimientos"** (hasta 5): insumo, "Lote {n} · {d} días" y punto de color por
   urgencia. Enlace "Ver todos" a `alertas`. Si está vacía: "Sin vencimientos próximos".
5. **Tarjeta "¿Qué necesitas comprar?"**, solo si `paraComprar > 0`: "Te faltan {n} productos"
   y botón primario "Ver lista de compra", que lleva a `compras`.

Disposición: en móvil y tablet, las KPI en una grilla de 2 × 2 y las listas
apiladas. En desktop, las 4 KPI en una fila y las dos listas lado a lado, con la tarjeta de compra
debajo.

## `InventarioTabla` (desktop, DS §22)

Props: las mismas que la lista de tarjetas: `estados: EstadoInsumo[]`, `disponibilidad`,
`duplicados`, `onOpen`, `onConsumirUno`, `onAbrirMenu`.

| Columna | Contenido |
|---|---|
| Producto | Botón con el nombre (abre el detalle), la unidad debajo y el aviso de posible duplicado si aplica |
| Categoría | Texto |
| Stock | `stockTotal` y la unidad |
| Stock mínimo | Valor o "—" |
| Vencimiento | Fecha del lote más próximo o "—" |
| Estado | Badge del DS §21, igual que la tarjeta |
| Acciones | "Consumir 1" (deshabilitado con el mismo motivo que la tarjeta) y "Más opciones" (`Ellipsis`) |

Filas de 64 px, encabezado 12/700 `text-muted` y hover `bg`. Con 0 resultados se muestra el mismo
estado vacío que en las tarjetas.
