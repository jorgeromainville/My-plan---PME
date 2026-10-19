import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { login } from '../../src/services/auth';
import { useSession } from '../../src/store/useSession';
import { colors } from '../../src/theme/colors';

export default function Login() {
  const router = useRouter();
  const signIn = useSession((s) => s.signIn);
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function onLogin() {
    setError('');
    setBusy(true);
    try {
      const r = await login(email.trim(), pass);
      await signIn(r.access, r.user.name);
      router.replace('/(tabs)');
    } catch {
      setError('No se pudo entrar. Revisa correo, clave y que la API esté corriendo.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.body}>
        <Text style={s.title}>Planner Today</Text>
        <Text style={s.sub}>Iniciar sesión</Text>
        <TextInput style={s.input} placeholder="Correo" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
        <TextInput style={s.input} placeholder="Contraseña" value={pass} onChangeText={setPass} secureTextEntry />
        {error ? <Text style={s.error}>{error}</Text> : null}
        <Pressable style={[s.btn, busy && s.btnOff]} onPress={onLogin} disabled={busy}>
          <Text style={s.btnTxt}>{busy ? 'Entrando…' : 'Entrar'}</Text>
        </Pressable>
        <Pressable onPress={() => router.push('/(auth)/register')}>
          <Text style={s.link}>Crear cuenta</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  body: { flex: 1, padding: 22, justifyContent: 'center' },
  title: { fontSize: 28, fontWeight: '900', color: colors.text },
  sub: { color: colors.muted, marginBottom: 16 },
  input: { backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: colors.line, padding: 14, marginBottom: 10 },
  error: { color: colors.danger, marginBottom: 10 },
  btn: { backgroundColor: colors.primary, borderRadius: 14, padding: 15, alignItems: 'center', marginTop: 6 },
  btnOff: { opacity: 0.6 },
  btnTxt: { color: '#fff', fontWeight: '800' },
  link: { textAlign: 'center', marginTop: 14, fontWeight: '700', color: colors.text },
});
