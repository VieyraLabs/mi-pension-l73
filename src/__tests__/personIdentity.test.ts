/**
 * Identidad de persona para agrupar simulaciones del historial (DEC-018).
 * Cubre SCN-001 (coincidencia por birthDate + palabra del nombre),
 * SCN-002 (rechazos) y SCN-003 (fallback a birthDate sin nombre).
 *
 * Para ejecutar: npm test
 */
import {
  getSignificantWords,
  isSamePerson,
} from '../services/pension/comparison/personIdentity';

const BIRTH = new Date(1968, 4, 3); // 3 de mayo de 1968

describe('personIdentity', () => {
  describe('isSamePerson — coincidencia (SCN-001)', () => {
    test('misma persona con mayúsculas y acentos distintos', () => {
      expect(
        isSamePerson(
          { name: 'María López', birthDate: BIRTH },
          { name: 'MARIA LOPEZ', birthDate: BIRTH },
        ),
      ).toBe(true);
    });

    test('basta una palabra coincidente cuando el resto del nombre difiere', () => {
      expect(
        isSamePerson(
          { name: 'María López García', birthDate: BIRTH },
          { name: 'Lopez Hernández, María', birthDate: BIRTH },
        ),
      ).toBe(true);
    });

    test('compara el día calendario aunque la hora difiera o venga como ISO', () => {
      expect(
        isSamePerson(
          { name: 'María López', birthDate: new Date(1968, 4, 3, 8, 30) },
          { name: 'María López', birthDate: BIRTH.toISOString() },
        ),
      ).toBe(true);
    });
  });

  describe('isSamePerson — rechazos (SCN-002)', () => {
    test('fecha de nacimiento distinta → false aunque el nombre coincida', () => {
      expect(
        isSamePerson(
          { name: 'María López', birthDate: BIRTH },
          { name: 'María López', birthDate: new Date(1970, 4, 3) },
        ),
      ).toBe(false);
    });

    test('mismo día y mes pero distinto año → false', () => {
      expect(
        isSamePerson(
          { name: 'María López', birthDate: BIRTH },
          { name: 'María López', birthDate: new Date(1969, 4, 3) },
        ),
      ).toBe(false);
    });

    test('mismo birthDate pero nombres sin palabra común → false', () => {
      expect(
        isSamePerson(
          { name: 'María López', birthDate: BIRTH },
          { name: 'Juana Pérez', birthDate: BIRTH },
        ),
      ).toBe(false);
    });

    test('coincide por palabra completa, nunca por subcadena', () => {
      expect(
        isSamePerson(
          { name: 'Ana Ruiz', birthDate: BIRTH },
          { name: 'Mariana Ruiz', birthDate: BIRTH },
        ),
      ).toBe(true); // «ruiz» es palabra completa en ambas
      expect(
        isSamePerson(
          { name: 'Ana', birthDate: BIRTH },
          { name: 'Mariana', birthDate: BIRTH },
        ),
      ).toBe(false); // ninguna palabra significativa en común («Ana» mide 3 pero no es «Mariana»)
      expect(
        isSamePerson(
          { name: 'José Álvarez', birthDate: BIRTH },
          { name: 'Josefa Ramírez', birthDate: BIRTH },
        ),
      ).toBe(false); // «jose» no es «josefa»: se compara por palabra completa
    });

    test('descarta palabras de menos de 3 caracteres', () => {
      expect(getSignificantWords('De la O')).toEqual([]);
      expect(getSignificantWords('Ana Ma')).toEqual(['ana']);
      expect(getSignificantWords('José Álvarez')).toEqual(['jose', 'alvarez']);
    });
  });

  describe('isSamePerson — fallback a birthDate (SCN-003)', () => {
    test('si falta el nombre en una de las dos, decide birthDate', () => {
      expect(
        isSamePerson({ name: undefined, birthDate: BIRTH }, { name: 'María López', birthDate: BIRTH }),
      ).toBe(true);
      expect(
        isSamePerson({ name: '', birthDate: BIRTH }, { name: 'María López', birthDate: BIRTH }),
      ).toBe(true);
    });

    test('sin nombres y con birthDate distinto → false', () => {
      expect(
        isSamePerson({ birthDate: BIRTH }, { birthDate: new Date(1968, 4, 4) }),
      ).toBe(false);
    });
  });
});
