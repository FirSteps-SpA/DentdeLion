# Data Model: Design System v1.0 y Navegación Desktop

**Feature**: 013-design-system-v1-y-navegacion-desktop | **Date**: 2026-10-18

Esta spec **no agrega persistencia de dominio**: no hay cambios en Dexie ni en Supabase. Agrega una
preferencia de interfaz local, un tipo de vista y dos *view-models* calculados en memoria.

## Preferencia local: `layoutStore` (Zustand + `localStorage`)

| Campo | Tipo | Regla |
|---|---|---|
| `sidebarExpandida` | `boolean` | Solo aplica en tablet (768–1199 px). Por defecto `false` (contraída). Se persiste en `localStorage['dentdelion.sidebar']` como `'1'`/`'0'`. Si leer o escribir falla, se usa el valor por defecto sin error (research.md R6) |
| `alternarSidebar()` | acción | Invierte el valor y lo persiste |

## `Vista` (`src/app/BottomNav.tsx` → `src/app/navegacion.ts`)

```text
type Vista = 'inicio' | 'inventario' | 'compras' | 'alertas' | 'mas'
```

| Vista | Etiqueta en la barra inferior | Etiqueta en la sidebar | Ícono (DS §7) |
|---|---|---|---|
| `inicio` | Inicio | Inicio | `House` |
| `inventario` | Inventario | Inventario | `Boxes` |
| `compras` | Compras | Compras | `ShoppingCart` |
| `alertas` | Alertas (+ burbuja) | Alertas (+ burbuja) | `Bell` |
| `mas` | Más | Ajustes | `Settings` |

La vista inicial es `inicio`. La lista vive en una sola constante compartida por `BottomNav` y
`Sidebar`.

## `Disposicion` (hook `useDisposicion`)

| Valor | Ancho del viewport |
|---|---|
| `'movil'` | < 768 px, o sin `matchMedia` |
| `'tablet'` | 768–1199 px |
| `'desktop'` | ≥ 1200 px |

## View-model `ResumenInicio` (`src/features/inicio/lib/resumenInicio.ts`, función pura)

Entradas: `insumos` (activos), `lotes`, `movimientos`, `itemsCompra`, `nivelesAvisoDias`,
`preferencias` y `hoy`.

| Campo | Cálculo (research.md R9) |
|---|---|
| `bajoMinimo` | `computeInsumosStockBajo(...).length` |
| `porVencer` | `computeAlertasCaducidad(..., nivelesAvisoDias).length` (lotes) |
| `paraComprar` | `computeItemsSugeridos(...).length` + `itemsCompra` con `estado === 'pendiente'` |
| `alertas` | `contarAlertasPendientes(..., preferencias)` |
| `listaAlertas` | Hasta 5 `{ insumo, tipo: 'caducado' \| 'caducidad' \| 'stock-bajo', detalle, diasRestantes? }`. Primero las caducadas, después la caducidad por `diasRestantes` ascendente y al final el stock bajo por nombre |
| `proximosVencimientos` | Hasta 5 `{ insumo, lote, diasRestantes }` de lotes con `fechaCaducidad` y stock > 0, por fecha ascendente |

## `estadoVisual` (`src/features/insumos/lib/estado.ts`, función pura)

Etiqueta, ícono y tono que se muestran para un `EstadoInsumo` (FR-007, aclaración 4). No cambia
`computeEstadoInsumo` ni sus reglas: solo agrega el caso "crítico".

| `estado` (spec 006) | `stockTotal` | Estado visual | Ícono | Tono |
|---|---|---|---|---|
| `caducado` | cualquiera | Caducado | `CircleAlert` | danger |
| `proximo-a-caducar` | cualquiera | Próximo a caducar | `Clock` | warning-30 |
| `bajo-stock` u `ok` | `0` | **Stock crítico** | `CircleAlert` | danger |
| `bajo-stock` | > 0 | Bajo Stock (etiqueta actual) | `TriangleAlert` | warning-30 |
| `ok` | > 0 | Ok (etiqueta actual) | `CircleCheck` | success |

## Tokens de diseño (`src/styles/index.css`, `@theme`)

Valores del DS con los ajustes AA de research.md R2. El contrato completo, con los pares que verifica
la prueba de contraste, está en [contracts/design-tokens.md](./contracts/design-tokens.md).

| Token (nombre actual) | Antes (spec 005) | Ahora (DS) |
|---|---|---|
| `--color-bg` | `#F5F8FA` | `#F8FCFC` |
| `--color-bg-secondary` | — | `#EFFAF8` |
| `--color-surface` | `#FFFFFF` | `#FFFFFF` |
| `--color-border` | `#E2E8F0` | `#E7F0F1` (tarjetas) |
| `--color-border-input` | — | `#DCEBEC` |
| `--color-text` | `#0F172A` | `#17363D` |
| `--color-text-muted` | `#64748B` | `#5A7177` (AA; DS `#668087`) |
| `--color-text-faint` | `#94A3B8` | `#8CA0A5` (solo deshabilitado) |
| `--color-primary` | `#0E5C73` | `#067F7A` (fondo con texto blanco; AA) |
| `--color-primary-dark` | `#0A4757` | `#056C68` (hover) |
| `--color-primary-active` | — | `#04605C` |
| `--color-primary-soft` | `#E6F4F3` | `#D8F3EF` (menta) |
| `--color-primary-text` | — | `#06706C` (texto sobre menta) |
| `--color-secondary-bg` | — | `#E7F7F5` (botón secundario) |
| `--color-brand` | — | `#12B8AE` (logo, foco, rellenos, sin texto encima) |
| `--color-brand-icon` | — | `#07958F` (íconos activos) |
| `--color-teal-dark` | — | `#0D5360` (logotipo, títulos de marca) |
| `--color-success-*` | verdes spec 005 | `#35B779` / `#E8F8F0` / texto `#1F7E54` / ícono `#2B9A65` |
| `--color-warning-30-*` | ámbar spec 005 | `#FFF6E3` / texto `#986712` / ícono `#A87A22` |
| `--color-danger*` | rojos spec 005 | `#E96767` / `#FDEEEE` / texto `#B84040` |
| `--color-urgent-7-*`, `--color-urgent-1-*` | naranja / rojo spec 005 | Se mantienen los niveles de caducidad (spec 004) y se ajustan a la familia warning/error del DS: 7 días `#FDE7C2`/`#8A5410` (5,18:1), 1 día `#FBE3E0`/`#A23838` (5,43:1). Distintos de 30 días (`#FFF6E3`) y de caducado (`#FDEEEE`) |
| `--color-info*` | — | `#EDF7FD` / ícono `#3F8BC2` |
| `--radius-*` | — | `sm 8`, `md 10`, `lg 16`, `xl 20`, `pill 999` |
| `--shadow-card`, `--shadow-modal`, `--shadow-dropdown` | — | DS §11 |
| `--breakpoint-desk` | — | `75rem` (1200 px) |
| `--font-sans` | Manrope | Manrope (+ peso 600) |

Los niveles de caducidad (30, 7 y 1 días, y caducado) deben seguir siendo **cuatro tonos
distinguibles** (FR-007, Constitución IV): fondos con valores distintos y, dentro de cada familia
(ámbar: 30 y 7 días; rojo: 1 día y caducado), una diferencia de luminancia relativa de al menos 0,05.
Cada badge lleva además su etiqueta ("30 días", "7 días", "1 día", "Caducado") y su ícono. La prueba
de contraste verifica todo esto y que el texto de cada nivel cumpla 4,5:1 sobre su fondo.
