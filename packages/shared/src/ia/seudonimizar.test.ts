import {
  MARCADOR,
  contieneIdentificadores,
  seudonimizarOpcional,
  seudonimizarTexto,
} from './seudonimizar';

const IDENTIFICADORES = {
  nombre: 'María Fernanda López',
  email: 'maria.lopez@correo.mx',
  telefono: '55 1234 5678',
};

describe('seudonimizarTexto', () => {
  it('sustituye el nombre completo por el marcador', () => {
    const texto = 'María Fernanda López acude a control.';

    expect(seudonimizarTexto(texto, IDENTIFICADORES)).toBe(`${MARCADOR.nombre} acude a control.`);
  });

  it('sustituye también el nombre de pila suelto', () => {
    const texto = 'María comenta que duerme mal.';

    expect(seudonimizarTexto(texto, IDENTIFICADORES)).toBe(
      `${MARCADOR.nombre} comenta que duerme mal.`,
    );
  });

  it('ignora mayúsculas y minúsculas al comparar el nombre', () => {
    expect(seudonimizarTexto('LÓPEZ refiere mejoría.', IDENTIFICADORES)).toBe(
      `${MARCADOR.nombre} refiere mejoría.`,
    );
  });

  it('no borra palabras cortas que coinciden con partes del nombre', () => {
    const texto = 'de la dieta';

    expect(seudonimizarTexto(texto, { nombre: 'Ana de la Torre' })).toBe(texto);
  });

  it('sustituye correos que no están en el expediente', () => {
    const texto = 'Escribir a la mamá: contacto@familia.com';

    expect(seudonimizarTexto(texto, IDENTIFICADORES)).toBe(
      `Escribir a la mamá: ${MARCADOR.email}`,
    );
  });

  it('sustituye teléfonos que no están en el expediente', () => {
    const texto = 'Dejar recado al 5598765432.';

    expect(seudonimizarTexto(texto, IDENTIFICADORES)).toBe(`Dejar recado al ${MARCADOR.telefono}.`);
  });

  it('respeta las cifras clínicas de cuatro dígitos o menos', () => {
    const texto = 'Meta de 2100 kcal con 145 g de proteína y peso de 78.4 kg.';

    expect(seudonimizarTexto(texto, IDENTIFICADORES)).toBe(texto);
  });

  it('funciona sin identificadores conocidos', () => {
    expect(seudonimizarTexto('Contacto: alguien@dominio.mx')).toBe(`Contacto: ${MARCADOR.email}`);
  });
});

describe('seudonimizarOpcional', () => {
  it('devuelve null cuando el texto está vacío o ausente', () => {
    expect(seudonimizarOpcional(null)).toBeNull();
    expect(seudonimizarOpcional('   ')).toBeNull();
  });

  it('seudonimiza y recorta cuando hay texto', () => {
    expect(seudonimizarOpcional('  María tolera bien la dieta ', IDENTIFICADORES)).toBe(
      `${MARCADOR.nombre} tolera bien la dieta`,
    );
  });
});

describe('contieneIdentificadores', () => {
  it('detecta un correo residual', () => {
    expect(contieneIdentificadores('mándalo a x@y.mx')).toBe(true);
  });

  it('detecta un teléfono residual', () => {
    expect(contieneIdentificadores('marcar 5512345678')).toBe(true);
  });

  it('detecta el nombre del paciente', () => {
    expect(contieneIdentificadores('López viene el martes', IDENTIFICADORES)).toBe(true);
  });

  it('no marca un texto ya seudonimizado', () => {
    const limpio = seudonimizarTexto(
      'María Fernanda López, maria.lopez@correo.mx, 55 1234 5678',
      IDENTIFICADORES,
    );

    expect(contieneIdentificadores(limpio, IDENTIFICADORES)).toBe(false);
  });

  it('es estable al repetirse sobre el mismo texto', () => {
    const texto = 'sin datos personales, 2100 kcal';

    expect(contieneIdentificadores(texto)).toBe(false);
    expect(contieneIdentificadores(texto)).toBe(false);
  });
});
