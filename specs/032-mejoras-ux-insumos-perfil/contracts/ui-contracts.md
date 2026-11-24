# Contract: UI

## §1 `PresentacionFields` (Alta y Editar)

| Antes | Ahora | Ayuda (1 línea, `text-xs text-text-muted`) |
|---|---|---|
| Unidad de consumo | ¿Cómo lo usas? | Stock, mínimo y consumos se cuentan en esta unidad. |
| Se compra por | ¿Cómo lo compras? | Cómo viene del proveedor. "Igual" si lo compras y usas en la misma unidad. |
| Contenido: ml por jeringa | ¿Cuánto trae cada jeringa? | Cuántos ml trae cada jeringa. |

La opción "Igual que la de consumo" pasa a "Igual que como lo uso".

## §2 Ejemplo (solo Alta)

`<details>` cerrado por defecto, `summary` "Ver un ejemplo" (≥ 48 px), encima de la presentación:

> **Ácido fosfórico 37,5 %** · Restauración
> Lo compras por **jeringa** y lo usas por **ml**; cada jeringa trae **3 ml**.
> Stock inicial: 3 jeringas = 9 ml · Stock mínimo: 0,5 ml (te avisamos al bajar de media jeringa
> aprox.)

No llena campos.

## §3 `CantidadDobleField`

```
Stock inicial
┌───────────────┐ ┌───────────────┐
│ 3             │ │ ≈ 9           │
│ jeringas      │ │ ml            │
└───────────────┘ └───────────────┘
```

- Props: `id`, `label`, `ayuda?`, `presentacion`, `valor: CantidadDoble`, `onChange`, `opcional?`,
  `error?`.
- Dos columnas (`grid-cols-2`, ≥ 48 px de alto). Cada input tiene su `aria-label` ("Stock inicial en
  jeringas" / "… en ml"). El derivado se anuncia con `aria-live="polite"`.
- Stock mínimo: `ayuda` = "Te avisamos cuando el stock baje de este número". `opcional`: vaciar uno
  vacía el otro.
- Unidades iguales: un solo input con la unidad como sufijo.

## §4 `MenuPerfil`

- Disparador: el avatar actual (iniciales) como `<button aria-haspopup="menu" aria-expanded
  aria-label="Menú de <nombre>">`, área táctil ≥ 48 px.
- Panel anclado bajo el avatar, alineado a la derecha, `role="menu"`: cabecera no interactiva (nombre
  y correo), `menuitem` "Ver perfil" y `menuitem` "Cerrar sesión".
- Teclado: Enter/Espacio abre; ↑/↓ recorre; Escape cierra y devuelve el foco al avatar. Click fuera
  cierra.
- "Ver perfil" → `irASeccionAjustes('perfil')`. "Cerrar sesión" → `useLogout().signOut()`.

## §5 `PerfilSection`

- El nombre muestra un botón "Editar nombre" que lo pasa a un input (máx. 80) con
  Guardar/Cancelar.
- Errores: "Escribe tu nombre." (vacío), "Necesitas conexión para cambiar tu nombre." (sin cliente o
  falla de red).
- Éxito: se actualizan el texto y las iniciales del avatar sin recargar.

## §6 `InventarioTabla`

Contenedor `overflow-x-clip`; `th` con `sticky top-[72px] z-10 bg-surface`; borde inferior del
encabezado visible al quedar fijo (`shadow-[inset_0_-1px_0_var(--color-border)]`, porque el borde de
la fila no acompaña al `th` fijo).
