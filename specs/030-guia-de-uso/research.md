# Research: Guía de uso con botón de ayuda

**Spec**: [spec.md](./spec.md) · **Fecha**: 2026-11-23

## R1 — Dónde va el "?"

- **Decision**: prop `ayuda?: IdAyuda` en `EncabezadoVista` (spec 027). Con ella, el encabezado
  agrega `BotonAyuda` al final del espacio de acciones. Las 7 vistas y `SeccionAjustesPantalla`
  pasan su id; no se toca nada más de cada vista.
- **Rationale**: un solo punto de entrada, igual en todas las pantallas (FR-001).

## R2 — Contenido

- **Decision**: `src/features/ayuda/contenido.ts` con `AYUDAS: Record<IdAyuda, Ayuda>`:
  `{ titulo, paraQue, tareas: { nombre, pasos: string[], soloAdministracion? }[], consejos:
  { texto, soloAdministracion? }[] }`. `IdAyuda` = las 7 vistas + `ajustes:<IdSeccion>` de las 8
  secciones + `ajustes:guia`? No: la sección "Guía de uso" no lleva "?" propio (ya es la guía).
- Texto plano, sin capturas; las tareas con pasos cortos usan los nombres exactos de los botones.
- `ayudaParaRol(ayuda, rol)` filtra lo de administración para personal (FR-004).

## R3 — Hoja

- **Decision**: `BottomSheet` existente (hoja en móvil, modal en desktop, foco atrapado, Escape).
  Componente `AyudaContenido` (secciones con `h3`, tareas en `ol`) compartido por la hoja y por la
  sección "Guía de uso" (`details/summary` por pantalla).

## R4 — Primera visita

- **Decision**: `localStorage` clave `dentdelion:ayudas-vistas:<usuarioId>` con la lista de ids
  vistos. `BotonAyuda` al montarse: si la persona no la vio, abre la hoja y la marca. Lecturas y
  escrituras en `try/catch` (si falla, se comporta como "no vista" y no rompe).
- Una sola hoja de ayuda a la vez: un módulo guarda cuál está abierta; si otra pantalla intenta
  abrirse sola mientras hay una abierta, espera a la próxima visita.
- **Pruebas**: el autoabrir se desactiva en `import.meta.env.MODE === 'test'` mediante
  `configuracionAyuda.automatica` (las pruebas existentes no ven hojas inesperadas); las pruebas
  de esta spec lo activan.
- **Rationale**: no requiere migración ni sincronización (assumption de la spec).

## R5 — Sección "Guía de uso"

- **Decision**: `IdSeccion` `'guia'` al final de `SECCIONES_AJUSTES`, ambos roles, ícono
  `CircleHelp`; resumen "15 pantallas" (o las visibles para el rol). Lista en el orden del menú las
  vistas y las secciones de Ajustes visibles para el rol.
