# Configuración de despliegue

## Ambientes

| Ambiente | Propósito | Deploy |
|---|---|---|
| `development` | Local, cada dev con su propio Postgres (Docker Compose) | Manual |
| `staging` | Réplica de producción, datos de prueba | Automático en cada push a `main` |
| `production` | Ambiente real | Manual (aprobación requerida), solo desde `main` con tag |

## Backend (`apps/api`)

- **Contenedor**: Docker, imagen construida en CI, publicada a un registry privado.
- **Hosting**: Railway (o equivalente gestionado) para staging; producción en un servicio con auto-scaling básico (ECS/Fargate o Railway según volumen).
- **Base de datos**: PostgreSQL gestionado (Railway/RDS), con backups automáticos diarios y retención de 30 días. Réplica de solo lectura para reporting una vez que el volumen lo justifique (no en el MVP).
- **Migraciones**: herramienta de migraciones del ORM (Prisma/TypeORM), versionadas en el repo. Se corren automáticamente al desplegar, **antes** de levantar la nueva versión de la app, y son siempre reversibles (`up`/`down`) o expand-contract cuando el cambio no es trivialmente reversible (p.ej. renombrar una columna: agregar la nueva, migrar datos, deprecar la vieja en un release posterior).
- **Variables de entorno**: gestionadas por ambiente en el proveedor de hosting (no en el repo). `.env.example` en el repo documenta qué variables existen, sin valores reales. Secretos de terceros (Stripe, proveedor de push, JWT secret) rotables sin downtime (se soporta más de una clave activa durante la rotación).
- **Health check**: endpoint `/v1/health` verificado por el orquestador antes de enrutar tráfico a una nueva instancia.

## Web (`apps/web`)

- **Hosting**: Vercel.
- **Preview deploys**: automático en cada PR, con su propia URL para QA manual y para correr Playwright.
- **Producción**: deploy automático al mergear a `main`, con rollback de un click desde Vercel si algo falla.
- **Variables de entorno**: configuradas en Vercel por ambiente (`Development`/`Preview`/`Production`); nunca se commitean claves reales.

## Mobile (`apps/mobile`)

- **Build**: Expo Application Services (EAS Build) para iOS y Android.
- **Distribución interna**: EAS Update (OTA) para cambios de JS que no tocan código nativo, disponible para QA interno en cada push a `main`.
- **Releases a stores**: EAS Submit, manual, con checklist de revisión (ver `code-review.md`) y changelog. Actualizaciones OTA a producción solo para fixes que no cambian código nativo ni requieren nueva revisión de la store; cambios de features grandes van por release completo.
- **Variables de entorno**: por perfil de build en `eas.json` (`development`, `preview`, `production`), sin secretos de backend embebidos en el bundle (todo secreto vive en el servidor).

## Pipeline de CI/CD (GitHub Actions)

1. `on: pull_request` → lint, type-check, tests (ver `testing.md`), build de cada app.
2. `on: push to main` → repite lo anterior + deploy automático a `staging` (web y api) + build OTA de mobile a canal interno.
3. `on: tag v*` → deploy a `production` de web y api (con aprobación manual en el ambiente de GitHub), y dispara EAS Build/Submit para mobile.

## Rollback

- **Web**: rollback instantáneo al deployment anterior desde Vercel.
- **API**: se mantiene la imagen Docker anterior taggeada; rollback = redeploy de esa imagen. Las migraciones de base de datos deben ser compatibles con la versión anterior del código durante una ventana de despliegue (por eso el patrón expand-contract).
- **Mobile**: rollback de una actualización OTA revirtiendo el canal a la versión anterior; si el problema es de una release de store, se requiere una nueva release (no hay rollback real en las stores).

## Observabilidad

- Logs centralizados (backend) y Sentry (errores de backend, web y mobile) en todos los ambientes salvo `development`.
- Alertas mínimas: error rate de la API, fallos de webhook de pago, caída del health check.
