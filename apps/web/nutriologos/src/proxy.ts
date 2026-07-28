import NextAuth from 'next-auth';

import { authConfig } from '@/server/auth/config';

// Solo la configuración compartida: el proxy no abre conexiones a la base de
// datos. Las reglas de acceso viven en `authConfig.callbacks.authorized`.
const { auth } = NextAuth(authConfig);
export default auth;

export const config = {
  // Se excluyen estáticos, imágenes y las rutas de API (cada handler valida su
  // propia sesión con `requiereNutriologo`).
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp)$).*)'],
};
