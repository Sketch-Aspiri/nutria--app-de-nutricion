export type SenalesOnboarding = {
  perfilProfesionalCompleto: boolean;
  pacientes: number;
  planes: number;
  citas: number;
};

export type PasoOnboarding = {
  id: 'perfil' | 'paciente' | 'plan' | 'cita';
  titulo: string;
  descripcion: string;
  href: string;
  completado: boolean;
};

export function calcularOnboarding(senales: SenalesOnboarding): {
  pasos: PasoOnboarding[];
  completados: number;
  porcentaje: number;
} {
  const pasos: PasoOnboarding[] = [
    {
      id: 'perfil',
      titulo: 'Completa tu identidad profesional',
      descripcion: 'Agrega cédula, especialidad y teléfono para personalizar tus entregables.',
      href: '/marca',
      completado: senales.perfilProfesionalCompleto,
    },
    {
      id: 'paciente',
      titulo: 'Registra tu primer paciente',
      descripcion: 'Obtén su consentimiento explícito antes de capturar datos de salud.',
      href: '/pacientes',
      completado: senales.pacientes > 0,
    },
    {
      id: 'plan',
      titulo: 'Crea un plan alimenticio',
      descripcion: 'Calcula requerimientos, revisa equivalentes y comparte el plan.',
      href: '/pacientes',
      completado: senales.planes > 0,
    },
    {
      id: 'cita',
      titulo: 'Agenda el seguimiento',
      descripcion: 'Programa una cita para probar recordatorios y continuidad clínica.',
      href: '/agenda',
      completado: senales.citas > 0,
    },
  ];
  const completados = pasos.filter((paso) => paso.completado).length;

  return {
    pasos,
    completados,
    porcentaje: Math.round((completados / pasos.length) * 100),
  };
}
