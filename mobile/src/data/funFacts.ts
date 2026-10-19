// Datos para entretener mientras el escáner trabaja.
// Casi todos son ciertos y verificables; los "guiños" (bromas obvias) salen
// muy de vez en cuando para sacar una sonrisa.

export const FUN_FACTS: string[] = [
  'Al despertar somos hasta un centímetro más altos que al final del día: los discos de la columna se comprimen.',
  'Los pulpos tienen tres corazones y sangre azul.',
  'Un rayo es unas cinco veces más caliente que la superficie del Sol.',
  'Los plátanos son ligeramente radiactivos por el potasio que contienen.',
  'La miel no se echa a perder: se han encontrado tarros comestibles de hace miles de años.',
  'El corazón de una ballena azul puede pesar como un coche pequeño.',
  'Los flamencos son rosas por los pigmentos de las gambas y algas que comen.',
  'La Torre Eiffel puede ser hasta 15 cm más alta en verano por la dilatación del metal.',
  'Los caracoles pueden pasar hasta tres años dormidos.',
  'El sonido no se propaga en el vacío: en el espacio nadie te oiría gritar.',
  'Los tiburones ya existían antes de que aparecieran los primeros árboles.',
  'Tu cuerpo tiene más bacterias que células propias, más o menos.',
  'Un día en Venus dura más que un año venusino.',
  'Las huellas de los koalas son casi idénticas a las humanas.',
  'El ojo humano distingue millones de colores distintos.',
  'Los dientes son la única parte del cuerpo que no se regenera sola.',
  'La luz del Sol tarda unos 8 minutos y 20 segundos en llegar a la Tierra.',
  'Los pingüinos se declaran con una piedra: si la aceptan, es pareja.',
  'El árbol vivo más viejo tiene más de 4.800 años.',
  'Las abejas pueden reconocer caras humanas.',
  'El ADN de dos personas coincide en un 99,9 %.',
  'Una nube de un kilómetro cúbico puede pesar más de 500 toneladas.',
  'Los astronautas crecen hasta 5 cm en el espacio y vuelven a su altura al aterrizar.',
  'Los gatos no pueden saborear lo dulce.',
  'El cerebro usa cerca del 20 % de la energía del cuerpo aunque pese solo un 2 %.',
  'Hay más estrellas en el universo que granos de arena en todas las playas de la Tierra.',
  'Los bebés tienen más huesos que los adultos: algunos se fusionan al crecer.',
  'Un relámpago puede iluminar una ciudad entera durante una fracción de segundo.',
  'Las plantas "sudan" agua por las hojas: se llama transpiración.',
  'El hierro de tu sangre se formó dentro de estrellas que explotaron hace millones de años.',
];

export const FUN_WINKS: string[] = [
  'Dato 100 % verificado: 2 + 2 sigue siendo 4.',
  'El agua moja. Fuente: la ducha de esta mañana.',
  'El fuego quema. No hace falta comprobarlo.',
  'El café con leche es café… con leche.',
  'Si tienes hambre, probablemente sea hora de comer.',
  'Los lunes duran más. La ciencia aún lo investiga.',
];

/** Dato aleatorio; ~8 % de las veces es un guiño. Evita repetir el anterior. */
export function randomFact(prev?: string): string {
  const wink = Math.random() < 0.08;
  const pool = (wink ? FUN_WINKS : FUN_FACTS).filter((f) => f !== prev);
  const list = pool.length ? pool : FUN_FACTS;
  return list[Math.floor(Math.random() * list.length)];
}
