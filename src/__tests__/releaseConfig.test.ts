/**
 * Invariantes de la configuración de publicación (Spec-10 y ADR-0017).
 *
 * Estos archivos son la fuente de verdad de lo que se distribuye: el perfil de
 * EAS decide qué artefacto sale, y la política de runtime version decide qué
 * actualizaciones puede aplicar un binario. Un cambio accidental en cualquiera
 * de los dos cambia lo que el usuario recibe sin que nada falle en la suite.
 *
 * Para ejecutar: npm test
 */
import appConfigJson from '../../app.json';
import easConfigJson from '../../eas.json';

type RuntimeVersionConfig = { policy?: string };

type ExpoConfig = {
  expo?: {
    version?: string;
    runtimeVersion?: RuntimeVersionConfig;
  };
};

type BuildProfile = {
  distribution?: string;
  channel?: string;
  autoIncrement?: boolean;
  android?: { buildType?: string };
};

type EasConfig = {
  cli?: { version?: string; appVersionSource?: string };
  build?: Record<string, BuildProfile>;
};

const appConfig = appConfigJson as unknown as ExpoConfig;
const easConfig = easConfigJson as unknown as EasConfig;

const releaseProfile = easConfig.build?.release;
const previewProfile = easConfig.build?.preview;
const productionProfile = easConfig.build?.production;

describe('release configuration — runtime version', () => {
  test('the runtime version policy is appVersion', () => {
    // Una OTA sólo puede aplicarse a binarios de la misma versión de la app.
    // Con otra política, un bundle nuevo podría cambiar el cálculo sobre un
    // binario de otra versión.
    expect(appConfig.expo?.runtimeVersion?.policy).toBe('appVersion');
  });
});

describe('release configuration — the release build profile', () => {
  test('it is internal distribution', () => {
    // 'store' produciría un .aab y un .ipa de tienda, que no son instalables
    // fuera de las tiendas.
    expect(releaseProfile?.distribution).toBe('internal');
  });

  test('it produces an installable APK, not an app bundle', () => {
    expect(releaseProfile?.android?.buildType).toBe('apk');
  });

  test('it ships to the production update channel', () => {
    expect(releaseProfile?.channel).toBe('production');
  });

  test('it increments the native build number', () => {
    expect(releaseProfile?.autoIncrement).toBe(true);
  });

  test('the release profile does not share the staging channel', () => {
    // Una build de release en el canal de staging recibiría las OTA de
    // pruebas, que son justamente las que no han pasado la revisión.
    expect(releaseProfile?.channel).not.toBe('staging');
  });
});

describe('release configuration — the other build profiles keep their meaning', () => {
  test('preview stays internal and on the staging channel', () => {
    expect(previewProfile?.distribution).toBe('internal');
    expect(previewProfile?.channel).toBe('staging');
  });

  test('production stays store distribution', () => {
    // 'production' es el perfil que se usaría para un envío a tiendas. No
    // declara 'distribution', que en EAS significa distribución de tienda.
    expect(productionProfile?.distribution).toBeUndefined();
    expect(productionProfile?.channel).toBe('production');
  });

  test('the native version is managed remotely', () => {
    expect(easConfig.cli?.appVersionSource).toBe('remote');
  });
});
