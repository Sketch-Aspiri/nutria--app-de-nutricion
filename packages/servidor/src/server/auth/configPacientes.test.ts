import { NextRequest } from 'next/server';

/**
 * `next-auth/providers/google` se publica solo como ESM y este paquete se
 * transpila a CommonJS para Jest. Se sustituye por un doble: la configuración
 * compartida únicamente lo mete en `providers` cuando hay credenciales de
 * Google en el entorno —que en los tests no las hay—, así que nunca se ejecuta.
 */
jest.mock('next-auth/providers/google', () => ({
  __esModule: true,
  default: () => ({ id: 'google', name: 'Google', type: 'oauth' }),
}));

import { authConfigPacientes } from './configPacientes';

/**
 * Reglas de navegación de la app del paciente.
 *
 * Esto **no** es el control de acceso a los datos —ese vive en
 * `requierePaciente`, en cada handler, y se prueba en `guards.test.ts`—. Aquí
 * solo se verifica a quién deja pasar el middleware y a dónde manda al resto:
 * un fallo aquí muestra pantallas vacías o encierra a alguien en un bucle de
 * redirecciones, no filtra un expediente.
 */

type Autorizado = NonNullable<(typeof authConfigPacientes)['callbacks']>['authorized'];
type Resultado = ReturnType<NonNullable<Autorizado>>;

const BASE = 'https://pacientes.nutria.mx';

function llamar(pathname: string, role: string | null): Resultado {
  const request = new NextRequest(new URL(pathname, BASE));
  const auth = role === null ? null : { user: { id: 'u1', role }, expires: '2099-01-01' };

  // `authorized` está definido en el objeto literal, así que existe siempre;
  // el `!` documenta eso en vez de esconder un opcional real.
  return authConfigPacientes.callbacks.authorized!({
    auth,
    request,
  } as Parameters<NonNullable<Autorizado>>[0]);
}

/** Las respuestas de redirección traen el destino en la cabecera `location`. */
function destinoDe(resultado: Resultado): string {
  const respuesta = resultado as Response;
  expect(respuesta).toBeInstanceOf(Response);
  return new URL(respuesta.headers.get('location') ?? '').pathname;
}

describe('authConfigPacientes.authorized — sin sesión', () => {
  it.each(['/entrar', '/activar', '/privacidad'])('deja ver %s', (ruta) => {
    expect(llamar(ruta, null)).toBe(true);
  });

  it('deja ver las subrutas públicas, como el enlace de invitación con token', () => {
    expect(llamar('/activar/abc123', null)).toBe(true);
  });

  it.each(['/', '/plan', '/progreso', '/mensajes', '/perfil'])('exige sesión en %s', (ruta) => {
    expect(llamar(ruta, null)).toBe(false);
  });

  it('no confunde una ruta que empieza igual que una pública', () => {
    // `/entrarme` no es `/entrar`: el prefijo se compara por segmento.
    expect(llamar('/entrarme', null)).toBe(false);
  });
});

describe('authConfigPacientes.authorized — sesión de paciente', () => {
  it('deja entrar a las pantallas de la app', () => {
    expect(llamar('/', 'END_USER')).toBe(true);
    expect(llamar('/progreso', 'END_USER')).toBe(true);
  });

  it('saca de /entrar a quien ya tiene sesión', () => {
    expect(destinoDe(llamar('/entrar', 'END_USER'))).toBe('/');
  });

  it('deja abrir /activar aunque haya sesión', () => {
    // El enlace de invitación puede abrirse en un navegador donde ya hay otra
    // cuenta iniciada; redirigirlo dejaría la invitación sin poder consumirse.
    expect(llamar('/activar', 'END_USER')).toBe(true);
  });
});

describe('authConfigPacientes.authorized — sesión que no es de paciente', () => {
  it.each(['NUTRITIONIST', 'ADMIN'])('manda a %s a /entrar con el motivo', (role) => {
    const resultado = llamar('/', role);
    const respuesta = resultado as Response;

    expect(destinoDe(resultado)).toBe('/entrar');
    expect(new URL(respuesta.headers.get('location') ?? '').searchParams.get('error')).toBe(
      'sin_acceso',
    );
  });

  it('no rebota indefinidamente: en /entrar lo deja quedarse', () => {
    // Sin este corte, `authorized` rechazaría, Auth.js devolvería a /entrar, y
    // desde ahí volvería a rechazar. El bucle es el bug que este caso cubre.
    expect(llamar('/entrar', 'NUTRITIONIST')).toBe(true);
  });

  it('la regla de rol gana sobre el resto de rutas públicas', () => {
    expect(destinoDe(llamar('/privacidad', 'NUTRITIONIST'))).toBe('/entrar');
  });
});

describe('authConfigPacientes — herencia', () => {
  it('conserva la estrategia de sesión y los callbacks compartidos', () => {
    expect(authConfigPacientes.session?.strategy).toBe('jwt');
    expect(authConfigPacientes.callbacks.jwt).toBeDefined();
    expect(authConfigPacientes.callbacks.session).toBeDefined();
  });

  it('manda a /entrar, no al login del panel', () => {
    expect(authConfigPacientes.pages?.signIn).toBe('/entrar');
  });
});
