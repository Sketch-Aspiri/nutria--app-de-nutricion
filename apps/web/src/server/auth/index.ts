import { PrismaAdapter } from '@auth/prisma-adapter';
import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { z } from 'zod';

import { prisma } from '@/server/db';
import { logger } from '@/server/logger';

import { authConfig } from './config';
import { normalizarEmail, verifyPassword } from './password';
import { asegurarCuentaNutriologo } from './provisioning';

/**
 * Hash válido de una contraseña aleatoria descartada. Cuando el correo no
 * existe se compara contra él para que el tiempo de respuesta sea el mismo que
 * con un correo real: de lo contrario la latencia revelaría qué cuentas existen.
 */
const HASH_SENUELO = '$2b$12$mk./Rsc6sFDxD5pALO4fkO6P46bl3U/FRpo3Tav9y6Dneeo8xhhB6';

const credencialesSchema = z.object({
  email: z.string().min(1),
  password: z.string().min(1),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma),
  providers: [
    ...authConfig.providers,
    Credentials({
      credentials: {
        email: { label: 'Correo', type: 'email' },
        password: { label: 'Contraseña', type: 'password' },
      },
      async authorize(credentials) {
        const parsed = credencialesSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const email = normalizarEmail(parsed.data.email);
        const usuario = await prisma.user.findUnique({ where: { email } });

        if (!usuario || usuario.deletedAt) {
          await verifyPassword(parsed.data.password, HASH_SENUELO);
          return null;
        }

        const passwordValida = await verifyPassword(parsed.data.password, usuario.passwordHash);
        if (!passwordValida) return null;

        await prisma.user.update({
          where: { id: usuario.id },
          data: { lastLoginAt: new Date() },
        });

        // Se permite iniciar sesión sin verificar el correo: el middleware
        // manda a /verificar, lo que da un mensaje mucho más claro que un
        // "credenciales inválidas" genérico.
        return {
          id: usuario.id,
          email: usuario.email,
          name: usuario.name,
          image: usuario.image,
          role: usuario.role,
          emailVerified: usuario.emailVerified,
        };
      },
    }),
  ],
  events: {
    /** Alta con Google: el proveedor ya validó el correo. */
    async linkAccount({ user }) {
      if (!user.id) return;
      await prisma.user.update({
        where: { id: user.id },
        data: { emailVerified: new Date() },
      });
    },
    async createUser({ user }) {
      if (!user.id) return;
      try {
        await asegurarCuentaNutriologo(user.id, user.name ?? user.email ?? 'Nutriólogo');
      } catch (error: unknown) {
        logger.error('No se pudo provisionar la cuenta del nutriólogo', error);
      }
    },
  },
});
