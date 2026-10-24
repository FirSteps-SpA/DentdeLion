# Quickstart: Proveedores

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
npm run test:rls  # proveedores, triggers de lotes y lugares, sin configuracion_clinica (§7)
npm run lint && npm run build
```

## Ensayo local de la migración (SC-003, SC-004)

`supabase db reset` aplica la migración sobre una base vacía. Para ensayar los datos existentes:

```bash
mv supabase/migrations/20261023000000_proveedores.sql /tmp/ && supabase db reset
docker exec -i supabase_db_DentdeLion psql -U postgres -d postgres < scripts/sql/ensayo-proveedores.sql
mv /tmp/20261023000000_proveedores.sql supabase/migrations/ && supabase migration up --local
npm run proveedores -- listar
npm run proveedores -- fusionar --tenant 00000000-0000-4000-8000-000000000001 \
  --a "Dental Sur" --de "dental sur" --de "Dentalsur Ltda." --ensayo   # y sin --ensayo
```

Esperado: 7 lotes, todos con `proveedor_id`; en el tenant 1, «dental sur» (4 lotes, el texto más
usado), «Dentalsur Ltda.» y «Sin proveedor»; en el tenant B, su propio «Dental Sur». Tras `fusionar`:
«Dental Sur» con 5 lotes y «Dentalsur Ltda.» eliminado. Repetir `fusionar` no cambia nada. Al terminar,
`supabase db reset`.

## Recorrido manual (skill `run-indentory`, teléfono 360 × 640, tablet y desktop)

1. **Ajustes → Proveedores** (administración): la tarjeta aparece entre Categorías e Insumos dados de
   baja. Crear "Dental Sur" con WhatsApp `9 1234 5678` (se ve `+56 9 1234 5678`) y contacto "Paula".
   Marcarlo "Predeterminado en" el lugar activo.
2. Crear " dental  súr": avisa "Ya existe un proveedor con ese nombre."
3. **Alta de material** con stock inicial: Proveedor ya muestra "Dental Sur". Guardar sin tocarlo.
4. Alta de otro material: abrir el selector, escribir "nor" → "Agregar proveedor «nor»"; escribir
   "Casa Norte" y agregar. Queda elegido; el resto del formulario no se borró.
5. **Detalle del insumo**: el lote dice "Lote … · Dental Sur — vence …".
6. Renombrar "Dental Sur" a "Dental Sur Ltda." en Ajustes: el detalle muestra el nombre nuevo.
7. **Compras → recibir** un ítem: el predeterminado del lugar del ítem viene elegido.
8. Desactivar "Casa Norte": desaparece del selector y de los predeterminados. En el selector, escribir
   "casa norte": "«Casa Norte» está desactivado." (con "Reactivar y usar" solo para administración).
9. Eliminar: un proveedor sin lotes se puede eliminar; uno con lotes no muestra "Eliminar".
10. **Personal**: Ajustes no muestra Proveedores (ni entrando por la URL); en el alta puede agregar un
    proveedor nuevo.
11. **Sin conexión** (DevTools → Offline): agregar un proveedor desde el alta y registrar el lote. Al
    volver la conexión, ambos suben y el lote queda con ese proveedor en otro dispositivo.
12. **Duplicado sin conexión**: dos navegadores sin conexión agregan "Proveedor X". Al conectar
    ambos, queda uno solo y los dos lotes lo usan.

## Compatibilidad con la 2.4.0

1. Con la migración aplicada, servir el front de `main` (2.4.0) y registrar un lote escribiendo
   "DENTAL SUR LTDA." y otro con "Proveedor Nuevo".
2. En el front nuevo: el primero quedó con "Dental Sur Ltda."; el segundo creó "Proveedor Nuevo".
3. La 2.4.0 sigue mostrando y sincronizando sin errores (el indicador de sincronización queda en
   "Sincronizado").

## Publicación (research.md R13)

1. **Lista para la clienta**: sobre la restauración del respaldo de producción, `node
   scripts/proveedores.mjs listar` → textos distintos por tenant con su cantidad de lotes. Enviar a la
   clienta y anotar qué fusionar y con qué nombre.
2. **Ensayo** sobre la restauración: aplicar la migración, `node scripts/proveedores.mjs fusionar …`
   según la lista, y comprobar:
   - la misma cantidad de lotes, y ninguno sin `proveedor_id` (SC-003);
   - no hay dos proveedores con la misma clave por tenant (SC-004);
   - el recorrido de compatibilidad con la 2.4.0 de arriba.
3. **Producción**: respaldo, `supabase db push`, fusiones y, después, el front 2.5.0.
4. **Seguimiento**: cuando todos los dispositivos de la clienta muestren 2.5.0, anotar en el backlog
   que el texto `lotes.proveedor` y la tolerancia de la 2.4.0 ya se pueden retirar.
