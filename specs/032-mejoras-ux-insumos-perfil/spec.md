# Feature Specification: Mejoras de UX en Nuevo insumo, perfil y tabla de inventario

**Feature Branch**: `[032-mejoras-ux-insumos-perfil]`

**Created**: 2026-11-24

**Status**: Draft

**Input**: User description: "Ideas II, III y IV de `notes.txt`: fijar el encabezado de la tabla de
insumos al hacer scroll; al tocar el ícono del perfil, un pop-up con Ver perfil y Cerrar sesión, y
poder editar el nombre del dentista en Ajustes → Perfil; en Nuevo insumo, nombres más intuitivos para
las unidades ('cómo se consume', 'cómo lo compras/cómo viene'), una nota en stock mínimo ('alerta
cuando el stock cae bajo este límite'), stock mínimo y stock inicial mostrados en unidad de consumo y
de compra lado a lado con conversión automática, un ejemplo (ácido fosfórico 37,5 %) y ocultar el
campo código de barras mientras el escáner esté oculto."

**Origen**: lista de ideas de DentdeLion posterior al release 2.11.0.

## Contexto

Quien da de alta un insumo por primera vez no entiende "Unidad de consumo" ni "Se compra por" sin
que se lo expliquen. El stock mínimo no dice para qué sirve y solo se escribe en la unidad de consumo,
mientras que el stock inicial se escribe en la unidad que se elija. Por eso hay que hacer la
conversión de cabeza (¿cuántos ml son 3 jeringas?). El formulario también pide un código de barras,
aunque el escáner está oculto desde hace varias versiones.

El avatar con las iniciales en el encabezado parece un botón, pero no hace nada. Para cerrar sesión
o ver el perfil hay que ir a Ajustes → Perfil, donde además el nombre no se puede cambiar. La spec 011
(FR-006/007) dejó "Cerrar sesión" solo en Ajustes para no duplicarlo. Esta spec revierte esa decisión
a pedido de la clienta: el acceso rápido desde el avatar es un atajo, y Ajustes → Perfil sigue siendo
el lugar completo.

En listas largas de inventario en vista de tabla (desktop/tablet), al bajar se pierde de vista qué
columna es cuál.

**Fuera de alcance**: cambiar correo o contraseña desde Perfil; foto de perfil; reactivar el escáner
de códigos; precargar insumos de ejemplo en el catálogo; cambios en la vista de tarjetas (móvil) del
inventario; cambiar la unidad o la presentación de un insumo ya creado (sigue como hoy).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Dar de alta un insumo sin tener que entender la jerga de la app (Priority: P1)

Como dentista que crea su primer insumo, quiero que el formulario me pregunte en palabras simples cómo
uso y cómo compro el material, y que me muestre el stock en ambas unidades, para no equivocarme con
las cantidades.

**Why this priority**: El alta es la primera tarea de toda clienta nueva. Si las cantidades quedan mal,
el stock, las alertas y los costos salen mal desde el inicio.

**Independent Test**: Crear "Ácido fosfórico 37,5 %" (Restauración), que se compra por jeringa, se usa
por ml y trae 3 ml por jeringa. Escribir stock inicial "3" en jeringas: el campo en ml muestra 9.
Escribir stock mínimo "0,5" en ml: el campo en jeringas muestra 0,17. Guardar. El detalle muestra
9 ml (3 jeringas) y el mínimo 0,5 ml.

**Acceptance Scenarios**:

1. **Given** el formulario Nuevo insumo, **When** se mira la sección de presentación, **Then** los
   rótulos son "¿Cómo lo usas?" (antes "Unidad de consumo"), "¿Cómo lo compras?" (antes "Se compra
   por") y "¿Cuánto trae cada <unidad de compra>?" (antes "Contenido: … por …"), cada uno con una
   ayuda breve de una línea.
2. **Given** la sección de presentación, **When** se abre el formulario, **Then** se ve un ejemplo
   plegable ("Ver un ejemplo") con el ácido fosfórico 37,5 %: categoría Restauración, se compra por
   jeringa, se usa por ml, 3 ml por jeringa, stock inicial 3 jeringas = 9 ml, mínimo 0,5 ml. El ejemplo
   no llena ningún campo.
3. **Given** el campo Stock mínimo, **When** se mira, **Then** tiene la ayuda "Te avisamos cuando el
   stock baje de este número".
4. **Given** un insumo cuya unidad de compra es distinta de la de consumo, **When** se miran Stock
   inicial y Stock mínimo, **Then** cada uno muestra dos campos lado a lado: uno en la unidad de compra
   y otro en la de consumo.
5. **Given** esos campos dobles, **When** se escribe en uno, **Then** el otro se actualiza al instante
   con la conversión según el contenido por unidad de compra. Si después cambia el contenido, el campo
   que la persona escribió por última vez se mantiene y el otro se recalcula.
6. **Given** la unidad de compra igual a la de consumo, **When** se miran esos campos, **Then** se ve
   un solo campo, como hoy.
7. **Given** el formulario Nuevo insumo o Editar insumo, **When** se recorre, **Then** no aparece el
   campo de código de barras / código de fabricante.
8. **Given** Editar insumo, **When** se mira el stock mínimo y la presentación, **Then** usan los mismos
   rótulos, ayudas y campos dobles que Nuevo insumo.

---

### User Story 2 - Atajo de perfil y editar mi nombre (Priority: P2)

Como persona del equipo, quiero tocar mi avatar para ir a mi perfil o cerrar sesión, y poder corregir
cómo aparece mi nombre.

**Why this priority**: Es un atajo que se espera en cualquier app. Además, el nombre aparece en el
historial de cada movimiento, y hoy solo administración puede corregirlo.

**Independent Test**: Tocar el avatar → aparece un menú con "Ver perfil" y "Cerrar sesión". "Ver
perfil" abre Ajustes → Perfil. Cambiar el nombre a "Dra. Ana Pérez" y guardar: las iniciales del avatar
cambian a "AP", y otro dispositivo de la misma persona ve el nombre nuevo tras sincronizar.

**Acceptance Scenarios**:

1. **Given** cualquier pantalla autenticada (encabezado en móvil o barra superior en desktop/tablet),
   **When** se toca el avatar, **Then** se abre un menú pequeño anclado al avatar con el nombre y el
   correo de la persona, "Ver perfil" y "Cerrar sesión".
2. **Given** el menú abierto, **When** se toca "Ver perfil", **Then** se abre Ajustes → Perfil y el
   menú se cierra.
3. **Given** el menú abierto, **When** se toca "Cerrar sesión", **Then** ocurre lo mismo que con el
   botón de Ajustes → Perfil, incluido el aviso si hay cambios sin sincronizar.
4. **Given** el menú abierto, **When** se toca fuera de él o se presiona Escape, **Then** se cierra sin
   hacer nada.
5. **Given** Ajustes → Perfil, **When** se toca "Editar nombre", se escribe un nombre nuevo y se
   guarda, **Then** el nombre se actualiza en Perfil, en el avatar y en los movimientos futuros.
6. **Given** un nombre vacío o de solo espacios, **When** se intenta guardar, **Then** se muestra un
   error y no se guarda.
7. **Given** una persona con rol personal (no administración), **When** edita su nombre, **Then**
   puede hacerlo, pero no puede cambiar su rol ni el nombre de otra persona.

---

### User Story 3 - Encabezado de la tabla fijo al bajar (Priority: P3)

Como persona que revisa un inventario largo en desktop o tablet, quiero que los nombres de las
columnas sigan visibles al bajar, para saber qué estoy leyendo.

**Why this priority**: Es una comodidad. No bloquea ninguna tarea.

**Independent Test**: En la vista de tabla con 30 o más insumos, bajar hasta el final. El encabezado
(Insumo, Categoría, Stock, …) queda pegado bajo la barra superior durante todo el recorrido.

**Acceptance Scenarios**:

1. **Given** la tabla de inventario con más filas de las que caben en pantalla, **When** se baja,
   **Then** la fila de encabezados queda fija justo debajo de la barra superior, con fondo opaco.
2. **Given** una tabla más ancha que la pantalla, **When** se desplaza hacia el costado, **Then** el
   encabezado se mueve junto con las columnas.
3. **Given** la tabla con paginación ("Ver más"), **When** se cargan más filas, **Then** el encabezado
   sigue fijo.

---

### Edge Cases

- **Conversión con una unidad que no admite decimales** (por ejemplo, cajas → unidades): el campo en
  esa unidad redondea hacia arriba en el stock mínimo (para no avisar tarde) y muestra el valor exacto
  en el stock inicial solo si es entero. Si no lo es, muestra el equivalente con hasta 2 decimales y
  una nota "≈". Lo que se guarda siempre es la cantidad en la unidad de consumo.
- **Contenido por unidad de compra vacío o 0**: el segundo campo queda deshabilitado con la ayuda
  "Completa cuánto trae cada <unidad>" hasta que haya un contenido válido.
- **Stock mínimo vacío** (es opcional): ambos campos quedan vacíos. Borrar uno borra el otro.
- **Cerrar sesión sin conexión con cambios pendientes**: mismo comportamiento y aviso que hoy en
  Ajustes → Perfil.
- **Editar el nombre sin conexión**: se guarda en el dispositivo y se sube al sincronizar. Los
  movimientos ya registrados conservan el nombre con que se hicieron, como hoy.
- **Usuario desactivado mientras tiene el menú abierto**: al sincronizar se aplica el flujo de acceso
  desactivado que ya existe.
- **Insumo antiguo con código de barras guardado**: el código se conserva sin cambios aunque el campo
  esté oculto, y editar otros datos no lo borra.

## Requirements *(mandatory)*

### Functional Requirements

**Nuevo/Editar insumo (US1)**

- **FR-001**: Los rótulos de presentación DEBEN pasar a "¿Cómo lo usas?", "¿Cómo lo compras?" y
  "¿Cuánto trae cada <unidad de compra>?", con una ayuda de una línea cada uno, en Nuevo y Editar
  insumo.
- **FR-002**: El formulario Nuevo insumo DEBE ofrecer un ejemplo plegable (cerrado por defecto) con el
  caso del ácido fosfórico 37,5 % descrito en US1, sin llenar ningún campo.
- **FR-003**: El campo Stock mínimo DEBE mostrar la ayuda "Te avisamos cuando el stock baje de este
  número".
- **FR-004**: Cuando la unidad de compra es distinta de la de consumo, Stock inicial y Stock mínimo
  DEBEN mostrar dos campos lado a lado (unidad de compra y unidad de consumo) que se convierten
  automáticamente y en vivo según el contenido por unidad de compra.
- **FR-005**: La cantidad guardada DEBE ser siempre la de la unidad de consumo. Los campos dobles son
  solo una forma de escribirla.
- **FR-006**: El campo de código de barras / código de fabricante DEBE ocultarse en Nuevo y Editar
  insumo mientras el escáner esté oculto, sin borrar los códigos ya guardados.

**Perfil (US2)**

- **FR-007**: El avatar del encabezado (móvil) y de la barra superior (desktop/tablet) DEBE ser un
  botón que abre un menú con nombre, correo, "Ver perfil" y "Cerrar sesión".
- **FR-008**: "Cerrar sesión" del menú DEBE tener el mismo comportamiento que el de Ajustes → Perfil.
- **FR-009**: Toda persona activa DEBE poder editar su propio nombre desde Ajustes → Perfil. El
  servidor DEBE permitir que cada persona cambie solo su nombre, no su rol, su tenant ni su estado.
- **FR-010**: El nombre editado DEBE reflejarse en el avatar, en Perfil y en Ajustes → Equipo, y usarse
  como autor de los movimientos nuevos.

**Tabla (US3)**

- **FR-011**: La fila de encabezados de la tabla de inventario DEBE quedar fija bajo la barra superior
  al desplazarse verticalmente y acompañar el desplazamiento horizontal.

**Comunes**

- **FR-012**: Todo control nuevo (avatar, opciones del menú, ejemplo plegable, campos dobles) DEBE
  tener un área táctil mínima de 48×48 px (Constitución III).
- **FR-013**: Todo DEBE funcionar sin conexión (Constitución I). El cambio de nombre se sincroniza como
  el resto de los datos.
- **FR-014**: El menú del avatar DEBE poder usarse con teclado (abrir, recorrer opciones y cerrar con
  Escape) y lectores de pantalla.

### Key Entities

- **Perfil**: nombre, correo, rol y estado de una persona del tenant. Cambia solo en que la propia
  persona puede editar su nombre.
- **Presentación del insumo**: unidad de consumo, unidad de compra y contenido por unidad de compra.
  Sin cambios de datos; solo cambian los rótulos y la forma de escribir las cantidades.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Una persona que nunca usó la app crea el insumo del ejemplo con stock inicial y mínimo
  correctos al primer intento, sin ayuda externa.
- **SC-002**: Ninguna conversión entre los dos campos se desvía más de 0,01 de la unidad de consumo
  respecto del cálculo exacto.
- **SC-003**: Cerrar sesión o llegar al perfil toma 2 toques desde cualquier pantalla (hoy toma 3 o
  más).
- **SC-004**: El cambio de nombre se ve en todos los dispositivos de la persona tras la siguiente
  sincronización.
- **SC-005**: Con 100 filas en la tabla, el encabezado sigue visible durante todo el desplazamiento.

## Assumptions

- Hoy solo administración puede actualizar perfiles en el servidor, así que FR-009 requiere un cambio
  acotado de permisos para que cada persona edite solo su propio nombre.
- Los textos propuestos ("¿Cómo lo usas?", etc.) son una primera versión. Se pueden ajustar en la
  revisión sin cambiar el alcance.
- La idea original pide ocultar el código de barras en Nuevo insumo. Se oculta también en Editar
  (donde se llama "Código de fabricante") para ser consistentes. Los códigos guardados se conservan y
  vuelven a mostrarse cuando se reactive el escáner.
- El ejemplo se muestra solo en Nuevo insumo. En Editar ya hay datos reales que sirven de referencia.
- La guía de uso (spec 030) se actualiza con los rótulos nuevos.
- "Cerrar sesión" en Ajustes → Perfil se mantiene. La spec 011 FR-006/007 queda reemplazada en ese
  punto.
