import AsyncStorage from '@react-native-async-storage/async-storage';

// Modo de la sesión:
//   - 'account': hay (o habrá) una cuenta en el servidor; manda la nube.
//   - 'guest':   sin cuenta; los datos viven solo en este teléfono (SQLite).
//
// `api()` consulta `isGuest()` de forma sincrónica en cada llamada, por eso el
// modo se guarda también en memoria: leer AsyncStorage en cada request sería
// lento y abriría una ventana de carrera al arrancar.
export type SessionMode = 'account' | 'guest';

const MODE_KEY = '@planner/mode';

let current: SessionMode = 'account';

export function currentMode(): SessionMode {
  return current;
}

export function isGuest(): boolean {
  return current === 'guest';
}

export function setModeInMemory(mode: SessionMode): void {
  current = mode;
}

export async function loadMode(): Promise<SessionMode> {
  try {
    const raw = await AsyncStorage.getItem(MODE_KEY);
    current = raw === 'guest' ? 'guest' : 'account';
  } catch {
    current = 'account';
  }
  return current;
}

export async function saveMode(mode: SessionMode): Promise<void> {
  current = mode;
  try {
    await AsyncStorage.setItem(MODE_KEY, mode);
  } catch {
    // sin persistencia: al reiniciar vuelve al login
  }
}
