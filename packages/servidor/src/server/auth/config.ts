import { NextResponse } from 'next/server';
import type { NextAuthConfig } from 'next-auth';
import Google from 'next-auth/providers/google';

/**
 * Configuración compartida entre el middleware (runtime edge) y el servidor.
 * No puede importar Prisma ni bcrypt: el middleware no corre en Node.
 * El proveedor de credenciales y el adaptador se agregan en `./index.ts`.
 */

const SESION_MAX_SEGUNDOS = 60 * 60 * 8;

/** Prefijos que exigen sesión con correo verificado. */
const RUTAS_PANEL = [
  '/inicio',
  '/pacientes',
  '/agenda',
  '/mensajes',
  '/facturacion',
  '/plantillas',
  '/marca',
  '/suscripcion',
];

/** Rutas de autenticación: quien ya tiene sesión activa no debería verlas. */
const RUTAS_AUTH = ['/login', '/registro'];
const RUTAS_SUPERADMIN = ['/superadmin'];
const RUTA_CUENTA_INACTIVA = '/cuenta-inactiva';

export const googleHabilitado = Boolean(
  process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET,
);

function coincidePrefijo(pathname: string, prefijos: string[]): boolean {
  return prefijos.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export const authConfig = {
  trustHost: true,
  pages: { signIn: '/login' },
  session: { strategy: 'jwt', maxAge: SESION_MAX_SEGUNDOS },
  providers: googleHabilitado ? [Google] : [],
  callbacks: {
    jwt({ token, user, account }) {
      // `user` solo llega en el inicio de sesión; después el token se reutiliza.
      if (user) {
        const role = user.role ?? 'NUTRITIONIST';
        token.userId = user.id;
        token.role = role;
        // Google ya validó el correo; el alta con contraseña exige verificarlo.
        token.emailVerificado = Boolean(user.emailVerified) || account?.provider === 'google';
        token.cuentaActiva = role !== 'NUTRITIONIST' || user.cuentaActiva === true;
      }
      return token;
    },
    session({ session, token }) {
      if (token.userId) session.user.id = token.userId;
      session.user.role = token.role ?? 'NUTRITIONIST';
      session.user.emailVerificado = token.emailVerificado ?? false;
      // Los JWT emitidos antes de agregar este claim no lo traen. Se dejan
      // pasar en edge y las barreras Node consultan la vigencia real en BD.
      session.user.cuentaActiva = token.cuentaActiva ?? true;
      return session;
    },
    authorized({ auth, request }) {
      const { nextUrl } = request;
      const usuario = auth?.user;

      if (coincidePrefijo(nextUrl.pathname, RUTAS_SUPERADMIN)) {
        if (!usuario) return false;
        if (usuario.role !== 'SUPERADMIN') {
          return NextResponse.redirect(new URL('/inicio', nextUrl));
        }
        return true;
      }

      if (coincidePrefijo(nextUrl.pathname, RUTAS_PANEL)) {
        if (!usuario) return false; // Auth.js redirige a /login con callbackUrl.
        if (!usuario.emailVerificado) {
          return NextResponse.redirect(new URL('/verificar', nextUrl));
        }
        if (!usuario.cuentaActiva) {
          return NextResponse.redirect(new URL(RUTA_CUENTA_INACTIVA, nextUrl));
        }
        return true;
      }

      if (nextUrl.pathname === RUTA_CUENTA_INACTIVA) {
        if (!usuario) return false;
        // No redirigir por `cuentaActiva`: el token puede seguir en `true`
        // hasta ocho horas después de vencer. El layout Node ya consultó la BD
        // y necesita poder aterrizar aquí sin formar un bucle de redirecciones.
        return true;
      }

      if (coincidePrefijo(nextUrl.pathname, RUTAS_AUTH) && usuario?.emailVerificado) {
        const destino = usuario.role === 'SUPERADMIN' ? '/superadmin/nutriologas' : '/pacientes';
        return NextResponse.redirect(new URL(destino, nextUrl));
      }

      return true;
    },
  },
} satisfies NextAuthConfig;
