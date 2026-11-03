/**
 * Catálogo de ocupaciones para derivar la clase de riesgo laboral (I–V) que
 * determina la prima de Riesgos de Trabajo de la Modalidad 10.
 *
 * FUENTE PRIMARIA: el **catálogo de ocupaciones de la calculadora oficial del
 * IMSS para Personas Trabajadoras Independientes** (Modalidad 10):
 * - Divisiones: `https://www.imss.gob.mx/personas-trabajadoras-independientes/calculadora`
 *   (las opciones del selector "División").
 * - Grupos y clase: `https://www.imss.gob.mx/sites/all/statics/trabajadores-independientes/catalogoSINCO-0326.js`
 *   (variable `arrayValoresSINCO`: división, grupo, nombre y clase de riesgo).
 *
 * En el catálogo oficial **la clase de riesgo viene publicada junto con el
 * grupo**: es el valor que la calculadora del IMSS envía al calcular la cuota,
 * y el que determina la prima de Riesgos de Trabajo. Por eso la app ya no
 * aproxima la clase: reproduce la clasificación oficial.
 *
 * LIMITACIÓN DECLARADA: el catálogo clasifica por **ocupación** y cada grupo
 * agrupa a varias ocupaciones que el IMSS considera equivalentes en riesgo. La
 * clase que se aplica es, por tanto, la del grupo que la persona elija; si su
 * actividad real no aparece en la lista, corresponde elegir el grupo más
 * cercano y verificarlo con el IMSS.
 *
 * Solo lectura y función pura: aquí no hay UI ni estado.
 */
import type { RiskClass } from '../models';

export interface OccupationGroup {
  /** Código del grupo dentro de su división (código del catálogo oficial). */
  code: string;
  name: string;
  /** Clase de riesgo que el catálogo oficial asigna a este grupo. */
  riskClass: RiskClass;
}

export interface OccupationDivision {
  /** Código de división (código del catálogo oficial). */
  code: string;
  name: string;
  groups: OccupationGroup[];
}

/**
 * Catálogo de ocupaciones de la Modalidad 10: 13 divisiones y sus grupos con
 * la clase de riesgo oficial.
 *
 * El orden de las divisiones y de los grupos es el del catálogo oficial, para
 * que la lista de la app sea la misma que la de la calculadora del IMSS. Los
 * nombres se reproducen literalmente (incluidas las erratas del original).
 */
