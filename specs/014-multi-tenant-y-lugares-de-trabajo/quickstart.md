# Quickstart: validar multi-tenant y lugares de trabajo

**Feature**: 014-multi-tenant-y-lugares-de-trabajo

## Requisitos

- Supabase local con la migración aplicada (`supabase db reset`) y la Edge Function servida
  (`supabase functions serve aceptar-invitacion`).
- `npm install`.
- Para los escenarios en navegador, el skill `run-indentory`.

## Pruebas automáticas

```bash
npm test          # unitarias + integración (lugares, "Todos", traslados, equipo, invitación)
npm run test:rls  # dos tenants, dos lugares, traslados, invitaciones (contracts/supabase-schema.md)
npm run lint && npm run build
```

## Escenarios manuales

| # | Pasos | Esperado | Spec |
|---|---|---|---|
| 1 | `node scripts/alta-tenant.mjs --nombre "Dentista B" --lugar "Box B" --admin b@test.local` y abrir el enlace | Pantalla de invitación; tras "Unirme", la app abre Inicio de un tenant vacío | FR-003, US5 |
| 2 | Iniciar sesión como usuario del tenant 1 y del tenant B en dos ventanas | Ninguno ve nada del otro; el chip muestra el lugar de cada uno | US1, SC-001 |
| 3 | Tenant 1 con un solo lugar | Sin selector; todo igual que en la 2.2.0 | US1-5, US2-5 |
| 4 | Como administradora del tenant 1, crear "Box Las Condes" | Aparece el selector con Providencia, Las Condes y Todos; Las Condes vacío | US4-1, SC-006 |
| 5 | En Providencia, ingresar 10 de un insumo; cambiar a Las Condes | Las Condes no tiene ese stock; sus alertas y sugeridos no cambian | US2-2/3/4, SC-003 |
| 6 | Trasladar 4 a Las Condes | Providencia queda con 6 y Las Condes con 4, mismo lote; aparece en el historial de ambos | US6-1/3, SC-008 |
| 7 | Sin conexión: trasladar 2 más, cambiar de lugar, reconectar | Llegan las dos partes; el total no cambia | US6-4, SC-005 |
| 8 | Deshacer el traslado | Ambos lugares vuelven al stock anterior | US6-6 |
| 9 | Elegir "Todos" | KPIs sumados; cada fila con su lugar; "Consumir 1" pide el lugar | US3 |
| 10 | Equipo → Invitar `p@test.local` como personal; abrir el enlace en incógnito | Entra al tenant 1 y ve ambos lugares | US5-1/2, SC-007 |
| 11 | Revocar una invitación y abrir su enlace | "Esta invitación ya no es válida" | US5-3 |
| 12 | Invitar el correo del tenant B | "Este correo ya pertenece a otro cliente" | US5-5 |
| 13 | Desactivar al usuario personal y probar entrar | Pantalla "acceso desactivado"; sin sync | US5-6, FR-021 |
| 14 | Desactivar "Box Las Condes" con stock | Pide confirmación; deja de aparecer; se puede reactivar | US4-3, Edge Cases |
| 15 | Mismo navegador: salir del tenant 1 y entrar con el tenant B | No queda ningún dato del tenant 1 a la vista; los pendientes del usuario anterior se conservan | FR-004 |

## Migración

1. **Servidor**: ensayo sobre la restauración del respaldo de producción (el script del release
   2.2.0, con esta migración). Los conteos de cada tabla deben quedar iguales; todas las filas en
   `TENANT_1` / `LUGAR_1`; `perfiles` con `TENANT_1`. Además, un tenant 2 creado en el ensayo no ve
   nada.
2. **Dispositivo (Dexie v10) en Chromium real**: build 2.2.0 con un consumo sin conexión, después el
   build de la rama. El consumo sube al lugar 1 y los datos quedan intactos.
3. **Despliegue**: respaldo, luego `supabase db push` y deploy de la Edge Function
   (`supabase functions deploy aceptar-invitacion`) **antes** de publicar el front. Los clientes 2.2.0
   siguen funcionando gracias a los `default` (R2).
