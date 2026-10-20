import React, { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { signInWithGoogle } from '../services/google';
import { colors, useThemedStyles, type ThemeColors } from '../theme/colors';
import type { SessionUser } from '../store/useSession';

interface Props {
  onSuccess: (r: { user: SessionUser; access: string }) => void | Promise<void>;
  onError: (message: string) => void;
}

// Logo oficial de Google (cuatro colores). No es un emoji: es vectorial.
function GoogleG({ size = 18 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <Path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <Path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <Path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </Svg>
  );
}

export function GoogleButton({ onSuccess, onError }: Props) {
  const s = useThemedStyles(createStyles);
  const [busy, setBusy] = useState(false);

  async function press() {
    if (busy) return;
    onError('');
    setBusy(true);
    try {
      const r = await signInWithGoogle();
      if (r) await onSuccess({ user: r.user, access: r.access });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'No se pudo entrar con Google.';
      onError(msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Pressable style={[s.btn, busy && s.off]} onPress={press} disabled={busy} accessibilityRole="button">
      {busy ? <ActivityIndicator size="small" color={colors.text} /> : <GoogleG />}
      <Text style={s.txt}>{busy ? 'Conectando…' : 'Continuar con Google'}</Text>
      <View style={s.spacer} />
    </Pressable>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    btn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.line,
      borderRadius: 14,
      padding: 14,
      marginTop: 12,
    },
    off: { opacity: 0.6 },
    txt: { color: colors.text, fontWeight: '800', fontSize: 15 },
    // Mantiene el texto centrado aunque el spinner/logo cambie de ancho.
    spacer: { width: 18 },
  });
}
