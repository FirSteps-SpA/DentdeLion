# Implementation Plan: Compras · selección, subtotal y pedido por WhatsApp

**Branch**: `022-compras-seleccion-subtotal-y-whatsapp` | **Date**: 2026-10-23 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/022-compras-seleccion-subtotal-y-whatsapp/spec.md`

## Summary

La lista de compras pasa a armar un pedido:

- **Selección y subtotal** (P1): casilla por ítem y "Seleccionar todo"; la selección se guarda como un
  borrador local en Dexie, sin sincronizar ni versión nueva (R2). Cada ítem marcado muestra cantidad ×
  precio por unidad de compra de la última compra (costo unitario de la 015 × contenido actual, R3) o
  "Sin precio"/"Sin cantidad"; una barra al pie suma el "Subtotal estimado" (R8).
- **Enviar por WhatsApp** (P1): hoja "Enviar pedido" con los proveedores activos (predeterminado del
  lugar ya elegido) y un enlace `wa.me` real con el mensaje (R4, R7). Mensaje = saludo del tenant +
  un renglón por ítem con su cantidad en unidades de compra, sin precios (R5).
- **Copiar y Compartir** (P2): mismos mensaje y selección; se mudan a la barra de resumen.
- **Deuda de sync** (P2): `pushItemsCompra` sube por autor y, si un ajeno nuevo se rechaza, uno por uno
  sin marcar el ciclo con error (R6).
- **Saludo editable** (P3): columna `configuracion_alertas.saludo_pedido` (null = el de la clienta),
  con la sincronización de configuración que ya existe; se edita en Ajustes → Proveedores (R1, R9).

## Technical Context

**Language/Version**: TypeScript ~6.0 (React 19), Node.js ^22.22 o ≥24.15; SQL (Postgres de Supabase).

**Primary Dependencies**: sin dependencias nuevas (React, Zustand, Dexie, Tailwind, `lucide-react`,
`@supabase/supabase-js`).

**Storage**: Postgres: migración `20261024000000_saludo_pedido.sql` (una columna con check). Dexie:
**sin versión nueva**: `ConfiguracionAlertas.saludoPedido` es un campo opcional y la selección es una
fila más de `borradores` (índice por `id`). Detalle en [data-model.md](./data-model.md).

**Testing**: Vitest + RTL (lógica del pedido, selección, saludo, sync; integración de Compras, hoja de
envío y Ajustes); `npm run test:rls` ampliado (saludo e `items_compra` ajenos); capturas con
`run-indentory` en tres tamaños; prueba manual del enlace en Android y desktop
([quickstart.md](./quickstart.md)).

**Target Platform**: PWA (teléfono, tablet, desktop) + Supabase.

**Project Type**: PWA con backend Supabase (front + una migración chica).

**Performance Goals**: marcar un ítem actualiza el subtotal sin demora perceptible con 200 ítems (la
suma es O(n) sobre costos ya calculados); enviar al predeterminado en ≤ 3 toques (SC-002).

**Constraints**:

- Sin conexión (Constitución I): selección, subtotal, mensaje y saludo funcionan sin red; solo WhatsApp
  necesita conexión, y lo maneja WhatsApp.
- El enlace de WhatsApp debe abrirse desde un toque directo (sin bloqueo de ventanas emergentes) en
  Android, iOS y desktop (R4); límite práctico de 4.000 caracteres.
- Clientes anteriores (2.4.0 y 021) no deben borrar el saludo al subir la configuración (R1).
- Táctil ≥ 48 px (Constitución III) en casillas, "Seleccionar todo", opciones de proveedor y botones.

**Scale/Scope**: 1 migración; 3 módulos de lógica nuevos (`pedido.ts`, `useSeleccionCompras.ts`,
`saludoAdmin.ts`) y 2 componentes nuevos (`ResumenSeleccion`, `EnviarPedidoSheet`); cambios en
`ComprasView`, las dos tarjetas, `compartir.ts`, `ProveedoresSection`, `alertasStore`, `db` (tipos),
`sync` (fila de configuración y `pushItemsCompra`) y `test-rls.mjs`; 5 archivos de prueba nuevos y ~4
ajustados.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Cumplimiento | Estado |
|---|---|---|
| I. Offline-First | Selección en Dexie (borrador local); saludo escrito primero en Dexie y subido en segundo plano con la regla existente; un ítem de compra rechazado ya no frena la subida del resto ni se pierde (queda local, R6) | ✅ |
| II. Zustand | Saludo expuesto por `alertasStore` (misma `liveQuery` de la configuración); la selección es estado de una pantalla, en un hook sobre Dexie, sin store nuevo | ✅ |
| III. Táctil 48 px | Casilla como `label` de 48 × 48; "Seleccionar todo", opciones de proveedor y botones con `touch-target` | ✅ |
| IV. Trazabilidad | No cambia lotes ni movimientos; el subtotal se calcula del precio por lote ya trazado (015) | ✅ |
| V. Búsqueda manual | No toca formularios de registro ni consumo; ninguna cámara | ✅ |
| VI. Multi-usuario | El saludo solo lo cambia administración (RLS existente); los ítems de compra siguen subiendo con su autor real: no se relaja la política de INSERT (R6) | ✅ |
| Pila obligatoria | Sin dependencias nuevas; WhatsApp por enlace, sin SDK | ✅ |

**Re-check post-diseño**: sin violaciones.

## Project Structure

### Documentation (this feature)

```text
specs/022-compras-seleccion-subtotal-y-whatsapp/
├── plan.md
├── research.md          # R1–R9
├── data-model.md        # saludo, selección, vistas calculadas
├── quickstart.md        # pruebas, recorrido manual, dispositivos reales, publicación
├── contracts/
│   ├── supabase-schema.md   # migración, test:rls, fila de configuración, pushItemsCompra
│   └── ui-contracts.md      # lógica, componentes, Ajustes, pruebas
├── checklists/requirements.md
└── tasks.md             # /speckit-tasks
```

### Source Code (repository root)

```text
supabase/migrations/
└── 20261024000000_saludo_pedido.sql        # NUEVO (R1)

