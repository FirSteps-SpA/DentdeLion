# Quickstart: validar la spec 024

## Pruebas automáticas

```bash
npm run lint
npm run build       # tsc -b + vite build
npm test            # incluye lecturas-movimientos.test.ts (arquitectura)
```

Las pruebas nuevas y ajustadas están en [contracts/ui-contracts.md §6](./contracts/ui-contracts.md).
No hay migración, así que `npm run test:rls` no cambia. Igual conviene correrlo si hay entorno local de
Supabase, para confirmar que un `ajuste` sin origen sube con el rol de personal.

## Recorrido manual (skill `run-indentory`)

Datos: un insumo que caduca, "Guantes", unidad `caja`, con un lote **L-OLD** de 4 cajas vencido ayer en
el lugar activo, y un mínimo de 2.

1. **Caso reportado (US1)**: en Compras, "Guantes" aparece como sugerido por **Vencido**. Tocar
   Recibir y comprobar que aparece "Descartar stock vencido (4 cajas)", marcada, con "Lote L-OLD
   (venció …)". Completar 1 caja, lote L-NEW, vence el año próximo, y confirmar.
   - Inventario: "Guantes" muestra 1 caja, no Caducado (Bajo stock, porque el mínimo es 2).
   - Compras: ya no está como Vencido. Sigue como Bajo stock, lo cual es correcto.
   - Detalle: en L-OLD, "Ajuste de stock: −4 cajas · hoy · <tu nombre>".
2. **Casilla desmarcada**: repetir el escenario con datos nuevos y desmarcar. Resultado: 5 cajas y
   Caducado, como en 2.6.0.
3. **Stock por lote (US2)**: como admin, abrir Editar de "Guantes", cambiar L-NEW a 3 y guardar. El
   stock total queda en 3 y el detalle muestra "Ajuste de stock: +2 cajas". Escribir 1,5 en un insumo
   sin decimales: el error aparece bajo el lote y no se guarda nada (tampoco un cambio de nombre hecho
   a la vez).
4. **Personal**: entrar como personal. No hay Editar, así que tampoco Stock por lote. La casilla de la
   recepción sí aparece.
5. **Eliminar desde Editar (US3)**: Editar → cambiar el nombre → Eliminar insumo → Cancelar. El
   nombre cambiado sigue en el formulario. Eliminar insumo → Eliminar: el insumo desaparece del
   inventario.
6. **Todos los lugares**: con dos lugares y un lote con stock en ambos, Editar en "Todos" muestra dos
   renglones con el nombre de cada lugar.
7. **Sin conexión**: en modo avión, repetir el paso 1. Se guarda, el indicador de sync muestra
   pendientes y al reconectar se sube.
8. **Táctil**: capturas en teléfono, tablet y desktop de la recepción con casilla y de Stock por lote,
   comprobando objetivos de 48 px o más.

## Publicación

Sin migración ni cambio de Dexie, así que no hay pasos de despliegue de base. Los clientes 2.6.0 en
caché ya suman los `ajuste` en el stock (`computeStockLote`), de modo que ven bien los descartes hechos
desde 2.7.0. Lo único que no muestran es la línea del historial.
