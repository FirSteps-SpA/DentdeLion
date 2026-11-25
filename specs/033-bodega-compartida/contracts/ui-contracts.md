# Contract: UI

## §1 Ajustes → Lugares (administración)

- Cada lugar activo muestra "Comparte bodega con Box 1" cuando aplica, o nada.
- Acción **"Compartir bodega con…"** (con 2+ lugares activos): hoja con la lista de los otros lugares
  activos. Si uno ya está en una bodega, se muestra como "Box 1 + Box 2".
- **Confirmación de juntar**: "El stock de Box 1 y Box 2 se sumará: N insumos con stock en ambos
  pasarán a un solo total". Si hay mínimos distintos, una lista "Insumo · Box 1: 5 · Box 2: 3"
  con un selector por fila (por defecto el mayor). Botones "Compartir bodega" / "Cancelar".
- Acción **"Dejar de compartir bodega"**: confirmación "El stock común se queda en Box 1. Box 2
  empezará en 0; podrás trasladarle stock después".
- **Desactivar** un lugar que comparte bodega: la confirmación existente agrega "Primero se separará
  de la bodega".
- Personal no ve estas acciones.

## §2 Selector de lugar y encabezado

- Un lugar de una bodega compartida se muestra "Box 2 · bodega con Box 1" en la lista del selector.
  La pastilla del encabezado mantiene solo el nombre.

## §3 Inventario, Alertas, Compras, Inicio

- Mismo comportamiento que hoy, con los datos de la bodega.
- En **"Todos"** el desglose por lugar usa el rótulo de la bodega ("Box 1 + Box 2: 6 · Las Condes 2").
- **Compras** en una bodega compartida: cada ítem manual muestra "Agregado en Box 1".

## §4 Traslado

- Los destinos excluyen los lugares de la misma bodega. Si todos los otros lugares están en la
  bodega, la acción "Trasladar" no aparece.

## §5 Reportes

- **Valor del inventario**: con un lugar de una bodega compartida, debajo del total va "Stock
  compartido con Box 1". En "Todos", una fila por bodega ("Box 1 + Box 2") y una por lugar
  independiente.
- Consumo, gasto y costo por tratamiento: sin cambios (por lugar del movimiento).
