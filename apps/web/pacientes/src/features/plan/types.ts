/**
 * Contratos que la app del paciente lee de `/api/v1/me/meal_plan`,
 * `/api/v1/me/recipes` y `/api/v1/me/activity_plan`.
 *
 * Son la forma serializada, en snake_case, no los modelos de Prisma: la app no
 * conoce el esquema de la base. Nada de lo que se declara aquí incluye
 * `nutritionist_id`, notas clínicas ni comentarios internos del profesional —el
 * serializador ya los omite— y por eso la UI no puede filtrarlos por descuido.
 */

/**
 * El alimento del plan, reducido a lo que la app del paciente muestra.
 *
 * El serializador manda más campos (grupo SMAE, gramos, imagen); no se declaran
 * porque nada los usa todavía y un tipo que promete campos que ninguna pantalla
 * pinta invita a inventarles usos.
 */
export type AlimentoPlan = {
  nombre: string;
  porcion_descripcion: string | null;
};

export type ItemPlan = {
  id: string;
  descripcion_libre: string | null;
  /** Admite medias porciones; opcional porque no todo consumidor lo necesita. */
  cantidad_porciones?: number | null;
  energia_kcal: number;
  proteina_g: number;
  carbohidratos_g: number;
  lipidos_g: number;
  food: AlimentoPlan | null;
};

export type ComidaPlan = {
  id: string;
  orden: number;
  nombre: string;
  horario: string | null;
  descripcion: string | null;
  items: ItemPlan[];
};

/**
 * Plan vigente del paciente.
 *
 * El endpoint solo devuelve planes `ACTIVO` **y** con `compartido_at`, así que
 * aquí no hay que decidir si se muestra: si llegó, es porque la nutrióloga lo
 * aprobó y lo envió. `null` significa "todavía no tienes plan", no un error.
 */
export type PlanPaciente = {
  id: string;
  estado: string;
  calorias_diarias: number;
  proteina_g: number;
  carbos_g: number;
  grasa_g: number;
  nota: string | null;
  compartido_at: string | null;
  pdf_url: string | null;
  updated_at: string;
  comidas: ComidaPlan[];
};

/**
 * Receta que la nutrióloga envió (`estado = ENVIADA`).
 *
 * `ingredientes` viaja como JSON en la base y el serializador solo comprueba
 * que sea un arreglo, así que se declara `unknown[]` y la UI lo normaliza en
 * `ingredientesDeReceta`: una receta antigua con un elemento raro debe
 * mostrarse incompleta, no reventar la pantalla.
 */
export type Receta = {
  id: string;
  nombre: string;
  ingredientes: unknown[];
  pasos: string | null;
  calorias: number | null;
  porciones: number;
  origen: 'MANUAL' | 'IA' | 'PLANTILLA';
  updated_at: string;
};

export type PlanActividad = {
  id: string;
  texto: string;
  compartido_at: string | null;
  updated_at: string;
};

export type Sustitucion = {
  sustituto: string;
  razon: string;
};

/** La cuota que viaja al cliente es la del paciente —mensual— no la de la clínica. */
export type CuotaIaPaciente = {
  limite: number;
  usadas: number;
  restantes: number;
  agotada: boolean;
};

export type RespuestaSustitucion = {
  tipo: 'SUSTITUCION_INGREDIENTE';
  formato: 'estructurado';
  datos: Sustitucion;
  aviso: string;
  cuota: CuotaIaPaciente;
};
