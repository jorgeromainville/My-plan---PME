import { getGoogleConfig, loginWithGoogle } from './authGoogle';

// El módulo nativo se carga solo al pulsar el botón: así Expo Go (que no lo
// incluye) sigue abriendo el resto de la app sin romperse. El login con Google
// necesita una dev build.
export async function signInWithGoogle() {
  const cfg = await getGoogleConfig();
  if (!cfg.enabled || !cfg.clientId) {
    throw new Error('El inicio con Google todavía no está configurado en el servidor.');
  }

  let mod: typeof import('@react-native-google-signin/google-signin');
  try {
    mod = await import('@react-native-google-signin/google-signin');
  } catch {
    throw new Error('Para entrar con Google necesitas la app de desarrollo (no Expo Go).');
  }

  mod.GoogleSignin.configure({ webClientId: cfg.clientId, offlineAccess: false });
  await mod.GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });

  const res = await mod.GoogleSignin.signIn();
  if (res.type !== 'success') return null; // el usuario cerró el selector

  const idToken = res.data.idToken;
  if (!idToken) {
    throw new Error('Google no devolvió el token de acceso. Revisa la configuración de la app.');
  }
  return loginWithGoogle(idToken);
}
