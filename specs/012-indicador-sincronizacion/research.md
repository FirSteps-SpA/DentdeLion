# Research: Indicador de Sincronización

**Feature**: 012-indicador-sincronizacion | **Date**: 2026-10-18

Hallazgos sobre el código actual (`src/lib/sync/index.ts`, `src/lib/db/index.ts`,
`supabase/migrations/20261017000000_baseline.sql`) y las decisiones que resuelven cada incógnita
del plan.

## R1 · De dónde sale el resultado de un ciclo

**Hallazgo**: `runSyncBatch()` devuelve `Promise<void>`. Solo `pushMovimientos`,
`pushCambiosInsumo`, `pushCategorias` y los `pull*` miran `{ error }`. `pushInsumos`, `pushLotes`,
`pushItemsCompra`, `pushConfiguracionAlertas` y `pushConfiguracionClinica` lo descartan. Hoy no
hay forma de saber si un ciclo terminó bien.

**Decisión**: `runSyncBatch()` pasa a devolver un `ResultadoCiclo` (ver
[data-model.md](./data-model.md)). Un recolector `CicloSync` se crea al inicio del ciclo y se pasa
a cada `push*`/`pull*`, que le entrega su `{ error }` con la etapa (`registrar(etapa, error)`).
El recolector clasifica cada error con la misma regla que ya usa `reportarErrorSync` (R2) y
también lo reporta a Sentry, así una sola llamada sustituye a `reportarErrorSync` en cada etapa.
Los rechazos por permisos que la etapa ya resolvió (filas marcadas `rechazadoEn`) **no** se
registran como error: son un resultado esperado, ya notificado con avisos.

**Alternativas descartadas**:
- Lanzar excepciones desde cada etapa: cortaría el ciclo en la primera falla, y hoy cada etapa
  sigue aunque otra falle (p. ej. el pull se hace aunque un push falle). Sería un cambio de
  comportamiento.
- Derivar el estado solo de `navigator.onLine`: no detecta wifi sin internet ni rechazos del
  servidor (aclaración 3).

## R2 · "Sin conexión" frente a "Error"

**Decisión** (aclaración 3 de la spec): un error es de **red** si `navigator.onLine === false` o
si el mensaje es de tipo `failed to fetch | networkerror | load failed | fetch failed | network
request failed`. Es la función `esFallaDeRed` de `src/lib/sync/reportar.ts`, que pasa a
exportarse. Cualquier otro `{ error }` es de **servidor**. El resultado del ciclo es:

1. `sesion` si la validación previa de sesión falla (R3), y entonces no se sube nada.
2. Si no, `error` si hubo al menos un error de servidor.
3. Si no, `sin-red` si hubo al menos un error de red.
4. Si no, `ok`.

La prioridad sigue FR-002: Error > Sin conexión. Basta un ciclo y el siguiente ciclo `ok` lo
borra. No hay contador de fallos seguidos.

## R3 · Sesión expirada

**Hallazgo**: con el refresh token vencido, supabase-js sigue enviando las peticiones como `anon`.
`movimientos` falla con RLS fila por fila (no se pierde nada, el bug de 2.1.0 ya está corregido).
Pero `pushCambiosInsumo` y `pushCategorias` interpretan el RLS como "sin permisos" y marcan las
filas como `rechazadoEn`: las **revierten** aunque el usuario sea administrador.

**Decisión**: antes de subir nada, `runSyncBatch` llama a `client.auth.getSession()`:
- Si devuelve error de red, el ciclo es `sin-red` y no se hace nada más.
- Si no hay sesión, o su `user.id` no coincide con `useAuthStore.usuario.id`, el ciclo es
  `sesion` (motivo de error FR-015) y no se hace ningún push ni pull.
- Si no, sigue normal.

`getSession` lee la sesión guardada y solo usa la red para refrescarla, así que sin red es barato.

## R4 · Pendientes de otro usuario (FR-012): filtrar por autor en todos los push con bandera

**Hallazgo**: solo `pushMovimientos` filtra por `usuarioId === usuario actual`.
`pushCambiosInsumo` y `pushCategorias` suben las filas pendientes de **todos** los usuarios del
dispositivo. Las políticas exigen `usuario_id = auth.uid()` y `creado_por = auth.uid()`, así que,
en un dispositivo compartido, el cambio de A subido con la sesión de B se rechaza por RLS, se
marca `rechazadoEn` y se revierte. **Se pierde un cambio legítimo de A** y no se cumple la promesa
de la historia 5 ("se subirán cuando esa persona inicie sesión").

