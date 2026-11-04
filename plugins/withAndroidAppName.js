// plugins/withAndroidAppName.js
//
// El nombre visible de la app en Android sale de `expo.name`, pero ese valor
// tiene que ser ASCII: Expo deriva de él el nombre del proyecto nativo de
// iOS y su saneado borra los caracteres acentuados en vez de transcribirlos
// ("Mi Pensión L73" se volvería "MiPensinL73"). Por eso el nombre visible se
// fija por plataforma: en iOS con `ios.infoPlist.CFBundleDisplayName` y aquí,
// con el mismo valor, para el `app_name` de Android.
//
// Se lee el nombre de `ios.infoPlist.CFBundleDisplayName` para que la marca
// se escriba en un solo lugar (app.json) y no se desincronice con la de iOS.

const { AndroidConfig, withStringsXml } = require('expo/config-plugins');

const withAndroidAppName = (config) =>
  withStringsXml(config, (config) => {
    const displayName = config.ios?.infoPlist?.CFBundleDisplayName;

    if (!displayName) {
      return config;
    }

    config.modResults = AndroidConfig.Strings.setStringItem(
      [AndroidConfig.Resources.buildResourceItem({ name: 'app_name', value: displayName })],
      config.modResults
    );

    return config;
  });

module.exports = withAndroidAppName;
