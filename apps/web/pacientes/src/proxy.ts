import NextAuth from 'next-auth';

import { authConfigPacientes } from '@/server/auth/configPacientes';

/**
 * Middleware de la app del paciente.
 *
 * Solo la configuración compartida: no abre conexiones a la base de datos —el
 * runtime edge no puede— así que las reglas viven en
 * `authConfigPacientes.callbacks.authorized`. La comprobación de verdad (rol,
 * expediente vivo, paciente activo) la hace `requierePaciente` en cada handler
 * de la API: esto solo evita que la navegación muestre pantallas vacías a quien
 * no tiene sesión.
 */
const { auth } = NextAuth(authConfigPacientes);
export default auth;

export const config = {
  // Se excluyen estáticos, el manifiesto, el service worker y las rutas de API,
  // que validan su propia sesión. `sw.js` tiene que quedar fuera: un service
  // worker redirigido a /entrar se instalaría con HTML en lugar de JavaScript.
  matcher: [
    '/((?!api|_next/static|_next/image|manifest.webmanifest|sw.js|offline.html|favicon.ico|.*\.(?:svg|png|jpg|jpeg|webp)$).*)',
  ],
};
