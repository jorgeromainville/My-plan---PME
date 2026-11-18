// Parche para un bug de Expo SDK 57 (expo-modules-autolinking 57.0.16).
//
// Al compilar con Gradle, el plugin de autolinking corre SIEMPRE:
//
//   node --eval "require('expo/bin/autolinking')" expo-modules-autolinking \
//     mirror-kotlin-inline-modules ... --watched-directories-serialized <lista>
//
// y si falla, Gradle aborta con un mensaje inútil y sin el stderr del proceso:
//
//   Process 'command 'node'' finished with non-zero exit value 1
//
// Motivos conocidos:
//
//   1) En ExpoAutolinkingPlugin.kt la lista es `emptyList<String>()`, y Gradle
//      expande una lista vacía a CERO argumentos: commander ve el flag sin
//      valor y muere con "argument missing".
//   2) El comando exige que las rutas contengan "android", pero el plugin las
//      calcula sobre el proyecto :expo (node_modules/expo/src/main/...), así
//      que lanza "Generation path is not inside any android directory!".
//
// No usamos módulos inline (la lista de directorios vigilados está vacía), así
// que lo único que necesitamos es que el comando termine con código 0. Este
// parche hace el flag opcional, quita la validación de ruta y, si algo más
// falla, lo anota en `autolinking-error.log` (en la raíz del repo) en vez de
// tumbar el build. El workflow imprime ese archivo si aparece.
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

if (text.includes(`${MARK}-v2`)) {
  console.log('Autolinking: ya estaba parcheado.');
  process.exit(0);
}

// Cada paso es opcional por separado: así el script sirve tanto sobre el
// archivo original de Expo como sobre uno ya parcheado por una versión previa.
const steps = [
  {
    name: 'flag opcional',
    from: ".requiredOption('--watched-directories-serialized <watchedDirectories>', 'JSON serialized watched directories array')",
    to: `.option('--watched-directories-serialized <watchedDirectories>', 'JSON serialized watched directories array')`,
  },
  {
    name: 'lista por defecto vacía',
    from: 'JSON.parse(watchedDirectoriesSerialized)',
    to: "JSON.parse(watchedDirectoriesSerialized ?? '[]')",
  },
  {
    name: 'sin exigir la ruta "android"',
    from: `if (!/.android./.test(kotlinFilesMirrorDirectory) ||
            !/.android./.test(inlineModulesListDirectory)) {
            throw new Error('Generation path is not inside any android directory!');
        }`,
    to: `// ${MARK}: se omite el chequeo porque en SDK 57 las rutas caen en
        // node_modules/expo/... y no en un directorio llamado "android".`,
  },
  {
    name: 'no tumbar el build',
    from: '        .action(async (commandArguments) => {',
    to: `        .action(async (commandArguments) => { try { // ${MARK}-v2`,
  },
  {
    name: 'registrar el error y salir con 0',
    from: `        await Promise.all([createMirrorStructurePromise, generateInlineModulesListPromise]);
    });`,
    to: `        await Promise.all([createMirrorStructurePromise, generateInlineModulesListPromise]);
        } catch (error) {
            require('fs').appendFileSync(
                require('path').resolve(process.cwd(), '../../autolinking-error.log'),
                String((error && error.stack) || error) + '\\n'
            );
        }
    });`,
  },
];

const applied = [];
for (const { name, from, to } of steps) {
  if (text.includes(from)) {
    text = text.replace(from, to);
    applied.push(name);
  }
}

// Solo escribimos si de verdad cambió algo; si no encontró NINGÚN fragmento,
// algo raro pasó (Expo reescribió el archivo) y preferimos fallar ruidosamente.
if (applied.length === 0) {
  console.error('Autolinking: no se reconoció ningún fragmento del comando.');
  console.error(`Revisa a mano: ${scriptPath}`);
  process.exit(1);
}

writeFileSync(scriptPath, text);
console.log(`Autolinking: parcheado (${applied.join(', ')}).`);
