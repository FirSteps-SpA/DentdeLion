# Implementation Plan: Mejoras de UX en Nuevo insumo, perfil y tabla de inventario

**Branch**: `032-mejoras-ux-insumos-perfil` | **Date**: 2026-11-24 | **Spec**: [spec.md](./spec.md)

## Summary

Tres mejoras de interfaz sin datos nuevos.

1. **Nuevo/Editar insumo**: rótulos en lenguaje simple en `PresentacionFields`, un ejemplo plegable en
   el alta, y un componente `CantidadDobleField` (compra | consumo, conversión en vivo, se guarda en
   unidad de consumo) para el stock inicial y los mínimos. El código de barras se oculta detrás de una
   constante junto al escáner.
2. **Perfil**: el avatar de `AppHeader`/`TopBar` pasa a ser un `MenuPerfil` (Ver perfil, Cerrar
   sesión). `PerfilSection` permite editar el nombre propio mediante la RPC `actualizar_mi_nombre`
   (online, como Equipo). El sync refresca el nombre en los otros dispositivos.
3. **Tabla**: `InventarioTabla` con `th` fijo bajo la `TopBar` (contenedor `overflow-x-clip`).

## Technical Context

**Language/Version**: TypeScript (React 19), SQL (Postgres 17).

**Primary Dependencies**: las existentes (Zustand, Dexie, Tailwind, supabase-js). Sin dependencias
nuevas.

**Storage**: migración `20261127000000_nombre_propio.sql` (solo la función). Sin cambios en Dexie.

**Testing**: Vitest. Se actualizan `alta-material`, `presentacion`, `inventario-tabla` y `ajustes`
(rótulos nuevos, sin código de barras). Tests nuevos: `CantidadDobleField` (unit: conversión, "≈",
contenido cambiado, vacío), `menu-perfil` (abrir/cerrar/teclado, Ver perfil abre la sección incluso
con Ajustes montado, Cerrar sesión) y `perfil-nombre` (guardar, vacío, sin conexión, iniciales).
`test:rls`: los controles de contracts/api.md.

**Target Platform**: PWA (móvil 390 px, tablet, desktop ≥ 1200 px).

**Project Type**: web app (SPA offline-first + Supabase).

**Constraints**: área táctil ≥ 48 px; el formulario de alta sigue funcionando offline; editar el nombre
requiere conexión.

**Scale/Scope**: ~10 archivos de UI, 1 migración, ~6 archivos de test.

## Constitution Check

| Principio | Cumplimiento | Estado |
|---|---|---|
| I. Offline-First | Alta, edición, menú y tabla siguen locales. Editar el nombre requiere conexión, como el nombre de la clínica y Equipo (research R5) | ✅ (excepción acotada, no clínica) |
| II. Zustand | `authStore.actualizarNombre`; el estado del campo doble es local del formulario | ✅ |
| III. Táctil 48 px | Avatar-botón, ítems del menú, `summary` del ejemplo e inputs dobles ≥ 48 px | ✅ |
| IV. Trazabilidad | Sin cambios en movimientos. El historial resuelve el autor por id | ✅ |
| V. Búsqueda manual | El escáner sigue oculto. La cámara no se activa en el alta | ✅ |
| VI. Multi-usuario | La RPC solo cambia el nombre de `auth.uid()`; rol y estado siguen siendo de administración | ✅ |

Re-evaluado tras el diseño (Phase 1): sin cambios.

## Project Structure

### Documentation (this feature)

```text
specs/032-mejoras-ux-insumos-perfil/
├── spec.md
├── plan.md
├── research.md          # R1–R7
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── api.md           # actualizar_mi_nombre + controles test:rls
│   └── ui-contracts.md  # §1–§6
└── checklists/requirements.md
```

### Source Code

```text
supabase/migrations/20261127000000_nombre_propio.sql      # actualizar_mi_nombre
scripts/test-rls.mjs                                       # controles nuevos
src/lib/scanner/                                           # MOSTRAR_CODIGO_BARRAS = false
src/stores/authStore.ts                                    # actualizarNombre
src/lib/sync/index.ts                                      # revisarPerfil refresca el nombre
src/lib/supabase/perfiles.ts                               # guardarNombrePropio (rpc)
src/app/useVista.ts                                        # irASeccionAjustes
src/app/App.tsx, src/app/AppShell.tsx                      # pasar irASeccionAjustes al encabezado
src/app/MenuPerfil.tsx                                     # nuevo
src/app/AppHeader.tsx, src/app/TopBar.tsx                  # avatar → MenuPerfil; comentario spec 011
src/features/ajustes/components/PerfilSection.tsx          # Editar nombre
src/components/ui/CantidadDobleField.tsx                   # nuevo
src/features/insumos/lib/cantidadDoble.ts                  # conversión pura (testeable)
src/features/insumos/components/PresentacionFields.tsx     # rótulos y ayudas
src/features/insumos/components/AltaMaterialView.tsx       # ejemplo, campos dobles, sin código
src/features/insumos/components/EditarInsumoForm.tsx       # mínimos dobles, sin código
src/features/insumos/components/InventarioTabla.tsx        # th sticky
src/features/ayuda/contenido.ts                            # rótulos y atajo de perfil
tests/unit/CantidadDobleField.test.tsx
tests/integration/{menu-perfil,perfil-nombre}.test.tsx
tests/integration/{alta-material,presentacion,inventario-tabla,ajustes}.test.tsx  # actualizados
```

**Structure Decision**: proyecto único existente. El componente genérico va a `components/ui` y la
conversión a `features/insumos/lib`.

## Orden sugerido

US3 (tabla, aislada) → US1 (campo doble + rótulos, el más grande) → US2 (migración + menú + nombre).
Cada historia se puede entregar por separado.

## Despliegue

`db push` de la migración (solo agrega una función; no hace falta respaldo especial) → front. Un
front viejo no llama la función, así que el orden no importa.

## Complexity Tracking

Sin desviaciones que justificar.
