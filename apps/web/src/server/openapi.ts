import { createDocument } from 'zod-openapi';
import { z } from 'zod';

import {
  actualizarPlanSchema,
  actualizarPlantillaSchema,
  crearPlanSchema,
  crearPlantillaSchema,
  estructuraPlantillaSchema,
} from '@/server/plans/schemas';
import { generarSchema } from '@/server/ai/schemas';
import { checkoutSchema } from '@/server/billing/schemas';
import { actualizarPerfilSchema } from '@/server/profile/schemas';

const uuid = z.string().uuid();
const fechaHora = z.iso.datetime();
const idPath = z.object({
  id: uuid.meta({ description: 'Identificador UUID del recurso' }),
});
const pacientePath = z.object({
  patientId: uuid.meta({ description: 'Identificador UUID del paciente' }),
});
const paginacion = z.object({
  page: z.coerce.number().int().min(1).optional(),
  per_page: z.coerce.number().int().min(1).max(100).optional(),
});
const filtroPlanes = paginacion.extend({
  estado: z.enum(['BORRADOR', 'ACTIVO', 'ARCHIVADO']).optional(),
});

const errorSchema = z
  .object({
    error: z.object({
      code: z.string(),
      message: z.string(),
      details: z.record(z.string(), z.array(z.string())).optional(),
    }),
  })
  .meta({ id: 'ApiError' });

const foodResumenSchema = z.object({
  id: uuid,
  nombre: z.string(),
  grupo: z.string(),
  porcion_descripcion: z.string(),
  porcion_gramos: z.number(),
  imagen_url: z.string().nullable(),
});

const itemPlanSchema = z.object({
  id: uuid,
  food_id: uuid.nullable(),
  descripcion_libre: z.string().nullable(),
  cantidad_porciones: z.number(),
  energia_kcal: z.number(),
  proteina_g: z.number(),
  carbohidratos_g: z.number(),
  lipidos_g: z.number(),
  food: foodResumenSchema.nullable(),
});

const comidaPlanSchema = z.object({
  id: uuid,
  orden: z.number().int(),
  nombre: z.string(),
  horario: z.string().nullable(),
  descripcion: z.string().nullable(),
  items: z.array(itemPlanSchema),
});

const planSchema = z
  .object({
    id: uuid,
    patient_id: uuid,
    estado: z.enum(['BORRADOR', 'ACTIVO', 'ARCHIVADO']),
    calorias_diarias: z.number(),
    proteina_g: z.number(),
    carbos_g: z.number(),
    grasa_g: z.number(),
    nota: z.string().nullable(),
    origen: z.enum(['MANUAL', 'IA', 'PLANTILLA']),
    calculo_snapshot: z.unknown().nullable(),
    compartido_at: fechaHora.nullable(),
    pdf_url: z.string().nullable(),
    created_at: fechaHora,
    updated_at: fechaHora,
    comidas: z.array(comidaPlanSchema),
  })
  .meta({ id: 'MealPlan' });

const plantillaSchema = z
  .object({
    id: uuid,
    nombre: z.string(),
    objetivo: z.enum([
      'PERDIDA_DE_GRASA',
      'GANANCIA_MUSCULAR',
      'MANTENIMIENTO',
      'CONTROL_DE_DIABETES',
      'MEJORA_DEPORTIVA',
      'OTRO',
    ]),
    calorias: z.number().int(),
    descripcion: z.string().nullable(),
    estructura: estructuraPlantillaSchema,
    created_at: fechaHora,
    updated_at: fechaHora,
  })
  .meta({ id: 'PlanTemplate' });

const metaPaginacionSchema = z.object({
  page: z.number().int(),
  per_page: z.number().int(),
  total: z.number().int(),
});

const listaPlanesSchema = z.object({
  data: z.array(planSchema),
  meta: metaPaginacionSchema,
});
const listaPlantillasSchema = z.object({
  data: z.array(plantillaSchema),
  meta: metaPaginacionSchema,
});

