# Contrato UI: Guía de uso

## Botón

- `button`, ícono `CircleHelp`, variante ghost, 48 × 48 px, `aria-label="Ayuda de <pantalla>"`,
  `aria-haspopup="dialog"`. Último elemento del espacio de acciones del encabezado.

## Hoja

- `BottomSheet` con título "Ayuda: <pantalla>".
- `h3` "Para qué sirve" + párrafo.
- `h3` "Cómo se hace…" + por tarea: `h4` con el nombre (y la etiqueta "Solo administración" para
  administración) y `ol` con los pasos.
- `h3` "Consejos" + `ul`.
- Botón "Entendido" al pie, que cierra.

## Ajustes → "Guía de uso"

- Tarjeta en el índice para ambos roles.
- Un `details` por pantalla visible para el rol (`summary` = nombre de la pantalla) con el mismo
  contenido que la hoja.

## Persistencia

- `localStorage["dentdelion:ayudas-vistas:<usuarioId>"]` = JSON `string[]` de ids.
