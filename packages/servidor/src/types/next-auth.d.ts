import type { UserRole } from '@prisma/client';
import type { DefaultSession } from 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      role: UserRole;
      emailVerificado: boolean;
    } & DefaultSession['user'];
  }

  interface User {
    role?: UserRole;
    emailVerified?: Date | null;
  }
}

// `next-auth/jwt` solo reexporta desde `@auth/core/jwt`; para que el merge de
// interfaces surta efecto hay que aumentar el módulo donde JWT está declarado.
declare module '@auth/core/jwt' {
  interface JWT {
    userId?: string;
    role?: UserRole;
    emailVerificado?: boolean;
  }
}
