# Quickstart: validar la spec 032

**Prerrequisitos**: `npm install`; Supabase local con la migración aplicada (`supabase db reset`)
para §2.

## Automático

```bash
npm run lint && npx tsc -b         # estilo y tipos
npm test                            # Vitest (alta-material, presentacion, ajustes, inventario-tabla, nuevos)
npm run test:rls                    # controles de contracts/api.md
```

## §1 Nuevo insumo (US1)

1. `npm run dev`, entrar como administradora, Inventario → "+ Material".
2. Abrir "Ver un ejemplo" y confirmar el texto de ui-contracts §2.
3. Crear "Ácido fosfórico 37,5 %": ¿Cómo lo usas? = ml; ¿Cómo lo compras? = jeringa; ¿Cuánto trae
   cada jeringa? = 3.
4. Stock inicial: escribir 3 en jeringas → ml muestra 9. Stock mínimo: escribir 0,5 en ml → jeringas
   muestra ≈ 0,17.
5. Cambiar el contenido a 5 → stock inicial ml = 15 (lo último editado fue jeringas). Volver a 3.
6. Confirmar que no hay campo de código de barras. Guardar → detalle: 9 ml (3 jeringas), mínimo
   0,5 ml.
7. Editar el insumo: mismos rótulos, mínimo doble, sin código de fabricante. Guardar sin cambios → un
   insumo antiguo con código lo conserva (revisarlo en Supabase Studio).

## §2 Perfil (US2)

1. Tocar el avatar (móvil 390 px y desktop 1280 px) → menú con nombre, correo, Ver perfil y Cerrar
   sesión. Escape lo cierra y el foco vuelve al avatar.
2. Ver perfil → Ajustes → Perfil, también si ya se estaba en Ajustes en otra sección.
3. Como personal: Editar nombre → "Dra. Ana Pérez" → las iniciales pasan a "AP".
4. DevTools offline → guardar otro nombre → "Necesitas conexión…".
5. Otro navegador con la misma cuenta → tras sincronizar, el nombre nuevo.

## §3 Tabla (US3)

1. Desktop a 1200 px con sidebar expandida, inventario con ≥ 25 insumos.
2. Bajar → el encabezado queda bajo la barra superior y no hay scroll horizontal ni columnas cortadas.
   Si se cortan, aplicar la alternativa de research R7.
3. Cambiar de página → sigue fijo.
