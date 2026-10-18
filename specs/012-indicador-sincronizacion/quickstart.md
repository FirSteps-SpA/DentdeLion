# Quickstart: validar el indicador de sincronización

**Feature**: 012-indicador-sincronizacion

## Requisitos

- Supabase local levantado y con la migración aplicada: `supabase start && supabase db reset`.
  Ver el README para el usuario administrador y el usuario `personal` de prueba.
- `npm install`. Para los escenarios en navegador, el skill `run-indentory` (`setup.sh` una vez).

## Pruebas automáticas

```bash
npm test          # unitarias + integración (incluye indicador-sincronizacion.test.tsx)
npm run test:rls  # casos nuevos de horas_aviso_pendientes (contracts/supabase-schema.md)
npm run lint && npm run build
```

Esperado: todo verde. La integración cubre un escenario por estado: Sincronizado, Pendientes, Sin
conexión, Error, alerta de antigüedad y pendientes de otro usuario.

## Escenarios manuales (`npm run dev`, Chromium con DevTools o `run-indentory`)

| # | Pasos | Esperado | Spec |
|---|---|---|---|
| 1 | Iniciar sesión con red y esperar un ciclo | "Sincronizado"; en el panel, la hora actual como última sincronización | US1-1, US2-1 |
| 2 | Pasar DevTools a *Offline* y registrar 3 consumos | "Sin conexión · 3" al instante | US1-2 |
| 3 | Volver a *Online* sin recargar | Antes de 30 s pasa a "Sincronizado"; los 3 consumos están en Supabase | US1-3, SC-002 |
| 4 | Con red, detener Supabase local (`supabase stop`) y registrar un consumo | "Sin conexión · 1", no "Error" (no se alcanza el servidor) | US1-5 |
| 5 | Con Supabase arriba, borrar la sesión de `localStorage` (clave `sb-…-auth-token`) | "Error de sincronización"; el panel pide volver a iniciar sesión; ningún cambio queda `rechazadoEn` | FR-015, R3 |
| 6 | Offline, abrir el panel y pulsar "Sincronizar ahora" | "Sin conexión: se subirán al volver la red"; la app sigue usable | US3-3 |
| 7 | Con pendientes y red, pulsar "Sincronizar ahora" dos veces seguidas | Un solo ciclo (pestaña Network), el botón queda deshabilitado mientras dura y los pendientes llegan a 0 en menos de 10 s | US3-1/2, SC-002 |
| 8 | Como administrador, en Ajustes poner el umbral en 1 h; offline, cambiar con DevTools el `creadoEn` de un movimiento pendiente a hace 2 h | Alerta (reloj, color de advertencia); el panel muestra 1 antiguo y su fecha | US4-1/2/4 |
| 9 | En otro dispositivo (otra ventana de incógnito) con rol `personal`, abrir Ajustes y el panel | No ve el campo de umbral; el panel dice "Aviso tras 1 h sin subir" tras un ciclo | FR-011 |
| 10 | Usuario A registra un consumo offline y cierra sesión; B inicia sesión con red | B ve "Sincronizado"; el panel dice "Hay 1 cambio de A…"; si A es administrador y había editado un insumo, el cambio **no** se revierte | US5-1/2, R4 |
| 11 | A vuelve a iniciar sesión con red | El aviso desaparece y el consumo de A está en Supabase | US5-4 |
| 12 | Con un formulario de consumo a medio llenar, abrir y cerrar el panel | El formulario conserva lo ingresado | US2-4 |

## Migración Dexie v9 en Chromium real

Igual que la v8 del release 2.1.0. Abrir el build `2.1.0` (`git checkout 2.1.0 && npm run build &&
npm run preview`), iniciar sesión, guardar el nombre de clínica y dejar un consumo offline. Después
cambiar a esta rama, hacer build y recargar. Esperado:
- El consumo sigue pendiente y se sube.
- `configuracionAlertas` y `configuracionClinica` tienen `sincronizado: true`.
- Ningún error en la consola.
- `usuariosConocidos` se llena en el siguiente login.

## Despliegue

1. Aplicar la migración en producción **antes** de publicar el front (contracts/supabase-schema.md).
2. Publicar y vigilar en Sentry los eventos `Sync …`. Ahora se reportan también las etapas que
   antes descartaban su error (`push insumos`, `push lotes`, `push items_compra`, configuración;
   R1), así que pueden aparecer eventos nuevos. Hay que revisarlos: son fallas que antes pasaban en
   silencio. No debería haber eventos de configuración de usuarios `personal` (R5).
