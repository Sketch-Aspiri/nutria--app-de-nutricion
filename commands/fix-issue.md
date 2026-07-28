---
description: Investiga y corrige un issue tracked (número de issue o descripción)
argument-hint: "<número de issue o descripción corta>"
allowed-tools: Bash(git:*), Bash(gh issue view:*), Read, Edit, Write, Grep, Glob
---

# /fix-issue

Corrige el issue `$ARGUMENTS`. Sigue este proceso en orden; no saltes directo a editar código.

## 1. Entender el issue

- Si `$ARGUMENTS` es un número, obtén el detalle con `gh issue view $ARGUMENTS` (título, descripción, pasos para reproducir, comentarios recientes).
- Si es una descripción libre, trátala como el reporte del bug/feature a resolver.
- Identifica: ¿es un bug (comportamiento actual incorrecto) o una feature (comportamiento nuevo)? ¿en qué app vive (`apps/mobile`, `apps/web/nutriologos`, `apps/web/pacientes`, `apps/api`, o `packages/shared`)?

## 2. Reproducir / localizar

- Para un bug: reproduce el problema antes de tocar nada. Si no se puede reproducir con la información dada, dilo explícitamente en vez de asumir una causa.
- Localiza el código relevante con búsqueda dirigida (`Grep`/`Glob`), no leyendo el repo entero. Si el issue menciona un endpoint, pantalla o mensaje de error específico, busca ese texto literal primero.

## 3. Diseñar el fix

- Antes de editar, resume en 2-3 líneas: causa raíz (para un bug) o approach (para una feature), y qué archivos van a cambiar.
- Prefiere el fix más pequeño que resuelve la causa raíz. No aproveches para refactors no relacionados; si ves algo que merece arreglarse aparte, anótalo pero no lo mezcles en el mismo cambio.
- Si el fix toca una convención documentada (`api-conventions.md`, `code-style.md`), respétala; si el issue pide algo que la contradice, señálalo antes de implementar.

## 4. Implementar

- Haz el cambio mínimo necesario.
- Si es un bug, agrega un test que falle sin el fix y pase con él (regresión). Si es una feature, agrega los tests correspondientes según `testing.md`.
- Actualiza el spec de OpenAPI si el cambio toca un endpoint (`api-conventions.md`).

## 5. Verificar

- Corre lint, type-check y la suite de tests relevante (no hace falta correr la suite completa de E2E mobile localmente).
- Confirma que el test de regresión efectivamente fallaba antes del fix (revisa el diff o corre el test contra el código anterior si es fácil de verificar).

## 6. Cerrar el loop

- Resume el cambio: causa raíz, archivos tocados, tests agregados.
- Si `$ARGUMENTS` era un número de issue, deja el mensaje de commit/PR referenciando el issue (`Fixes #123`) para que se cierre automáticamente al mergear.
- No marques el issue como resuelto tú mismo si el proceso del equipo es que lo cierre el PR al mergear.
