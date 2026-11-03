import {
  M10_OCCUPATION_CATALOG,
  getOccupationDivision,
  getOccupationGroup,
  resolveRiskClass,
} from '../constants/ocupaciones';

describe('Catálogo de ocupaciones (Modalidad 10)', () => {
  test('resuelve la clase de riesgo a partir de división y grupo', () => {
    expect(resolveRiskClass('14', '41')).toBe(3); // Comerciantes → clase III
    expect(resolveRiskClass('14', '42')).toBe(2); // Vendedores ambulantes → clase II
    expect(resolveRiskClass('12', '24')).toBe(2); // Especialistas en salud → clase II
    expect(resolveRiskClass('16', '61')).toBe(3); // Actividades agrícolas y ganaderas → clase III
    expect(resolveRiskClass('16', '63')).toBe(5); // Operadores de maquinaria agropecuaria → clase V
    expect(resolveRiskClass('114', '114')).toBe(5); // Construcción → clase V
    expect(resolveRiskClass('115', '01')).toBe(4); // Conductores y repartidores → clase IV
  });

  test('devuelve undefined si la ocupación no existe', () => {
    expect(resolveRiskClass('99', '99')).toBeUndefined();
    expect(resolveRiskClass('1', undefined)).toBeUndefined();
    expect(resolveRiskClass(undefined, '11')).toBeUndefined();
    // La división existe, pero el grupo no.
    expect(resolveRiskClass('14', '99')).toBeUndefined();
  });

  test('trae las 13 divisiones del catálogo oficial y todos los grupos con clase válida', () => {
    expect(M10_OCCUPATION_CATALOG).toHaveLength(13);
    for (const division of M10_OCCUPATION_CATALOG) {
      expect(division.groups.length).toBeGreaterThan(0);
      for (const group of division.groups) {
        expect([1, 2, 3, 4, 5]).toContain(group.riskClass);
        expect(getOccupationGroup(division.code, group.code)).toEqual(group);
      }
    }
  });

  test('incluye la división de Comerciantes y agentes de ventas con su grupo', () => {
    const division = getOccupationDivision('14');
    expect(division?.name).toBe('Comerciantes y agentes de ventas');
    expect(division?.groups.map((g) => g.name)).toContain('Comerciantes');
    expect(getOccupationGroup('14', '41')?.riskClass).toBe(3);
  });

  test('los códigos de división son únicos y no se confunden con los del catálogo anterior', () => {
    const codes = M10_OCCUPATION_CATALOG.map((d) => d.code);
    expect(new Set(codes).size).toBe(codes.length);
    // El catálogo anterior (RACERF) usaba un solo dígito; el oficial no.
    for (const code of codes) {
      expect(code.length).toBeGreaterThan(1);
    }
  });
});