**Decisión**: `pushCambiosInsumo` filtra por `cambio.usuarioId === usuarioActual` y
`pushCategorias` por `categoria.creadoPor === usuarioActual`, igual que `pushMovimientos`. Es un
arreglo necesario para que el indicador diga la verdad, no una ampliación del alcance. Las filas
que ya quedaron `rechazadoEn` por este bug no se reabren: no hay forma de distinguirlas de los
rechazos reales.

**Riesgo anotado, fuera de alcance**: `pushItemsCompra` sube la tabla completa en un solo upsert.
Si queda un ítem nuevo de A sin subir y B tiene la sesión, el INSERT de esa fila falla por RLS
(`creado_por = auth.uid()`) y con él todo el lote. Hoy pasa en silencio. Con esta spec el
indicador de B mostrará "Error" hasta que A inicie sesión. Es correcto (es una falla real) pero
molesto. Se anota en el backlog. Una política de `ON CONFLICT DO UPDATE` no se ve afectada: Postgres
solo aplica el `WITH CHECK` de INSERT a las filas que se insertan de verdad.

## R5 · Configuración global: subir solo si cambió y solo si es administrador

**Hallazgo**: `pushConfiguracionAlertas` y `pushConfiguracionClinica` hacen upsert en **cada
ciclo**, sin importar el rol, apenas existe la fila local (que todos los dispositivos tienen tras
el primer pull). Esto trae dos problemas:
1. Con rol `personal`, el upsert se rechaza por RLS cada 30 s. Hoy se descarta; con R1 pondría el
   indicador en "Error" para siempre.
2. Entre dos administradores, el que tiene la fila vieja la sube **antes** de bajar la nueva
   (push antes que pull) y pisa el cambio del otro. Con el umbral nuevo (FR-011) se vería como
   "cambié el umbral y volvió a 24".

**Decisión**: ambas filas de configuración ganan una bandera local `sincronizado` (no se sube al
servidor), con el mismo patrón que `cambiosInsumo`:
- Guardar desde Ajustes escribe `sincronizado: false`.
- El push sube solo si `sincronizado === false` **y** el usuario es administrador, y marca `true`
  si no hubo error.
- El pull escribe `sincronizado: true` y **no** pisa una fila local con `sincronizado: false`
  (gana el cambio local, que se sube en el siguiente push).

Las filas existentes no tienen la bandera. El `upgrade` de Dexie v9 las marca `true`: ya vinieron
del servidor o ya se subieron en algún ciclo anterior.

Estas filas **no** cuentan en el número de pendientes (alcance de la spec), pero una falla al
subirlas sí cuenta como error del ciclo.

## R6 · Dónde se guarda el umbral (FR-011)

**Decisión**: columna nueva `configuracion_alertas.horas_aviso_pendientes integer not null default
24 check (between 1 and 168)`. Reusa la fila global que ya leen todos y escribe solo el
administrador (política existente). Localmente es un campo opcional en `ConfiguracionAlertas`, y
si falta vale 24 (`HORAS_AVISO_PENDIENTES_POR_DEFECTO`).

Compatibilidad con clientes 2.1.0 en caché:
- **Escritura desde un cliente viejo**: su upsert no envía la columna, así que en
  `ON CONFLICT DO UPDATE` PostgREST solo actualiza las columnas enviadas y el valor se conserva.
  En un INSERT (no hay fila) se usa el default.
- **Lectura desde un cliente nuevo de una fila sin el campo** (antes del primer pull):
  `toConfiguracionAlertasRow` **omite** la clave si es `undefined`. Nunca la rellena con 24 al
  subir, para no pisar el valor del servidor.

**Alternativas descartadas**: una tabla propia (más políticas y código de sync por un solo número)
o un valor por dispositivo (lo descartó la aclaración 1).

## R7 · Nombres de otros usuarios (FR-012)

**Hallazgo**: la política `perfiles: leer solo el propio perfil` impide leer nombres ajenos, y
`usuarioActual` guarda una sola fila que se borra en cada login.

