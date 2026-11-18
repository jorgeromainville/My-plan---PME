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

// 3) Permitir fijar el versionCode desde la CI sin tocar app.json, pero
// respetando el valor que `expo prebuild` tomó de `app.json` si no se pasa.
const versionMatch = /^(\s*)versionCode\s+(\d+)\r?\n/m.exec(text);
if (versionMatch) {
  const [, indent, original] = versionMatch;
  text = text.replace(
    versionMatch[0],
    `${indent}versionCode (System.getenv("MYPLAN_VERSION_CODE") ?: "${original}").toInteger()\n`,
  );
}

writeFileSync(gradlePath, text);
console.log('Firma: build.gradle parcheado para usar la llave de MYPLAN_KEYSTORE_PATH.');
