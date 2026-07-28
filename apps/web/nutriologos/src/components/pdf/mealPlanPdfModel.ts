export type MealPlanPdfItem = {
  id: string;
  nombre: string;
  porcion: string;
  cantidadPorciones: number;
  energiaKcal: number;
  proteinaG: number;
  carbohidratosG: number;
  lipidosG: number;
};

export type MealPlanPdfMeal = {
  id: string;
  nombre: string;
  horario: string | null;
  descripcion: string | null;
  items: MealPlanPdfItem[];
};

export type MealPlanPdfData = {
  generadoEn: Date;
  marca: {
    nombre: string;
    color: string;
    logoUrl: string | null;
    profesional: string;
    cedulaProfesional: string | null;
    especialidad: string | null;
  };
  paciente: {
    nombre: string;
  };
  plan: {
    caloriasDiarias: number;
    proteinaG: number;
    carbosG: number;
    grasaG: number;
    nota: string | null;
    comidas: MealPlanPdfMeal[];
  };
};

const COLOR_PREDETERMINADO = '#065f46';

/** Solo se aceptan colores hex para no enviar valores CSS arbitrarios al renderer. */
export function normalizarColorMarca(color: string): string {
  return /^#[0-9a-f]{6}$/i.test(color) ? color : COLOR_PREDETERMINADO;
}

export function numeroPdf(valor: number, maximoDecimales = 1): string {
  return new Intl.NumberFormat('es-MX', {
    maximumFractionDigits: maximoDecimales,
  }).format(valor);
}

export function textoCompacto(texto: string): string {
  return texto.replace(/\s+/g, ' ').trim();
}

export function inicialDeMarca(nombre: string): string {
  return nombre.trim().charAt(0).toUpperCase() || 'N';
}

export function descripcionProfesional(data: MealPlanPdfData): string {
  return [
    data.marca.profesional,
    data.marca.especialidad,
    data.marca.cedulaProfesional ? `Cédula ${data.marca.cedulaProfesional}` : null,
  ]
    .filter(Boolean)
    .join(' - ');
}
