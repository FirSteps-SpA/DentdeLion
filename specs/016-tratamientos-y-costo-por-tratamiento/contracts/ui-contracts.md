# Contract: interfaz — Tratamientos

Controles ≥ 48 × 48 px (Constitución III), tokens del DS (spec 013), montos con `formatearCLP`
(spec 015), sin cámara (Constitución V), todo sin red (FR-020). Toda ganancia se rotula
**"Ganancia estimada"** con la nota "No es utilidad contable" (FR-010).

## 1. Navegación (DS §29, R7)

- Sidebar: Inicio, Inventario, **Tratamientos**, Compras, Alertas, Ajustes.
- Barra inferior móvil: Inicio, Inventario, **Tratamientos**, Alertas, Más. "Más" suma Compras.

## 2. Lista de tratamientos

- Pestañas: **Tratamientos** | **Historial**.
- Cada fila/tarjeta: nombre, precio en el lugar activo (o "Sin precio en este lugar"), costo de
  materiales (o "desde $X" si incompleto), "Ganancia estimada" (o el motivo: "Sin precio" / "Define
  el % profesional del lugar"), y el botón **Registrar** (48 px).
- En "Todos": la ganancia por lugar; "Registrar" pregunta el lugar.
- Administración: botón **+ Tratamiento**; "Mostrar desactivados".

## 3. Formulario de tratamiento (administración)

- Nombre.
- **Precios por lugar**: una fila por lugar activo con su campo de precio (vacío = sin precio).
- **Materiales**: buscador del catálogo (`SearchPicker`) + `Stepper` de cantidad con sufijo de la
  unidad de consumo; quitar material. Insumos dados de baja se marcan.
- Vista previa en vivo: costo de materiales y ganancia estimada en el lugar activo.
- Desactivar / reactivar.

## 4. Detalle del tratamiento

- Tabla de materiales: cantidad, costo unitario, costo (o "Sin precio").
- Bloque de montos (DS §27): precio en el lugar, comisión profesional (precio × %), costo de
  materiales, **Ganancia estimada** (negativa en rojo con signo).
- Historial de cambios del tratamiento (autor, fecha, campo).

## 5. Registrar realizado

Panel (`BottomSheet`):

```text
Registrar Restauración clase II
Lugar: Clínica Providencia
Anestesia Articaína 4%   [-] 1 cartucho  [+]   (disponible: 120)
Resina A2                [-] 2 g         [+]   (disponible: 1,5)  ⚠ falta 0,5 g
...
Costo de materiales $3.480 · Ganancia estimada $14.520
[Cancelar] [Registrar]
```

- Cantidades estándar editables (incluso 0). Si falta stock: el material se marca, se muestra lo
  disponible y "Registrar" queda deshabilitado hasta ajustar (FR-015).
- Tras registrar: aviso "Registrada Restauración clase II" con **Deshacer** (como "Consumir 1").

## 6. Historial

- Filtro hoy / esta semana / este mes; lista con fecha, tratamiento, autor, costo, ganancia
  estimada; anulados tachados con "Anulado por X".
- Totales del período: cantidad, Σ precios, Σ costo de materiales, Σ ganancia estimada.
- Cada registro: **Deshacer** (si no está anulado).

## 7. Ajustes → Lugares de trabajo

- Al editar un lugar: **% profesional** (0–100) y el % de la clínica como resto ("Clínica: 60 %").
  Solo administración.

## 8. Historial del lote

- Los consumos de un tratamiento se ven como "Restauración clase II · 1 cartucho" (FR-018).
