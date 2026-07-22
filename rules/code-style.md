# Guía de estilo de código

Aplica a los tres paquetes del monorepo: `apps/mobile` (React Native/Expo), `apps/web` (Next.js) y `apps/api` (Node.js). Todo el código se escribe en **TypeScript estricto** (`strict: true` en `tsconfig.json`); no se aceptan nuevos archivos `.js` salvo scripts de configuración puntuales.

## Formato y linting

- **Prettier** para formato automático (sin discusiones de estilo en code review): comillas simples, punto y coma obligatorio, `trailingComma: all`, ancho de línea 100.
- **ESLint** con `@typescript-eslint`, `eslint-plugin-react-hooks` y `eslint-plugin-import` (orden de imports: externos → internos → relativos, con línea en blanco entre grupos).
- El formato se corre automáticamente en pre-commit (`lint-staged` + `husky`). Ningún PR debe traer cambios de formato solos junto con cambios funcionales; van en commits separados.

## Nombres

- Componentes React: `PascalCase` (`MealCard.tsx`), un componente principal por archivo.
- Hooks: `useCamelCase` (`useDailyTotals.ts`).
- Funciones y variables: `camelCase`. Constantes verdaderamente globales: `UPPER_SNAKE_CASE`.
- Tipos e interfaces: `PascalCase`, sin prefijo `I` (`User`, no `IUser`). Se prefiere `type` para uniones/props y `interface` para contratos que se extienden.
- Archivos de test: mismo nombre que el archivo bajo prueba + `.test.ts(x)`.
- Endpoints REST y nombres de tabla en base de datos: `snake_case` en plural (`meal_entries`, `nutrition_plans`), ver `api-conventions.md`.

## Estructura de carpetas (por app)

```
apps/mobile/src/
  screens/<feature>/         # una carpeta por pantalla o flujo
  components/                # componentes reutilizables sin lógica de negocio
  hooks/
  services/                  # llamadas a la API (React Query)
  store/                     # Zustand
  navigation/

apps/web/src/
  app/<route>/               # App Router de Next.js
  components/
  hooks/
  services/
  lib/

apps/api/src/
  modules/<feature>/         # controller, service, dto, tests co-ubicados
  common/                    # guards, pipes, interceptors, decoradores compartidos
  config/
```

Regla general: el código se organiza **por feature**, no por tipo de archivo. Dentro de cada feature sí se separan controller/service/dto/tests.

## Componentes y lógica de negocio

- Los componentes de UI no llaman directamente a `fetch`/axios; toda llamada a red pasa por un hook de `services/` basado en React Query.
- Ningún componente de más de ~200 líneas: si crece, se extraen subcomponentes o se mueve lógica a un hook.
- Props de componentes siempre tipadas explícitamente (sin `any`, sin `React.FC` genérico sin props tipadas).
- Evitar lógica de negocio (cálculo de macros, reglas de adherencia, etc.) duplicada entre mobile y web: vive en `packages/shared` y se importa desde ambos.

## Manejo de errores

- Backend: errores de dominio como excepciones tipadas (`NotFoundException`, `ValidationException`, etc.), nunca `throw new Error("algo salió mal")`. Ver formato de respuesta de error en `api-conventions.md`.
- Frontend (mobile/web): errores de red manejados en la capa de `services/` y expuestos a la UI como estado (`{ data, error, isLoading }`), nunca con `try/catch` silenciosos que oculten el fallo.
- Nunca se atrapa una excepción solo para hacer `console.log` y continuar como si nada; o se maneja el error de forma significativa para el usuario, o se deja propagar.

## Comentarios y documentación

- El código se explica solo cuando el *por qué* no es obvio (decisiones de negocio, workarounds, límites de una librería). No se comentan obviedades línea por línea.
- Funciones públicas de `packages/shared` y de `common/` en el backend llevan un comentario corto describiendo contrato y casos borde relevantes (p.ej. qué pasa si el usuario no tiene plan asignado).
- Nada de código comentado ("dejado por si acaso") en commits a `main`; para eso está el historial de git.

## Datos sensibles

Este proyecto maneja datos de salud (peso, medidas, hábitos alimenticios). Ningún dato de este tipo se loggea en texto plano (ni en `console.log` ni en logs de producción), y no se incluyen datos reales de usuarios en fixtures de test o en ejemplos dentro de la documentación.
