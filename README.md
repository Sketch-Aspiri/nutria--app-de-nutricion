# nutria — Aplicación Integral de Nutrición

Monorepo (npm workspaces) de la plataforma de nutrición. Ver `CLAUDE.md` para convenciones y documentos de referencia.

```
apps/
  web/
    nutriologos/  # Next.js (App Router) — panel del nutriólogo + API /api/v1
    pacientes/    # Next.js — app del paciente: API /api/v1/me lista (incluida la IA), UI pendiente
packages/
  servidor/   # capa de servidor compartida por las apps web: prisma (esquema,
              # migraciones, seed), auth, IA, cifrado, bitácora, repositorios
  shared/     # lógica de negocio pura (TDEE, macros, alergias, adherencia) + tests
  ui-tokens/  # design tokens compartidos (colores, tipografía, espaciado)
MVP/          # prototipos JSX de referencia y el plan de la V2
```

El plan de la versión desplegable vive en `MVP/app-web/PLAN-V2-PRODUCCION.md`.
El plan de la app del paciente, en `MVP/app-movil/PLAN-APP-PACIENTES.md`.

## Puesta en marcha

```bash
npm install
cp apps/web/nutriologos/.env.example apps/web/nutriologos/.env    # y completa los valores
```

### 1. Base de datos

Se necesita un PostgreSQL. Para desarrollo, lo más rápido es un proyecto gratuito
en [Neon](https://neon.tech): copia las cadenas *Pooled* y *Direct* a `DATABASE_URL`
y `DIRECT_URL` respectivamente. También funciona un Postgres local.

```bash
cd apps/web/nutriologos
npm run db:deploy            # aplica el esquema (28 tablas)
npm run db:studio            # opcional: explorar los datos
```

### 2. Secreto de sesión

```bash
cd apps/web/nutriologos && npx auth secret     # escribe AUTH_SECRET en .env
```

### 3. Levantar la app

```bash
npm run dev:nutriologos  # http://localhost:3000
```

Crea tu cuenta en `/registro`. Sin proveedor de correo configurado no se envían
correos: el enlace de verificación aparece en la pantalla de alta y en la consola
del servidor.

### Salida de correo

Hay dos caminos y el SMTP tiene prioridad si está configurado:

| Camino | Variables | Cuándo |
|---|---|---|
| SMTP de un buzón propio | `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD` | Fase de prueba: no requiere dominio. Con Gmail hace falta verificación en dos pasos y una **contraseña de aplicación**; el tope es de ~500 correos al día. |
| Resend | `RESEND_API_KEY` | Producción abierta, con dominio verificado. Sin dominio, Resend solo entrega al correo de la propia cuenta. |

`EMAIL_FROM` debe coincidir con el buzón de `SMTP_USER` cuando se usa SMTP: Gmail
reescribe el remitente si no corresponde a la cuenta que autentica.

### Variables opcionales

| Variable | Efecto si falta |
|---|---|
| `ANTHROPIC_API_KEY` | Las acciones de IA muestran un error amigable; el resto funciona. |
| `RESEND_API_KEY` / `SMTP_*` | No se envían correos; en desarrollo se muestra el enlace de verificación. |
| `ADMIN_NOTIFY_EMAIL` | No se manda el aviso interno de cada alta (nutriólogo o paciente). |
| `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` | Solo se ofrece acceso con correo y contraseña. |

## Tests y checks

```bash
npm run test             # Jest en todos los workspaces (shared: 80% líneas mínimo)
npm run type-check       # tsc --noEmit en todos los workspaces
npm run build:nutriologos  # build de producción
```

CI (`.github/workflows/ci.yml`) levanta un Postgres efímero, aplica las migraciones,
verifica que no haya deriva entre `schema.prisma` y las migraciones, y corre
type-check, tests y build en cada PR.

## Estado

- **Autenticación real** (Auth.js): alta de nutriólogo, verificación de correo,
  acceso con contraseña o Google, y sesión JWT validada en middleware y en cada
  handler de `/api/v1`.
- **Esquema de base de datos completo** (Prisma/PostgreSQL): usuarios, pacientes,
  expediente clínico, antropometría, alimentos, planes, seguimiento, agenda,
  mensajes, cobros, suscripciones y bitácora de auditoría.
- Las pantallas del panel **todavía leen datos demo desde `localStorage`**
  (`src/store/app-state.tsx`); se conectan a la base en la fase 1 del plan.
- La llamada a la IA pasa por `/api/ai` (route handler): la API key vive solo en el
  servidor y los errores siguen el formato de `rules/api-conventions.md`.
