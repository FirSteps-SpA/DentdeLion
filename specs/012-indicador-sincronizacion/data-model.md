# Data Model: Indicador de Sincronización

**Feature**: 012-indicador-sincronizacion | **Date**: 2026-10-18

## Dexie `version(9)`

| Tabla | Cambio | Sincronizada |
|---|---|---|
| `usuariosConocidos` | **Nueva**: `'id'` | No (local al dispositivo) |
| `estadoSync` | **Nueva**: `'id'` | No (local al dispositivo) |
| `configuracionAlertas` | Campos nuevos `horasAvisoPendientes?` y `sincronizado` (sin índice nuevo) | Sí (excepto `sincronizado`) |
| `configuracionClinica` | Campo nuevo `sincronizado` (sin índice nuevo) | Sí (excepto `sincronizado`) |
| `movimientos`, `cambiosInsumo`, `categorias` | Sin cambios de forma: se leen para contar | Sí |

`upgrade()`: las filas existentes de `configuracionAlertas` y `configuracionClinica` reciben
`sincronizado: true` (research.md R5). **No** se toca `movimientos` (la v8 ya hizo el reenvío
único). No se renombra la base `inDENToryDB` (decisión del backlog).

## Entidades nuevas (locales)

### UsuarioConocido

Quién inició sesión alguna vez en este dispositivo. Solo sirve para nombrar a los dueños de
pendientes ajenos (FR-012, research.md R7).

| Campo | Tipo | Regla |
|---|---|---|
| `id` | `string` | Id de Supabase Auth (igual que `Movimiento.usuarioId`) |
| `nombre` | `string` | Del perfil al iniciar sesión |
| `vistoEn` | `string` (ISO) | Último login en el dispositivo |

Se escribe con `put` en `authStore.login`. Nunca se borra en `logout`.

### EstadoSync

Fila única `id: 'local'`.

| Campo | Tipo | Regla |
|---|---|---|
| `id` | `'local'` | Fija |
| `ultimaExitosaEn` | `string \| null` | Fin del último ciclo con resultado `ok` (FR-006). `null` o sin fila = "Nunca sincronizado" |

## Entidades extendidas

### ConfiguracionAlertas (fila `'global'`)

| Campo | Tipo | Regla |
|---|---|---|
| `horasAvisoPendientes` | `number?` | Entero de 1 a 168. Si falta, vale `HORAS_AVISO_PENDIENTES_POR_DEFECTO = 24`. Al subir se **omite** si es `undefined` (R6) |
| `sincronizado` | `boolean` | Solo local. `false` al guardar desde Ajustes. `true` tras un push sin error, tras un push rechazado por permisos (el cambio se descarta) o tras un pull. El pull respeta un `false` solo si el usuario actual es administrador (R5) |

`actualizarNivelesAviso` y el nuevo `actualizarHorasAvisoPendientes` conservan el otro campo de
la fila y escriben `sincronizado: false`. La validación del umbral es: entero, `1 ≤ h ≤ 168`, y
si no se cumple aparece el mensaje "Ingresa un número de horas entre 1 y 168."

### ConfiguracionClinica (fila `'global'`)

Gana `sincronizado: boolean` con las mismas reglas (R5). Sin otros cambios.

## Estado en memoria (Zustand)

### `syncStore`: estado del ciclo

| Campo | Tipo | Notas |
|---|---|---|
| `fase` | `'inactivo' \| 'sincronizando'` | `sincronizando` mientras haya un ciclo en curso (R9) |
| `ultimoResultado` | `ResultadoCiclo['estado'] \| null` | `null` antes del primer ciclo de esta carga |
| `ultimaExitosaEn` | `string \| null` | Espejo reactivo de `EstadoSync` |
| `sincronizarAhora` | `() => Promise<ResultadoCiclo>` | Reusa el ciclo en curso si lo hay |

### `ResultadoCiclo`

```text
estado: 'ok' | 'sin-red' | 'error' | 'sesion'
etapasConError: string[]   // p. ej. ['push movimientos'], solo para diagnóstico
terminadoEn: string        // ISO
```

### `pendientesStore`: derivado por `liveQuery` (R8)

Por cada autor:

| Campo | Tipo |
|---|---|
| `usuarioId` | `string` |
| `movimientos`, `cambiosInsumo`, `categorias` | `number` |
| `masAntiguoEn` | `string` (ISO, `creadoEn` mínimo) |

Qué cuenta como pendiente:
- `Movimiento`: `sincronizado === false`. Autor: `usuarioId`.
- `CambioInsumo`: `sincronizado === false && rechazadoEn === null`. Autor: `usuarioId`.
- `Categoria`: `sincronizado === false && rechazadoEn === null`. Autor: `creadoPor`.

## Derivación del indicador: `calcularIndicador()` (función pura)

Entradas: el usuario actual, los pendientes por autor, `syncStore`, `navigator.onLine`, el umbral
en horas, `ahora` y los usuarios conocidos.

```text
propios      = pendientes del usuario actual (suma de los 3 tipos)
ajenos       = [{ nombre | "otro usuario", total, masAntiguoEn }] del resto de autores
antiguos     = pendientes (propios y ajenos) con max(0, ahora − creadoEn) > umbral h
estado       = 'error'       si ultimoResultado ∈ {error, sesion}
               'sin-conexion' si no, cuando !onLine o ultimoResultado = sin-red
               'pendientes'   si no, cuando propios > 0
               'sincronizado' en otro caso
alerta       = antiguos.length > 0        // se superpone a cualquier estado (FR-010)
etiqueta     = propios > 99 ? "99+" : propios
motivoError  = ultimoResultado = 'sesion' ? 'sesion' : 'servidor'
```

Transiciones:
- Un ciclo `ok` lleva `error` o `sin-conexion` a `pendientes`/`sincronizado`.
- Crear un cambio local sube `propios` de inmediato (`liveQuery`).
- El evento `offline` lleva cualquier estado distinto de `error` a `sin-conexion`.
- Los pendientes ajenos nunca cambian `estado`; solo pueden activar `alerta` (aclaración 2).
