# Estrategia de testing

## Principios

- Todo código nuevo que toque lógica de negocio (cálculo de macros, reglas de adherencia, permisos, facturación) requiere tests. Cambios puramente de estilo/UI no lo requieren, pero sí un smoke test si tocan un flujo crítico (login, registro de comida, pago).
- Los tests documentan comportamiento, no implementación: se prueba lo que el código hace desde afuera (inputs/outputs, requests/responses), no detalles internos que puedan refactorizarse.
- Un test que falla de forma intermitente ("flaky") se arregla o se elimina; no se re-ejecuta hasta que pase ni se marca `skip` sin un issue abierto para arreglarlo.

## Herramientas por app

| App | Unitario/integración | E2E |
|---|---|---|
| `apps/api` (Node) | Jest + Supertest (requests HTTP contra la app en memoria) | Postman/Newman contra ambiente de staging para los flujos críticos |
| `apps/web/*` (Next.js) | Jest + React Testing Library | Playwright |
| `apps/mobile` (React Native) | Jest + React Native Testing Library | Detox (iOS/Android, corre en CI solo en `main` por costo/tiempo) |
| `packages/shared` | Jest (funciones puras: cálculo de calorías, macros, adherencia) | — |

## Pirámide y cobertura esperada

- **Unitarios** (mayoría de los tests): funciones puras en `packages/shared`, servicios del backend con dependencias mockeadas, hooks de datos.
- **Integración**: endpoints del backend contra una base de datos de test real (Postgres en Docker, no mocks de la capa de datos), y componentes de frontend que orquestan varios subcomponentes.
- **E2E** (pocos, cubren solo flujos críticos): login, registro de una comida, asignación de un plan, agendar una cita, checkout de pago.

Cobertura mínima exigida en CI: **80% líneas en `apps/api` y `packages/shared`**, **60% en
`packages/servidor`**, **45% en `apps/web/*` y 60% en `apps/mobile`** (la UI se apoya más en E2E que
en cobertura de líneas). El build falla si baja de estos umbrales.

Los dos últimos números cambiaron en la fase 1 del plan de la app del paciente, cuando la capa de
servidor salió de `apps/web/nutriologos` hacia `packages/servidor`. No se dejó de probar nada: la
cobertura simplemente se contabiliza donde vive el código. Lo que queda en `apps/web/*` es UI, que
antes iba promediada con un backend muy cubierto. `packages/servidor` arranca en 60 y debe subir a
80 —el nivel que esta misma tabla exige al backend— conforme se agreguen los tests de las fases 2 a 5.

## Convenciones

- Un archivo de test por archivo de código, mismo nombre + `.test.ts(x)`, co-ubicado en la misma carpeta (no una carpeta `__tests__` separada).
- Naming de casos: `describe('MealEntryService')` → `it('rechaza una comida con calorías negativas')`, en español o inglés consistente con el resto del archivo, pero siempre describiendo comportamiento, no implementación ("debería..." / "should...").
- Datos de prueba vía *factories* (`packages/shared/test-utils` o equivalente por app), nunca objetos hardcodeados repetidos en cada test.
- Ningún test pega a servicios externos reales (Open Food Facts, Stripe, proveedor de push): se mockean en unitarios/integración y se usan sandboxes/test-mode en E2E.
- Los tests no dependen del orden de ejecución ni comparten estado mutable entre ellos.

## En CI

1. Lint + type-check (`tsc --noEmit`).
2. Tests unitarios + integración por paquete, en paralelo.
3. Cobertura, con falla si no alcanza el umbral.
4. E2E web (Playwright) en cada PR contra un preview deploy.
5. E2E mobile (Detox) solo al mergear a `main`, por tiempo de build.

Un PR no es mergeable si cualquiera de estos pasos falla. Ver `deploy-config.md` para cómo se conecta esto con el pipeline de despliegue.

## Qué NO testear

- Detalles de estilos/CSS exactos (usar snapshot tests con moderación, no como sustituto de tests de comportamiento).
- Librerías de terceros ya testeadas (React Query, React Navigation, etc.) — se testea *cómo las usamos*, no que ellas funcionen.
- Contenido de copy/textos exactos, salvo que el texto sea parte de un contrato (p.ej. un mensaje de error que el frontend parsea).
