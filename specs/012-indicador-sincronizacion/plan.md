# Implementation Plan: Indicador de Sincronización

**Branch**: `012-indicador-sincronizacion` | **Date**: 2026-10-18 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/012-indicador-sincronizacion/spec.md`

## Summary

Reemplaza el indicador binario del encabezado ("Sincronizado"/"Sin conexión", que solo mira
`isBackendConnected`) por un **`SyncIndicator`** basado en los pendientes reales y en el resultado
del último ciclo. Tiene cuatro estados (Error > Sin conexión > N pendientes > Sincronizado) y una
alerta superpuesta por antigüedad. Al tocarlo se abre un **`SyncSheet`** (el `BottomSheet`
existente) con la última sincronización exitosa, el desglose por tipo, los pendientes de otras
personas del dispositivo y el botón "Sincronizar ahora".

Para que el indicador diga la verdad, el ciclo de sync tiene que **informar su resultado**: hoy
`runSyncBatch()` devuelve `void` y cinco etapas descartan su `{ error }` (research.md R1–R3). Al
revisar el ciclo aparecieron dos bugs que esta spec corrige porque afectan directamente lo que el
indicador promete:

- **R4**: en un dispositivo compartido, los cambios de insumo y las categorías de otra persona se
  suben con la sesión actual. El servidor los rechaza por RLS y quedan marcados como rechazados,
  así que **se revierten**.
- **R5**: la configuración global se sube en cada ciclo sin importar el rol. Con rol `personal`
  falla siempre, y entre dos administradores el de la fila vieja pisa el cambio del otro.

El umbral de aviso (FR-011) es una columna nueva en `configuracion_alertas` (R6). Los nombres de
otros usuarios salen de una tabla local nueva, `usuariosConocidos` (R7).

## Technical Context

**Language/Version**: TypeScript ~6.0 (React 19), Node.js ^22.22 o ≥24.15. Scaffold sin cambios.

**Primary Dependencies**: ninguna nueva. React, Tailwind CSS v4, Zustand 5, Dexie 4 (`liveQuery`),
supabase-js 2, Sentry. Componentes existentes: `BottomSheet`, `TouchButton`, `Card`, `IconField`.
Íconos nuevos en `src/components/icons` con el mismo estilo de trazo que los actuales.

**Storage**:
- Dexie `version(9)`: tablas locales nuevas `usuariosConocidos` y `estadoSync`;
  `configuracionAlertas` gana `horasAvisoPendientes?` y `sincronizado`, y `configuracionClinica`
  gana `sincronizado` (upgrade a `true`).
- Supabase: columna `configuracion_alertas.horas_aviso_pendientes` (1–168, default 24), sin
  políticas nuevas.
- Detalle en [data-model.md](./data-model.md) y
  [contracts/supabase-schema.md](./contracts/supabase-schema.md).

**Testing**: Vitest + React Testing Library con el `memoryDb` mockeado (patrón de
`tests/unit/sync-movimientos-fallo.test.ts`).
- Unitarias nuevas:
  - `sync-resultado-ciclo.test.ts`: clasificación, sesión y guardián;
  - `sync-autoria.test.ts`: filtro por autor en cambios y categorías;
  - `sync-configuracion-bandera.test.ts`: rol, bandera y omisión de la columna;
  - `indicador.test.ts`: `calcularIndicador()` puro.
- Integración nueva: `tests/integration/indicador-sincronizacion.test.tsx`, un escenario por
  estado más el panel.
- `test:rls` con los casos de la columna nueva.
- Migración Dexie v9 verificada en Chromium real (skill `run-indentory`), como la v8.
- Se ajustan las pruebas existentes de sync que asumen `Promise<void>` y la subida incondicional de
  configuración (`sync-configuracion-clinica.test.ts`, `sync-full-repush.test.ts`).

**Target Platform**: PWA instalable en navegadores táctiles (Principio III).

**Project Type**: frontend PWA más el esquema Supabase (sin backend propio).

**Performance Goals**:
- El indicador se actualiza en menos de 1 s tras un registro (SC-001, `liveQuery`).
- El contador llega a 0 en menos de 30 s al volver la red, gracias al ciclo inmediato del evento
  `online`; la spec pide menos de 1 min (SC-002).
- "Sincronizar ahora" termina en menos de 10 s.

**Constraints**:
- Todo el indicador funciona sin conexión (FR-013).
- `runSyncBatch` nunca lanza.
- Nunca puede haber dos ciclos simultáneos.
- No se renombra `inDENToryDB`.

**Scale/Scope**: un dispositivo con unos cientos de filas pendientes como máximo y 2 a 5 usuarios
por dispositivo compartido. 3 componentes nuevos (indicador, panel e íconos), 2 stores nuevos,
1 migración SQL y cambios acotados a `src/lib/sync`, `src/lib/db`, `authStore` y
`ConfiguracionAlertasSection`.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Cumplimiento | Estado |
|---|---|---|
| I. Offline-First | Pendientes, antigüedad, nombres y última sincronización se calculan desde IndexedDB. "Sincronizar ahora" sin red no bloquea. El ciclo sigue sin lanzar. R3–R5 **reducen** las pérdidas silenciosas de datos (cambios revertidos por error) | ✅ |
| II. Zustand | El estado nuevo vive en `syncStore` y `pendientesStore` (Zustand + `liveQuery`). Sin Context ni otras librerías | ✅ |
| III. Táctil 48 px | El indicador y el botón usan `touch-target`/`TouchButton`. El panel es el `BottomSheet` existente | ✅ |
| IV. Alertas visuales | La alerta de antigüedad lleva ícono y color, no solo texto (FR-010) | ✅ |
| V. Búsqueda manual / cámara | No se tocan formularios de registro ni consumo, y la cámara no se ve afectada | ✅ N/A |
| VI. Multi-usuario | La autoría se preserva: cada quien sube solo lo suyo (R4 extiende a cambios y categorías la regla que ya tenían los movimientos), y los pendientes ajenos se nombran con su autor | ✅ |
| Pila obligatoria | Sin dependencias nuevas | ✅ |

Gate de flujo de trabajo: la capa de datos cambia (Dexie v9 y ciclo de sync). La escritura
primaria sigue en IndexedDB y la sync sigue siendo no bloqueante y tolerante a fallos de red.

**Re-check post-diseño**: sin violaciones. No hace falta Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/012-indicador-sincronizacion/
├── plan.md
├── research.md            # R1–R12
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── supabase-schema.md # migración, ciclo, guardián, casos test:rls
│   └── ui-contracts.md    # SyncIndicator, SyncSheet, campo de umbral
├── checklists/requirements.md
└── tasks.md               # /speckit-tasks
```

