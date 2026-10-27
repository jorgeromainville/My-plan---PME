import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GoogleButton } from '../../src/components/GoogleButton';
import { login } from '../../src/services/auth';
import { useSession } from '../../src/store/useSession';
import { colors, useThemedStyles, type ThemeColors } from '../../src/theme/colors';

export default function Login() {
  const s = useThemedStyles(createStyles);
  const router = useRouter();
  const signIn = useSession((s) => s.signIn);
  const startGuest = useSession((s) => s.startGuest);
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function onGuest() {
    setError('');
    setBusy(true);
    try {
      await startGuest();
      router.replace('/(tabs)');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo entrar sin cuenta.');
    } finally {
      setBusy(false);
    }
  }

  async function onLogin() {
    setError('');
    setBusy(true);
    try {
      const r = await login(email.trim(), pass);
      await signIn(r.access, r.user);
      router.replace('/(tabs)');
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : 'No se pudo entrar. Revisa correo, clave y que la API esté corriendo.',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.body}>
        <Text style={s.title}>My Plan</Text>
        <Text style={s.sub}>Iniciar sesión</Text>
        <TextInput placeholderTextColor={colors.muted} style={s.input} placeholder="Correo" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
        <TextInput placeholderTextColor={colors.muted} style={s.input} placeholder="Contraseña" value={pass} onChangeText={setPass} secureTextEntry />
        {error ? <Text style={s.error}>{error}</Text> : null}
        <Pressable style={[s.btn, busy && s.btnOff]} onPress={onLogin} disabled={busy}>
          <Text style={s.btnTxt}>{busy ? 'Entrando…' : 'Entrar'}</Text>
        </Pressable>
        <View style={s.orRow}>
          <View style={s.orLine} />
          <Text style={s.orTxt}>o</Text>
          <View style={s.orLine} />
        </View>
        <GoogleButton
          onError={setError}
          onSuccess={async (r) => {
            await signIn(r.access, r.user);
            router.replace('/(tabs)');
          }}
        />
        <Pressable onPress={() => router.push('/(auth)/register')}>
          <Text style={s.link}>Crear cuenta con Google</Text>
        </Pressable>
        <Pressable style={[s.guest, busy && s.btnOff]} onPress={onGuest} disabled={busy}>
          <Text style={s.guestTxt}>Entrar sin cuenta</Text>
        </Pressable>
        <Text style={s.guestNote}>
          Tus datos se guardan solo en este teléfono. Puedes crear una cuenta después.
        </Text>
      </View>
    </SafeAreaView>
  );
}
function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  body: { flex: 1, padding: 22, justifyContent: 'center' },
  title: { fontSize: 28, fontWeight: '900', color: colors.text },
  sub: { color: colors.muted, marginBottom: 16 },
  input: { backgroundColor: colors.card, borderRadius: 12, borderWidth: 1, borderColor: colors.line, padding: 14, marginBottom: 10, color: colors.text },
  error: { color: colors.danger, marginBottom: 10 },
  btn: { backgroundColor: colors.primary, borderRadius: 14, padding: 15, alignItems: 'center', marginTop: 6 },
  btnOff: { opacity: 0.6 },
  btnTxt: { color: colors.onPrimary, fontWeight: '800' },
  orRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14 },
  orLine: { flex: 1, height: 1, backgroundColor: colors.line },
  orTxt: { color: colors.muted, fontSize: 12, fontWeight: '700' },
  link: { textAlign: 'center', marginTop: 14, fontWeight: '700', color: colors.text },
  guest: { marginTop: 20, borderWidth: 1, borderColor: colors.line, borderRadius: 14, padding: 14, alignItems: 'center', backgroundColor: colors.card },
  guestTxt: { fontWeight: '800', color: colors.text },
  guestNote: { textAlign: 'center', marginTop: 8, fontSize: 12, lineHeight: 17, color: colors.muted },
});
}
