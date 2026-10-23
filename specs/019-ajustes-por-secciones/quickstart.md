# Quickstart: validar Ajustes por secciones

**Feature**: 019-ajustes-por-secciones | **Date**: 2026-10-22

## Prerrequisitos

- `develop` con la spec 018 (Dexie v12). Sin migraciones que aplicar.
- Supabase local (`supabase start`) con el seed; un tenant con **dos lugares** y una cuenta
  `administrador` y otra `personal`.
- Skill `run-indentory` para levantar la app y tomar capturas.

## 1. Pruebas automáticas

```bash
npm run lint && npm run build
npx vitest run tests/unit/ajustes tests/unit/sync-paginacion.test.ts \
  tests/unit/sync-minimos-lugar-paginacion.test.ts \
  tests/integration/ajustes.test.tsx tests/integration/ajustes-minimos.test.tsx \
  tests/integration/navegacion-responsiva.test.tsx tests/integration/lugares.test.tsx \
  tests/integration/equipo-invitacion.test.tsx
npm test            # suite completa sin regresiones
```

Esperado: todo verde. Los casos de `ajustes.test.tsx` que existían antes de la spec siguen pasando,
ahora entrando por el índice (SC-007).

## 2. Índice y navegación (US1, SC-001, SC-002)

Como administradora, en un teléfono de 360 × 640 (DevTools):

1. Tocar "Más". **Esperado**: Compras y Reportes arriba; debajo, cinco tarjetas en este orden: Perfil y
   equipo, Lugares de trabajo, Notificaciones y avisos, Categorías, Insumos dados de baja; cada una con
   resumen ("Ana · Administradora", "2 lugares", …). Todo entra en una pantalla.
2. Tocar "Categorías". **Esperado**: solo la sección, con "Volver" y el título arriba; la URL termina en
   `#ajustes/categorias`; no aparecen Compras ni Reportes.
3. Renombrar una categoría y tocar "Volver". **Esperado**: índice en la misma posición; el resumen de
   Categorías sigue correcto.
4. Abrir "Lugares de trabajo" y recargar la página. **Esperado**: vuelve a "Lugares de trabajo".
5. Usar el "atrás" del navegador. **Esperado**: índice de Ajustes (no sale de la app ni va a Inicio).
6. Abrir una sección, ir a "Inventario" desde la barra y volver a "Más". **Esperado**: índice.

## 3. Permisos (US2, SC-005)

1. Iniciar sesión como personal y abrir "Más". **Esperado**: dos tarjetas, "Perfil" y
   "Notificaciones".
2. Abrir "Notificaciones". **Esperado**: solo los dos interruptores; sin niveles de aviso, horas ni
   mínimos.
3. Escribir en la URL `#ajustes/categorias` y recargar. **Esperado**: índice de personal.

## 4. Stock mínimo por lugar (US3, SC-003, SC-004)

Como administradora, con el lugar A activo:

1. "Notificaciones y avisos" ▸ "Stock mínimo por insumo". **Esperado**: 25 insumos, "Ver más (quedan
   N)", texto "Mínimos de A…".
2. Buscar "guantes" (o "GUANTÉS"). **Esperado**: solo coincidencias y el contador.
3. Cambiar el mínimo a un valor sobre el stock actual y salir del campo. **Esperado**: insignia
   "Propio"; en Alertas del lugar A aparece "Bajo mínimo" para ese insumo; en Inventario ▸ editar
   insumo, "mínimo en este lugar" muestra el mismo valor.
4. Cambiar al lugar B en el encabezado. **Esperado**: ese insumo muestra "General" con el mínimo del
   catálogo; las alertas de B no cambiaron.
5. Volver a A, borrar el valor y salir del campo. **Esperado**: "General".
6. Elegir "Todos". **Esperado**: cada insumo con el mínimo de A y de B, sin campos editables, y el aviso
   para elegir un lugar.
7. Con un tenant de un solo lugar: el editor no muestra insignias ni texto de lugar y cambia el mínimo
   del catálogo (visible en editar insumo ▸ "Stock mínimo").
8. Sin conexión (DevTools ▸ Offline), cambiar un mínimo; volver a conectar. **Esperado**: el
   indicador de sincronización lo sube y otro dispositivo lo recibe.

## 5. Descarga completa de mínimos por lugar (US4, SC-006)

Cubierta por `tests/unit/sync-minimos-lugar-paginacion.test.ts` (más de 1.000 filas con clave
compuesta, error en una página, cambio local sin subir). Opcional en local: insertar 1.500 filas en
`minimos_lugar` con SQL, iniciar sesión en un navegador limpio y comparar
`await db.minimosLugar.count()` en la consola con el conteo del servidor.

## 6. Capturas (SC-007)

Con `run-indentory`: índice y una sección (Notificaciones y avisos) en móvil (360), tablet (768) y
desktop (1280), para administración y personal. Revisar que cada control de la página anterior aparece
en alguna sección.
