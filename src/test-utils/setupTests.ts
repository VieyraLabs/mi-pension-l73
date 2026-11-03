/**
 * Configuración global de las pruebas.
 *
 * El timeout por omisión de `waitFor` es de un segundo. En local basta, pero
 * en CI, donde corren 36 suites en paralelo, una aserción que espera un
 * re-render puede rebasar ese segundo por carga de CPU y no por lógica: la
 * prueba falla de forma intermitente sin que nada esté roto.
 *
 * Subir el margen no relaja ninguna aserción: la condición que se espera es
 * la misma, sólo tiene más tiempo para cumplirse. El propio timeout de la
 * prueba (`testTimeout`) sigue en su valor por omisión, así que una prueba
 * que se cuelgue de verdad sigue fallando.
 */
import { configure } from '@testing-library/react-native';

configure({ asyncUtilTimeout: 5000 });
