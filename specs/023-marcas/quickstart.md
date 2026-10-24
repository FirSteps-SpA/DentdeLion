# Quickstart: Marcas

Guía para comprobar que la spec funciona de punta a punta. Detalle en
[contracts/supabase-schema.md](./contracts/supabase-schema.md) y
[contracts/ui-contracts.md](./contracts/ui-contracts.md).

## Requisitos

- Supabase local con la migración aplicada (`supabase db reset`).
- Dos tenants de prueba (los que siembra `test:rls`) y, en el tenant A, una cuenta de administración y
  una de personal.

## Pruebas automáticas

```bash
npm test          # unit + integración (contracts/ui-contracts.md, "Pruebas")
npm run test:rls  # marcas, marca_id protegido, historial marcaId, convivencia 2.5.0 (supabase-schema §5)
npm run lint && npm run build
```

Esperado: todo en verde, y las pruebas de la 021 (`selector-proveedor`, `ajustes-proveedores`)
**sin modificar** después de extraer `SelectorCatalogo`.

## Recorrido manual (skill `run-indentory`, teléfono 360 × 640, tablet y desktop)

1. **Ajustes → Marcas** (administración): la tarjeta aparece junto a Categorías y Proveedores, con "Sin
   marcas". Crear "3M" y "GC". El resumen pasa a "2 marcas".
2. Crear " 3m ": avisa "Ya existe una marca con ese nombre."
3. **Alta de material** "Composite Z350": el campo Marca viene en "Sin marca". Elegir "3M" con el
   buscador ("3m"). Guardar.
4. Alta de otro material: en Marca, escribir "Ivoclar" → "Agregar marca «Ivoclar»". Queda elegida; el
   resto del formulario no se borró. Guardar.
5. Alta de un tercero sin tocar Marca: se guarda sin marca, con los mismos pasos que antes (SC-001).
6. **Inventario**: "Composite Z350 · 3M" (marca en gris, sin desbordar a 360 px). Buscar "3m" → aparece
   (SC-007). Buscar "ivoclar" → aparece el segundo.
7. **Detalle del insumo**: muestra "Marca: 3M"; el tercero no muestra la fila.
8. **Editar** "Composite Z350" (administración): cambiar a "GC", guardar; luego a "Sin marca". El
   detalle refleja cada cambio.
9. **Compras**: con "Composite Z350" (de nuevo con 3M) bajo el mínimo, el sugerido se ve "Composite
   Z350 · 3M". Seleccionarlo y enviar por WhatsApp: el renglón dice "- Composite Z350 · 3M — …".
10. **Ajustes → Marcas**: "3M" muestra "1 insumo" y no ofrece Eliminar. Desactivar "3M": desaparece del
    selector, pero Z350 la sigue mostrando; al editar Z350, el campo dice "«3M» (desactivada)". En el
    alta, escribir "3m": "«3M» está desactivada." con "Reactivar y usar" solo para administración.
11. Eliminar una marca sin insumos: se elimina. Con más de 25 marcas, aparece "Ver más".
12. **Personal**: Ajustes no muestra Marcas (ni entrando por la URL); en el alta puede elegir y agregar
    una marca; no ve "Editar" en el insumo.
13. **Sin conexión** (DevTools → Offline): agregar una marca desde el alta y guardar. Al volver la
    conexión suben las dos, y otro dispositivo ve el insumo con esa marca.
14. **Duplicado sin conexión**: dos navegadores sin conexión agregan "Dentsply" en dos altas. Al
    conectar los dos, queda una sola marca y los dos insumos la usan.

## Compatibilidad con la 2.5.0 (SC-006)

1. Con la migración aplicada, en el front nuevo: poner la marca "3M" a un insumo **en el alta** (sin
   cambio en el historial) y "GC" a otro **editándolo**.
2. Servir el front de `main` (2.5.0) con otra sesión de administración: editar el stock mínimo de ambos
   y dar de alta un material nuevo.
3. En el front nuevo: los dos conservan su marca y tienen el mínimo nuevo; el material nuevo está sin
   marca. La 2.5.0 queda en "Sincronizado", sin errores.
4. **Dispositivo recién actualizado** (R3): en un navegador que estaba en la 2.5.0 con esos insumos,
   cargar el front nuevo (Dexie v13 → v14). Tras el primer ciclo, los insumos siguen con su marca en el
   servidor y en ese navegador.

## Publicación (research.md R14)

1. `npm run test:rls` en verde contra la base local con la migración.
2. **Producción**: respaldo, `supabase db push` (servidor primero, FR-022). Verificar que la 2.5.0
   publicada sigue sincronizando.
3. Publicar el front 2.6.0. Repetir los pasos 6–9 del recorrido en producción con un insumo de prueba.
4. **Rollback**: si el front falla, se revierte solo el front (la 2.5.0 convive con el servidor nuevo).
