// Parche para un bug de Expo SDK 57 (expo-modules-autolinking 57.0.16).
//
// Al compilar con Gradle, el plugin de autolinking corre SIEMPRE:
//
//   node --eval "require('expo/bin/autolinking')" expo-modules-autolinking \
//     mirror-kotlin-inline-modules ... --watched-directories-serialized <lista>
//
// y falla por dos motivos, en este orden:
//
//   1) En ExpoAutolinkingPlugin.kt la lista es `emptyList<String>()`, y Gradle
//      expande una lista vacía a CERO argumentos. Commander ve el flag sin
//      valor y muere con "argument missing" (exit 1).
//   2) Aunque llegara la lista, el comando exige que las rutas contengan
//      "android". El plugin las calcula con `project.file(...)` sobre el
//      proyecto :expo, o sea `node_modules/expo/src/main/...`, que no la
//      contiene: "Generation path is not inside any android directory!".
//
// Resultado: `Process 'command 'node'' finished with non-zero exit value 1`
// al evaluar el proyecto, sin más pistas.
//
// Ninguna versión publicada (probado hasta 57.0.18) lo corrige. Como no
// usamos módulos inline (la lista de directorios vigilados está vacía), el
// comando es un no-op: basta con que salga con código 0.
//
// Es idempotente. Se ejecuta después de `npm ci` y antes de Gradle.
//
//   node scripts/patch-expo-autolinking.mjs
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const scriptPath = resolve(
  here,
  '..',
  'node_modules',
  'expo-modules-autolinking',
  'build',
  'commands',
  'mirrorKotlinInlineModulesCommand.js',
);

if (!existsSync(scriptPath)) {
  console.error(`Autolinking: no existe ${scriptPath}`);
  console.error('Corre antes: npm ci');
  process.exit(1);
}

const MARK = 'myplan:inline-modules-noop';
let text = readFileSync(scriptPath, 'utf8');

if (text.includes(MARK)) {
  console.log('Autolinking: ya estaba parcheado.');
  process.exit(0);
}

const replacements = [
  {
    name: 'flag opcional',
    from: ".requiredOption('--watched-directories-serialized <watchedDirectories>', 'JSON serialized watched directories array')",
    to: `.option('--watched-directories-serialized <watchedDirectories>', 'JSON serialized watched directories array') // ${MARK}`,
  },
  {
    name: 'lista por defecto vacía',
    from: 'const watchedDirectories = JSON.parse(watchedDirectoriesSerialized);',
    to: "const watchedDirectories = JSON.parse(watchedDirectoriesSerialized ?? '[]');",
  },
  {
    name: 'sin exigir la ruta "android"',
    from: `        if (!/.android./.test(kotlinFilesMirrorDirectory) ||
            !/.android./.test(inlineModulesListDirectory)) {
            throw new Error('Generation path is not inside any android directory!');
        }`,
    to: `        // ${MARK}: se omite el chequeo porque en SDK 57 las rutas caen en
        // node_modules/expo/... y no en un directorio llamado "android".`,
  },
];

for (const { name, from, to } of replacements) {
  if (!text.includes(from)) {
    console.error(`Autolinking: no se encontró el fragmento "${name}".`);
    console.error('Puede que Expo lo haya reescrito: revisa el archivo a mano.');
    process.exit(1);
  }
  text = text.replace(from, to);
}

writeFileSync(scriptPath, text);
console.log('Autolinking: mirror-kotlin-inline-modules parcheado (queda como no-op).');