**Decisión**: tabla local nueva `usuariosConocidos` (`id`, `nombre`, `vistoEn`), que nunca se
sincroniza. `authStore.login` hace `put` del usuario además de reemplazar `usuarioActual`, y
`logout` no la borra. Un pendiente de otro usuario solo existe si esa persona trabajó en este
dispositivo, así que su nombre está ahí, salvo para logins anteriores a 012, en cuyo caso se
muestra "otro usuario". No se ensancha la política de `perfiles` (privacidad: no hay que exponer
el directorio de usuarios para esto).

## R8 · Contar pendientes de forma reactiva y barata

**Hallazgo**: el índice `sincronizado` de `movimientos` existe, pero IndexedDB no indexa
booleanos, así que no sirve para consultar. Los volúmenes son chicos: unos cientos de movimientos
por dispositivo (181 en producción al publicar 2.1.0).

**Decisión**: un `liveQuery` sobre `movimientos`, `cambiosInsumo` y `categorias` que filtra en
memoria (`!sincronizado && rechazadoEn === null` donde aplique) y agrupa por autor. Es el mismo
patrón que `inventoryStore`, que ya carga `movimientos` completos. La antigüedad depende del reloj,
no solo de los datos, así que el store recalcula también con un temporizador de 60 s. Si el reloj
está atrasado, la antigüedad se calcula como `max(0, ahora − creadoEn)`.

## R9 · Un solo ciclo a la vez y "Sincronizar ahora"

**Decisión**: `startBackgroundSync` y `sincronizarAhora()` comparten un guardián en el módulo
(`cicloEnCurso: Promise<ResultadoCiclo> | null`). Si ya hay un ciclo, el tick del intervalo lo
salta y `sincronizarAhora` devuelve la promesa en curso. El botón se deshabilita mientras
`fase === 'sincronizando'` (FR-008). Además:
- El evento `online` de `window` lanza un ciclo inmediato, para que el contador llegue a 0 antes
  de los 30 s del intervalo (SC-002).
- El evento `offline` pone el estado en `sin-red` sin esperar al siguiente ciclo.

Hoy dos ciclos pueden solaparse si uno tarda más de 30 s. El guardián también elimina ese riesgo.

## R10 · Persistencia de la última sincronización exitosa

**Decisión**: tabla local nueva `estadoSync`, con una fila `id: 'local'` y el campo
`ultimaExitosaEn: string | null`, que se escribe al terminar un ciclo `ok`. Es del dispositivo y
no del usuario: sigue el patrón de `preferenciasNotificaciones`. El estado en vivo (fase,
resultado, motivo) se guarda solo en memoria, en un store de Zustand (`syncStore`): no tiene
sentido mostrar tras reabrir la app el "Error" del arranque anterior.

## R11 · El indicador binario actual y `useBackendConnection`

**Decisión**: `AppHeader` deja de leer `useAppStore().isBackendConnected`. `useBackendConnection`
y `appStore` quedan como están (solo registran en la consola), sin consumidores en la interfaz. Se
podrán borrar en la spec 013, que rehace el encabezado. Así esta spec no toca más de lo necesario.

## R12 · Pruebas

- **Unitarias** (Vitest, `memoryDb` mockeado como en `sync-movimientos-fallo.test.ts`):
  - clasificación del ciclo (R1–R3);
  - filtro por autor en cambios y categorías (R4);
  - bandera de configuración y rol (R5);
  - omisión de `horas_aviso_pendientes` indefinido (R6);
  - derivación pura `calcularIndicador()` (prioridad de estados, alerta de antigüedad, otros
    usuarios, "99+");
  - guardián de ciclo único (R9).
- **Integración** (`tests/integration/indicador-sincronizacion.test.tsx`): un escenario por estado
  de la aceptación del roadmap (Sincronizado, Pendientes, Sin conexión, Error, alerta de
  antigüedad, pendientes de otro usuario), más que el panel se abre y cierra sin perder un
  formulario.
- **RLS** (`npm run test:rls`): el administrador escribe `horas_aviso_pendientes`; `personal` es
  rechazado; el valor 0 o 169 viola el check.
- **Dexie v9 en Chromium real** (skill `run-indentory`), como la v8 del release 2.1.0: los datos
  de una base v8 siguen ahí y las configuraciones quedan `sincronizado: true`.
