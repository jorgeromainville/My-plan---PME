// Firma del AAB/APK release sin EAS.
//
// `expo prebuild` genera `android/app/build.gradle` con el release firmado con la
// llave **debug** (EAS la sustituye en la nube). Al compilar con Gradle en local o
// en GitHub Actions hay que apuntar a una llave real, así que este script la toma
// de variables de entorno. Si no hay llave, deja la de debug para poder probar.
//
// Es idempotente: si ya parcheó el archivo, no hace nada. Se ejecuta SIEMPRE
// después de `expo prebuild`, porque CNG regenera `android/` desde cero.
//
//   MYPLAN_KEYSTORE_PATH      ruta al .keystore (relativa a android/app)
//   MYPLAN_KEYSTORE_PASSWORD  contraseña del almacén
//   MYPLAN_KEY_ALIAS          alias (por defecto `upload`)
//   MYPLAN_KEY_PASSWORD       contraseña de la llave
//
//   node scripts/patch-signing.mjs
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const gradlePath = resolve(here, '..', 'android', 'app', 'build.gradle');

if (!existsSync(gradlePath)) {
  console.error('No existe android/app/build.gradle. Corre antes: npx expo prebuild --platform android');
  process.exit(1);
}

const MARK = '// myplan:release-signing';
let text = readFileSync(gradlePath, 'utf8');

if (text.includes(MARK)) {
  console.log('Firma: ya estaba parcheada.');
  process.exit(0);
}

// 1) Agregar el bloque `release` dentro de `signingConfigs`.
const debugBlockEnd = `            keyPassword 'android'
        }
    }
`;
const withRelease = `            keyPassword 'android'
        }
        ${MARK}
        release {
            // Si no hay variables de entorno, se firma con la llave de debug
            // (sirve para probar; Play Store rechaza un AAB firmado así).
            storeFile file(System.getenv("MYPLAN_KEYSTORE_PATH") ?: "debug.keystore")
            storePassword System.getenv("MYPLAN_KEYSTORE_PASSWORD") ?: "android"
            keyAlias System.getenv("MYPLAN_KEY_ALIAS") ?: "androiddebugkey"
            keyPassword System.getenv("MYPLAN_KEY_PASSWORD") ?: "android"
        }
    }
`;

if (!text.includes(debugBlockEnd)) {
  console.error('Firma: no se encontró el bloque signingConfigs esperado.');
  process.exit(1);
}
text = text.replace(debugBlockEnd, withRelease);

// 2) Que el buildType `release` use esa configuración.
const releaseDebugSign = `        release {
            // Caution! In production, you need to generate your own keystore file.
            // see https://reactnative.dev/docs/signed-apk-android.
            signingConfig signingConfigs.debug`;
const releaseRealSign = `        release {
            // Caution! In production, you need to generate your own keystore file.
            // see https://reactnative.dev/docs/signed-apk-android.
            signingConfig signingConfigs.release`;

if (!text.includes(releaseDebugSign)) {
  console.error('Firma: no se encontró el buildType release esperado.');
  process.exit(1);
}
text = text.replace(releaseDebugSign, releaseRealSign);

// 3) El versionCode NO se toca aquí: lo deja `expo prebuild` como literal
// entero desde app.json. Antes se inyectaba una expresión de Groovy con
// System.getenv, y Gradle reventaba al evaluar :app ("Value is null") cuando la
// variable llegaba vacía. Para cambiarlo desde la CI se edita app.json antes
// del prebuild (ver .github/workflows/android-build.yml).

writeFileSync(gradlePath, text);
console.log('Firma: build.gradle parcheado para usar la llave de MYPLAN_KEYSTORE_PATH.');
