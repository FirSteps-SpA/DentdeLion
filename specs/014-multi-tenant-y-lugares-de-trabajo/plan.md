# Implementation Plan: Multi-tenant y Lugares de Trabajo

**Branch**: `014-multi-tenant-y-lugares-de-trabajo` | **Date**: 2026-10-18 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/014-multi-tenant-y-lugares-de-trabajo/spec.md`

## Summary

Convierte DentdeLion de una clínica a varios clientes aislados (tenants), cada uno con varios
lugares de trabajo.

- **Tenants y membresía**: tablas nuevas `tenants` y `lugares`. `perfiles` pasa a ser la membresía,
  con tenant, rol y estado (research.md R1).
- **Aislamiento en el servidor**: `tenant_id` con `default tenant_actual()` en todas las tablas de
  negocio y RLS por tenant en lugar de `using (true)`. Las FK compuestas impiden apuntar a lugares de
  otro tenant (R2).
- **Stock por lugar**: el stock sale de `movimientos.lugar_id`, de modo que un lote mantiene su
  identidad entre lugares (R3).
- **Traslados**: un par de movimientos `traslado_salida`/`traslado_entrada`, con atomicidad
  garantizada por un trigger diferido en el servidor y una transacción Dexie en el dispositivo (R4).
- **Mínimos por lugar**: tabla `minimos_lugar` (R6).
- **Invitaciones**: un enlace propio de 7 días que la administradora envía por correo, WhatsApp o
  copia, aceptado por una Edge Function. No depende de un servidor de correo (R5).
- **Alta de tenants**: manual, con `scripts/alta-tenant.mjs`.
- **Dispositivo**: Dexie v10 por tenant, con la migración a tenant 1 / lugar 1 en servidor y
  dispositivo. Lugar activo y "Todos" (de lectura) en un store nuevo (R8, R10).

## Technical Context

**Language/Version**: TypeScript ~6.0 (React 19), Node.js ^22.22 o ≥24.15. Edge Function en Deno,
con el runtime de Supabase Edge Functions.

**Primary Dependencies**: sin dependencias de producción nuevas. Supabase JS (cliente), `supabase-js`
en la Edge Function (import de esm), Dexie, Zustand, Tailwind y `lucide-react`. Una devDependency
nueva, `fake-indexeddb`, solo para probar el upgrade de Dexie v10 con IndexedDB real en Vitest.

**Storage**:
- Postgres (Supabase): 4 tablas nuevas, columnas `tenant_id`/`lugar_id`/`traslado_id`, funciones,
  triggers y RLS reescrita.
- Dexie v10: `tenantId`/`lugarId` en todas las tablas, más `lugares`, `minimosLugar` y
  `lugarActivo`.
- Detalle en [data-model.md](./data-model.md) y
  [contracts/supabase-schema.md](./contracts/supabase-schema.md).

**Testing**:
- Vitest + RTL: funciones puras por lugar, traslados, sync de pares, upgrade v10, filtro por tenant,
  y la interfaz de selector, "Todos", lugares, equipo e invitación.
- `test:rls` ampliado con dos tenants y dos lugares, más la Edge Function servida localmente.
- Ensayo de la migración sobre una restauración del respaldo de producción.
- Dexie v10 verificado en Chromium real.

**Target Platform**: PWA (teléfono, tablet y desktop) y Supabase (Postgres, Auth, Edge Functions).

**Project Type**: PWA + esquema Supabase + una Edge Function + un script de operación.

**Performance Goals**:
- Cambiar de lugar en menos de 1 s (SC-004), con filtros en memoria sobre unos cientos o miles de
  filas por tenant.
- RLS con índices `(tenant_id)` y `(lugar_id)` en las tablas con más filas.

**Constraints**:
- Aislamiento total entre tenants, verificado contra el servidor y no solo en la app (FR-002).
- Offline completo: lugar activo, traslados y "Todos" sin red (Constitución I).
- Compatibilidad con clientes 2.2.0 durante el despliegue.
- No renombrar `inDENToryDB`.

**Scale/Scope**:
- Pocos tenants al principio (1 o 2), con 1 a 5 lugares y 1 a 10 usuarios por tenant.
- Unos 15 archivos de lógica afectados por el filtro por lugar.
- 4 vistas nuevas o cambiadas: selector, lugares, equipo e invitación. Un flujo nuevo: traslado.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Cumplimiento | Estado |
|---|---|---|
| I. Offline-First | El lugar activo, el filtro por lugar, los traslados (transacción Dexie) y "Todos" funcionan sin red. El dispositivo sincroniza todos los lugares del tenant. Los pendientes de la 2.2.0 migran al lugar 1 sin pérdida (R8) y el servidor rechaza pares de traslado incompletos, así que no se pierden ni duplican transacciones | ✅ |
| II. Zustand | El estado nuevo (`lugarStore`, el equipo y las invitaciones del administrador) va en Zustand y lee Dexie | ✅ |
| III. Táctil 48 px | El selector, los menús, los botones de compartir invitación y el `Stepper` del traslado miden al menos 48 px | ✅ |
| IV. Trazabilidad y alertas | El lote conserva su identidad entre lugares; el traslado queda en el historial de ambos con autor y fecha; las alertas se calculan por lugar con su mínimo efectivo, localmente | ✅ |
| V. Búsqueda manual | No cambia; el escáner sigue oculto | ✅ |
| VI. Multi-usuario | La autoría sigue en cada movimiento (`usuario_id = auth.uid()`); la autorización por tenant y rol vive en el servidor (RLS y Edge Function); los usuarios desactivados pierden el acceso, pero su autoría se conserva | ✅ |
| Pila obligatoria | La Edge Function es parte de Supabase (backend de la pila); no hay dependencias npm nuevas | ✅ |

**Re-check post-diseño**: sin violaciones. La Edge Function con service role es el único componente
con privilegios elevados: valida el token y el tenant antes de crear usuarios, y su código se revisa
en la PR.

## Project Structure

### Documentation (this feature)

```text
specs/014-multi-tenant-y-lugares-de-trabajo/
├── plan.md
├── research.md          # R1–R11
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── supabase-schema.md   # migración, RLS, Edge Function, script de alta, casos test:rls
│   └── ui-contracts.md      # selector, "Todos", lugares, equipo, invitación, traslado
├── checklists/requirements.md
└── tasks.md             # /speckit-tasks
```

### Source Code (repository root)

```text
supabase/migrations/20261020000000_multi_tenant.sql      # nuevo
supabase/functions/aceptar-invitacion/index.ts           # nuevo (Deno)
supabase/config.toml                                     # [functions.aceptar-invitacion] verify_jwt = false
scripts/alta-tenant.mjs                                  # nuevo
scripts/test-rls.mjs                                     # casos de dos tenants

