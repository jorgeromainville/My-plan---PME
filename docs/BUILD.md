# Compilar para la Play Store sin EAS

My Plan usa el SDK de Expo, pero **no depende de la nube de EAS** para producir el
AAB. El proyecto nativo se genera con `expo prebuild` (CNG) y se compila con
Gradle. Los módulos de Expo siguen funcionando porque son open source y se
autolinkean igual que cualquier paquete nativo.

---

## Opción A — GitHub Actions (recomendada, no requiere nada instalado)

`.github/workflows/android-build.yml`, ejecución manual:

1. Pestaña **Actions** → **Android build** → **Run workflow**.
2. `variant`: `aab` (Play Store) o `apk` (probar a mano en el teléfono).
3. `version_code`: déjalo vacío para usar el de `app.json`, o escribe el número
   que toque (Play exige que crezca en cada subida).
4. Al terminar, descarga el artefacto `myplan-aab-<n>`.

Secretos del repositorio (**Settings → Secrets and variables → Actions**):

| Secreto | Uso |
|---|---|
| `MYPLAN_KEYSTORE_BASE64` | Keystore de subida en base64 |
| `MYPLAN_KEYSTORE_PASSWORD` | Contraseña del almacén |
| `MYPLAN_KEY_ALIAS` | Alias de la llave |
| `MYPLAN_KEY_PASSWORD` | Contraseña de la llave |
| `EXPO_PUBLIC_API_URL` | Opcional; por defecto `https://my-plan-api.onrender.com` |
| `EXPO_PUBLIC_GOOGLE_MAPS_KEY` | Opcional; se hornea en el bundle |

Sin los cuatro primeros el build sale **firmado con la llave debug**: instala en
un teléfono y sirve para probar, pero Play Store lo rechaza.

### Crear la llave de subida

`.github/workflows/android-keystore.yml` (**Android keystore** → Run workflow)
genera el keystore en el runner y lo deja como artefacto `myplan-upload-keystore`
con un `LEEME.txt`. Es una acción de una sola vez:

- Guarda el `.keystore` fuera del repositorio (gestor de contraseñas / USB).
- Si lo pierdes **antes** de publicar, se genera otro sin problema.
- Si lo pierdes **después** de publicar, Play Console permite reiniciar la llave
  de carga, pero es un trámite con soporte.

Al publicar la primera vez, Play Console registrará esa llave como **llave de
subida** y Google guardará la **llave de firma** (Play App Signing). Por eso
también hay que agregar el **SHA-1 de Play App Signing** al cliente Android de
Google Cloud, o Google Sign-In falla en los builds de tienda.

---

## Opción B — Gradle en tu PC

Requiere JDK 17 y el Android SDK (Android Studio los instala).

```powershell
cd mobile
npx expo prebuild --platform android --clean
node scripts/patch-signing.mjs
cd android
./gradlew bundleRelease      # android/app/build/outputs/bundle/release/app-release.aab
```

Para firmar de verdad, antes del `gradlew`:

```powershell
$env:MYPLAN_KEYSTORE_PATH     = "upload.keystore"   # copiado a android/app/
$env:MYPLAN_KEYSTORE_PASSWORD = "..."
$env:MYPLAN_KEY_ALIAS         = "upload"
$env:MYPLAN_KEY_PASSWORD      = "..."
```

`scripts/patch-signing.mjs` es idempotente y **debe correr después de cada
`prebuild`**, porque CNG borra `android/` y lo vuelve a generar con la llave debug.

---

## Qué se versiona y qué no

- `android/` e `ios/` están en `mobile/.gitignore`: son salida de `prebuild`.
  Mientras no haga falta tocar `build.gradle` a mano, se regeneran.
- `app.json` es la fuente de verdad de versión, `versionCode`, permisos, íconos y
  plugins. Cambiarlo **no** toca un `android/` ya generado: hay que volver a
  correr `prebuild`.
- `expo-dev-client` sigue en `dependencies` porque el APK de desarrollo del
  teléfono lo necesita. El AAB de la Opción A también lo incluye; si algún día
  molesta en producción, se mueve a `devDependencies` y se compila el release con
  `--no-dev`.

---

## Verificar sin compilar

```powershell
cd mobile
npx expo prebuild --platform android --no-install   # ¿resuelven los plugins?
npm run typecheck
npm run test:local
npx expo export --platform android --output-dir "$env:TEMP\myplan-export"
```

Si `prebuild` termina sin errores y `expo export` produce el bundle, el código no
depende de nada exclusivo de EAS.

---

## Errores conocidos del build (Expo SDK 57)

Dos fallos del CI no vienen del código de la app, sino de cómo Expo SDK 57
genera y configura el proyecto Android. Los dos ya están resueltos por scripts;
esta sección existe para reconocerlos si vuelven.

### `Value is null` al evaluar `:app`

```
A problem occurred evaluating project ':app'
> Value is null
  app/build.gradle line: 95
```

Era el parche de firma: inyectaba `versionCode` con una expresión de Groovy
basada en `System.getenv("MYPLAN_VERSION_CODE")` y Gradle la evaluaba a `null`.
**Regla:** `patch-signing.mjs` solo toca la firma. El `versionCode` se queda
como literal entero que escribe `prebuild` desde `app.json`, y el input
`version_code` del workflow se aplica reescribiendo `app.json` antes.

### `Process 'command 'node'' finished with non-zero exit value 1`

Aparece al evaluar el proyecto, sin mensaje útil, justo después de listar los
módulos de Expo. Lo provoca `expo-modules-autolinking`:

1. `ExpoAutolinkingPlugin.kt` pasa `expo.inlineModules.watchedDirectories` como
   lista vacía; Gradle expande una lista vacía a **cero argumentos** y
   `commander` aborta con `option '--watched-directories-serialized' argument
   missing`.
2. Aunque llegara el valor, el comando exige que las rutas contengan `android`,
   pero las calcula sobre el proyecto `:expo` (`node_modules/expo/src/main/...`),
   así que lanza `Generation path is not inside any android directory!`.

No está corregido hasta 57.0.18. Como la app no usa módulos inline, el comando
es un no-op y `mobile/scripts/patch-expo-autolinking.mjs` lo deja saliendo con
código 0. **Si algún día se hace `rm -rf node_modules` o cambia la versión de
Expo, hay que volver a correrlo** (y revisar que siga encontrando los
fragmentos; si no, el script falla ruidosamente en vez de seguir de largo).
