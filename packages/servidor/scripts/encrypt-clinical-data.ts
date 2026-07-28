import { PrismaClient } from '@prisma/client';

import {
  decryptText,
  encryptText,
  ENCRYPTION_CONTEXT,
  needsEncryptionRefresh,
} from '../src/server/crypto';

const prisma = new PrismaClient();
const EXECUTE = process.argv.includes('--execute');
const BATCH_SIZE = 100;

type Counts = {
  medicalRecords: number;
  messages: number;
  consultationNotes: number;
};

const counts: Counts = {
  medicalRecords: 0,
  messages: 0,
  consultationNotes: 0,
};

async function migrateMedicalRecords(): Promise<void> {
  let cursor: string | undefined;
  for (;;) {
    const rows = await prisma.medicalRecord.findMany({
      orderBy: { id: 'asc' },
      take: BATCH_SIZE,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: { id: true, antecedentes: true, medicamentos: true },
    });
    if (rows.length === 0) break;

    for (const row of rows) {
      const needsRefresh =
        needsEncryptionRefresh(row.antecedentes) ||
        needsEncryptionRefresh(row.medicamentos);
      if (!needsRefresh) continue;
      counts.medicalRecords += 1;
      if (!EXECUTE) continue;

      await prisma.medicalRecord.update({
        where: { id: row.id },
        data: {
          antecedentes:
            needsEncryptionRefresh(row.antecedentes)
              ? encryptText(
                  decryptText(
                    row.antecedentes,
                    ENCRYPTION_CONTEXT.medicalAntecedentes,
                  ),
                  ENCRYPTION_CONTEXT.medicalAntecedentes,
                )
              : row.antecedentes,
          medicamentos:
            needsEncryptionRefresh(row.medicamentos)
              ? encryptText(
                  decryptText(
                    row.medicamentos,
                    ENCRYPTION_CONTEXT.medicalMedicamentos,
                  ),
                  ENCRYPTION_CONTEXT.medicalMedicamentos,
                )
              : row.medicamentos,
        },
      });
    }
    cursor = rows.at(-1)?.id;
  }
}

async function migrateMessages(): Promise<void> {
  let cursor: string | undefined;
  for (;;) {
    const rows = await prisma.message.findMany({
      orderBy: { id: 'asc' },
      take: BATCH_SIZE,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: { id: true, texto: true },
    });
    if (rows.length === 0) break;

    for (const row of rows) {
      if (!needsEncryptionRefresh(row.texto)) continue;
      counts.messages += 1;
      if (!EXECUTE) continue;
      await prisma.message.update({
        where: { id: row.id },
        data: {
          texto: encryptText(
            decryptText(row.texto, ENCRYPTION_CONTEXT.messageText),
            ENCRYPTION_CONTEXT.messageText,
          ) as string,
        },
      });
    }
    cursor = rows.at(-1)?.id;
  }
}

async function migrateConsultationNotes(): Promise<void> {
  let cursor: string | undefined;
  for (;;) {
    const rows = await prisma.consultationNote.findMany({
      orderBy: { id: 'asc' },
      take: BATCH_SIZE,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    if (rows.length === 0) break;

    for (const row of rows) {
      const values = [row.motivo, row.hallazgos, row.plan, row.seguimiento];
      if (values.every((value) => !needsEncryptionRefresh(value))) continue;
      counts.consultationNotes += 1;
      if (!EXECUTE) continue;

      await prisma.consultationNote.update({
        where: { id: row.id },
        data: {
          motivo:
            needsEncryptionRefresh(row.motivo)
              ? encryptText(
                  decryptText(
                    row.motivo,
                    ENCRYPTION_CONTEXT.consultationMotivo,
                  ),
                  ENCRYPTION_CONTEXT.consultationMotivo,
                )
              : row.motivo,
          hallazgos:
            needsEncryptionRefresh(row.hallazgos)
              ? encryptText(
                  decryptText(
                    row.hallazgos,
                    ENCRYPTION_CONTEXT.consultationHallazgos,
                  ),
                  ENCRYPTION_CONTEXT.consultationHallazgos,
                )
              : row.hallazgos,
          plan:
            needsEncryptionRefresh(row.plan)
              ? encryptText(
                  decryptText(row.plan, ENCRYPTION_CONTEXT.consultationPlan),
                  ENCRYPTION_CONTEXT.consultationPlan,
                )
              : row.plan,
          seguimiento:
            needsEncryptionRefresh(row.seguimiento)
              ? encryptText(
                  decryptText(
                    row.seguimiento,
                    ENCRYPTION_CONTEXT.consultationSeguimiento,
                  ),
                  ENCRYPTION_CONTEXT.consultationSeguimiento,
                )
              : row.seguimiento,
        },
      });
    }
    cursor = rows.at(-1)?.id;
  }
}

async function main(): Promise<void> {
  await migrateMedicalRecords();
  await migrateMessages();
  await migrateConsultationNotes();

  const total =
    counts.medicalRecords + counts.messages + counts.consultationNotes;
  console.info(
    `${EXECUTE ? 'Migrados' : 'Pendientes'}: ${total} registros ` +
      `(expedientes=${counts.medicalRecords}, mensajes=${counts.messages}, ` +
      `notas=${counts.consultationNotes}).`,
  );
  if (!EXECUTE && total > 0) {
    console.info('Ejecuta npm run db:encrypt para aplicar el backfill.');
    process.exitCode = 2;
  }
}

main()
  .catch((error: unknown) => {
    console.error(
      'El backfill de cifrado falló:',
      error instanceof Error ? error.name : 'UnknownError',
    );
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