src/lib/db/index.ts                    # tipos + version(10) + constantes TENANT_1/LUGAR_1
src/lib/sync/index.ts                  # push/pull de lugares y minimosLugar; pares de traslado; filtro por tenant
src/lib/tenancy.ts                     # nuevo: aislamiento local al iniciar sesión (FR-004)
src/stores/lugarStore.ts               # nuevo: lugar activo / 'todos'
src/stores/{inventoryStore,alertasStore,authStore}.ts    # tenantId en el usuario; lugares y mínimos
src/features/insumos/lib/{stock,estado,consumoRapido,alta,movements}.ts   # por lugar; traslado
src/features/insumos/lib/traslado.ts   # nuevo
src/features/alertas/lib/{stockBajo,caducidad,resumen}.ts               # por lugar + mínimo efectivo
src/features/compras/lib/{sugeridos,recepcion,itemsManuales}.ts         # por lugar
src/features/inicio/lib/resumenInicio.ts                                # por lugar / 'todos'
src/features/ajustes/components/{LugaresSection,EquipoSection}.tsx      # nuevos
src/features/ajustes/lib/{lugares,equipo,invitaciones}.ts               # nuevos
src/features/auth/AceptarInvitacion.tsx                                 # nuevo
src/features/insumos/components/TrasladoForm.tsx                        # nuevo
src/app/{SelectorLugar,ElegirLugarSheet}.tsx                            # nuevos
src/app/{TopBar,AppHeader,App}.tsx                                      # selector, ruta de invitación, acceso desactivado

tests/unit/{traslado,stockPorLugar,tenancyLocal,dexie-v10}.test.ts
tests/integration/{lugares,traslado,equipo-invitacion,vista-todos}.test.tsx
```

**Structure Decision**: el mismo proyecto PWA más dos piezas de backend.
- La Edge Function vive en `supabase/functions/`, con la estructura estándar de la CLI.
- El script de alta va junto a `test-rls.mjs`.
- La lógica de lugar se agrega a las funciones puras existentes como parámetro, en vez de duplicarlas.

## Riesgos y notas

- **Tamaño (L)**: el filtro por lugar toca casi todas las funciones de inventario. Las pruebas
  existentes deben seguir en verde con un solo lugar (el caso de la clienta actual) antes de agregar
  los casos de varios lugares.
- **RLS reescrita**: es el cambio de seguridad más grande desde la baseline. Un error filtra datos
  entre clientes. Se mitiga con `test:rls` de dos tenants en el CI y con el ensayo sobre el respaldo.
- **Orden de despliegue**: primero la migración y la Edge Function, después el front. Los clientes
  2.2.0 siguen funcionando gracias a los `default`, pero no ven ni crean lugares nuevos hasta
  actualizar.
- **Invitaciones sin correo automático**: decisión de R5, que cambia la redacción de FR-019. Si más
  adelante se configura un SMTP propio, se puede agregar el envío automático sin cambiar el modelo.
- **Clientes 2.2.0 con varios lugares**: un cliente 2.2.0 en caché descarga lotes y movimientos de
  todos los lugares sin filtrarlos, así que mostraría el stock sumado. Además, no entiende los tipos
  `traslado_*`. Mientras el tenant tenga un solo lugar no pasa nada (el caso de la clienta actual).
  Por eso, antes de crear el segundo lugar o el primer traslado, todos los dispositivos del tenant
  deben estar actualizados: el aviso de actualización del service worker y la verificación de
  versión en el procedimiento de despliegue.
- **Pendientes de un usuario desactivado**: el servidor acepta sus `lotes` y `movimientos` con
  `creado_en` anterior a `desactivado_en`. El valor lo pone el cliente, pero la persona era de
  confianza hasta ese momento, y es preferible a perder consumos clínicos (Constitución I).
- **Datos de otros tenants en el dispositivo**: se borran las filas sincronizadas de otros tenants al
  cambiar de tenant. Los pendientes ajenos quedan en IndexedDB, ocultos para la app pero accesibles
  con las herramientas del navegador. Es aceptable mientras sean unos pocos registros en un
  dispositivo compartido; se documenta.

## Complexity Tracking

Sin violaciones de la constitución.
