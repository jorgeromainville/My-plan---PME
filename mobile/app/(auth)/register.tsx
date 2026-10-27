import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GoogleButton } from '../../src/components/GoogleButton';
import { useSession } from '../../src/store/useSession';
import { useThemedStyles, type ThemeColors } from '../../src/theme/colors';

export default function Register() {
  const s = useThemedStyles(createStyles);
  const router = useRouter();
  const signIn = useSession((s) => s.signIn);
  const [error, setError] = useState('');

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.body}>
        <Text style={s.title}>Crear cuenta</Text>
        <Text style={s.sub}>
          Las cuentas nuevas se crean con Google. Verificamos tu correo en un toque y no guardamos
          contraseñas.
        </Text>
        {error ? <Text style={s.error}>{error}</Text> : null}
        <GoogleButton
          onError={setError}
          onSuccess={async (r) => {
            await signIn(r.access, r.user);
            router.replace('/(tabs)');
          }}
        />
        <Pressable onPress={() => router.replace('/(auth)/login')}>
          <Text style={s.link}>Ya tengo cuenta · Entrar</Text>
        </Pressable>
        <Text style={s.legal}>
          Al crear tu cuenta con Google aceptas los{' '}
          <Text style={s.linkInline} onPress={() => router.push('/terminos')}>
            términos de uso
          </Text>{' '}
          y la{' '}
          <Text style={s.linkInline} onPress={() => router.push('/privacidad')}>
            política de privacidad
          </Text>
          .
        </Text>
      </View>
    </SafeAreaView>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bg },
    body: { flex: 1, padding: 22, justifyContent: 'center' },
    title: { fontSize: 26, fontWeight: '900', color: colors.text, marginBottom: 8 },
    sub: { color: colors.muted, lineHeight: 20, marginBottom: 8 },
    error: { color: colors.danger, marginBottom: 10 },
    link: { textAlign: 'center', marginTop: 16, fontWeight: '700', color: colors.text },
    legal: { marginTop: 20, fontSize: 12, lineHeight: 18, color: colors.muted, textAlign: 'center' },
    linkInline: { color: colors.text, fontWeight: '800', textDecorationLine: 'underline' },
  });
}
