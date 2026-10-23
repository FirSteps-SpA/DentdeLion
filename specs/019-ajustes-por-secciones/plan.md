# Implementation Plan: Ajustes por secciones

**Branch**: `019-ajustes-por-secciones` | **Date**: 2026-10-22 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/019-ajustes-por-secciones/spec.md`

## Summary

Ajustes deja de ser una página larga y pasa a un índice de tarjetas que abre cada sección por separado,
sin cambios de esquema:

- **Índice y secciones** (P1): un registro `SECCIONES_AJUSTES` define las cinco secciones, su ícono,
  título por rol y si son solo de administración (R2). `AjustesView` muestra el índice (tarjetas con un
  resumen calculado de los stores locales, R3) o una subpantalla con "Volver" que reusa los componentes
  de sección actuales sin cambiar su comportamiento.
- **Sección en la URL** (P1): la app no tiene rutas; la sección abierta va en el hash
  (`#ajustes/<id>`) con `pushState`, así se conserva al recargar y el "atrás" vuelve al índice. Cambiar
  de vista desde la navegación limpia el hash (R1).
- **Permisos** (P1): `seccionesVisibles(rol)` decide qué tarjetas hay; una sección de la URL no visible
  para el rol (o tras un cambio de rol) se cierra y muestra el índice (R7).
- **Stock mínimo por insumo** (P2): `MinimosPorInsumoSection` con buscador, 25 filas + "Ver más" y la
  misma regla de escritura que la edición del insumo: con varios lugares edita el mínimo del lugar
  activo (insignia "Propio"/"General"), en "Todos" es solo lectura, con un solo lugar edita el del
  catálogo (R4).
- **Descarga completa de mínimos por lugar** (P3): `seleccionarTodo` aprende el cursor de clave
  compuesta y `pullMinimosLugar` lo usa (R5).

## Technical Context

**Language/Version**: TypeScript ~6.0 (React 19), Node.js ^22.22 o ≥24.15.

**Primary Dependencies**: sin dependencias nuevas (React, Zustand, Dexie, Tailwind, `lucide-react`,
supabase-js). Sin router: History API nativa para el hash (R1).

**Storage**: sin cambios. Postgres y Dexie (v12) iguales; no hay migración. Se edita `minimos_lugar`
desde una pantalla más y se descarga paginada. Detalle en [data-model.md](./data-model.md).

**Testing**: Vitest + RTL — unit de `secciones` (visibilidad y resúmenes), `seccionUrl`,
`minimosEditor` y paginación con clave compuesta (cliente falso con `.or()`); integración de Ajustes
reorganizada para entrar por el índice (todos los casos actuales se conservan) y un archivo nuevo para
el editor de mínimos; capturas con `run-indentory` en tres tamaños y dos roles (quickstart).

**Target Platform**: PWA (teléfono, tablet, desktop); "atrás" de Android y del navegador.

**Project Type**: PWA, solo front.

**Performance Goals**: el índice se muestra con datos locales sin esperar red; el editor de mínimos
renderiza 25 filas en vez de 73+ y filtra mientras se escribe sin demora perceptible.

**Constraints**:
- Offline completo (Constitución I): índice, resúmenes y editor de mínimos usan solo IndexedDB; Equipo
  sigue necesitando conexión como hoy y por eso no entra en el resumen (R3).
- Objetivos táctiles ≥ 48 px (Constitución III): tarjetas de ≥ 72 px, "Volver", "Ver más" y campos.
- Mismo comportamiento de cada sección (FR-007): los componentes actuales se reubican, no se reescriben,
  salvo la división de `ConfiguracionAlertasSection` (avisos ↔ mínimos).
- Autorización real en RLS, sin cambios; ocultar secciones es UI.

**Scale/Scope**: 3 módulos nuevos en `features/ajustes/lib`, 4 componentes nuevos, ~8 componentes
tocados, 1 helper de sync generalizado, 1 test de integración reorganizado y 5 archivos de prueba nuevos.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Cumplimiento | Estado |
|---|---|---|
| I. Offline-First | Índice, resúmenes y mínimos desde IndexedDB; guardar un mínimo escribe en Dexie y lo sube el sync; la descarga paginada no aplica nada si una página falla y conserva los cambios locales | ✅ |
| II. Zustand | Sin store nuevo; la sección abierta es estado de navegación (URL + `useState`), como `vista`; los datos salen de los stores existentes | ✅ |
| III. Táctil 48 px | Tarjetas ≥ 72 px de alto con toda el área activa; "Volver", "Ver más", "Limpiar búsqueda" y campos con `touch-target` | ✅ |
| IV. Trazabilidad y alertas | Un mínimo cambiado en Ajustes rige las alertas del lugar donde se trabaja (corrige el caso en que no se notaba); cálculo de alertas sin cambios | ✅ |
| V. Búsqueda manual | El editor suma un buscador por texto; ningún formulario activa la cámara | ✅ |
| VI. Multi-usuario | Sin cambios en autoría ni registros; permisos por rol se mantienen | ✅ |
| Pila obligatoria | Sin dependencias nuevas (sin router) | ✅ |

