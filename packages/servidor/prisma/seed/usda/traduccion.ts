/**
 * Traducción de las descripciones de USDA al español de México.
 *
 * Las descripciones vienen en segmentos separados por comas, del alimento al
 * detalle: "Chicken, broilers or fryers, breast, meat only, cooked, roasted".
 * Se traduce el alimento (primer segmento) y hasta dos calificativos útiles;
 * el resto se descarta porque no cambia lo que el nutriólogo necesita leer.
 *
 * Un alimento cuyo primer segmento no esté en el diccionario **no se importa**.
 * Es preferible una base más chica y en español que uno con nombres en inglés
 * que nadie va a encontrar buscando.
 */

/** Alimento principal: es el que decide si la fila entra o no al catálogo. */
export const ALIMENTOS_EN_ESPANOL: Record<string, string> = {
  // Verduras
  broccoli: 'Brócoli',
  spinach: 'Espinaca',
  carrots: 'Zanahoria',
  carrot: 'Zanahoria',
  tomatoes: 'Jitomate',
  lettuce: 'Lechuga',
  cucumber: 'Pepino',
  onions: 'Cebolla',
  garlic: 'Ajo',
  cauliflower: 'Coliflor',
  cabbage: 'Col',
  celery: 'Apio',
  asparagus: 'Espárrago',
  eggplant: 'Berenjena',
  mushrooms: 'Champiñón',
  peppers: 'Chile',
  squash: 'Calabaza',
  zucchini: 'Calabacita',
  pumpkin: 'Calabaza de Castilla',
  beets: 'Betabel',
  radishes: 'Rábano',
  turnips: 'Nabo',
  artichokes: 'Alcachofa',
  'brussels sprouts': 'Col de Bruselas',
  kale: 'Col rizada',
  chard: 'Acelga',
  'green beans': 'Ejote',
  leeks: 'Poro',
  jicama: 'Jícama',
  chayote: 'Chayote',
  nopales: 'Nopal',
  okra: 'Okra',
  watercress: 'Berro',
  'sweet potato': 'Camote',
  potatoes: 'Papa',
  yam: 'Ñame',
  cassava: 'Yuca',
  corn: 'Maíz',

  // Frutas
  apples: 'Manzana',
  bananas: 'Plátano',
  oranges: 'Naranja',
  grapes: 'Uva',
  strawberries: 'Fresa',
  blueberries: 'Arándano azul',
  raspberries: 'Frambuesa',
  blackberries: 'Zarzamora',
  watermelon: 'Sandía',
  melons: 'Melón',
  cantaloupe: 'Melón chino',
  pineapple: 'Piña',
  mangos: 'Mango',
  mango: 'Mango',
  papayas: 'Papaya',
  pears: 'Pera',
  peaches: 'Durazno',
  plums: 'Ciruela',
  apricots: 'Chabacano',
  cherries: 'Cereza',
  grapefruit: 'Toronja',
  lemons: 'Limón amarillo',
  limes: 'Limón',
  tangerines: 'Mandarina',
  guavas: 'Guayaba',
  kiwifruit: 'Kiwi',
  avocados: 'Aguacate',
  figs: 'Higo',
  dates: 'Dátil',
  raisins: 'Pasas',
  prunes: 'Ciruela pasa',
  'passion fruit': 'Maracuyá',
  pomegranates: 'Granada',
  coconut: 'Coco',
  'sapote': 'Zapote',
  'prickly pears': 'Tuna',

  // Cereales y tubérculos
  rice: 'Arroz',
  wheat: 'Trigo',
  oats: 'Avena',
  barley: 'Cebada',
  quinoa: 'Quinoa',
  amaranth: 'Amaranto',
  buckwheat: 'Trigo sarraceno',
  pasta: 'Pasta',
  spaghetti: 'Espagueti',
  macaroni: 'Macarrón',
  noodles: 'Fideo',
  bread: 'Pan',
  tortillas: 'Tortilla',
  crackers: 'Galleta salada',
  cookies: 'Galleta',
  cereals: 'Cereal',
  'cereals ready-to-eat': 'Cereal de caja',
  bagels: 'Bagel',
  muffins: 'Panqué',
  popcorn: 'Palomitas',
  'corn flour': 'Harina de maíz',
  cornmeal: 'Harina de maíz',
  'wheat flour': 'Harina de trigo',
  couscous: 'Cuscús',
  millet: 'Mijo',
  rye: 'Centeno',

  // Leguminosas
  beans: 'Frijol',
  lentils: 'Lenteja',
  chickpeas: 'Garbanzo',
  peas: 'Chícharo',
  'broad beans': 'Haba',
  'fava beans': 'Haba',
  soybeans: 'Soya',
  tofu: 'Tofu',
  peanuts: 'Cacahuate',
  hummus: 'Hummus',

  // Origen animal
  chicken: 'Pollo',
  turkey: 'Pavo',
  beef: 'Res',
  pork: 'Cerdo',
  lamb: 'Cordero',
  veal: 'Ternera',
  fish: 'Pescado',
  salmon: 'Salmón',
  tuna: 'Atún',
  tilapia: 'Tilapia',
  cod: 'Bacalao',
  sardine: 'Sardina',
  trout: 'Trucha',
  shrimp: 'Camarón',
  crab: 'Cangrejo',
  octopus: 'Pulpo',
  squid: 'Calamar',
  clams: 'Almeja',
  oysters: 'Ostión',
  egg: 'Huevo',
  eggs: 'Huevo',
  cheese: 'Queso',
  ham: 'Jamón',
  bacon: 'Tocino',
  sausage: 'Salchicha',
  bologna: 'Mortadela',
  liver: 'Hígado',
  'ground beef': 'Carne molida de res',

  // Leche
  milk: 'Leche',
  yogurt: 'Yogurt',
  buttermilk: 'Leche búlgara',
  kefir: 'Kéfir',

  // Aceites y grasas
  oil: 'Aceite',
  butter: 'Mantequilla',
  cream: 'Crema',
  margarine: 'Margarina',
  lard: 'Manteca de cerdo',
  mayonnaise: 'Mayonesa',
  almonds: 'Almendra',
  walnuts: 'Nuez de Castilla',
  pecans: 'Nuez',
  pistachios: 'Pistache',
  cashews: 'Nuez de la India',
  hazelnuts: 'Avellana',
  'sunflower seed kernels': 'Semilla de girasol',
  'pumpkin and squash seed kernels': 'Pepita de calabaza',
  'sesame seeds': 'Ajonjolí',
  'chia seeds': 'Chía',
  'flaxseed': 'Linaza',
  olives: 'Aceituna',
  'peanut butter': 'Crema de cacahuate',

  // Azúcares
  sugars: 'Azúcar',
  sugar: 'Azúcar',
  honey: 'Miel',
  syrups: 'Jarabe',
  jams: 'Mermelada',
  jellies: 'Jalea',
  chocolate: 'Chocolate',
  candies: 'Dulce',
  'ice creams': 'Helado',
  gelatins: 'Gelatina',

  // Libres
  coffee: 'Café',
  tea: 'Té',
  water: 'Agua',
  vinegar: 'Vinagre',
  cinnamon: 'Canela',
  oregano: 'Orégano',
  cumin: 'Comino',
  parsley: 'Perejil',
  cilantro: 'Cilantro',
  basil: 'Albahaca',
  'chili powder': 'Chile en polvo',
  salt: 'Sal',
  pepper: 'Pimienta',
};

