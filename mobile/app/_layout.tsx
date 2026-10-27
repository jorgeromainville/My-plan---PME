import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { AppState } from 'react-native';
import { flushPending, setOnSessionExpired } from '../src/services/api';
import { useCatalog } from '../src/store/useCatalog';
import { usePrefs } from '../src/store/usePrefs';
import { useSession } from '../src/store/useSession';
import { useIsDark } from '../src/theme/colors';

// Layout raíz: carga sesión y manda a login si no hay token ni modo invitado.
export default function RootLayout() {
  const { loaded, token, mode, load, signOut } = useSession();
  const segments = useSegments();
  const router = useRouter();
  const isDark = useIsDark();
  const active = !!token || mode === 'guest';

  useEffect(() => {
    load();
    usePrefs.getState().load();
    setOnSessionExpired(() => signOut());
  }, []);

  // Los catálogos (tipos de evento/plantillas) se leen cuando ya se sabe si la
  // sesión es de cuenta o invitado: `api()` decide a dónde ir según el modo.
  useEffect(() => {
    if (!loaded) return;
    void useCatalog.getState().load();
  }, [loaded, mode]);

  useEffect(() => {
    if (!loaded) return;
    const inAuth = segments[0] === '(auth)';
    // Privacidad y términos son públicos: se pueden leer antes de crear cuenta.
    const isPublic = inAuth || segments[0] === 'privacidad' || segments[0] === 'terminos';
    if (!active && !isPublic) router.replace('/(auth)/login');
    if (active && inAuth) router.replace('/(tabs)');
  }, [loaded, active, segments]);

  // Al abrir la app o volver a primer plano, intenta enviar lo que quedó
  // pendiente sin conexión.
  useEffect(() => {
    if (!token) return;
    void flushPending(true);
    const sub = AppState.addEventListener('change', (st) => {
      if (st === 'active') void flushPending();
    });
    return () => sub.remove();
  }, [token]);

  if (!loaded) return null;

  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="nuevo-registro" options={{ presentation: 'modal', headerShown: false }} />
        <Stack.Screen name="perfil" />
        <Stack.Screen name="tarea" options={{ presentation: 'modal' }} />
        <Stack.Screen name="evento" options={{ presentation: 'modal' }} />
        <Stack.Screen name="ajustes" />
        <Stack.Screen name="personas" />
        <Stack.Screen name="persona" options={{ presentation: 'modal' }} />
        <Stack.Screen name="ingresos" />
        <Stack.Screen name="ingreso" options={{ presentation: 'modal' }} />
        <Stack.Screen name="gastos" />
        <Stack.Screen name="gasto" options={{ presentation: 'modal' }} />
        <Stack.Screen name="metas" />
        <Stack.Screen name="meta" options={{ presentation: 'modal' }} />
        <Stack.Screen name="lugar" options={{ presentation: 'modal' }} />
        <Stack.Screen name="escaner" options={{ presentation: 'modal' }} />
        <Stack.Screen name="privacidad" />
        <Stack.Screen name="terminos" />
      </Stack>
    </>
  );
}
