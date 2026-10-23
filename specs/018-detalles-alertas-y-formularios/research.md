# Research: Detalles de alertas y formularios

**Feature**: 018-detalles-alertas-y-formularios | **Date**: 2026-10-22

No quedaron `NEEDS CLARIFICATION` en el contexto técnico: la spec se aclaró el 2026-10-22 (rueda,
días/meses, detalle y próximos vencimientos). Estas son las decisiones de diseño.

## R1 — Cómo evitar que la rueda cambie un campo numérico

**Decision**: componente `NumeroInput` (`src/components/ui/NumeroInput.tsx`) que envuelve
`<input type="number">` y, en `onWheel`, si el campo tiene el foco, lo suelta (`blur()`). Mantiene
`type="number"`, `inputMode`, `min`, `step` y todos los atributos que hoy recibe cada campo.

**Rationale**:
- Chrome, Edge y Firefox solo cambian el valor con la rueda cuando el campo tiene el foco (Safari no lo
  hace). Al soltar el foco durante el evento, la acción por defecto ya no aplica al campo y el navegador
  desplaza la página: cumple FR-001 y FR-002 sin manejar el scroll a mano.
- La escritura, el teclado numérico en móvil y las flechas siguen igual (FR-003): solo se pierde el foco
  cuando la persona gira la rueda sobre el campo, que es justo cuando quiere desplazarse.
- Es el mismo control en un solo lugar, así que los campos futuros lo heredan (R2).
- Soltar el foco dispara los `onBlur` existentes. En el mínimo por insumo de Ajustes (que guarda en
  `onBlur`) se guarda el valor que la persona escribió, el mismo que se guardaría al tocar fuera del
  campo; nunca un valor alterado por la rueda. En los formularios con validación al perder el foco, el
  efecto es el mismo que pasar al campo siguiente.

**Alternatives considered**:
- `preventDefault()` en un listener de `wheel` no pasivo: bloquea el cambio, pero también el
  desplazamiento de la página (rompe FR-002) salvo que se reimplemente el scroll.
- Cambiar a `type="text"` + `inputMode="decimal"`: elimina el problema de raíz, pero se pierden las
  flechas, la validación nativa de `min`/`step` y hay que aceptar la coma decimal del teclado móvil en
  cada parser. Más superficie de cambio para un arreglo S.
- Un listener global en `document`: no deja una pieza que se pueda probar por componente (FR-005) y
  depende de que nadie lo desmonte.
- Solo botones + y − (propuesta original de la clienta): descartado en Clarifications.

## R2 — Que ningún campo numérico se escape

**Decision**: prueba de arquitectura `tests/unit/sin-input-number-suelto.test.ts`, con el mismo
patrón que `lecturas-movimientos.test.ts`: recorre `src/` y falla si encuentra `type="number"` fuera de
`NumeroInput.tsx`. Además, `tests/integration/rueda-campos-numericos.test.tsx` monta cada formulario y
comprueba que la rueda no cambia sus campos (FR-005).

**Rationale**: la lista de campos de FR-004 es la de hoy; la prueba de arquitectura la mantiene cierta
cuando se agreguen campos (edge case "campos futuros").

**Alternatives considered**: regla de ESLint propia (más infraestructura que una prueba de 30 líneas
que el proyecto ya usa como patrón).

## R3 — Texto del tiempo restante

**Decision**: `textoTiempoCaducidad(diasRestantes: number): string` en
`src/features/alertas/lib/textoCaducidad.ts`:

| `diasRestantes` | Texto |
|---|---|
| 0 | "vence hoy" |
| 1 | "vence en 1 día" |
| 2–59 | "vence en N días" |
| ≥ 60 | "vence en M meses", con M = ⌊días / 30⌋ |
| −1 | "caducado hace 1 día" |
| −2 a −59 | "caducado hace N días" |
| ≤ −60 | "caducado hace M meses", con M = ⌊\|días\| / 30⌋ |

`diasRestantes` es el que ya calculan `computeAlertasCaducidad` y `resumenInicio` con `diasEntre`
(`src/lib/dateMath.ts`), así que el cálculo no cambia (FR-015).

**Rationale**: meses de 30 días hacen que el límite sea exacto y predecible para las pruebas (60–89 = 2,
90–119 = 3, como dice FR-007). Con M ≥ 2 siempre, nunca hace falta el singular "1 mes".

**Alternatives considered**: meses calendario (diferencia de mes y día entre hoy y la fecha): más
"correcto" pero con límites que cambian según el mes y la misma lectura para la persona. `mesesRestantes`
existente redondea (`Math.round`), lo que daría "2 meses" a 45 días; no se reutiliza.

## R4 — Fecha legible sin corrimiento de zona horaria

**Decision**: `formatearFechaCaducidad(fecha: 'AAAA-MM-DD'): string` en el mismo archivo. Arma la fecha
con sus componentes en hora local (`new Date(año, mes − 1, día)`) y la formatea con
`Intl.DateTimeFormat('es-CL', { day: 'numeric', month: 'short', year: 'numeric' })` → "3 nov 2026".
*(Corregido al implementar: `dateStyle: 'medium'` en `es-CL` da "03-11-2026", no "3 nov 2026".)*

**Rationale**: `new Date('2026-11-03')` es medianoche UTC, que en Chile (UTC−3) es el 2 de noviembre; con
`Intl` en hora local mostraría un día menos. Construir la fecha local evita el error.