/** Calificativos: enriquecen el nombre pero no deciden si el alimento entra. */
export const CALIFICATIVOS_EN_ESPANOL: Record<string, string> = {
  raw: 'crudo',
  cooked: 'cocido',
  boiled: 'hervido',
  roasted: 'asado',
  grilled: 'a la parrilla',
  broiled: 'a la plancha',
  fried: 'frito',
  baked: 'horneado',
  steamed: 'al vapor',
  dried: 'deshidratado',
  dry: 'seco',
  canned: 'de lata',
  frozen: 'congelado',
  fresh: 'fresco',
  whole: 'entero',
  'whole grain': 'integral',
  'whole wheat': 'integral',
  'whole-wheat': 'integral',
  enriched: 'enriquecido',
  unenriched: 'sin enriquecer',
  skim: 'descremada',
  nonfat: 'sin grasa',
  'low fat': 'bajo en grasa',
  'lowfat': 'bajo en grasa',
  'reduced fat': 'reducido en grasa',
  'fat free': 'sin grasa',
  'lean only': 'magro',
  lean: 'magro',
  'meat only': 'sin piel',
  'without skin': 'sin piel',
  'with skin': 'con piel',
  breast: 'pechuga',
  thigh: 'muslo',
  drumstick: 'pierna',
  wing: 'ala',
  loin: 'lomo',
  'ground': 'molido',
  sliced: 'rebanado',
  chopped: 'picado',
  shredded: 'rallado',
  unsalted: 'sin sal',
  salted: 'con sal',
  'with salt': 'con sal',
  'without salt': 'sin sal',
  sweetened: 'endulzado',
  unsweetened: 'sin azúcar',
  'in water': 'en agua',
  'in oil': 'en aceite',
  'in syrup': 'en almíbar',
  peeled: 'pelado',
  unpeeled: 'con cáscara',
  'with peel': 'con cáscara',
  'without peel': 'sin cáscara',
  ripe: 'maduro',
  green: 'verde',
  red: 'rojo',
  white: 'blanco',
  yellow: 'amarillo',
  black: 'negro',
  sweet: 'dulce',
  plain: 'natural',
  natural: 'natural',
  mature: 'maduro',
  'seeds': 'semillas',
  juice: 'jugo',
};

