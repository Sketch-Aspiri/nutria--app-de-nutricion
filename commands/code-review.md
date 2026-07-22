---
description: Revisa el diff actual (o un PR) contra las convenciones del proyecto
argument-hint: "[número de PR opcional]"
allowed-tools: Bash(git diff:*), Bash(git log:*), Bash(gh pr diff:*), Read, Grep, Glob
---

# /code-review

Revisa cambios de código contra las convenciones definidas en `code-style.md`, `testing.md`, `api-conventions.md` y las consideraciones de seguridad del agente `security-auditor`.

## Qué revisar (en este orden)

1. **Correctitud**: ¿el cambio hace lo que dice el PR/commit? ¿hay edge cases obvios sin cubrir (valores negativos, nulos, usuario sin nutricionista asignado, plan vacío, etc.)?
2. **Convenciones de estilo** (`code-style.md`): nombres, estructura de carpetas por feature, lógica de negocio duplicada entre mobile/web que debería vivir en `packages/shared`, componentes u hooks demasiado grandes.
3. **Convenciones de API** (`api-conventions.md`) si el cambio toca `apps/api`: rutas, formato de error, versionado, autorización validada en el backend (no solo en el frontend).
4. **Tests** (`testing.md`): ¿hay tests para la lógica de negocio nueva? ¿cubren el caso feliz y al menos un caso de error? ¿algún test quedó `skip`/`only` por error?
5. **Seguridad**: datos de salud (peso, medidas, hábitos alimenticios) no deben loggearse en texto plano; validar que endpoints nuevos chequeen pertenencia del recurso (un nutricionista no debe poder leer pacientes de otro); secretos no hardcodeados. Para cambios sensibles (auth, pagos, permisos), delega el análisis profundo al agente `security-auditor`.
6. **Impacto en despliegue** (`deploy-config.md`): ¿el cambio requiere una migración de base de datos? ¿es compatible con el patrón expand-contract? ¿toca variables de entorno nuevas que hay que documentar en `.env.example`?

## Cómo obtener el diff

- Si se pasa un número de PR como argumento (`$ARGUMENTS`), usa `gh pr diff $ARGUMENTS`.
- Si no se pasa nada, usa `git diff main...HEAD` para revisar los cambios de la rama actual contra `main`.

## Formato de salida

Organiza el feedback en tres categorías, en este orden:

1. **Bloqueante** — debe arreglarse antes de mergear (bugs, falta de tests en lógica crítica, problema de seguridad, rompe una convención de API).
2. **Sugerido** — mejora recomendada pero no bloqueante (nombres, estructura, un caso borde poco probable).
3. **Nit** — estilo menor, opcional para quien escribió el código.

Para cada punto, cita el archivo y la línea relevante, y explica el *por qué* (qué convención o riesgo aplica), no solo el *qué*. Si todo está bien, dilo explícitamente en vez de forzar comentarios — no inventes objeciones para tener algo que decir.
