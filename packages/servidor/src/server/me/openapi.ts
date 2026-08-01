import { z } from 'zod';
import { createDocument } from 'zod-openapi';

import {
  coachSchema,
  estimacionComidaSchema,
  sustitucionSchema,
} from '@/server/ai/schemasPaciente';

import {
  cambiarPasswordSchema,
  darDeBajaSchema,
  enviarMensajeSchema,
  filtroFechasSchema,
  guardarAguaSchema,
  registrarComidaSchema,
  registrarEjercicioSchema,
  registrarPesoSchema,
} from './schemas';

/**
 * Contrato OpenAPI de la app del paciente (`/api/v1/me/*`).
 *
 * Documento **propio**, separado del de `nutriologos`: son dos superficies con
 * audiencias y sesiones distintas, y mezclarlas describiría rutas que ninguna de
 * las dos apps monta. Cada app sirve el suyo en su `/api/v1/docs`.
 *
 * Ninguna ruta de aquí acepta un `patient_id`: lo resuelve `requierePaciente`
 * desde la sesión. Que el contrato no lo mencione es intencional — si algún día
 * aparece en este archivo, es que alguien rompió la regla de §6.2.
 */

const uuid = z.string().uuid();
const fechaHora = z.iso.datetime();
const fechaDia = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const idPath = z.object({
  id: uuid.meta({ description: 'Identificador UUID del recurso propio' }),
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

const metaPaginacionSchema = z.object({
  page: z.number().int(),
  per_page: z.number().int(),
  total: z.number().int(),
});

/* --- Perfil y plan --------------------------------------------------------- */

const metasSchema = z
  .object({
    calorias_diarias: z.number().int(),
    proteina_g: z.number().int(),
    carbos_g: z.number().int(),
    grasa_g: z.number().int(),
  })
  .meta({ id: 'MetasDelPlan' });

const perfilSchema = z
  .object({
    id: uuid,
    nombre: z.string(),
    email: z.string().nullable(),
    foto_url: z.string().nullable(),
    objetivo: z.string().nullable(),
    objetivo_otro: z.string().nullable(),
    nutriologo: z.object({
      nombre: z.string().nullable(),
      consultorio: z.string().nullable(),
    }),
    meta_agua_vasos: z.number().int(),
    /** `null` cuando no hay plan activo y compartido: estado vacío, no ceros. */
    metas: metasSchema.nullable(),
  })
  .meta({ id: 'PerfilPaciente' });

const itemPlanSchema = z.object({
  id: uuid,
  food_id: uuid.nullable(),
  descripcion_libre: z.string().nullable(),
  cantidad_porciones: z.number(),
  energia_kcal: z.number(),
  proteina_g: z.number(),
  carbohidratos_g: z.number(),
  lipidos_g: z.number(),
  /** Snapshot del alimento al armar el plan; `null` si el renglón es texto libre. */
  food: z
    .object({
      nombre: z.string(),
      porcion_descripcion: z.string().nullable(),
    })
    .nullable(),
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
    estado: z.enum(['BORRADOR', 'ACTIVO', 'ARCHIVADO']),
    calorias_diarias: z.number(),
    proteina_g: z.number(),
    carbos_g: z.number(),
    grasa_g: z.number(),
    nota: z.string().nullable(),
    compartido_at: fechaHora.nullable(),
    // `comidas`, no `meals`: es la llave que emite `serializarPlan`. El nombre en
    // inglés era el de la relación de Prisma y no salía nunca por la API.
    comidas: z.array(comidaPlanSchema),
  })
  .meta({ id: 'PlanDelPaciente' });

/* --- Registros ------------------------------------------------------------- */

const registroComidaSchema = z
  .object({
    id: uuid,
    meal_plan_meal_id: uuid.nullable(),
    fecha: fechaHora,
    dia: fechaDia,
    hora: fechaHora.nullable(),
    nombre: z.string(),
    calorias: z.number().int().nullable(),
    proteina_g: z.number().nullable(),
    carbos_g: z.number().nullable(),
    grasa_g: z.number().nullable(),
    origen: z.enum(['MANUAL', 'IA']),
    foto_url: z.string().nullable(),
    comentario_paciente: z.string().nullable(),
    created_at: fechaHora,
  })
  .meta({ id: 'RegistroComida' });

const registroPesoSchema = z
  .object({
    id: uuid,
    fecha: fechaDia,
    peso_kg: z.number(),
    created_at: fechaHora,
  })
  .meta({ id: 'RegistroPeso' });

const registroEjercicioSchema = z
  .object({
    id: uuid,
    fecha: fechaDia,
    tipo: z.string(),
    duracion_min: z.number().int(),
    created_at: fechaHora,
  })
  .meta({ id: 'RegistroEjercicio' });

const registroAguaSchema = z
  .object({ fecha: fechaDia, vasos: z.number().int() })
  .meta({ id: 'RegistroAgua' });

const hoySchema = z
  .object({
    dia: fechaDia,
    zona_horaria: z.string(),
    plan: planSchema.nullable(),
    comidas_marcadas: z.array(uuid),
    registros: z.array(registroComidaSchema),
    agua: z.object({ vasos: z.number().int(), meta: z.number().int() }),
    adherencia: z
      .object({
        porcentaje: z.number(),
        racha: z.number().int(),
        dias_evaluados: z.number().int(),
        comidas_registradas: z.number().int(),
        comidas_esperadas: z.number().int(),
      })
      .nullable(),
  })
  .meta({ id: 'ResumenHoy' });

const progresoSchema = z
  .object({
    pesos: z.array(registroPesoSchema),
    peso: z.object({ inicial: z.number(), actual: z.number(), cambio_kg: z.number() }).nullable(),
    /**
     * Siempre `null` en la V1: el esquema no guarda un peso objetivo y estimarlo
     * sería inventarle una meta clínica al paciente.
     */
    falta_kg: z.null(),
    logros: z.array(
      z.object({
        id: z.string(),
        titulo: z.string(),
        descripcion: z.string(),
        conseguido: z.boolean(),
        progreso: z.number(),
      }),
    ),
  })
  .meta({ id: 'Progreso' });

/* --- Contenido compartido y comunicación ----------------------------------- */

const recetaSchema = z
  .object({
    id: uuid,
    nombre: z.string(),
    ingredientes: z.array(z.string()),
    pasos: z.string().nullable(),
    calorias: z.number().int().nullable(),
    porciones: z.number().int(),
    origen: z.enum(['MANUAL', 'IA', 'PLANTILLA']),
    updated_at: fechaHora,
  })
  .meta({ id: 'RecetaEnviada' });

const planActividadSchema = z
  .object({
    id: uuid,
    texto: z.string(),
    compartido_at: fechaHora.nullable(),
    updated_at: fechaHora,
  })
  .meta({ id: 'PlanActividad' });

const mensajeSchema = z
  .object({
    id: uuid,
    emisor: z.enum(['PATIENT', 'NUTRITIONIST']),
    texto: z.string(),
    leido_at: fechaHora.nullable(),
    created_at: fechaHora,
  })
  .meta({ id: 'Mensaje' });

const citaSchema = z
  .object({
    id: uuid,
    inicio: fechaHora,
    duracion_min: z.number().int(),
    tipo: z.string(),
    estado: z.string(),
    video_url: z.string().nullable(),
  })
  .meta({ id: 'Cita' });

const fotoSchema = z.object({ url: z.url() }).meta({ id: 'FotoComida' });

/* --- IA (fase 5) ----------------------------------------------------------- */

const cuotaPacienteSchema = z
  .object({
    limite: z.number().int(),
    usadas: z.number().int(),
    restantes: z.number().int(),
    agotada: z.boolean(),
  })
  .meta({
    id: 'CuotaIAPaciente',
    description:
      'Tope mensual del paciente. La cuota de la clínica no se expone: es información comercial de su nutriólogo.',
  });

const salidaCoachSchema = z
  .object({
    tipo: z.literal('COACH_PACIENTE'),
    formato: z.literal('texto'),
    texto: z.string(),
    aviso: z.string(),
    cuota: cuotaPacienteSchema,
  })
  .meta({ id: 'RespuestaCoach' });

const salidaEstimacionSchema = z
  .object({
    tipo: z.literal('ESTIMACION_COMIDA'),
    formato: z.literal('estructurado'),
    datos: z.object({
      alimento: z.string(),
      calorias: z.number().int(),
      proteina_g: z.number(),
      carbos_g: z.number(),
      grasa_g: z.number(),
    }),
    aviso: z.string(),
    cuota: cuotaPacienteSchema,
  })
  .meta({ id: 'EstimacionComida' });

const salidaSustitucionSchema = z
  .object({
    tipo: z.literal('SUSTITUCION_INGREDIENTE'),
    formato: z.literal('estructurado'),
    datos: z.object({ sustituto: z.string(), razon: z.string() }),
    aviso: z.string(),
    cuota: cuotaPacienteSchema,
  })
  .meta({ id: 'SustitucionIngrediente' });

/* --- Documento ------------------------------------------------------------- */

const json = <T extends z.ZodType>(schema: T) => ({
  'application/json': { schema },
});
const respuesta = <T extends z.ZodType>(description: string, schema: T) => ({
  description,
  content: json(schema),
});
const lista = <T extends z.ZodType>(item: T, meta = metaPaginacionSchema) =>
  z.object({ data: z.array(item), meta });

const erroresComunes = {
  '401': respuesta('Sesión ausente o revocada', errorSchema),
  '403': respuesta('La cuenta no es de un paciente activo', errorSchema),
  '429': respuesta('Límite de tasa alcanzado', errorSchema),
  '500': respuesta('Error interno sin datos clínicos', errorSchema),
};

const erroresIa = {
  '400': respuesta('JSON inválido o validación fallida', errorSchema),
  '422': respuesta('La salida del modelo no pasó la validación', errorSchema),
  '429': respuesta('Tope mensual agotado o ráfaga de peticiones', errorSchema),
  '502': respuesta('El proveedor de IA falló', errorSchema),
  '503': respuesta('El servidor no tiene configurada la IA', errorSchema),
  '401': erroresComunes['401'],
  '403': erroresComunes['403'],
  '500': erroresComunes['500'],
};

export const openApiPacientes = createDocument({
  openapi: '3.1.0',
  info: {
    title: 'Nutria — API del paciente',
    version: '1.0.0',
    description: [
      'Superficie que consume la app del paciente. Se monta solo en `apps/web/pacientes`.',
      'Toda ruta resuelve el paciente desde la sesión: ninguna acepta un identificador de paciente.',
      'Las lecturas devuelven lo que el nutriólogo aprobó, no lo que existe: plan activo y compartido, recetas enviadas, plan de actividad compartido.',
    ].join(' '),
  },
  servers: [{ url: '/' }],
  security: [{ sessionCookie: [] }],
  tags: [
    { name: 'Perfil' },
    { name: 'Plan' },
    { name: 'Registros' },
    { name: 'Progreso' },
    { name: 'Mensajes' },
    { name: 'IA' },
    { name: 'Cuenta' },
  ],
  paths: {
    '/api/v1/me': {
      get: {
        tags: ['Perfil'],
        summary: 'Perfil del paciente y metas de su plan vigente',
        responses: {
          '200': respuesta('Perfil', perfilSchema),
          '404': respuesta('Expediente no encontrado', errorSchema),
          ...erroresComunes,
        },
      },
    },
    '/api/v1/me/today': {
      get: {
        tags: ['Plan'],
        summary: 'Todo lo que pinta la pantalla Hoy en una sola llamada',
        responses: {
          '200': respuesta('Plan del día, registros, agua y adherencia', hoySchema),
          ...erroresComunes,
        },
      },
    },
    '/api/v1/me/meal_plan': {
      get: {
        tags: ['Plan'],
        summary: 'Plan alimenticio vigente',
        description:
          'Devuelve `null` en lugar de 404: no tener plan compartido es un estado normal de la app.',
        responses: {
          '200': respuesta('Plan vigente o null', planSchema.nullable()),
          ...erroresComunes,
        },
      },
    },
    '/api/v1/me/recipes': {
      get: {
        tags: ['Plan'],
        summary: 'Recetas que el nutriólogo envió',
        description: 'Solo `estado = ENVIADA`; las sugeridas son su borrador.',
        responses: {
          '200': respuesta('Recetas', lista(recetaSchema)),
          ...erroresComunes,
        },
      },
    },
    '/api/v1/me/activity_plan': {
      get: {
        tags: ['Plan'],
        summary: 'Plan de actividad compartido',
        responses: {
          '200': respuesta('Plan de actividad o null', planActividadSchema.nullable()),
          ...erroresComunes,
        },
      },
    },
    '/api/v1/me/meal_logs': {
      post: {
        tags: ['Registros'],
        summary: 'Marca una comida del plan o registra una libre',
        description:
          'Con `meal_plan_meal_id` marca una comida del plan propio; sin él registra una comida libre con sus macros. `origen = IA` cuando las cifras vienen de la estimación del coach.',
        requestBody: { required: true, content: json(registrarComidaSchema) },
        responses: {
          '201': respuesta('Registro creado', registroComidaSchema),
          '400': respuesta('JSON inválido o validación fallida', errorSchema),
          '404': respuesta('La comida no pertenece a un plan propio', errorSchema),
          ...erroresComunes,
        },
      },
    },
    '/api/v1/me/meal_logs/{id}': {
      delete: {
        tags: ['Registros'],
        summary: 'Desmarca o borra un registro propio',
        requestParams: { path: idPath },
        responses: {
          '204': { description: 'Registro eliminado' },
          '404': respuesta('El registro no es del paciente', errorSchema),
          ...erroresComunes,
        },
      },
    },
    '/api/v1/me/weight_logs': {
      get: {
        tags: ['Registros'],
        summary: 'Historial de peso',
        requestParams: { query: filtroFechasSchema },
        responses: {
          '200': respuesta('Pesos', lista(registroPesoSchema)),
          ...erroresComunes,
        },
      },
      post: {
        tags: ['Registros'],
        summary: 'Registra el peso del día',
        description: 'Upsert por `(paciente, fecha)`: volver a pesarse corrige, no duplica.',
        requestBody: { required: true, content: json(registrarPesoSchema) },
        responses: {
          '201': respuesta('Peso registrado', registroPesoSchema),
          '400': respuesta('JSON inválido o validación fallida', errorSchema),
          ...erroresComunes,
        },
      },
    },
    '/api/v1/me/exercise_logs': {
      get: {
        tags: ['Registros'],
        summary: 'Historial de ejercicio',
        requestParams: { query: filtroFechasSchema },
        responses: {
          '200': respuesta('Ejercicio', lista(registroEjercicioSchema)),
          ...erroresComunes,
        },
      },
      post: {
        tags: ['Registros'],
        summary: 'Registra una sesión de ejercicio',
        requestBody: { required: true, content: json(registrarEjercicioSchema) },
        responses: {
          '201': respuesta('Ejercicio registrado', registroEjercicioSchema),
          '400': respuesta('JSON inválido o validación fallida', errorSchema),
          ...erroresComunes,
        },
      },
    },
    '/api/v1/me/water_logs': {
      put: {
        tags: ['Registros'],
        summary: 'Guarda los vasos de agua del día',
        description:
          'PUT y no POST: la app manda el total del día, así la operación es idempotente sobre una red móvil.',
        requestBody: { required: true, content: json(guardarAguaSchema) },
        responses: {
          '200': respuesta('Agua del día', registroAguaSchema),
          '400': respuesta('JSON inválido o validación fallida', errorSchema),
          ...erroresComunes,
        },
      },
    },
    '/api/v1/me/photos': {
      post: {
        tags: ['Registros'],
        summary: 'Sube una foto de comida',
        description:
          'multipart/form-data con el campo `file`. El tipo se decide leyendo los bytes, no el `Content-Type` declarado.',
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: z.object({ file: z.string().meta({ format: 'binary' }) }),
            },
          },
        },
        responses: {
          '201': respuesta('Foto subida', fotoSchema),
          '400': respuesta('Archivo ausente o formato no permitido', errorSchema),
          '413': respuesta('La foto excede el tamaño máximo', errorSchema),
          '503': respuesta('Almacenamiento de fotos no configurado', errorSchema),
          ...erroresComunes,
        },
      },
    },
    '/api/v1/me/progress': {
      get: {
        tags: ['Progreso'],
        summary: 'Serie de peso, tendencia y logros calculados',
        responses: {
          '200': respuesta('Progreso', progresoSchema),
          ...erroresComunes,
        },
      },
    },
    '/api/v1/me/messages': {
      get: {
        tags: ['Mensajes'],
        summary: 'Hilo con el nutriólogo',
        responses: {
          '200': respuesta(
            'Mensajes con el conteo de no leídos',
            lista(mensajeSchema, metaPaginacionSchema.extend({ sin_leer: z.number().int() })),
          ),
          ...erroresComunes,
        },
      },
      post: {
        tags: ['Mensajes'],
        summary: 'Escribe al nutriólogo',
        requestBody: { required: true, content: json(enviarMensajeSchema) },
        responses: {
          '201': respuesta('Mensaje enviado', mensajeSchema),
          '400': respuesta('JSON inválido o validación fallida', errorSchema),
          ...erroresComunes,
        },
      },
    },
    '/api/v1/me/messages/read': {
      post: {
        tags: ['Mensajes'],
        summary: 'Marca como leídos los mensajes del nutriólogo',
        responses: {
          '200': respuesta('Conteo marcado', z.object({ marcados: z.number().int() })),
          ...erroresComunes,
        },
      },
    },
    '/api/v1/me/password': {
      post: {
        tags: ['Cuenta'],
        summary: 'Cambia la contraseña del paciente',
        description:
          'Exige la contraseña actual. Límite propio de 5 intentos por hora: el endpoint ' +
          'comprueba una contraseña y sin tope sería un oráculo de fuerza bruta.',
        requestBody: { required: true, content: json(cambiarPasswordSchema) },
        responses: {
          '200': respuesta('Contraseña actualizada', z.object({ actualizada: z.literal(true) })),
          '400': respuesta('JSON inválido, validación fallida o contraseña incorrecta', errorSchema),
          ...erroresComunes,
        },
      },
    },
    '/api/v1/me/export': {
      get: {
        tags: ['Cuenta'],
        summary: 'Descarga los datos del paciente (derecho de acceso ARCO)',
        description:
          'Devuelve un archivo JSON con lo que el paciente registró y lo que su nutrióloga le ' +
          'compartió. **No** incluye notas de consulta ni el expediente clínico de texto libre: ' +
          'son responsabilidad de la nutrióloga (NOM-004-SSA3) y el propio archivo lo declara en ' +
          '`expediente_clinico_completo`. Máximo 3 descargas por hora.',
        responses: {
          '200': {
            description: 'Archivo JSON con los datos del paciente',
            content: { 'application/json': { schema: { type: 'object' } } },
          },
          '413': respuesta('Demasiados datos para una descarga inmediata', errorSchema),
          ...erroresComunes,
        },
      },
    },
    '/api/v1/me/account': {
      delete: {
        tags: ['Cuenta'],
        summary: 'Da de baja la cuenta del paciente (derecho de cancelación ARCO)',
        description:
          'Desvincula `user_id` y borra la cuenta de acceso en una transacción. El expediente ' +
          'clínico **permanece** con el nutriólogo, que es su responsable, y se le notifica. ' +
          'Exige la contraseña: es la única acción irreversible de la app.',
        requestBody: { required: true, content: json(darDeBajaSchema) },
        responses: {
          '200': respuesta('Cuenta dada de baja', z.object({ baja: z.literal(true) })),
          '400': respuesta('JSON inválido, validación fallida o contraseña incorrecta', errorSchema),
          ...erroresComunes,
        },
      },
    },
    '/api/v1/me/appointments': {
      get: {
        tags: ['Perfil'],
        summary: 'Próximas citas',
        description: 'Solo lectura en la V1; no incluye las notas del nutriólogo.',
        responses: {
          '200': respuesta('Citas programadas', lista(citaSchema)),
          ...erroresComunes,
        },
      },
    },
    '/api/v1/me/ai/coach': {
      post: {
        tags: ['IA'],
        summary: 'Coach conversacional del paciente',
        description: [
          'Orienta y deriva a la nutrióloga; no modifica el plan, las metas ni el expediente.',
          'El historial lo conserva el cliente: la conversación no se guarda en el servidor.',
          'La respuesta incluye siempre `aviso`, que la UI debe mostrar.',
        ].join(' '),
        requestBody: { required: true, content: json(coachSchema) },
        responses: {
          '200': respuesta('Respuesta del coach', salidaCoachSchema),
          ...erroresIa,
        },
      },
    },
    '/api/v1/me/ai/meal_estimate': {
      post: {
        tags: ['IA'],
        summary: 'Estima los macros de una comida descrita en texto',
        description:
          'Devuelve la estimación; **no la guarda**. Registrarla es una llamada aparte a `POST /me/meal_logs` con `origen = IA`.',
        requestBody: { required: true, content: json(estimacionComidaSchema) },
        responses: {
          '200': respuesta('Estimación', salidaEstimacionSchema),
          ...erroresIa,
        },
      },
    },
    '/api/v1/me/ai/substitution': {
      post: {
        tags: ['IA'],
        summary: 'Sustituye un ingrediente por otro equivalente',
        description:
          'Con `receta_id` usa la receta como contexto, siempre que sea del paciente y esté enviada. La salida se rechaza con 422 si menciona un alérgeno declarado.',
        requestBody: { required: true, content: json(sustitucionSchema) },
        responses: {
          '200': respuesta('Sustitución propuesta', salidaSustitucionSchema),
          '404': respuesta('La receta no es del paciente o no le fue enviada', errorSchema),
          ...erroresIa,
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