/** Descripciones con estos rasgos no describen un alimento genérico. */
const SEGMENTOS_A_IGNORAR = [
  'all commercial varieties',
  'commercial',
  'nfs',
  'includes usda commodity',
  'usda commodity',
  'upc',
  'variety not specified',
];

function limpiar(segmento: string): string {
  return segmento.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Traduce una descripción de USDA. Devuelve `null` cuando el alimento
 * principal no está en el diccionario: ese alimento no se importa.
 */
export function traducirDescripcion(descripcion: string): string | null {
  const segmentos = descripcion
    .split(',')
    .map(limpiar)
    .filter((segmento) => segmento.length > 0)
    .filter((segmento) => !SEGMENTOS_A_IGNORAR.some((ruido) => segmento.includes(ruido)));

  const principal = segmentos[0];
  if (principal === undefined) return null;

  const alimento = traducirAlimento(principal);
  if (!alimento) return null;

  const calificativos = segmentos
    .slice(1)
    .map(traducirCalificativo)
    .filter((texto): texto is string => texto !== null);

  const unicos = [...new Set(calificativos)].slice(0, 2);
  return unicos.length > 0 ? `${alimento}, ${unicos.join(', ')}` : alimento;
}

/** El primer segmento puede traer detalle: "beef" en "beef, ribeye". */
function traducirAlimento(segmento: string): string | null {
  return buscarEnDiccionario(segmento, ALIMENTOS_EN_ESPANOL);
}

function traducirCalificativo(segmento: string): string | null {
  return buscarEnDiccionario(segmento, CALIFICATIVOS_EN_ESPANOL);
}

/**
 * Busca el segmento completo, luego una frase contenida en él y por último
 * palabra por palabra. De lo más específico a lo más general: "green beans"
 * tiene que ganarle a "green".
 */
function buscarEnDiccionario(
  segmento: string,
  diccionario: Record<string, string>,
): string | null {
  const directo = diccionario[segmento];
  if (directo) return directo;

  const frases = Object.keys(diccionario)
    .filter((clave) => clave.includes(' '))
    .sort((a, b) => b.length - a.length);

  for (const frase of frases) {
    const traduccion = diccionario[frase];
    if (traduccion && segmento.includes(frase)) return traduccion;
  }

  for (const palabra of segmento.split(' ')) {
    const traduccion = diccionario[palabra];
    if (traduccion) return traduccion;
  }

  return null;
}
