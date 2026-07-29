# CLAUDE.md

Guía para trabajar en el monorepo de **Aplicación Integral de Nutrición**. Léela antes de escribir código en este proyecto.

## Qué es este proyecto

Una plataforma de nutrición con tres frentes: app móvil para el usuario final (registro de comidas y calorías, plan de alimentación personalizado, seguimiento de progreso, consultas con nutricionistas), app web (marketplace de nutricionistas, panel del nutricionista, panel de administración) y un backend compartido por ambas.

- Detalle del alcance móvil: `MVP-app-movil.md`.
- Detalle del alcance web: `MVP-app-web.md`.

## Stack

- **Mobile**: React Native + Expo, TypeScript, React Navigation, React Query + Zustand.
- **Web**: Next.js (App Router), TypeScript, Tailwind CSS.
- **Backend**: Node.js con NestJS, PostgreSQL, API REST versionada (`/v1`).
- **Compartido**: `packages/servidor` (capa de servidor de las apps web: Prisma, auth, IA, cifrado, repositorios), `packages/shared` (lógica de negocio pura: cálculo de macros, reglas de adherencia) y `packages/ui-tokens` (design system compartido entre mobile y web).

## Estructura del monorepo

```
apps/
  mobile/     # React Native / Expo
  web/
    nutriologos/  # Next.js — panel del nutriólogo + API /api/v1
    pacientes/    # Next.js — app del paciente: API /api/v1/me lista (incluida la IA), UI pendiente
                  # (ver MVP/app-movil/PLAN-APP-PACIENTES.md)
  api/        # NestJS
packages/
  servidor/   # capa de servidor compartida: prisma (esquema, migraciones, seed),
              # auth, IA, cifrado, bitácora y repositorios. La consumen ambas apps web
  shared/     # lógica de negocio compartida, sin dependencias de UI
  ui-tokens/  # colores, tipografía, espaciado
```

## Documentos de referencia (léelos antes de las tareas correspondientes)

| Documento | Cuándo consultarlo |
|---|---|
| `code-style.md` | Antes de escribir o editar cualquier código |
| `testing.md` | Al agregar o modificar lógica de negocio, endpoints o flujos críticos |
| `api-conventions.md` | Al crear o modificar cualquier endpoint del backend |
| `deploy-config.md` | Al tocar migraciones, variables de entorno, o el pipeline de CI/CD |
| `MVP-app-movil.md` | Al trabajar en `apps/mobile`, para saber qué está y qué no está en alcance |
| `MVP-app-web.md` | Al trabajar en `apps/web/nutriologos`, para saber qué está y qué no está en alcance |
| `ai-guidelines.md` | Al tocar cualquier función de IA: prompts, seudonimización, cuotas, validación de salidas |

## Comandos habituales

```bash
# Backend
cd apps/api && npm run start:dev       # servidor local
cd apps/api && npm run test            # tests unitarios/integración
cd apps/api && npm run migration:run   # migraciones pendientes

# Web
cd apps/web/nutriologos && npm run dev
cd apps/web/nutriologos && npm run test

# Mobile
cd apps/mobile && npx expo start
cd apps/mobile && npm run test

# Todo el monorepo (si se usa un task runner tipo turbo/nx)
npm run lint --workspaces
npm run type-check --workspaces
```

## Principios generales al trabajar en este repo

1. **Datos de salud, cuidado extra.** Este proyecto maneja peso, medidas, hábitos alimenticios y notas clínicas. Nunca loggear estos datos en texto plano, nunca incluir datos reales de usuarios en fixtures, ejemplos o mensajes de commit.
2. **Autorización siempre en el backend.** Un nutricionista solo accede a sus pacientes asignados; un paciente solo a lo suyo. No es aceptable ocultar una acción solo en el frontend como control de seguridad.
3. **Lógica de negocio compartida vive en `packages/shared`.** Si una regla (cálculo de calorías, macros, adherencia) se necesita en mobile y en web, no se duplica.
4. **Cambios pequeños y enfocados.** Un PR resuelve una cosa. Refactors no relacionados van aparte, aunque se detecten de paso.
5. **Todo cambio de lógica de negocio lleva test.** Ver `testing.md` para cobertura mínima esperada por app.
6. **Migraciones reversibles o expand-contract.** Ver `deploy-config.md`.
7. **La IA propone, el nutriólogo aprueba.** Las funciones de IA generativa (borrador de plan, resumen clínico, recetas, sugerencia de respuesta, plan de actividad) sí están en alcance, pero siempre como asistencia: nada que produzca el modelo se guarda ni se envía al paciente sin que el profesional lo revise. Ver `ai-guidelines.md`.

## Comandos y agentes disponibles en este proyecto

- `/code-review` — revisa el diff actual o un PR contra las convenciones del proyecto (`code-review.md`).
- `/fix-issue <número o descripción>` — investiga y corrige un issue siguiendo un proceso estructurado (`fix-issue.md`).
- Agente `code-reviewer` — revisor de código proactivo, invocado después de cambios significativos.
- Agente `security-auditor` — auditoría de seguridad enfocada en autorización y datos de salud, invocado en cambios de auth/permisos/pagos o bajo pedido explícito.

## Qué evitar

- No introducir un ORM o librería de estado nuevo sin justificarlo (ya hay decisiones tomadas: React Query + Zustand en mobile, Prisma/TypeORM en el backend).
- No commitear secretos ni valores reales de `.env`.
