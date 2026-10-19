# Contract: Interfaz de lugares, equipo, invitaciones y traslados

**Feature**: 014-multi-tenant-y-lugares-de-trabajo

## `SelectorLugar` (barra superior en tablet y desktop; encabezado en móvil)

- Se muestra **solo** si el tenant tiene 2 o más lugares activos (FR-008). Con uno solo, el chip
  muestra el nombre del lugar, sin menú.
- Es un botón de al menos 48 px con el nombre del lugar activo y `ChevronDown`. Abre un menú, que es
  un `BottomSheet` en móvil y un dropdown con `shadow-dropdown` en tablet y desktop, con:
  - "Todos los lugares";
  - un separador;
  - un ítem por lugar activo, el activo con `CircleCheck`.
- Al elegir, actualiza `lugarStore` y las vistas sin recargar (SC-004).

## Vista "Todos"

- **Inicio**: los KPIs suman todos los lugares; cada ítem de las listas muestra un chip con su lugar.
- **Inventario**: las tarjetas y la tabla muestran el stock por lugar ("Providencia 4 · Las Condes
  2") y el estado del peor lugar.
- **Alertas y Compras**: cada fila lleva el chip de su lugar.
- **Acciones que modifican stock**: "Consumir 1", "+ Material", recepción de compras y traslado abren
  primero "¿En qué lugar?" (un `BottomSheet` con los lugares) y después siguen el flujo normal en ese
  lugar (FR-014).

## Ajustes → "Lugares de trabajo" (solo administrador; reemplaza "Clínica")

- Nombre del tenant, editable.
- Lista de lugares: nombre editable en línea, "Desactivar" / "Reactivar", y el contador de insumos
  con stock.
- "+ Nuevo lugar": nombre (1–60 caracteres, único sin distinguir mayúsculas).
- Desactivar un lugar con stock pide confirmación: "Su stock dejará de verse en el selector". No
  permite desactivar el último lugar activo.

## Ajustes → "Equipo" (solo administrador)

- Lista de personas: nombre, correo, rol y estado, con "Cambiar rol" y "Desactivar" / "Reactivar".
  No permite dejar el tenant sin administradora.
- "+ Invitar":
  - campos: correo y rol (personal o administrador);
  - crea la invitación y muestra el enlace con tres botones de al menos 48 px: **"Enviar por
    correo"** (`mailto:` con asunto y texto en español), **"WhatsApp"** (`https://wa.me/?text=…`) y
    **"Copiar enlace"**;
  - aviso: "El enlace vence en 7 días".
- "Invitaciones pendientes": correo, rol, fecha de vencimiento, "Revocar" y "Reenviar", que genera un
  enlace nuevo y revoca el anterior.

## Pantalla de invitación (`/?invitacion=<token>`, sin sesión)

- Logo, "Te invitaron a {tenant}" y el correo en solo lectura.
- Campos "Tu nombre", "Contraseña" y "Repite la contraseña", con la regla visible "Mínimo 10
  caracteres, con letras y números".
- Botón "Unirme". Si sale bien, inicia sesión y entra a Inicio.
- Errores en línea según el código de la Edge Function:
  - "Esta invitación venció; pide una nueva";
  - "Esta invitación ya no es válida";
  - "Este correo ya pertenece a otro cliente de Dentdelion".

## Traslado ("Trasladar" en el menú de opciones de un insumo, solo si hay 2 o más lugares)

- `BottomSheet` "Trasladar {insumo}" con:
  - lote (por defecto, el de vencimiento más próximo con stock en el lugar activo, FEFO);
  - destino (los otros lugares activos);
  - cantidad (`Stepper`, con el máximo igual al stock del lote en el origen).
- Botón "Trasladar". Muestra el aviso "Trasladado {n} {unidad} a {destino}" con "Deshacer" (spec 007).
- El historial del lote muestra "Traslado → {destino}" o "Traslado ← {origen}".

## Usuario sin acceso

Si el perfil está desactivado, o el tenant no tiene lugares activos, se muestra la pantalla
"Tu acceso a Dentdelion está desactivado. Contacta a tu administradora." con "Cerrar sesión".
