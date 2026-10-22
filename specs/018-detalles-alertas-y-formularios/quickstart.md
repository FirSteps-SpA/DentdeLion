# Quickstart: validar detalles de alertas y formularios

**Feature**: 018-detalles-alertas-y-formularios | **Date**: 2026-10-22

## Prerrequisitos

- `develop` con el release 2.4.0 (Dexie v12). Sin migraciones que aplicar.
- Supabase local (`supabase start`) con el seed y dos lugares en el tenant de prueba.
- Skill `run-indentory` para levantar la app y tomar capturas.
- Para la sección 2: Chrome (o Edge) y Firefox de escritorio con mouse de rueda o trackpad.

## 1. Pruebas automáticas

```bash
npm run lint && npm run build
npx vitest run tests/unit/NumeroInput.test.tsx tests/unit/sin-input-number-suelto.test.ts \
  tests/unit/alertas tests/integration/rueda-campos-numericos.test.tsx \
  tests/integration/alertas-detalle.test.tsx tests/integration/inicio.test.tsx \
  tests/integration/alta-material.test.tsx
TZ=America/Santiago npx vitest run tests/unit/alertas/textoCaducidad.test.ts   # fecha sin corrimiento
npm test            # suite completa sin regresiones
```

Esperado: todo verde. Las tablas de [contracts/ui-contracts.md](./contracts/ui-contracts.md) §2 y §3
son los casos de las pruebas unitarias.

## 2. Rueda del mouse (P1, SC-001, SC-006) — navegador real

En cada navegador:

1. Abrir "Registrar material". Escribir `200` en "Stock inicial" y `5` en "Stock mínimo".
2. Con el cursor sobre "Stock inicial" (y el campo con el foco), girar la rueda hacia arriba y abajo.
   **Esperado**: sigue en 200 y la página se desplaza.
3. Volver a enfocar el campo y usar ↑ / ↓ del teclado. **Esperado**: cambia a 201 / 200.
4. Repetir el paso 2 en: consumo de un insumo, editar insumo (mínimo), precio de ingreso, convertir
   unidad, Ajustes ▸ stock mínimo por insumo y horas de aviso, % profesional de un lugar, precio de un
   tratamiento, cantidad en "Registrar tratamiento" y recepción de una compra. **Esperado**: ningún
   valor cambia.
5. En un teléfono (o emulación móvil): tocar "Stock inicial". **Esperado**: teclado numérico; + y −
   funcionan.

## 3. Alertas de caducidad (P2, SC-002, SC-003)

Preparar en "Clínica Providencia", con niveles de aviso 30/7/1 y 90 días:

| Insumo | Lote | Vence |
|---|---|---|
| Lidocaína 2 % | L-1 | hoy + 12 días |
| Lidocaína 2 % | L-2 | hoy + 75 días |
| Guantes M | G-1 | hoy |
| Resina A2 | R-1 | hoy − 5 días |

Abrir Alertas. **Esperado**:

- "Lidocaína 2 %" dos veces: `vence en 12 días` y `vence en 2 meses`, cada una con su fecha legible
  ("3 nov 2026"); ningún renglón dice "lote", "nivel" ni una fecha `AAAA-MM-DD`.
- Guantes M: `vence hoy`. Resina A2: `caducado hace 5 días`, badge "Caducado" en rojo.
- Tocar el renglón de Lidocaína a 75 días: se abre el detalle con L-1 y L-2 y sus fechas. Cerrar:
  se vuelve a Alertas.
- Inicio: el resumen de alertas y "Próximos vencimientos" muestran los mismos textos, sin lote; tocar
  uno abre el detalle y cerrar vuelve a Inicio.
- "Lotes en revisión" (si hay uno): sigue mostrando el número de lote.

## 4. "Sin stock" (P2, SC-004)

Con mínimo 5: consumir todo "Algodón" (stock 0) y dejar "Eyectores" en 2.

**Esperado**: en Alertas, Algodón dice **Sin stock** (rojo, ícono de círculo) y Eyectores **Bajo
mínimo** (ámbar, triángulo). En Inicio, igual (ya no aparece "Stock crítico"). En "Todos", con Algodón
en 0 en un lugar y en 2 en el otro, cada renglón tiene la etiqueta de su lugar y su chip.

## 5. Interruptor "¿Caduca?" (P3, SC-005)

Abrir "Registrar material" y recorrer con Tab. **Esperado**: Número de lote → Proveedor → **¿Caduca?**
→ Fecha de vencimiento. Apagar el interruptor: la fecha desaparece; guardar: el insumo queda como "No
caduca". Encenderlo: la fecha aparece debajo y es obligatoria.

## 6. Capturas

Con `run-indentory`: Alertas e Inicio en móvil (390 px) y desktop (1280 px), y el alta de material en
móvil, para adjuntar al PR.
