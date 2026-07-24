# Runbook de lanzamiento — fase 8

Este documento separa lo que puede automatizarse del trabajo que exige control
del titular del dominio, proveedores y personas piloto. No contiene secretos ni
datos reales de pacientes.

## Orden de despliegue

1. Crear una rama/preview con una base Neon aislada y backups habilitados.
2. Configurar las variables de `.env.example` en el proveedor, por ambiente.
3. Ejecutar `npm run launch:check`, `prisma migrate deploy`,
   `npm run db:encrypt:check` y después `npm run db:seed -- --tanda=off`.
4. Si el chequeo encuentra texto clínico legado, respaldar y ejecutar una sola
   vez `npm run db:encrypt`; repetir el chequeo hasta obtener cero pendientes.
5. Validar `/api/v1/health`, registro/verificación, alta con consentimiento,
   expediente, plan/PDF, agenda, mensajes, exportación y borrado lógico.
6. Ejecutar la carga sobre preview y revisar errores/latencia en Sentry.
7. Promover exactamente la versión probada; repetir health y smoke test.

## Dominio y proveedores

- DNS: apuntar el subdominio elegido al proveedor y esperar certificado TLS
  válido antes de cambiar `APP_URL`, `AUTH_URL` y callbacks OAuth.
- Resend: verificar el dominio remitente con SPF/DKIM; comprobar que DMARC no
  rechace recordatorios.
- Sentry: configurar proyecto web, alertas de tasa de errores y latencia; la
  integración elimina cuerpo, correo, UUID, breadcrumbs y contexto libre.
- Upstash: usar una base regional separada por ambiente para rate limiting.
- Neon: usar conexión pooled para runtime y directa para migraciones.
- Stripe: mantener `BILLING_MODE=beta` durante el piloto. Activar cobro solo con
  precios/webhook productivos verificados.

## Rotación y recuperación

- Guardar `ENCRYPTION_KEY` únicamente en el gestor de secretos. Para rotar:
  mover la clave anterior a `ENCRYPTION_PREVIOUS_KEYS`, publicar la nueva con
  otro `ENCRYPTION_KEY_ID`, ejecutar el backfill y retirar la anterior solo
  cuando el chequeo confirme que ya no es necesaria.
- Rollback de aplicación: volver a la versión previa, sin revertir las columnas
  expand-only. No retirar campos hasta completar una fase contract posterior.
- Si una clave se pierde, detener escrituras y escalar el incidente: los datos
  cifrados no pueden recuperarse sin ella.

## Onboarding de la cohorte piloto (3–5 nutriólogos)

1. El responsable define `PILOT_EMAILS` con exactamente 3–5 participantes que
   hayan aceptado la invitación y el aviso de privacidad.
2. Cada participante verifica su correo y completa `/inicio` primero con un
   paciente ficticio.
3. En una sesión guiada de 45 minutos prueba: perfil profesional, consentimiento,
   alta de paciente, plan/PDF, agenda, nota firmada y exportación.
4. Registrar feedback solo con el alias `piloto-01`…`piloto-05`; nunca copiar
   nombres, diagnósticos, medidas ni capturas de expedientes.
5. Ejecutar `npm run pilot:status`. La cohorte está incorporada cuando todas las
   cuentas reportan correo y aviso verificados y onboarding al 100%.
6. Mantener un canal de soporte con horario, responsable y SLA acordados; al
   cerrar el piloto, confirmar continuidad o baja y aplicar la política de
   retención correspondiente.

## Evidencia de salida

- Resultado del CI y auditoría de seguridad, sin hallazgos críticos/altos abiertos.
- Reporte de k6 con umbrales aprobados en preview.
- Captura de `launch:check` sin valores de secretos.
- Health check de producción, dominio TLS y alertas de Sentry operativas.
- `pilot:status` con 3–5 alias al 100%.