export const M10_OCCUPATION_CATALOG: readonly OccupationDivision[] = [
  {
    code: '110',
    name: 'Mexicanos en el extranjero',
    groups: [
      {
        code: '101',
        name: 'Trabajadores independientes que radican y laboran en el extranjero',
        riskClass: 1,
      },
    ],
  },
  {
    code: '115',
    name: 'Plataformas digitales',
    groups: [{ code: '01', name: 'Conductores y repartidores', riskClass: 4 }],
  },
  {
    code: '111',
    name: 'Ministros de culto',
    groups: [{ code: '111', name: 'Sacerdotes, pastores y otros teólogos', riskClass: 1 }],
  },
  {
    code: '12',
    name: 'Profesionistas y técnicos',
    groups: [
      {
        code: '21',
        name: 'Profesionistas y técnicos en ciencias económico-administrativas, ciencias sociales, humanistas y en artes',
        riskClass: 1,
      },
      {
        code: '22',
        name: 'Investigadores, técnicos y profesionistas en ciencias exactas, biológicas, ingeniería, informática y en telecomunicaciones',
        riskClass: 1,
      },
      {
        code: '23',
        name: 'Profesores, técnicos y especialistas en docencia',
        riskClass: 1,
      },
      {
        code: '24',
        name: 'Médicos, enfermeras, técnicos, otros especialistas en salud y trabajadores de apoyo',
        riskClass: 2,
      },
    ],
  },
  {
    code: '14',
    name: 'Comerciantes y agentes de ventas',
    groups: [
      { code: '41', name: 'Comerciantes', riskClass: 3 },
      {
        code: '43',
        name: 'Trabajadores de alquiler de bienes muebles y de bienes raíces',
        riskClass: 2,
      },
      { code: '42', name: 'Vendedores ambulantes', riskClass: 2 },
    ],
  },
  {
    code: '15',
    name: 'Trabajadores en servicios personales y de vigilancia',
    groups: [
      {
        code: '51',
        name: 'Trabajadores en la preparación y servicio de alimentos y bebidas, así como en servicios de esparcimiento y de hotelería',
        riskClass: 3,
      },
      { code: '52', name: 'Trabajadores independientes en cuidados personales', riskClass: 1 },
      { code: '53', name: 'Trabajadores en servicios de protección y vigilancia', riskClass: 3 },
    ],
  },
  {
    code: '16',
    name: 'Trabajadores en actividades agrícolas, ganaderas, forestales, caza y pesca',
    groups: [
      { code: '61', name: 'Trabajadores en actividades agrícolas y ganaderas', riskClass: 3 },
      {
        code: '62',
        name: 'Trabajadores en actividades pesqueras, forestales, caza y similares',
        riskClass: 4,
      },
      { code: '63', name: 'Operadores de maquinaria agropecuaria y forestal', riskClass: 5 },
    ],
  },
  {
    code: '17',
    name: 'Trabajadores artesanos',
    groups: [
      {
        code: '72',
        name: 'Artesanos y trabajadores en el tratamiento y elaboracion de productos',
        riskClass: 5,
      },
    ],
  },
  {
    code: '114',
    name: 'Trabajadores de la construcción',
    groups: [{ code: '114', name: 'Trabajadores de la construcción', riskClass: 5 }],
  },
  {
    code: '18',
    name: 'Operadores de instalaciones y maquinaria industrial',
    groups: [
      {
        code: '81',
        name: 'Operadores de instalaciones y maquinaria industrial',
        riskClass: 5,
      },
      {
        code: '82',
        name: 'Ensambladores y montadores de herramientas, maquinaria, productos metálicos y electrónicos',
        riskClass: 4,
      },
    ],
  },
  {
    code: '112',
    name: 'Conductores',
    groups: [
      { code: '11201', name: 'Conductores de transporte y de maquinaria móvil', riskClass: 4 },
      {
        code: '11202',
        name: 'Conductores de transporte de tracción humana y animal',
        riskClass: 5,
      },
    ],
  },
  {
    code: '19',
    name: 'Trabajadores en actividades elementales de apoyo y mensajería',
    groups: [
      {
        code: '97',
        name: 'Trabajadores de paquetería, de apoyo para espectáculos, mensajeros y repartidores de mercancía',
        riskClass: 4,
      },
      { code: '99', name: 'Ocupaciones de apoyo', riskClass: 5 },
    ],
  },
  {
    code: '113',
    name: 'Otra división no clasificada anteriormente',
    groups: [
      {
        code: '113',
        name: 'Otro grupo no clasificado anteriormente',
        riskClass: 3,
      },
    ],
  },
];

/** Obtiene una división por su código. */
export function getOccupationDivision(code?: string): OccupationDivision | undefined {
  if (!code) return undefined;
  return M10_OCCUPATION_CATALOG.find((d) => d.code === code);
}

/** Obtiene un grupo por división y grupo. */
export function getOccupationGroup(
  divisionCode?: string,
  groupCode?: string,
): OccupationGroup | undefined {
  const division = getOccupationDivision(divisionCode);
  if (!division || !groupCode) return undefined;
  return division.groups.find((g) => g.code === groupCode);
}

/**
 * Ocupación con la que se precarga la Modalidad 10: la división de
 * Comerciantes y agentes de ventas con su grupo Comerciantes.
 *
 * La clase **no** se escribe a mano: se toma del catálogo, para que siga siendo
 * la que el IMSS publica.
 */
export const M10_DEFAULT_OCCUPATION = {
  divisionCode: '14',
  groupCode: '41',
  riskClass: getOccupationGroup('14', '41')?.riskClass,
};

/**
 * Deriva la clase de riesgo a partir de la división y el grupo seleccionados.
 * Devuelve `undefined` si la ocupación no está en el catálogo (o no se eligió).
 */
export function resolveRiskClass(
  divisionCode?: string,
  groupCode?: string,
): RiskClass | undefined {
  return getOccupationGroup(divisionCode, groupCode)?.riskClass;
}
