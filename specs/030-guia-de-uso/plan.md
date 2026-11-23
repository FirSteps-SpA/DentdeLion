# Implementation Plan: Guía de uso con botón de ayuda

**Branch**: `030-guia-de-uso` | **Date**: 2026-11-23 | **Spec**: [spec.md](./spec.md)

## Summary

Prop `ayuda` en el `EncabezadoVista` común, que agrega un "?" de 48 px y abre una `BottomSheet` con
la ayuda de esa pantalla, filtrada por rol. Se abre sola la primera vez por pantalla y persona
(recordado en `localStorage`). La sección nueva de Ajustes "Guía de uso" reúne todas las ayudas. Contenido
estático en `src/features/ayuda/contenido.ts` (R1–R5).

## Technical Context

**Language/Version**: TypeScript ~6.0, React 19. **Dependencies**: ninguna nueva.

**Storage**: `localStorage` (preferencia del dispositivo); sin Dexie, sin Supabase, sin migración.

**Testing**: Vitest + Testing Library: recorrido de las 15 ayudas, filtro por rol, primera visita,
sección de Ajustes.

**Constraints**: offline (contenido en el bundle); 48 px; textos en español revisados por la
clienta.

## Constitution Check

| Principio | Cumplimiento | Estado |
|---|---|---|
| I. Offline-First | Contenido estático | ✅ |
| II. Zustand | Sin store nuevo (estado local + `localStorage`) | ✅ |
| III. Táctil 48 px | Botón 48 px | ✅ |
| IV. Trazabilidad | No registra datos | ✅ |
| V. Búsqueda manual | Sin cambios | ✅ |
| VI. Multi-usuario | Texto por rol; "vista" por persona | ✅ |

## Project Structure

```text
src/features/ayuda/{contenido.ts,ayudasVistas.ts}
src/features/ayuda/components/{BotonAyuda.tsx,AyudaContenido.tsx,GuiaUsoSection.tsx}
src/components/ui/EncabezadoVista.tsx      # prop ayuda
src/features/*/components/*View.tsx        # pasan su id
src/features/ajustes/{lib/secciones.ts,components/SeccionAjustesPantalla.tsx,…}
tests/unit/ayuda/*.test.ts(x), tests/integration/ayuda.test.tsx
```
