import { pedir } from '@/services/http';

export type NutriologaAdmin = {
  id: string;
  nombre: string;
  email: string;
  fecha_registro: string;
  plan: 'PRO' | 'CLINICA' | 'FREE';
  estado_cuenta: 'ACTIVA' | 'BLOQUEADA';
  acceso_expira: string | null;
  primer_mes_gratis: boolean;
  ultima_activacion: string | null;
  nota_activacion: string | null;
  gestionada_por_stripe: boolean;
};

export type ListaNutriologas = {
  data: NutriologaAdmin[];
  meta: {
    page: number;
    per_page: number;
    total: number;
    activas: number;
    bloqueadas: number;
  };
};

export function obtenerNutriologas(page: number): Promise<ListaNutriologas> {
  return pedir<ListaNutriologas>(`/api/v1/admin/nutritionists?page=${page}&per_page=20`);
}

export function activarCuentaNutriologa(input: {
  id: string;
  nota?: string;
}): Promise<NutriologaAdmin> {
  return pedir<NutriologaAdmin>(`/api/v1/admin/nutritionists/${input.id}/activate`, {
    method: 'POST',
    body: JSON.stringify({ activation_note: input.nota || undefined }),
  });
}