const perfilSchema = z
  .object({
    id: uuid,
    email: z.email(),
    nombre: z.string().nullable(),
    role: z.string(),
    email_verificado: z.boolean(),
    perfil: z
      .object({
        nombre_completo: z.string(),
        cedula_profesional: z.string().nullable(),
        telefono: z.string().nullable(),
        especialidad: z.string().nullable(),
        marca_nombre: z.string().nullable(),
        marca_color: z.string(),
        marca_logo_url: z.string().nullable(),
      })
      .nullable(),
    suscripcion: z
      .object({
        plan: z.string(),
        status: z.string(),
        current_period_end: fechaHora.nullable(),
      })
      .nullable(),
  })
  .meta({ id: 'NutritionistProfile' });

const cuotaIaSchema = z
  .object({
    plan: z.enum(['FREE', 'PRO', 'CLINICA']),
    // `null` = sin tope (beta comercial); ver `packages/shared/src/ia/limites.ts`.
    limite: z.number().int().nullable(),
    usadas: z.number().int(),
    restantes: z.number().int().nullable(),
    agotada: z.boolean(),
    ilimitada: z.boolean(),
  })
  .meta({ id: 'CuotaIA' });

const cuotaIaConEstadoSchema = cuotaIaSchema
  .extend({ configurada: z.boolean() })
  .meta({ id: 'CuotaIAConEstado' });

const generacionIaSchema = z
  .object({
    tipo: z.enum(['PLAN', 'NOTA_CLINICA', 'RECETA', 'RESPUESTA_MENSAJE', 'PLAN_ACTIVIDAD']),
    formato: z.enum(['estructurado', 'texto']),
    /** Presente solo con `formato: estructurado`; su forma depende de `tipo`. */
    datos: z.unknown().nullable(),
    /** Presente solo con `formato: texto`, para que el nutriólogo lo edite. */
    texto: z.string().nullable(),
    advertencias: z.array(z.string()),
    cuota: cuotaIaSchema,
  })
  .meta({ id: 'GeneracionIA' });

const limiteUsoSchema = z
  .object({
    usados: z.number().int(),
    /** `null` = ilimitado. */
    limite: z.number().int().nullable(),
    restantes: z.number().int().nullable(),
    alcanzado: z.boolean(),
  })
  .meta({ id: 'LimiteUso' });

const planCatalogoSchema = z
  .object({
    clave: z.enum(['FREE', 'PRO', 'CLINICA']),
    nombre: z.string(),
    descripcion: z.string(),
    precios: z.array(
      z.object({
        periodo: z.enum(['MENSUAL', 'ANUAL']),
        centavos: z.number().int(),
        moneda: z.string(),
      }),
    ),
    incluye: z.array(z.string()),
    dias_prueba: z.number().int(),
    contratable: z.boolean(),
  })
  .meta({ id: 'PlanCatalogo' });

const suscripcionSchema = z
  .object({
    plan: z.enum(['FREE', 'PRO', 'CLINICA']),
    estado: z.enum(['ACTIVE', 'TRIALING', 'PAST_DUE', 'CANCELED', 'UNPAID']),
    modo: z.enum(['beta', 'produccion']),
    periodo_fin: fechaHora.nullable(),
    cancela_al_final: z.boolean(),
    pagos_habilitados: z.boolean(),
    tiene_suscripcion_stripe: z.boolean(),
    entitlements: z.object({
      pacientes: limiteUsoSchema,
      plantillas: limiteUsoSchema,
      ia: cuotaIaSchema,
      marca_blanca: z.boolean(),
    }),
    catalogo: z.array(planCatalogoSchema),
  })
  .meta({ id: 'Suscripcion' });

const urlStripeSchema = z.object({ url: z.url() }).meta({ id: 'UrlStripe' });

