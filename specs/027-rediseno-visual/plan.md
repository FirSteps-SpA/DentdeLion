# Implementation Plan: Rediseño visual de la app

**Branch**: `027-rediseno-visual` | **Date**: 2026-11-23 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/027-rediseno-visual/spec.md`

## Summary

Aplicar el lenguaje visual de `ref/2026-11-23-redesign` (Inicio en desktop) a toda la app, entrando
por componentes compartidos (R1):

- **Armazón** (P1, R4): barra lateral con activo turquesa lleno e ilustración al pie; barra superior
  y encabezado del teléfono con pastillas para el lugar y la sincronización; barra inferior con
  activo en pastilla; fondo con ondas.
- **Inicio** (P1, R6, R8): saludo con diente y destellos; KPI con ícono en tinte, número del color del
  estado, ícono de fondo y "Ver detalle →"; "Valor de inventario" destacada; secciones con
  encabezado con ícono; vencimientos en línea de tiempo; sin "¿Qué necesitas comprar?".
- **Resto** (P2, R5–R7, R9): `EncabezadoVista`, `EncabezadoSeccion`, `EstadoVacio` y pastillas en
  Inventario, Tratamientos, Compras, Reportes, Alertas, Ajustes y pantallas de acceso.

Solo front: sin migración, sin Dexie, sin sync; mismos textos, acciones y datos (FR-016).

## Technical Context

**Language/Version**: TypeScript ~6.0 (React 19), Node.js ^22.22 o ≥24.15.

**Primary Dependencies**: sin dependencias nuevas (React, Tailwind v4, `lucide-react`).

**Storage**: N/A.

**Testing**: Vitest + RTL para componentes nuevos y contraste; suite existente como red de
regresión (SC-003); recorrido y capturas con `run-indentory` (SC-001, SC-002, SC-005).

**Target Platform**: PWA (teléfono desde 360 px, tablet, desktop).

**Project Type**: PWA con backend Supabase (solo front en esta spec).

**Performance Goals**: SVG en línea y CSS; sin imágenes ni pedidos de red nuevos; el bundle crece
unos pocos KB.

**Constraints**:

- Sin conexión (Constitución I): todo decorado en el bundle.
- AA en todo texto nuevo, 48 px, foco visible (Constitución III, FR-018).
- `prefers-reduced-motion` y `print` (FR-020).
- La vista activa no se desmonta al cambiar de ancho (spec 013 FR-015): `AppShell` conserva el mismo
  `<main>`.

**Scale/Scope**: ~9 componentes nuevos o reescritos en `src/components` y `src/app`; ~20 archivos de
vista retocados para usar los componentes; ~6 pruebas nuevas y ajustes puntuales en pruebas
existentes.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Cumplimiento | Estado |
|---|---|---|
| I. Offline-First | Decorados como SVG/CSS en el bundle; nada depende de la red | ✅ |
| II. Zustand | Sin cambios de estado; las vistas leen los mismos stores | ✅ |
| III. Táctil 48 px | Controles nuevos (pastillas del lugar y la sincronización, ítems) de 48 px; decorados sin toques (`pointer-events: none`) | ✅ |
| IV. Trazabilidad y alertas | Alertas con color, ícono y texto (pastillas con texto, línea de tiempo con fecha) | ✅ |
| V. Búsqueda manual | Sin cambios | ✅ |
| VI. Multi-usuario | Sin cambios | ✅ |
| Pila obligatoria | Sin dependencias nuevas | ✅ |

**Re-check post-diseño**: sin violaciones.

## Project Structure

### Documentation (this feature)

```text
specs/027-rediseno-visual/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/ui-contracts.md
├── checklists/requirements.md
└── tasks.md
```

### Source Code (repository root)

```text
src/
├── styles/index.css                         # tokens nuevos (R2)
├── components/decoracion/                   # nuevo: DienteLinea, OndasFondo, OndaSidebar, MiniBarras, IconoFondo
├── components/ui/
│   ├── EncabezadoVista.tsx                  # nuevo
│   ├── EncabezadoSeccion.tsx                # nuevo
│   ├── EstadoVacio.tsx                      # nuevo
│   ├── Card.tsx (KpiCard)                   # tinte, ícono de fondo, "Ver detalle", destacada
│   └── Badge.tsx                            # pastilla más alta
├── app/{AppShell,Sidebar,TopBar,AppHeader,BottomNav,SyncIndicator,SelectorLugar,App}.tsx
└── features/
    ├── inicio/components/InicioView.tsx
    ├── insumos/components/{InventarioView,ResumenAlertasBanner,…}.tsx
    ├── tratamientos/components/{TratamientosView,HistorialTratamientos}.tsx
    ├── compras/components/ComprasView.tsx
    ├── reportes/components/{ReportesView,charts/TarjetaGrafico,EstadoVacioReportes}.tsx
    ├── alertas/components/{AlertasView,RenglonAlerta}.tsx
    ├── ajustes/components/{AjustesIndice,SeccionAjustesPantalla,TarjetaSeccion,…}.tsx
    └── auth/{LoginForm,AceptarInvitacion,AccesoDesactivado}.tsx
tests/unit/{contraste,decoracion,encabezados,kpiCard,sidebar,syncIndicator}.test.ts(x)
```

**Structure Decision**: PWA única existente; componentes compartidos en `src/components` y `src/app`,
adoptados por cada `features/*`.

## Despliegue

Solo front, sin `db push`. Puede ir en el mismo release que 025 y 026 (la 026 exige su migración
antes). Avisar al equipo del cambio de apariencia; nada cambia de lugar.
