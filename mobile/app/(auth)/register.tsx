import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { register } from '../../src/services/auth';
import { useSession } from '../../src/store/useSession';
import { colors, useThemedStyles, type ThemeColors } from '../../src/theme/colors';

export default function Register() {
  const s = useThemedStyles(createStyles);
  const router = useRouter();
  const signIn = useSession((s) => s.signIn);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [error, setError] = useState('');

  async function onRegister() {
    setError('');
    try {
      const r = await register(name.trim(), email.trim(), pass);
      await signIn(r.access, r.user);
      router.replace('/(tabs)');
    } catch {
      setError('No se pudo crear la cuenta (¿correo ya usado o clave menor a 8?).');
    }
  }

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.body}>
        <Text style={s.title}>Crear cuenta</Text>
        <TextInput placeholderTextColor={colors.muted} style={s.input} placeholder="Nombre" value={name} onChangeText={setName} />
        <TextInput placeholderTextColor={colors.muted} style={s.input} placeholder="Correo" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
        <TextInput placeholderTextColor={colors.muted} style={s.input} placeholder="Contraseña (mín. 8)" value={pass} onChangeText={setPass} secureTextEntry />
        {error ? <Text style={s.error}>{error}</Text> : null}
        <Pressable style={s.btn} onPress={onRegister}>
          <Text style={s.btnTxt}>Registrarme</Text>
        </Pressable>
        <Text style={s.legal}>
          Al crear tu cuenta aceptas los{' '}
          <Text style={s.link} onPress={() => router.push('/terminos')}>
            términos de uso
          </Text>{' '}
          y la{' '}
          <Text style={s.link} onPress={() => router.push('/privacidad')}>
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
  title: { fontSize: 26, fontWeight: '900', color: colors.text, marginBottom: 14 },
  input: { backgroundColor: colors.card, borderRadius: 12, borderWidth: 1, borderColor: colors.line, padding: 14, marginBottom: 10, color: colors.text },
  error: { color: colors.danger, marginBottom: 10 },
  btn: { backgroundColor: colors.primary, borderRadius: 14, padding: 15, alignItems: 'center' },
  btnTxt: { color: '#fff', fontWeight: '800' },
  legal: { marginTop: 16, fontSize: 12, lineHeight: 18, color: colors.muted, textAlign: 'center' },
  link: { color: colors.text, fontWeight: '800', textDecorationLine: 'underline' },
});
}