const json = <T extends z.ZodType>(schema: T) => ({
  'application/json': { schema },
});
const respuesta = <T extends z.ZodType>(description: string, schema: T) => ({
  description,
  content: json(schema),
});
const erroresComunes = {
  '401': respuesta('Sesión ausente o revocada', errorSchema),
  '403': respuesta('Correo no verificado o rol insuficiente', errorSchema),
  '500': respuesta('Error interno sin datos clínicos', errorSchema),
};

/** Contrato OpenAPI de la fase 4, generado desde sus schemas Zod de entrada. */
export const openApiDocument = createDocument({
  openapi: '3.1.0',
  info: {
    title: 'Nutria API',
    version: '1.5.0',
    description:
      'Contratos de planes alimenticios, plantillas, PDF, marca blanca y asistencia con IA.',
  },
  servers: [{ url: '/' }],
  security: [{ sessionCookie: [] }],
  tags: [
    { name: 'Perfil' },
    { name: 'Planes' },
    { name: 'Plantillas' },
    { name: 'IA' },
  ],
  paths: {
    '/api/v1/ai/generate': {
      post: {
        tags: ['IA'],
        summary: 'Genera un borrador asistido por IA sobre un paciente propio',
        description: [
          'Discriminado por `tipo`. Con `stream: true` responde `text/event-stream`',
          'con eventos `delta`, `progreso`, `reintento`, `final` y `error`; el evento',
          '`final` lleva el mismo objeto que la respuesta JSON.',
          'Los datos del paciente viajan seudonimizados y los prompts nunca se loggean.',
        ].join(' '),
        requestBody: { required: true, content: json(generarSchema) },
        responses: {
          '200': respuesta('Borrador generado y validado', generacionIaSchema),
          '400': respuesta('JSON inválido o validación fallida', errorSchema),
          '404': respuesta('Paciente no encontrado', errorSchema),
          '429': respuesta('Cuota mensual de IA agotada (AI_LIMIT_REACHED)', errorSchema),
          '502': respuesta('El proveedor de IA falló (AI_UPSTREAM_ERROR)', errorSchema),
          '503': respuesta('Falta ANTHROPIC_API_KEY (AI_NOT_CONFIGURED)', errorSchema),
          ...erroresComunes,
        },
      },
    },
    '/api/v1/ai/usage': {
      get: {
        tags: ['IA'],
        summary: 'Consulta la cuota de IA del mes en curso',
        responses: {
          '200': respuesta('Cuota vigente', cuotaIaConEstadoSchema),
          ...erroresComunes,
        },
      },
    },
    '/api/v1/billing/subscription': {
      get: {
        tags: ['Facturación'],
        summary: 'Plan vigente, entitlements y catálogo de planes',
        responses: {
          '200': respuesta('Suscripción del nutriólogo', suscripcionSchema),
          ...erroresComunes,
        },
      },
    },
    '/api/v1/billing/checkout': {
      post: {
        tags: ['Facturación'],
        summary: 'Abre Stripe Checkout y devuelve la URL de pago',
        requestBody: { required: true, content: json(checkoutSchema) },
        responses: {
          '200': respuesta('URL de la sesión de checkout', urlStripeSchema),
          '400': respuesta('JSON inválido o validación fallida', errorSchema),
          '409': respuesta(
            'Beta comercial o plan sin precio configurado (BILLING_NOT_AVAILABLE)',
            errorSchema,
          ),
          '503': respuesta('Falta STRIPE_SECRET_KEY (BILLING_NOT_CONFIGURED)', errorSchema),
          ...erroresComunes,
        },
      },
    },
    '/api/v1/billing/portal': {
      post: {
        tags: ['Facturación'],
        summary: 'Abre el Customer Portal de Stripe',
        responses: {
          '200': respuesta('URL del portal de facturación', urlStripeSchema),
          '409': respuesta('El usuario no tiene suscripción de pago (BILLING_NOT_AVAILABLE)', errorSchema),
          '503': respuesta('Falta STRIPE_SECRET_KEY (BILLING_NOT_CONFIGURED)', errorSchema),
          ...erroresComunes,
        },
      },
    },
    '/api/v1/me': {
      get: {
        tags: ['Perfil'],
        summary: 'Obtiene perfil y marca blanca',
        responses: {
          '200': respuesta('Perfil del nutriólogo', perfilSchema),
          ...erroresComunes,
        },
      },
      patch: {
        tags: ['Perfil'],
        summary: 'Actualiza datos profesionales y marca blanca',
        requestBody: { required: true, content: json(actualizarPerfilSchema) },
        responses: {
          '200': respuesta('Perfil actualizado', perfilSchema),
          '400': respuesta('JSON inválido o validación fallida', errorSchema),
          ...erroresComunes,
        },
      },
    },
    '/api/v1/patients/{patientId}/meal_plans': {
      get: {
        tags: ['Planes'],
        summary: 'Lista el historial de planes de un paciente propio',
        requestParams: { path: pacientePath, query: filtroPlanes },
        responses: {
          '200': respuesta('Planes paginados', listaPlanesSchema),
          '400': respuesta('Filtros de consulta inválidos', errorSchema),
          '404': respuesta('Paciente no encontrado', errorSchema),
          ...erroresComunes,
        },
      },
      post: {
        tags: ['Planes'],
        summary: 'Crea un borrador manual o desde plantilla',
        requestParams: { path: pacientePath },
        requestBody: { required: true, content: json(crearPlanSchema) },
        responses: {
          '201': respuesta('Plan creado', planSchema),
          '400': respuesta('JSON inválido o validación fallida', errorSchema),
          '404': respuesta('Paciente, alimento o plantilla no encontrado', errorSchema),
          '422': respuesta('Plan solicitado como activo pero no activable', errorSchema),
          ...erroresComunes,
        },
      },
    },
    '/api/v1/meal_plans/{id}': {
      get: {
        tags: ['Planes'],
        summary: 'Obtiene un plan propio completo',
        requestParams: { path: idPath },
        responses: {
          '200': respuesta('Plan', planSchema),
          '404': respuesta('Plan no encontrado', errorSchema),
          ...erroresComunes,
        },
      },
      patch: {
        tags: ['Planes'],
        summary: 'Actualiza un borrador con control de versión',
        requestParams: { path: idPath },
        requestBody: { required: true, content: json(actualizarPlanSchema) },
        responses: {
          '200': respuesta('Borrador actualizado', planSchema),
          '400': respuesta('JSON inválido o validación fallida', errorSchema),
          '404': respuesta('Plan o alimento no encontrado', errorSchema),
          '409': respuesta('Plan histórico o versión obsoleta', errorSchema),
          '422': respuesta('Estructura o validación clínica inválida', errorSchema),
          ...erroresComunes,
        },
      },
      delete: {
        tags: ['Planes'],
        summary: 'Archiva un plan sin borrar su historial',
        requestParams: { path: idPath },
        responses: {
          '204': { description: 'Plan archivado' },
          '404': respuesta('Plan no encontrado', errorSchema),
          ...erroresComunes,
        },
      },
    },
    '/api/v1/meal_plans/{id}/activate': {
      post: {
        tags: ['Planes'],
        summary: 'Activa un plan dentro de ±5% de la meta y sin alérgenos',
        requestParams: { path: idPath },
        responses: {
          '200': respuesta('Plan activo', planSchema),
          '404': respuesta('Plan no encontrado', errorSchema),
          '422': respuesta('Plan incompleto, fuera de meta o con alérgenos', errorSchema),
          ...erroresComunes,
        },
      },
    },
    '/api/v1/meal_plans/{id}/share': {
      post: {
        tags: ['Planes'],
        summary: 'Activa si hace falta y registra la entrega al paciente',
        requestParams: { path: idPath },
        responses: {
          '200': respuesta('Plan compartido', planSchema),
          '404': respuesta('Plan no encontrado', errorSchema),
          '422': respuesta('Plan no compartible', errorSchema),
          ...erroresComunes,
        },
      },
    },
    '/api/v1/meal_plans/{id}/duplicate': {
      post: {
        tags: ['Planes'],
        summary: 'Duplica un plan histórico como borrador editable',
        requestParams: { path: idPath },
        responses: {
          '201': respuesta('Borrador duplicado', planSchema),
          '404': respuesta('Plan no encontrado', errorSchema),
          ...erroresComunes,
        },
      },
    },
    '/api/v1/meal_plans/{id}/pdf': {
      get: {
        tags: ['Planes'],
        summary: 'Renderiza el PDF real con marca blanca',
        requestParams: {
          path: idPath,
          query: z.object({
            download: z.literal('1').optional(),
          }),
        },
        responses: {
          '200': {
            description: 'Documento PDF',
            content: {
              'application/pdf': {
                schema: z.string().meta({ format: 'binary' }),
              },
            },
          },
          '404': respuesta('Plan no encontrado', errorSchema),
          '422': respuesta('Plan demasiado extenso para exportar', errorSchema),
          '429': respuesta('Límite de render alcanzado', errorSchema),
          '503': respuesta('Renderer ocupado o agotó el tiempo', errorSchema),
          ...erroresComunes,
        },
      },
    },
    '/api/v1/meal_plans/{id}/export_pdf': {
      post: {
        tags: ['Planes'],
        summary: 'Exporta el PDF como descarga (contrato estable V2)',
        requestParams: { path: idPath },
        responses: {
          '200': {
            description: 'Documento PDF descargable',
            content: {
              'application/pdf': {
                schema: z.string().meta({ format: 'binary' }),
              },
            },
          },
          '404': respuesta('Plan no encontrado', errorSchema),
          '422': respuesta('Plan demasiado extenso para exportar', errorSchema),
          '429': respuesta('Límite de render alcanzado', errorSchema),
          '503': respuesta('Renderer ocupado o agotó el tiempo', errorSchema),
          ...erroresComunes,
        },
      },
    },
    '/api/v1/plan_templates': {
      get: {
        tags: ['Plantillas'],
        summary: 'Lista plantillas propias',
        requestParams: { query: paginacion },
        responses: {
          '200': respuesta('Plantillas paginadas', listaPlantillasSchema),
          ...erroresComunes,
        },
      },
      post: {
        tags: ['Plantillas'],
        summary: 'Crea una plantilla reutilizable',
        requestBody: { required: true, content: json(crearPlantillaSchema) },
        responses: {
          '201': respuesta('Plantilla creada', plantillaSchema),
          '400': respuesta('JSON inválido o validación fallida', errorSchema),
          '404': respuesta('Alimento no encontrado', errorSchema),
          ...erroresComunes,
        },
      },
    },
    '/api/v1/plan_templates/{id}': {
      get: {
        tags: ['Plantillas'],
        summary: 'Obtiene una plantilla propia',
        requestParams: { path: idPath },
        responses: {
          '200': respuesta('Plantilla', plantillaSchema),
          '404': respuesta('Plantilla no encontrada', errorSchema),
          ...erroresComunes,
        },
      },
      patch: {
        tags: ['Plantillas'],
        summary: 'Actualiza una plantilla propia',
        requestParams: { path: idPath },
        requestBody: { required: true, content: json(actualizarPlantillaSchema) },
        responses: {
          '200': respuesta('Plantilla actualizada', plantillaSchema),
          '400': respuesta('JSON inválido o validación fallida', errorSchema),
          '404': respuesta('Plantilla o alimento no encontrado', errorSchema),
          ...erroresComunes,
        },
      },
      delete: {
        tags: ['Plantillas'],
        summary: 'Elimina una plantilla propia',
        requestParams: { path: idPath },
        responses: {
          '204': { description: 'Plantilla eliminada' },
          '404': respuesta('Plantilla no encontrada', errorSchema),
          ...erroresComunes,
        },
      },
    },
  },
  components: {
    securitySchemes: {
      sessionCookie: {
        type: 'apiKey',
        in: 'cookie',
        name: 'authjs.session-token',
      },
    },
  },
});