scripts/
└── test-rls.mjs                            # sección spec 022

src/
├── lib/
│   ├── db/index.ts                         # ConfiguracionAlertas.saludoPedido; Borrador como unión
│   └── sync/index.ts                       # saludo_pedido en la fila; pushItemsCompra por autor (R6)
├── stores/
│   └── alertasStore.ts                     # saludoPedido efectivo
└── features/
    ├── compras/
    │   ├── lib/pedido.ts                   # NUEVO: claves, valor, resumen, mensaje, enlace (R3–R5)
    │   ├── lib/useSeleccionCompras.ts      # NUEVO: selección en borradores + poda (R2)
    │   ├── lib/compartir.ts                # sin construirTextoCompartir
    │   └── components/
    │       ├── ComprasView.tsx             # casillas, Seleccionar todo, barra, overlay de envío
    │       ├── ItemSugeridoCard.tsx, ItemManualCard.tsx   # casilla y valor
    │       ├── ResumenSeleccion.tsx        # NUEVO (R8)
    │       └── EnviarPedidoSheet.tsx       # NUEVO (R7)
    └── ajustes/
        ├── lib/saludoAdmin.ts              # NUEVO (R9)
        └── components/ProveedoresSection.tsx   # tarjeta "Mensaje del pedido"

tests/
├── unit/compras/pedido.test.ts, unit/compras/useSeleccionCompras.test.tsx   # NUEVOS
├── unit/ajustes/saludoAdmin.test.ts, unit/sync-configuracion-saludo.test.ts # NUEVOS
├── integration/compras-seleccion.test.tsx, integration/enviar-pedido.test.tsx  # NUEVOS
└── (ajustados) unit/compras/compartir, unit/sync-items-compra, integration/compras,
    integration/ajustes-proveedores
```

**Structure Decision**: todo lo del pedido vive en `features/compras` (solo lo usa Compras); el saludo
se edita en `features/ajustes`, junto a los proveedores, y se lee de `alertasStore`, que ya carga la
fila de configuración del tenant. La lista de proveedores se toma de `features/proveedores` (021) sin
cambiarla.

## Complexity Tracking

Sin violaciones de la constitución; no aplica.

## Notas

- **Nombre de la tabla**: el saludo vive en `configuracion_alertas`, que ya es "la configuración del
  tenant" aunque se llame de avisos (R1). Si se suman más ajustes generales, conviene renombrarla; va al
  backlog al publicar.
- **Sugeridos sin id**: la clave de un sugerido es lugar + insumo (R2); si un insumo deja de estar bajo
  el mínimo y vuelve, aparece sin marcar (es otro pedido).
- **Prueba real**: el lado de WhatsApp no se automatiza; SC-003 se cierra con la prueba en Android y
  desktop del quickstart antes de publicar.
- **Precio del pedido manual**: la cantidad de un ítem manual vinculado se toma en unidades de compra;
  el formulario hoy dice solo "Cantidad (opcional)". No se cambia aquí; si la clienta la escribe en
  unidades de consumo, el subtotal de ese ítem sale alto. Se revisa con ella en la prueba.
