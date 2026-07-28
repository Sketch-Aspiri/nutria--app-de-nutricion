# Reglas de las funciones de IA

Aplican a todo lo que viva bajo `packages/servidor/src/server/ai/` y a cualquier pantalla que
consuma `/api/v1/ai`.

## 1. La IA propone, el profesional aprueba

Ninguna salida del modelo se guarda en el expediente, se activa como plan ni se envía al
paciente de forma automática. Siempre queda como borrador editable, y el prompt del sistema
lo dice explícitamente para que el modelo no redacte indicaciones en tono definitivo.

Prohibido: diagnosticar, indicar medicamentos, o presentar una propuesta como final.

## 2. Los prompts se arman en el servidor

La UI manda **intención** (`tipo`, identificador del paciente, texto libre del nutriólogo),
nunca el prompt. Si el cliente pudiera mandar el prompt completo, cualquier pantalla nueva
podría saltarse la seudonimización sin que nadie lo note en review.

Todo prompt nuevo va en `packages/servidor/src/server/ai/prompts.ts` y recibe el contexto ya limpio de
`contexto.ts`.

## 3. Seudonimización obligatoria

Hacia Anthropic viajan edad, sexo, mediciones, condiciones, alergias y preferencias —lo que
el cálculo clínico necesita—. **Nunca** nombre, correo ni teléfono: se sustituyen por
`[PACIENTE]`, `[CORREO]` y `[TELEFONO]` (`packages/shared/src/ia/seudonimizar.ts`).

El filtro se aplica también al texto libre —notas de consulta, mensajes, antecedentes—,
porque suele mencionar nombres y teléfonos de terceros.

## 4. Nunca loggear prompts ni respuestas

Llevan datos de salud aunque estén seudonimizados. `ai_usage` solo guarda contadores:
generaciones, tokens de entrada y tokens de salida. Si un error necesita contexto, se loggea
el tipo de generación y el código de error, jamás el contenido.

## 5. Salidas estructuradas: validar antes de mostrar

Las generaciones con consecuencia clínica (plan, receta, nota) se piden con schema JSON y
después se validan en dos pasos:

1. **Forma** con Zod (`schemas.ts`).
2. **Contenido clínico** (`validacion.ts`): que los `food_id` existan en el catálogo real,
   que no aparezca ningún alérgeno declarado, y que la energía quede dentro de ±5 % de la
   meta calculada.

Si no valida, se reintenta **una** vez explicándole al modelo el motivo del rechazo, y si
vuelve a fallar se degrada a texto editable con la advertencia visible. Nunca se muestra una
salida no validada como si estuviera aprobada.

Los nutrimentos los calcula el servidor a partir de la fila del alimento, no el modelo: la
IA elige *qué* y *cuánto*, la aritmética la hace la base (`borrador.ts`).

## 6. Cuotas y costo

Cada generación consume cuota del plan (`packages/shared/src/ia/limites.ts`): Free 15/mes,
Pro 150, Clínica 500. La cuota se reserva **antes** de llamar al proveedor —de forma atómica,
para que dos pestañas no se pasen del límite— y se reembolsa si la llamada falla.

Al agotarse, el endpoint responde `429 AI_LIMIT_REACHED` y la UI muestra el CTA de mejora de
plan. El límite se aplica en el servidor; ocultar el botón en el frontend no cuenta.

`max_tokens` se acota por tipo de tarea en `config.ts`. Modelo por tarea: Sonnet para lo que
tiene consecuencia clínica, Haiku para tareas cortas.

## 7. Audio

El dictado de consulta usa la Web Speech API del navegador. El audio no sale del equipo del
nutriólogo; solo el texto, y solo cuando pide estructurarlo.

## 8. Tests

Toda función nueva de IA lleva test de la validación clínica y del camino de degradación.
El proveedor se mockea: los tests nunca llaman a la API real.
