# Contract: Interfaz del indicador de sincronización

**Feature**: 012-indicador-sincronizacion

## `SyncIndicator` (`src/app/SyncIndicator.tsx`), dentro de `AppHeader`

Reemplaza el punto con el texto "Sincronizado"/"Sin conexión" que hoy deriva de
`isBackendConnected`.

- Es un `<button>` con área táctil ≥ 48×48 px (`touch-target`, FR-014) y
  `aria-label="Estado de sincronización: <texto>"`. Al tocarlo abre `SyncSheet`.
- El color no es la única señal: cada estado lleva su ícono.

| Estado | Texto | Ícono / color |
|---|---|---|
| `sincronizado` | "Sincronizado" | check · `success` |
| `pendientes` | "N pendientes" (o "99+ pendientes") | flechas · `primary` |
| `sin-conexion` | "Sin conexión", y "· N" si N > 0 | nube tachada · `text-muted` |
| `error` | "Error de sincronización", y "· N" si N > 0 | triángulo · `danger` |
| `alerta` (se superpone) | El texto del estado base | Ícono de reloj, más los colores `warning-30-text`/`warning-30-bg` (FR-010) |

- Mientras `fase === 'sincronizando'`, el ícono gira (con `motion-safe`) y el texto no cambia.
- En pantallas angostas el texto puede abreviarse ("Error", "Sin red"), pero el `aria-label`
  mantiene el texto completo.
- No se muestra sin usuario (en la pantalla de login, `AppHeader` no se monta).

## `SyncSheet` (`src/app/SyncSheet.tsx`)

Usa el `BottomSheet` existente con `titulo="Sincronización"`. Lo monta `AppHeader` con estado
local: no hay navegación ni cambio de `vista`, así que el formulario de abajo conserva su estado
(FR-007).

Contenido, en este orden (solo se muestra cada bloque si aplica):

1. **Estado actual**: el mismo texto del indicador. Si es `error`, agrega el motivo:
   - `servidor`: "El servidor rechazó la última subida. Se reintentará automáticamente."
   - `sesion`: "Tu sesión expiró. Cierra sesión y vuelve a entrar para subir tus cambios."
     (FR-015)
2. **Última sincronización**: "Última sincronización: hoy 14:32", "ayer 18:05", "12 oct 09:10" o
   "Nunca sincronizado".
3. **Tus pendientes** (si N > 0): una línea por tipo con su cantidad, p. ej. "Consumos e ingresos:
   3", "Cambios de insumo: 1", "Categorías nuevas: 1".
4. **Pendientes antiguos** (si `alerta`): "N cambios llevan más de H h sin subir (el más antiguo,
   del 12 oct 09:10)." Debajo, el umbral vigente: "Aviso tras H h sin subir". Para quien no es
   administrador, es la única vista del umbral (lectura).
5. **De otras personas** (si hay): por autor, "Hay N cambios de Ana que se subirán cuando esa
   persona inicie sesión en este dispositivo." Si alguno supera el umbral, se agrega: "Pídele que
   inicie sesión pronto."
6. **Botón "Sincronizar ahora"**: `TouchButton` primario de ancho completo. Mientras haya un ciclo
   en curso está deshabilitado y dice "Sincronizando…". Al terminar muestra un mensaje en línea:
   - `ok`: "Listo"
   - `sin-red`: "Sin conexión: se subirán al volver la red"
   - `error`/`sesion`: el motivo del punto 1

   El mensaje no se muestra como toast.

Se cierra con el fondo, con Escape o con "Cerrar", que es lo que ya hace `BottomSheet`.

## Ajustes, `ConfiguracionAlertasSection` (solo administradores)

Nuevo campo después de "Configurar niveles de aviso de caducidad":

- Título: "Aviso de cambios sin subir"
- `IconField` con la etiqueta "Avisar si un cambio lleva más de (horas)", `type="number"`,
  `min=1`, `max=168`, `step=1` y como valor inicial el umbral vigente. Guarda en `onBlur`, igual
  que los otros campos de la sección.
- Si el valor no es válido muestra `role="alert"` con "Ingresa un número de horas entre 1 y 168."
  y no guarda.
