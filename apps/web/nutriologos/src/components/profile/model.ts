export type FormularioMarca = {
  nombreCompleto: string;
  cedula: string;
  especialidad: string;
  telefono: string;
  marcaNombre: string;
  marcaColor: string;
  marcaLogo: string | null;
};

export const FORMULARIO_MARCA_VACIO: FormularioMarca = {
  nombreCompleto: '',
  cedula: '',
  especialidad: '',
  telefono: '',
  marcaNombre: '',
  marcaColor: '#065f46',
  marcaLogo: null,
};
