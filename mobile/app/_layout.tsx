import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { AppState } from 'react-native';
import { flushPending, setOnSessionExpired } from '../src/services/api';
import { useCatalog } from '../src/store/useCatalog';
import { usePrefs } from '../src/store/usePrefs';
import { useSession } from '../src/store/useSession';

// Layout raíz: carga sesión y manda a login si no hay token.
export default function RootLayout() {
  const { loaded, token, load, signOut } = useSession();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    load();
    usePrefs.getState().load();
    useCatalog.getState().load();
    setOnSessionExpired(() => signOut());
  }, []);

  useEffect(() => {
    if (!loaded) return;
    const inAuth = segments[0] === '(auth)';
    if (!token && !inAuth) router.replace('/(auth)/login');
    if (token && inAuth) router.replace('/(tabs)');
  }, [loaded, token, segments]);

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
      <StatusBar style="dark" />
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
      </Stack>
    </>
  );
}
