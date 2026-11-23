# Contrato: Edge Function `estimar-materiales`

`POST /functions/v1/estimar-materiales` con el JWT de la sesión (`verify_jwt = true`).

## Petición

```json
{ "tratamiento": "Restauración clase II", "insumoIds": ["uuid", "uuid"] }
```

- `tratamiento`: string, 1–80 tras `trim`.
- `insumoIds`: 1–20 uuid distintos.

## Respuestas

| Estado | Cuerpo | Cuándo |
|---|---|---|
| 200 | `{ "reconocido": true, "sugerencias": [{ "insumoId", "cantidad": number \| null, "nota" }] }` | ok |
| 200 | `{ "reconocido": false, "sugerencias": [] }` | no es un tratamiento dental |
| 400 | `{ "codigo": "solicitud_invalida" }` | forma inválida |
| 401 | `{ "codigo": "sin_sesion" }` | sin JWT válido |
| 403 | `{ "codigo": "solo_administracion" }` | no es administración |
| 404 | `{ "codigo": "materiales_invalidos" }` | algún id no es del tenant |
| 429 | `{ "codigo": "limite_diario" }` | 20 hoy |
| 503 | `{ "codigo": "no_configurado" }` | sin `ANTHROPIC_API_KEY` |
| 502 | `{ "codigo": "error_modelo" }` | rechazo, salida inválida o timeout |

Orden de controles: forma → sesión → rol → materiales del tenant → clave configurada → límite
(reserva) → IA → validación → `resultado`.

## Controles de `npm run test:rls`

1. `reservar_estimacion` no se puede llamar por la API (anon/authenticated).
2. Personal no lee `estimaciones_ia`; administración solo las de su tenant.
3. Nadie inserta ni actualiza `estimaciones_ia` por la API.
4. `reservar_estimacion` (service role) devuelve id hasta 20 en el día y `null` en la 21.
5. Edge Function local sin clave: personal → 403; administración con un id de otro tenant → 404;
   administración válida → 503 `no_configurado` (sin consumir la reserva: se verifica la clave antes
   de reservar).
