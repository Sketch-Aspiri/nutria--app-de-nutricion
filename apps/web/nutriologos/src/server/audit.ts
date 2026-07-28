import { Prisma } from '@prisma/client';

import { prisma } from '@/server/db';
import { ipDe } from '@/server/rate-limit';

type AuditEvent = {
  userId: string;
  action: string;
  resource: 'patient' | 'consultation_note';
  resourceId: string;
  request?: Request;
  metadata?: Prisma.InputJsonObject;
};

/** Bitácora clínica allowlisted: nunca recibe nombres, medidas ni texto libre. */
export async function recordAuditEvent(event: AuditEvent): Promise<void> {
  await prisma.auditLog.create({
    data: {
      userId: event.userId,
      accion: event.action,
      recurso: event.resource,
      recursoId: event.resourceId,
      ip: event.request ? ipDe(event.request) : null,
      metadata: event.metadata ?? {},
    },
  });
}