**Re-check post-diseño**: sin violaciones.

## Project Structure

### Documentation (this feature)

```text
specs/019-ajustes-por-secciones/
├── plan.md
├── research.md          # R1–R8
├── data-model.md        # sin esquema nuevo; regla de escritura del mínimo y tipos de presentación
├── quickstart.md
├── contracts/
│   └── ui-contracts.md  # índice, tarjetas, subpantalla, URL, editor de mínimos, seleccionarTodo
├── checklists/requirements.md
└── tasks.md             # /speckit-tasks
```

### Source Code (repository root)

```text
src/
├── app/
│   └── App.tsx                          # vista inicial 'mas' si hay #ajustes/<id>; limpia el hash al cambiar de vista
├── lib/sync/
│   ├── paginar.ts                       # seleccionarTodo con opción `clave` compuesta (R5)
│   └── index.ts                         # pullMinimosLugar → seleccionarTodo(..., { clave: ['insumo_id','lugar_id'] })
└── features/ajustes/
    ├── lib/
    │   ├── secciones.ts                 # NUEVO: SECCIONES_AJUSTES, seccionesVisibles, resumenSeccion (R2, R3)
    │   ├── seccionUrl.ts                # NUEVO: hash #ajustes/<id>, useSeccionAjustes (R1)
    │   └── minimosEditor.ts             # NUEVO: filasMinimos (modo, origen, búsqueda, orden) (R4)
    └── components/
        ├── AjustesView.tsx              # índice o sección; cierra secciones no visibles (R7)
        ├── AjustesIndice.tsx            # NUEVO: accesos móviles + grilla de tarjetas
        ├── TarjetaSeccion.tsx           # NUEVO
        ├── SeccionAjustesPantalla.tsx   # NUEVO: "Volver" + título + contenido por sección
        ├── MinimosPorInsumoSection.tsx  # NUEVO: buscador, "Ver más", lugar/catálogo/todos (R4)
        ├── ConfiguracionAlertasSection.tsx → AvisosSection.tsx  # sin el editor de mínimos
        ├── LugaresSection.tsx, CategoriasSection.tsx, InsumosBajaSection.tsx  # prop `sinTitulo`
        └── PerfilSection.tsx, EquipoSection.tsx, NotificacionesSection.tsx    # sin cambios de contrato

tests/
├── helpers/consultaFalsa.ts             # `.or()` con cursor compuesto y `order()` múltiple
├── unit/
│   ├── ajustes/secciones.test.ts
│   ├── ajustes/seccionUrl.test.ts
│   ├── ajustes/minimosEditor.test.ts
│   └── sync-minimos-lugar-paginacion.test.ts
└── integration/
    ├── ajustes.test.tsx                 # reorganizado: entra por el índice; índice, Volver, popstate, recarga, permisos
    ├── ajustes-minimos.test.tsx         # NUEVO: buscar, paginar, editar por lugar, "Todos", un solo lugar
    └── navegacion-responsiva.test.tsx   # ampliado: cambiar de vista limpia el hash
```

**Structure Decision**: todo vive en `features/ajustes`, que ya es dueña de la pantalla. Las funciones
de escritura de mínimos se reusan desde `features/insumos/lib/minimos.ts` y
`features/alertas/lib/configuracion.ts` sin moverlas, para que Ajustes y la edición del insumo
compartan la misma implementación. La paginación por clave compuesta extiende el helper de la 017 en
`lib/sync/paginar.ts` en vez de crear uno paralelo.

## Complexity Tracking

Sin violaciones de la constitución; no aplica.

## Notas para la spec 020 y 021

- **020**: el editor de mínimos usa un "Ver más" local de 25 filas; si la 020 crea un componente de
  paginación común, lo reemplaza ahí. Categorías e insumos dados de baja quedan sin paginar.
- **021**: agrega `'proveedores'` a `SECCIONES_AJUSTES` entre `categorias` y `baja`, con su resumen;
  el índice, la URL y los permisos lo toman sin más cambios.
