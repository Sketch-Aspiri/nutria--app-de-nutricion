import { revisarCatalogo, type FilaAlimento } from '../tipos';

import { escribirCacheUsda, leerCacheUsda } from './cache';
import { CONSULTAS_USDA, type ConsultaUsda } from './consultas';
import { claveDeDuplicado, mapearAlimentoUsda, type AlimentoUsda } from './mapeo';

/**
 * Import de la tanda 2: USDA FoodData Central → `alimentos-usda.json`.
 *
 *   USDA_API_KEY=... npm run db:import:usda
 *
 * No escribe en la base: deja el resultado en el archivo versionado que lee la
 * siembra. Es a propósito — así el catálogo que se despliega es el que alguien
 * revisó en un PR, no lo que la API haya devuelto ese día.
 *
 * La llave se obtiene gratis en https://fdc.nal.usda.gov/api-key-signup.html.
 * Sin llave se usa `DEMO_KEY`, que sirve para probar el script pero está
 * limitada a unas decenas de peticiones por hora.
 */

const API_USDA = 'https://api.nal.usda.gov/fdc/v1/foods/search';

/** Datos genéricos y analíticos. Se excluyen los productos de marca. */
const TIPOS_DE_DATO = ['Foundation', 'SR Legacy'];

/** Pausa entre peticiones: la API pide no saturarla. */
const PAUSA_MS = 400;

type RespuestaBusqueda = { foods?: AlimentoUsda[] };

/**
 * Cupo de la API agotado.
 *
 * No es un fallo del import: lo ya traído es válido y se guarda. Con DEMO_KEY
 * el cupo se agota a media corrida, así que cada ejecución completa lo que
 * falta del catálogo en lugar de empezar de cero.
 */
class LimiteAlcanzado extends Error {
  constructor() {
    super(
      'USDA respondió 429 (cupo de peticiones agotado). Con DEMO_KEY el tope es de unas decenas por hora: consigue una llave gratuita y ponla en USDA_API_KEY, o vuelve a correr el import más tarde para completar el catálogo.',
    );
    this.name = 'LimiteAlcanzado';
  }
}

async function esperar(ms: number): Promise<void> {
  await new Promise((resolver) => setTimeout(resolver, ms));
}

async function buscar(consulta: ConsultaUsda, llave: string): Promise<AlimentoUsda[]> {
  const url = new URL(API_USDA);
  url.searchParams.set('api_key', llave);
  url.searchParams.set('query', consulta.termino);
  url.searchParams.set('pageSize', String(consulta.maximo));
  for (const tipo of TIPOS_DE_DATO) url.searchParams.append('dataType', tipo);

  const respuesta = await fetch(url);

  if (respuesta.status === 429) throw new LimiteAlcanzado();
  if (!respuesta.ok) {
    throw new Error(`USDA respondió ${respuesta.status} al buscar "${consulta.termino}".`);
  }

  const cuerpo = (await respuesta.json()) as RespuestaBusqueda;
  return cuerpo.foods ?? [];
}

type Descarte = { motivo: string; descripcion: string };

async function main(): Promise<void> {
  const llave = process.env.USDA_API_KEY ?? 'DEMO_KEY';
  if (llave === 'DEMO_KEY') {
    console.warn('Sin USDA_API_KEY: se usa DEMO_KEY, con cupo muy limitado.\n');
  }

  // Se parte de lo ya importado: una corrida cortada por el cupo completa el
  // catálogo en vez de reemplazarlo.
  const filas: FilaAlimento[] = leerCacheUsda();
  const vistos = new Set<string>();
  for (const fila of filas) {
    vistos.add(claveDeDuplicado(fila));
    vistos.add(fila.ref);
  }

  const descartes: Descarte[] = [];
  let cupoAgotado = false;

  for (const consulta of CONSULTAS_USDA) {
    let encontrados: AlimentoUsda[];
    try {
      encontrados = await buscar(consulta, llave);
    } catch (error: unknown) {
      if (!(error instanceof LimiteAlcanzado)) throw error;
      cupoAgotado = true;
      console.warn(`\n${error.message}`);
      break;
    }

    let aceptados = 0;

    for (const alimento of encontrados) {
      const resultado = mapearAlimentoUsda(alimento);

      if (!resultado.ok) {
        descartes.push({ motivo: resultado.motivo, descripcion: resultado.descripcion });
        continue;
      }

      // El grupo que USDA implica manda sobre el esperado, pero si no coinciden
      // es que la búsqueda trajo otra cosa: se descarta en lugar de reclasificar.
      if (resultado.fila.grupo !== consulta.grupo) {
        descartes.push({
          motivo: `Cayó en "${resultado.fila.grupo}" y se buscaba "${consulta.grupo}"`,
          descripcion: alimento.description,
        });
        continue;
      }

      const clave = claveDeDuplicado(resultado.fila);
      if (vistos.has(clave) || vistos.has(resultado.fila.ref)) continue;

      vistos.add(clave);
      vistos.add(resultado.fila.ref);
      filas.push(resultado.fila);
      aceptados += 1;
    }

    console.info(
      `${consulta.termino.padEnd(34)} ${String(aceptados).padStart(3)} de ${encontrados.length}`,
    );
    await esperar(PAUSA_MS);
  }

  const problemas = revisarCatalogo(filas);
  const incoherentes = new Set(problemas.map((problema) => problema.ref));
  const limpias = filas.filter((fila) => !incoherentes.has(fila.ref));

  // Sin nada que guardar no se toca el archivo: una corrida que solo encontró
  // el cupo agotado no debe dejar un catálogo vacío en el repositorio.
  if (limpias.length === 0) {
    console.info('\nNo se importó ningún alimento; el catálogo anterior queda intacto.');
    process.exitCode = 1;
    return;
  }

  escribirCacheUsda(limpias);

  console.info(`\n${limpias.length} alimentos escritos en alimentos-usda.json.`);
  if (incoherentes.size > 0) {
    console.info(`${incoherentes.size} descartados por no pasar la revisión de coherencia.`);
  }
  console.info(`${descartes.length} resultados de USDA no se pudieron mapear.`);
  resumirDescartes(descartes);

  if (cupoAgotado) {
    console.info('\nEl catálogo quedó incompleto. Vuelve a correr el import para continuarlo.');
    process.exitCode = 1;
  }
}

/** Los motivos agrupados dicen qué falta en el diccionario o en el mapeo. */
function resumirDescartes(descartes: Descarte[]): void {
  const porMotivo = new Map<string, number>();
  for (const descarte of descartes) {
    porMotivo.set(descarte.motivo, (porMotivo.get(descarte.motivo) ?? 0) + 1);
  }

  for (const [motivo, veces] of [...porMotivo].sort((a, b) => b[1] - a[1])) {
    console.info(`  ${String(veces).padStart(4)}  ${motivo}`);
  }
}

main().catch((error: unknown) => {
  console.error('\nEl import falló:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
