# Contract: Tokens de diseño y contraste

**Feature**: 013-design-system-v1-y-navegacion-desktop

Fuente única: el `@theme` de `src/styles/index.css`. Los componentes solo usan estos tokens (nada de
hex sueltos en las clases). Valores en [data-model.md](../data-model.md).

## Pares verificados (prueba `tests/unit/contraste.test.ts`)

La prueba lee el `@theme`, resuelve cada token y exige el mínimo indicado (WCAG 2.1: texto normal
4,5:1; texto grande ≥ 18,66 px bold y componentes o íconos informativos 3:1).

| Uso | Texto o ícono | Fondo | Mínimo |
|---|---|---|---|
| Texto principal | `text` | `surface`, `bg`, `bg-secondary` | 4,5 |
| Texto secundario, placeholder, nav inactiva | `text-muted` | `surface`, `bg`, `bg-secondary` | 4,5 |
| Botón primario, chip activo, burbuja | blanco | `primary`, `primary-dark`, `primary-active` | 4,5 |
| Botón secundario, sidebar activo | `primary-text` | `primary-soft`, `bg-secondary` | 4,5 |
| Botón outline | `teal-dark` | `surface`, `bg` | 4,5 |
| Badge stock OK | `success-text` | `success-bg` | 4,5 |
| Badge stock bajo / caducidad 30 d | `warning-30-text` | `warning-30-bg` | 4,5 |
| Caducidad 7 d | `urgent-7-text` | `urgent-7-bg` | 4,5 |
| Caducidad 1 d | `urgent-1-text` | `urgent-1-bg` | 4,5 |
| Stock crítico, caducado, errores | `danger` | `danger-bg`, `surface` | 4,5 |
| Aviso (toast) | blanco | `text` (`#17363D`) | 4,5 |
| Ícono activo de navegación | `brand-icon` | `surface`, `primary-soft` | 3 |
| Íconos de estado | `success-icon`, `warning-icon`, `danger`, `info-icon` | `surface` | 3 |
| Logotipo | `teal-dark` | `surface`, `bg` | 4,5 |

Exentos (WCAG 1.4.3 y 1.4.11): `text-faint` en controles deshabilitados, `brand` (`#12B8AE`) en el
ícono del logo, el anillo de foco (acompaña al borde de 2 px) y los rellenos decorativos.

## Escala tipográfica (utilidades)

| Utilidad | Tamaño / interlineado / peso / tracking (DS §5) |
|---|---|
| `text-display` | 32 / 40 / 800 / −0,6 px |
| `text-h1` | 28 / 36 / 800 / −0,4 px |
| `text-h2` | 22 / 30 / 700 / −0,2 px |
| `text-h3` | 17 / 24 / 700 |
| `text-body-lg` | 16 / 24 / 400 |
| `text-body` | 14 / 20 / 400 |
| `text-body-sm` | 13 / 18 / 400 |
| `text-caption` | 12 / 16 / 500 |
| `text-num` | 26 / 32 / 800 / −0,5 px (KPIs) |

## Componentes base (`src/components/ui`)

| Componente | Contrato (DS) | Ajuste |
|---|---|---|
| `TouchButton` `primary` | `primary`, hover `primary-dark`, active `primary-active`; deshabilitado `#B7DCD9` con texto blanco; radio 10, padding 0 18 px, 14/700 | Altura 48 px (Constitución III) |
| `TouchButton` `secondary` | Fondo `#E7F7F5`, texto `primary-text`, hover `primary-soft` | Altura 48 px |
| `TouchButton` `ghost` → outline | Fondo `surface`, texto `teal-dark`, borde `border-input`, hover `bg` y borde `brand`, 14/600 | Altura 48 px |
| `IconField` e inputs | Borde `border-input`, radio 10, padding 0 14 px, 14 px `text`; foco: borde 2 px `brand` y anillo `0 0 0 3px rgba(18,184,174,.10)` | Altura 48 px; placeholder en `text-muted` |
| `Card` | `surface`, borde `border`, radio 16, `shadow-card` | — |
| `Card` KPI | Mínimo 132 px de alto, padding 20; título 13/600 `text-muted`; valor `text-num` | — |
| `Badge` (chips) | Radio pill, ícono del DS §21 y texto de estado | Colores AA |
| `BottomSheet` | Móvil: igual que hoy, desde abajo, radio superior 20. Desde `md`: centrado, máximo 560 px, padding 24, radio 20, `shadow-modal`, título 20/700 | — |
| `Switch`, `Stepper` | Colores `primary`; las áreas táctiles no cambian | — |
| `AvisosConsumo` (toast) | Fondo `text`, texto blanco, ícono `#35B779`, radio 10 | Contenido y duración sin cambios |
