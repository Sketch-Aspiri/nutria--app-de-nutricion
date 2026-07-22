# nutria — Aplicación Integral de Nutrición

Monorepo (npm workspaces) de la plataforma de nutrición. Ver `CLAUDE.md` para convenciones y documentos de referencia.

```
apps/
  web/        # Next.js (App Router) — panel del nutriólogo (MVP construido)
packages/
  shared/     # lógica de negocio pura (TDEE, macros, alergias, adherencia) + tests
  ui-tokens/  # design tokens compartidos (colores, tipografía, espaciado)
MVP/          # prototipos JSX de referencia
```

## Correr el MVP web

```bash
npm install
npm run dev:web          # http://localhost:3000
```

Funciones de IA (planes, notas clínicas, recetas, respuestas sugeridas): copia
`apps/web/.env.example` a `apps/web/.env.local` y define `ANTHROPIC_API_KEY`.
Sin la key, la app funciona completa y las acciones de IA muestran un error amigable.

## Tests y checks

```bash
npm run test             # Jest en todos los workspaces (shared: 80% líneas mínimo)
npm run type-check       # tsc --noEmit en todos los workspaces
npm run build:web        # build de producción (incluye type-check de la web)
```

## Estado del MVP web

- Login simulado (la autenticación real llega con `apps/api`).
- Estado en `localStorage` con datos demo; el backend NestJS lo reemplazará.
- La llamada a la IA pasa por `/api/ai` (route handler): la API key vive solo en el servidor
  y los errores siguen el formato de `rules/api-conventions.md`.
