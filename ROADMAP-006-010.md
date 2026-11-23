# Roadmap: Evolución hacia Listado Operativo + Acciones Rápidas

**Estado**: Borrador de planificación (aún no formalizado como specs)

**Contexto**: Evolucionar la arquitectura de la PWA hacia una experiencia más práctica en clínica, cambiando el modelo actual basado en "transacciones" (pantallas separadas Registrar/Consumir) hacia un modelo centrado en **Listado Operativo + Acciones Rápidas**, resolviendo la mezcla de responsabilidades en Alertas y simplificando el flujo de consumo.

---

## 1. Plan de próximas specs (en orden de implementación)

### 006 — Rediseño de Navegación e Vista Principal de Insumos (Dashboard & Listado)

Transición de la navegación actual a una vista principal por defecto basada en un listado unificado de insumos con barra de búsqueda, filtros avanzados por categoría/estado y un resumen superior compacto de alertas. Permite consultar el detalle completo de cada material.

### 007 — Acciones Rápidas: Consumo Directo (Shortcut) y Edición/Eliminación

Implementación de acciones directas desde la lista principal para consumir la unidad/insumo completo con un solo toque (swipe o botón dedicado) para el caso de uso más frecuente, además de modales/pantallas para editar datos del producto y eliminación (soft delete o baja).

### 008 — Formulario Unificado para Creación de Nuevo Material

Reestructuración de la vista para dar de alta nuevos materiales en el catálogo, incorporando un selector desplegable de categorías, configuración de umbrales de stock mínimo y la opción de vincular lotes/fechas de vencimiento iniciales.

**Categorías reales de la clínica (a precargar en el selector desplegable)**: Cirugía, Restauración, Tratamientos pulpares, Fresas.

### 009 — Gestión de Lista de Compras (Reabastecimiento)

Nueva vista dedicada para la gestión de compras que agrupa automáticamente productos con stock bajo o caducados, permitiendo además agregar ítems manualmente en cualquier momento y marcar ítems como reabastecidos para actualizar el stock.

### 010 — Separación de Ajustes y Configuración Global

Desacoplamiento de la sección de configuración de la pestaña de alertas para moverla a una vista/drawer propio de usuario, administrando la clínica, categorías, usuarios y preferencias de notificaciones.

---

## 2. Propuesta detallada de estructura y UI/UX de las vistas

### Nivel superior: nueva estructura de navegación inferior (Bottom Nav)

Pasamos de **[ Registrar | Consumir | Alertas ]** a **4 secciones claras**:

```
[ 📦 Inventario ]   [ 🛒 Compras ]   [ 🔔 Alertas ]   [ ⚙️ Más / Config ]
```

---

### Vista 1: Inventario (Pantalla Principal por Defecto)

Esta pantalla pasa a ser el centro neurálgico del trabajo diario en el gabinete.

**Estructura visual (de arriba a abajo)**

1. **Header Principal**
   - Título de la Clínica / Gabinete actual.
   - Avatar del usuario y botón de acción rápida `+ Material`.

2. **Banner Resumen de Estado (Compact Summary Widget)**
   - Tarjeta superior tipo carrusel o grid de 2 columnas con indicadores rápidos:
     - 🔴 **X Caducados / Próximos** (clic filtrará automáticamente la lista).
     - 🟠 **Y Sin / Bajo Stock** (clic filtrará automáticamente la lista).

3. **Barra de Búsqueda y Filtros Flotantes**
   - Input de búsqueda rápida por texto o lector (conservando el botón de escaneo opcional con cámara al final del input).
   - **Chips de Selección/Categoría (Scroll Horizontal)**: `Todos`, `Anestesia`, `Restauración`, `Protección`, etc.
   - **Filtros de Estado**: Badges conmutables `🔴 Caducados`, `🟠 Bajo Stock`, `🟢 Ok`.

4. **Listado de Insumos (Tarjetas Táctiles)**

   Cada insumo se muestra como una tarjeta compacta de alto contraste con:
   - **Badge de Categoría y Estado Visual**: Punto o borde lateral de color según su salud (Verde/Naranja/Rojo).
   - **Nombre Comercial y Lote Primario** (próximo a vencer).
   - **Indicador de Stock Grande**: Ej. `8 cajas` o `2/5 un.`.
   - **Acciones Directas en Tarjeta**:
     - **Botón Principal de Un Solo Tap `[⚡ Consumir 1]`**: Consume la unidad estándar completa de forma inmediata con *Haptic Feedback* (vibración leve) y un aviso temporal tipo *Toast* con Deshacer (Undo). *(Reemplazado por la spec 025: "Consumir" abre la hoja de consumo con cantidad 1.)*
     - **Menú de tres puntos `⋮` o Tap Largo**: Despliega opciones: *Ver Detalle / Lotes*, *Editar*, *Agregar a Compras*, *Eliminar*.

---

### Vista 2: Agregar Nuevo Material

Vista tipo formulario modal completo o pantalla limpia enfocada en agilizar el alta de productos en el catálogo.

**Estructura visual**

1. **Header Simple**: Título "Nuevo Material" con botón `Cancelar` o `Atrás`.
2. **Formulario Táctil**
   - **Menú Desplegable (Dropdown) de Categorías**: Con opción rápida de `+ Crear nueva categoría`.
   - **Nombre del Material**: Campo de texto con auto-completado/sugerencias basadas en materiales comunes.
   - **Código de Barras (Opcional)**: Campo con botón secundario de cámara `[ 📷 Escanear ]` al lado para autocompletar si existe el código.
   - **Unidad de Medida**: Selector tipo segmented control (`Caja`, `Frasco`, `Pieza`, `Cartucho`).
   - **Stock Inicial y Umbral Mínimo**: Selectores numéricos grandes con botones `+` y `-` aptos para guantes.
   - **Switch Toggle "Sujeto a Caducidad"**: Al activarse, despliega el campo para el primer Lote y Fecha de Vencimiento.
3. **Botón Flotante Fijo**: `[ Guardar e Ingresar ]`.

---

### Vista 3: Lista de Compras (Reabastecimiento)

Vista diseñada para cuando el administrador o asistente debe hacer los pedidos a proveedores.

**Estructura visual**

1. **Header y Acción Manual**
   - Título "Lista de Compras" y botón `[ + Añadir Ítem Manual ]`.
2. **Secciones del Listado**
   - **Sugeridos por el Sistema (Automáticos)**: Insumos que cayeron por debajo del stock mínimo o que se marcaron como caducados. Badge distintivo: `🟠 Stock Mínimo` o `🔴 Caducado`.
   - **Agregados Manualmente**: Ítems no catalogados o compras puntuales solicitadas por el personal (badge `✏️ Manual`).
3. **Interacción de Chequeo**
   - Cada ítem tiene un *checkbox* amplio para marcar como "Comprado / Recibido".
   - Al marcar un ítem automático como "Recibido", la app abre un flujo rápido para actualizar el lote/caducidad e ingresar las unidades directo al inventario activo.
4. **Exportación / Acción Rápida**: Botón para `Compartir Lista (PDF / WhatsApp)` con los proveedores.

---

## Próximos pasos

Cuando se quiera formalizar, cada bloque de arriba se convierte en una spec bajo `specs/00N-slug/spec.md` vía la skill `speckit-specify`, en el orden indicado (006 → 007 → 008 → 009 → 010), dado que 007-010 dependen de la nueva navegación/listado introducida en 006.