### Source Code (repository root)

```text
supabase/migrations/
└── 20261019000000_horas_aviso_pendientes.sql       # nuevo

src/lib/db/index.ts                                  # tipos + version(9)
src/lib/sync/
├── index.ts          # ResultadoCiclo, CicloSync, sesión previa, filtro por autor,
│                     # bandera de configuración, guardián, sincronizarAhora, online/offline
├── reportar.ts       # exporta esFallaDeRed
└── indicador.ts      # nuevo: calcularIndicador() puro + agrupación de pendientes
src/stores/
├── syncStore.ts      # nuevo: fase, ultimoResultado, ultimaExitosaEn
├── pendientesStore.ts# nuevo: liveQuery de pendientes por autor + usuariosConocidos + tick 60 s
├── authStore.ts      # login → put en usuariosConocidos
└── alertasStore.ts   # expone horasAvisoPendientes
src/features/alertas/lib/configuracion.ts            # actualizarHorasAvisoPendientes + sincronizado:false
src/features/ajustes/components/ConfiguracionAlertasSection.tsx  # campo de umbral
src/app/
├── AppHeader.tsx     # usa SyncIndicator en lugar del indicador binario
├── SyncIndicator.tsx # nuevo
└── SyncSheet.tsx     # nuevo
src/app/App.tsx                                      # suscribe pendientesStore/syncStore
src/components/icons/index.tsx                       # íconos de estado

tests/unit/{sync-resultado-ciclo,sync-autoria,sync-configuracion-bandera,indicador}.test.ts
tests/integration/indicador-sincronizacion.test.tsx
scripts/test-rls.mjs                                 # casos nuevos
```

**Structure Decision**: es un solo proyecto PWA y se mantiene la organización actual.

- La lógica pura del indicador va en `src/lib/sync/indicador.ts`, junto al ciclo que la alimenta,
  para poder probarla sin React.
- Los stores siguen el patrón de `alertasStore`/`clinicaStore`.
- El indicador y el panel van en `src/app/`, porque son parte del armazón (como `AppHeader` y
  `AvisosConsumo`) y no de una feature de dominio.

## Riesgos y notas

- **`pushItemsCompra` con ítems ajenos sin subir** (research.md R4): el indicador de quien tiene
  la sesión mostrará "Error" hasta que el autor inicie sesión. Queda fuera de alcance y se anota en
  el backlog.
- **Orden de despliegue**: la migración va antes que el front (contracts/supabase-schema.md).
- **Más eventos en Sentry**: las etapas que antes descartaban su error ahora se reportan (R1).
  Pueden aparecer eventos nuevos, y conviene revisarlos tras publicar.
- **Spec 013**: rediseñará el encabezado. `SyncIndicator` se diseña como componente autónomo para
  moverlo al sidebar o header nuevo sin cambiar su lógica.

## Complexity Tracking

Sin violaciones de la constitución.
