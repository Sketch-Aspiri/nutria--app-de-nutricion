# Auditoría de seguridad — fase 8

Fecha: 2026-07-24
Alcance: `apps/web`, dependencias del monorepo, CI/CD, autenticación,
autorización, cifrado de datos clínicos, privacidad, observabilidad y secretos.

## Resultado ejecutivo

La auditoría no encontró secretos reales versionados, vulnerabilidades conocidas
en dependencias ni una ruta de acceso cruzado a expedientes. Las rutas clínicas
revisadas filtran por el nutriólogo autenticado y responden 404 cuando el recurso
no le pertenece.

Los hallazgos de lanzamiento que sí podían resolverse en código quedaron
corregidos: rate limiting distribuido y seudonimizado, Sentry sin información
clínica, cifrado y rotación de columnas sensibles, auditoría de accesos y firmas,
exportación ARCO acotada, cabeceras de seguridad, dependencias, CI fijado por SHA
y protección adicional contra archivos de secretos.

No se declara todavía un **go-live comercial**. El código de la fase está
terminado, pero la promoción a producción permanece bloqueada por configuración
externa y por los controles residuales enumerados abajo.

## Controles implementados

- AES-256-GCM con IV aleatorio, AAD por tipo de columna, identificador de clave,
  lectura transitoria con claves anteriores y backfill idempotente de texto
  legado o cifrado con una clave antigua.
- Cifrado de antecedentes, medicamentos, mensajes y notas de consulta; el
  contexto de IA descifra únicamente después de comprobar pertenencia.
- Notas clínicas persistidas, firmables e inmutables después de la firma.
- Registro de auditoría sin PHI para lectura/exportación de pacientes,
  consentimiento, restricción de tratamiento y operaciones de notas.
- Consentimiento explícito de datos sensibles y versión del aviso de privacidad;
  aviso integral y flujo de exportación del expediente.
- Sentry con trazas desactivadas y sanitización de usuario, request, cookies,
  cabeceras, contexto, breadcrumbs, mensajes y stack frames no permitidos.
- Rate limiting con Upstash en producción, cierre seguro si el proveedor no está
  disponible y llaves HMAC que no revelan correo ni IP.
- Cabeceras CSP, HSTS, `nosniff`, política de referrer, permisos y protección de
  framing.
- Acciones de GitHub fijadas por hash, permisos mínimos, Dependabot y
  `npm audit --audit-level=high` en CI.

## Hallazgos corregidos durante la auditoría

| Severidad original | Hallazgo | Corrección |
|---|---|---|
| Alta | El backfill no rotaba sobres cifrados con una clave anterior | Detección de `keyId`, descifrado con claves anteriores y recifrado con la activa |
| Alta | Identificadores sin seudonimizar en el rate limit remoto | HMAC con clave exclusiva y analítica de Upstash desactivada |
| Alta | Acciones de terceros mutables y permisos implícitos en CI | SHA inmutable y `contents: read` |
| Media | Sentry podía conservar contextos o spans | Trazas a cero, eliminación de contextos/spans y allowlist de stack |
| Media | Exportación de expediente sin límite operativo | 3 solicitudes/hora, conteo previo y tope de 10 000 filas |
| Media | Fallback local permisivo ante una falla de Upstash | Fail-closed en producción; fallback acotado sólo en desarrollo |
| Media | URLs de videollamada aceptaban HTTP | Validación exclusiva de HTTPS |

## Riesgos residuales antes del go-live comercial

1. **Vinculación criptográfica por registro — media.** El AAD identifica la
   columna, no el UUID de la fila. Un atacante con escritura directa en la base
   podría trasplantar un ciphertext válido entre dos filas del mismo tipo. La
   siguiente versión del sobre debe incluir `recordId + column` y migrarse con
   expand-contract.
2. **Ciclo ARCO y retención legal — media.** Acceso y restricción de tratamiento
   están implementados. La cancelación definitiva requiere que negocio/legal
   defina retención de expediente, bloqueo por obligación sanitaria, identidad
   del solicitante, SLA y autorización de borrado.
3. **Evidencia de consentimiento — media.** Se guarda versión, momento, método y
   actor, pero el alta hecha por el nutriólogo no equivale a una confirmación
   electrónica directa del paciente. Incorporar enlace de confirmación firmado o
   firma equivalente antes de usar el sistema fuera del piloto controlado.
4. **Defensa de cuenta — media.** Falta MFA y reautenticación para exportaciones;
   existen además diferencias menores de respuesta que podrían ayudar a enumerar
   cuentas. Añadir MFA/WebAuthn o TOTP y reautenticación para acciones sensibles.
5. **CSP — media.** `script-src` conserva `unsafe-inline` por compatibilidad con
   Next.js. Migrar a nonces por request y verificar todos los flujos.
6. **Campos clínicos adicionales — media.** El conjunto solicitado está cifrado,
   pero otros campos libres del expediente pueden contener salud por la forma en
   que los usuarios los usan. Inventariarlos y extender el sobre de cifrado.
7. **Auditoría atómica — baja.** La nota y su evento de auditoría se escriben en
   operaciones consecutivas. Un fallo entre ambas podría dejar una escritura sin
   evidencia; moverlas a una sola transacción.
8. **Cadena de dependencias — baja.** Los `overrides` de `postcss` y `sharp`
   eliminan avisos de `npm audit`, aunque exceden los rangos declarados por la
   versión actual de Next. Retirarlos cuando Next los adopte oficialmente.
9. **Auth.js beta — informativa.** Seguir las notas de versión y fijar una versión
   estable antes del lanzamiento comercial.

## Verificación

- `npm audit`: 0 vulnerabilidades en 836 dependencias.
- TypeScript: limpio en web, shared y ui-tokens.
- Pruebas: 387 de web y 302 de shared, **689/689 en verde**.
- Prisma: esquema válido.
- Carga local: 1 147 solicitudes a health en 10 segundos, 10 VUs, 0 % de error,
  p95 de 87 ms. El escenario autenticado debe repetirse en preview con una cuenta
  sintética.
- Build de producción: una ejecución previa fue exitosa. La repetición final
  quedó bloqueada por la red restringida del entorno al descargar Fraunces,
  Inter e IBM Plex Mono desde Google Fonts; no fue un error de TypeScript ni de
  la aplicación.

## Dictamen

**Fase 8 de ingeniería: terminada. Go-live: condicionado.** Antes de publicar se
deben aprobar al menos los riesgos residuales 1–6 o mitigarlos, completar los 24
controles de `launch:check`, ejecutar migración/backfill con respaldo, correr la
carga autenticada en preview y obtener evidencia del onboarding de 3–5 pilotos.