**Alternatives considered**: formato `dd/mm/aaaa` de `ConfirmarLoteCaducadoDialog` (correcto pero menos
legible de un vistazo); dejar `AAAA-MM-DD` (es lo que la clienta pidió cambiar).

## R5 — Abrir el detalle desde una alerta

**Decision**: en Alertas e Inicio, cada renglón de caducidad, de stock bajo y de próximos vencimientos se
envuelve en un botón (≥ 48 px de alto) que guarda en estado local `{ insumoId, lugar }` y renderiza el
`InsumoDetalle` existente con los datos de la `VistaLugar` del renglón:
`lotes = vista.datos.lotes` del insumo y `movimientos = vista.datos.movimientos`. `onClose` limpia el
estado: la persona sigue en Alertas o Inicio. "Lotes en revisión" no cambia (ya muestra el lote y tiene
su propia acción).

**Rationale**: `InsumoDetalle` recibe lotes y movimientos por props y tiene `onClose`, así que no hace
falta navegar a Inventario ni compartir estado entre vistas (sin store nuevo, Constitución II).

*Corregido al implementar*: `InsumoDetalle` no es un componente superpuesto, sino una `Card` que
Inventario muestra en línea al final de la página. En Alertas o Inicio quedaría fuera de la vista, así que
`DetalleDesdeAlerta` lo envuelve en el `BottomSheet` existente (hoja en móvil, modal centrado desde
tablet), con el título "Detalle del insumo". `InsumoDetalle` recibe `enHoja` para ocultar su propia X
(la hoja ya trae "Cerrar"); en Inventario no cambia. Con la vista del lugar del renglón, en "Todos" el detalle muestra los lotes de ese
lugar (edge case de la spec).

**Stock bajo también abre el detalle**: la spec solo lo exige para caducidad (FR-009). Se incluye porque
es el mismo componente de renglón y así todos los renglones de Alertas se comportan igual; no agrega
pantallas ni datos. Si se prefiere acotar, basta con no envolver esos renglones.

**Alternatives considered**: navegar a Inventario con el insumo seleccionado (requiere estado compartido
entre vistas y saca a la persona de Alertas); hoja nueva con lotes (duplica el detalle; descartado en
Clarifications).

## R6 — Etiqueta "Sin stock"

**Decision**: `etiquetaStockBajo(stockActual)` en `src/features/alertas/lib/etiquetaStock.ts` devuelve
`{ texto: 'Sin stock', variante: 'danger', icono: CircleAlert }` con stock ≤ 0 y
`{ texto: 'Bajo mínimo', variante: 'warning-30', icono: AlertTriangle }` en otro caso. La usan
`AlertasView` y `FilaAlerta` de `InicioView` (reemplaza "Stock crítico").

**Rationale**: un solo criterio para las dos pantallas (FR-011, FR-012). `InsumoCard` ya usa "Sin stock"
para el estado `sin-stock` de Inventario, así que el término queda unificado en toda la app.

**Alternatives considered**: reutilizar `computeEstadoInsumo` de Inventario (mezcla caducidad y stock; la
alerta solo necesita la parte de stock).

## R7 — Posición del interruptor "¿Caduca?"

**Decision**: mover el bloque del interruptor (`role="switch"`) dentro de la tarjeta del lote en
`AltaMaterialView`, después de "Proveedor" e inmediatamente antes del bloque condicional de "Fecha de
vencimiento". Cambiar la etiqueta "Sujeto a caducidad" por "¿Caduca?" (la de `EditarInsumoForm`).
`toggleCaduca` y la validación no cambian (FR-014).

**Rationale**: el orden del DOM define el orden visual y el de foco (FR-013) sin `tabIndex` ni CSS de
reordenamiento. `ORDEN_CAMPOS` (enfoque del primer error) no incluye el interruptor, así que no cambia.

**Alternatives considered**: ponerlo arriba de la tarjeta del lote (separa la decisión de la fecha a la
que afecta).

## R8 — Pruebas de la rueda en jsdom

**Decision**: jsdom no simula el cambio de valor por la rueda, así que las pruebas verifican el
mecanismo: con el campo enfocado y un valor escrito, `fireEvent.wheel` deja el campo sin foco
(`document.activeElement !== input`) y con el mismo valor; escribir (`fireEvent.change`) y los botones
+ y − del `Stepper` siguen cambiando el valor. jsdom tampoco aplica las flechas a un `type="number"`
(y el proyecto no usa `user-event`), así que las flechas, la rueda real y el desplazamiento de la
página se verifican a mano en Chrome y Firefox (quickstart, SC-006).

**Rationale**: la prueba falla si alguien quita el `onWheel` o usa un `input` suelto, que es lo que hay
que proteger.

**Resultado (2026-10-22, T030)**: control en Chromium headless (Playwright) con la rueda real del mouse:
un `type="number"` normal enfocado pasa de 200 a 199 y la página no se mueve; con el `blur()` de
`NumeroInput` sigue en 200 y la página se desplaza 100 px. En la app (alta de material, comando `wheel`
de `run-indentory`): stock inicial, mínimo y precio sin cambios, foco suelto y el formulario se desplaza
120 px; la flecha ↑ con el foco sigue sumando (200 → 201). Prueba manual en un navegador de escritorio (2026-10-22): la rueda no
cambia los campos numéricos.
