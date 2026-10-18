# Implementation Plan: Design System v1.0 y Navegación Desktop

**Branch**: `013-design-system-v1-y-navegacion-desktop` | **Date**: 2026-10-18 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/013-design-system-v1-y-navegacion-desktop/spec.md`

## Summary

Adopta el Design System v1.0 de la clienta en toda la app y agrega la disposición para pantallas
grandes:

- **Tokens**: se cambian los valores de los tokens semánticos existentes del `@theme` de Tailwind a
  la paleta del DS, con ajustes AA dentro de cada familia (research.md R1–R2). También se agregan la
  escala tipográfica, los radios, las sombras y el breakpoint de 1200 px.
- **Íconos**: el módulo actual pasa a re-exportar íconos **Lucide** con los mismos nombres, así que
  los 27 archivos que los usan no cambian sus imports (R3). El diente de marca es un SVG outline
  propio.
- **Armazón y navegación**: `App.tsx` delega en un **`AppShell`** que, según `useDisposicion()`
  (móvil, tablet o desktop), muestra la barra inferior del DS o una **sidebar** (contraída en
  tablet, de 240 px en desktop) con una barra superior. La vista activa nunca se desmonta al cambiar
  de ancho (R5, R8).
- **Inicio**: sección nueva, la que se abre al entrar, con 4 KPIs y 2 listas calculadas con las
  mismas funciones que ya usan Alertas y Compras (R9).
- **Inventario**: en desktop se ve como tabla, con las mismas acciones que las tarjetas (R10).
- **Modales**: el `BottomSheet` se centra desde tablet (R7).
- **Nombre**: "Dentdelion", con ícono de app regenerado (R11).

No hay cambios de datos, sincronización ni permisos.

## Technical Context

**Language/Version**: TypeScript ~6.0 (React 19), Node.js ^22.22 o ≥24.15.

**Primary Dependencies**: **nueva:** `lucide-react` ^1.59 (MIT, se empaqueta en el build). Se
mantienen React, Tailwind CSS v4 (`@theme`), Zustand, Dexie y `@fontsource/manrope`, con el peso
600 agregado.

**Storage**: sin cambios de Dexie ni Supabase. Una preferencia de interfaz en `localStorage`
(`dentdelion.sidebar`) a través de `layoutStore` (Zustand).

**Testing**: Vitest + RTL.
- Unitarias nuevas: `contraste.test.ts` (lee `index.css` y verifica los pares del contrato),
  `resumenInicio.test.ts` y `useDisposicion.test.ts`.
- Integración nueva: `navegacion-responsiva.test.tsx` (con `matchMedia` simulado), `inicio.test.tsx`
  e `inventario-tabla.test.tsx`.
- Se ajustan las pruebas de marca ("Dentdelion") y la vista inicial: la app abre en Inicio, así que
  las pruebas que asumían Inventario como vista por defecto se ajustan.
- Visual: capturas en 375, 768, 1024 y 1440 px y medición automática de desplazamiento horizontal y
  de áreas táctiles con el skill `run-indentory`.

**Target Platform**: PWA en teléfono, tablet y escritorio (Chromium, Safari iOS, Firefox).

**Project Type**: frontend PWA (sin cambios en el backend).

**Performance Goals**:
- El bundle no debe crecer más de 40 KB gzip. Lucide se importa ícono por ícono (unos 25 a 0,3 KB) y
  Manrope 600 pesa unos 15 KB.
- Cambiar de disposición no provoca recargas ni pérdida de estado.
- Consumo rápido en menos de 10 s (SC-005).

**Constraints**:
- Todo objetivo interactivo mide al menos 48 px (Constitución III, FR-004).
- Contraste AA (FR-005).
- Tipografía e íconos disponibles offline (FR-020).
- Sin cambios de flujo ni de permisos (FR-009).
- No se renombra `inDENToryDB`.

**Scale/Scope**:
- 5 vistas, unos 40 componentes restilados, 12 modales que pasan a centrados desde tablet y un
  módulo de íconos con unos 30 íconos.
- Componentes nuevos: `AppShell`, `Sidebar`, `TopBar`, `InicioView` e `InventarioTabla`.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Cumplimiento | Estado |
|---|---|---|
| I. Offline-First | No hay cambios de datos ni de sync. Manrope (self-hosted) y Lucide (empaquetado) entran al precache del service worker y nada se carga de CDN (FR-020). Inicio se calcula con datos locales | ✅ |
| II. Zustand | El estado nuevo (`sidebarExpandida`) va en `layoutStore` (Zustand). `useDisposicion` lee el viewport sin estado propio | ✅ |
| III. Táctil 48 px | Botones e inputs miden 48 px en vez de 44 (FR-004); ítems de sidebar de 48 px en vez de 42; tarjetas KPI, filas de la tabla y botones de la barra inferior de al menos 48 px. Lo verifica la medición automática (quickstart #10) | ✅ |
| IV. Alertas visuales | Los estados de stock y los 4 niveles de caducidad siguen siendo distinguibles por color **e** ícono (FR-007), con contraste AA. Inicio muestra las alertas con color e ícono | ✅ |
| V. Búsqueda manual / cámara | La búsqueda de Inventario no cambia; el escáner sigue oculto (spec 011) y el botón flotante del DS queda fuera de alcance | ✅ |
| VI. Multi-usuario | No se tocan autoría ni permisos; la navegación no cambia lo que ve cada rol (FR-009) | ✅ |
| Pila obligatoria | Se agrega `lucide-react`, una librería de íconos que el DS pide explícitamente (§6, §45). No sustituye nada de la pila obligatoria; se justifica en la PR | ✅ (justificada) |

**Re-check post-diseño**: sin violaciones. El renderizado único por disposición (R5) evita duplicar
controles accesibles, y el `BottomSheet` responsivo mantiene un solo overlay.

## Project Structure

### Documentation (this feature)

```text
specs/013-design-system-v1-y-navegacion-desktop/
├── plan.md
├── research.md             # R1–R14
├── data-model.md           # layoutStore, Vista, Disposicion, ResumenInicio, tokens
├── quickstart.md
├── contracts/
│   ├── design-tokens.md    # tokens, pares de contraste verificados, tipografía, componentes base
│   └── ui-contracts.md     # AppShell, BottomNav, Sidebar, TopBar, AppHeader, InicioView, InventarioTabla
├── checklists/requirements.md
└── tasks.md                # /speckit-tasks
```

### Source Code (repository root)

```text
index.html                                  # <title> Dentdelion, favicon SVG
vite.config.ts                              # manifest: name, short_name, theme/background
public/icons/{icon.svg,icon-192.png,icon-512.png}   # diente nuevo
src/styles/index.css                        # @theme DS + Manrope 600 + escala + breakpoint desk + color-scheme light
src/lib/branding.ts                         # APP_NAME = 'Dentdelion'
src/components/icons/index.tsx              # re-exports Lucide + Tooth propio
src/components/ui/{TouchButton,IconField,Card,Badge,BottomSheet,Switch,Stepper}.tsx   # estilos DS
src/app/
├── App.tsx              # vista inicial 'inicio'; delega en AppShell
├── AppShell.tsx         # nuevo
├── Sidebar.tsx          # nuevo
├── TopBar.tsx           # nuevo
├── navegacion.ts        # nuevo: Vista + lista de secciones compartida
├── useDisposicion.ts    # nuevo
├── usePanelSync.ts      # nuevo: estado del panel de sincronización compartido por AppHeader y TopBar
├── AppHeader.tsx        # logo nuevo
├── BottomNav.tsx        # DS §29, 5 ítems
├── AvisosConsumo.tsx    # toast DS §37
└── SyncIndicator.tsx / SyncSheet.tsx   # solo estilo
src/stores/layoutStore.ts                   # nuevo
src/features/insumos/lib/estado.ts          # + estadoVisual (suficiente / bajo / crítico = stock 0)
scripts/generar-iconos.mjs                  # nuevo: rasteriza public/icons/icon.svg a 192/512 px
src/features/inicio/
├── components/InicioView.tsx               # nuevo
└── lib/resumenInicio.ts                    # nuevo
src/features/insumos/components/
├── InventarioTabla.tsx                     # nuevo
├── InventarioView.tsx                      # tabla en desktop
└── InsumoCard.tsx, InsumoFiltros.tsx, ResumenAlertasBanner.tsx, …   # estilos DS
src/features/{alertas,compras,ajustes,auth}/components/*.tsx            # estilos DS

tests/unit/{contraste,resumenInicio,useDisposicion}.test.ts
tests/integration/{navegacion-responsiva,inicio,inventario-tabla}.test.tsx
tests/helpers/matchMedia.ts                 # nuevo: simulador de anchos
```

**Structure Decision**: un solo proyecto PWA y se mantiene la organización actual.

- El armazón y la navegación van en `src/app/`, porque son parte del shell, como `BottomNav` y
  `AppHeader`.
- Inicio es una feature de dominio nueva en `src/features/inicio/`, con la lógica pura separada de la
  vista, igual que en `alertas/lib`.
- La tabla vive junto a las tarjetas de inventario.

## Riesgos y notas

- **Pruebas que asumen Inventario como vista inicial**: con Inicio por defecto, algunas pruebas de
  App o de navegación cambian. Se ajustan de forma explícita en las tareas, sin cambiar lo que
  verifican.
- **Fidelidad frente a AA**: el botón primario y algunos textos se ven más oscuros que en la lámina.
  Lo decidió la aclaración 1; conviene mostrarle a la clienta la comparación en la revisión (SC-001).
- **Ícono de la app instalada**: los dispositivos con la PWA instalada pueden tardar en actualizar el
  ícono (lo cachea el sistema operativo), y no es controlable desde la app.
- **Spec 014**: la `TopBar` y la cabecera de la sidebar dejan un lugar para el selector de lugar de
  trabajo, sin implementarlo.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Dependencia nueva `lucide-react` (fuera de la lista de la pila obligatoria) | El DS (§6, §45) pide Lucide explícitamente y la app necesita unos 30 íconos consistentes (outline, 2 px) | Redibujar a mano cada ícono es lento y propenso a inconsistencias; un CDN rompe el modo offline |
