import {
  CATALOGO_PLANES,
  calcularEntitlements,
  calcularLimiteUso,
  esSuscripcionVigente,
  formatearPrecioMXN,
  planDelCatalogo,
  precioDe,
} from './planes';

describe('catálogo de planes', () => {
  it('tiene ficha para los tres planes del enum de la base', () => {
    expect(CATALOGO_PLANES.map((p) => p.clave)).toEqual(['FREE', 'PRO', 'CLINICA']);
  });

  it('cotiza Pro mensual y anual, y Free en cero', () => {
    expect(precioDe('PRO', 'MENSUAL')?.centavos).toBe(49_900);
    expect(precioDe('PRO', 'ANUAL')?.centavos).toBe(499_000);
    expect(precioDe('FREE', 'MENSUAL')?.centavos).toBe(0);
  });

  it('no ofrece anualidad donde no existe', () => {
    expect(precioDe('CLINICA', 'ANUAL')).toBeUndefined();
  });

  it('solo Pro trae periodo de prueba', () => {
    expect(planDelCatalogo('PRO').diasPrueba).toBe(14);
    expect(planDelCatalogo('FREE').diasPrueba).toBe(0);
  });
});

describe('formatearPrecioMXN', () => {
  it('escribe centavos con dos dígitos y separador de miles', () => {
    expect(formatearPrecioMXN(49_900)).toBe('$499.00 MXN');
    expect(formatearPrecioMXN(129_900)).toBe('$1,299.00 MXN');
    expect(formatearPrecioMXN(0)).toBe('$0.00 MXN');
    expect(formatearPrecioMXN(4_990_50)).toBe('$4,990.50 MXN');
  });
});

describe('esSuscripcionVigente', () => {
  it('mantiene el acceso mientras Stripe reintenta el cobro', () => {
    expect(esSuscripcionVigente('PAST_DUE')).toBe(true);
    expect(esSuscripcionVigente('TRIALING')).toBe(true);
    expect(esSuscripcionVigente('ACTIVE')).toBe(true);
  });

  it('corta cuando Stripe se rinde', () => {
    expect(esSuscripcionVigente('CANCELED')).toBe(false);
    expect(esSuscripcionVigente('UNPAID')).toBe(false);
    expect(esSuscripcionVigente('LO_QUE_SEA')).toBe(false);
  });
});

describe('calcularLimiteUso', () => {
  it('marca alcanzado al llegar al tope', () => {
    expect(calcularLimiteUso(3, 3)).toMatchObject({ restantes: 0, alcanzado: true });
    expect(calcularLimiteUso(2, 3)).toMatchObject({ restantes: 1, alcanzado: false });
  });

  it('nunca reporta restantes negativas si el contador se pasó', () => {
    expect(calcularLimiteUso(9, 3)).toMatchObject({ restantes: 0, alcanzado: true });
  });

  it('trata el límite nulo como ilimitado', () => {
    expect(calcularLimiteUso(500, null)).toMatchObject({
      limite: null,
      restantes: null,
      alcanzado: false,
    });
  });
});

describe('calcularEntitlements', () => {
  const base = {
    plan: 'FREE' as const,
    estado: 'ACTIVE' as const,
    modo: 'produccion' as const,
    pacientesActivos: 0,
    plantillasGuardadas: 0,
    generacionesIaDelMes: 0,
  };

  it('aplica el cupo de 3 pacientes del plan Free', () => {
    const e = calcularEntitlements({ ...base, pacientesActivos: 3 });
    expect(e.pacientes).toMatchObject({ limite: 3, restantes: 0, alcanzado: true });
    expect(e.marcaBlanca).toBe(false);
  });

  it('Pro no tiene cupo de pacientes y sí marca blanca', () => {
    const e = calcularEntitlements({ ...base, plan: 'PRO', pacientesActivos: 120 });
    expect(e.pacientes.alcanzado).toBe(false);
    expect(e.pacientes.limite).toBeNull();
    expect(e.marcaBlanca).toBe(true);
    expect(e.ia.limite).toBe(150);
  });

  it('degrada a Free cuando la suscripción dejó de estar vigente', () => {
    const e = calcularEntitlements({
      ...base,
      plan: 'PRO',
      estado: 'CANCELED',
      pacientesActivos: 5,
    });
    expect(e.plan).toBe('FREE');
    expect(e.pacientes.alcanzado).toBe(true);
    expect(e.marcaBlanca).toBe(false);
    // El estado real se conserva para que la UI pueda explicar el porqué.
    expect(e.estado).toBe('CANCELED');
  });

  it('en beta nadie topa con nada, ni siquiera en Free', () => {
    const e = calcularEntitlements({
      ...base,
      modo: 'beta',
      pacientesActivos: 80,
      plantillasGuardadas: 40,
      generacionesIaDelMes: 900,
    });
    expect(e.plan).toBe('FREE');
    expect(e.pacientes.alcanzado).toBe(false);
    expect(e.plantillas.alcanzado).toBe(false);
    expect(e.ia).toMatchObject({ ilimitada: true, agotada: false, limite: null });
    expect(e.marcaBlanca).toBe(true);
  });
});
