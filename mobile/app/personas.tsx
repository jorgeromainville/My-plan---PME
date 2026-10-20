import { useRouter } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card } from '../src/components/Card';
import { errorMessage } from '../src/services/api';
import { categoryIcon, listContactCategories, listContacts, type Contact, type ContactCategory } from '../src/services/contacts';
import { colors, useThemedStyles, type ThemeColors } from '../src/theme/colors';

// Personas: buscador + categorías + "Contactar hoy" primero.
export default function Personas() {
  const s = useThemedStyles(createStyles);
  const router = useRouter();
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('Todos');
  const [cats, setCats] = useState<ContactCategory[]>([]);
  const [today, setToday] = useState<Contact[]>([]);
  const [all, setAll] = useState<Contact[]>([]);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const [t, a, c] = await Promise.all([
        listContacts({ followup: 'today' }),
        listContacts({}),
        listContactCategories(),
      ]);
      setToday(t);
      setAll(a);
      setCats(c);
    } catch (e) {
      setError(errorMessage(e));
    }
  }, []);

  useFocusEffect(useCallback(() => {
    load();
  }, [load]));

  const shown = all.filter(
    (c) =>
      (cat === 'Todos' || c.category === cat) &&
      (q.trim() === '' ||
        `${c.firstName} ${c.lastName ?? ''}`.toLowerCase().includes(q.trim().toLowerCase())),
  );

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <Pressable onPress={() => router.back()} style={s.back} accessibilityLabel="Volver">
          <Text style={s.backTxt}>‹</Text>
        </Pressable>
        <Text style={s.title}>Personas</Text>
        <Pressable onPress={() => router.push('/persona')} style={s.add} accessibilityLabel="Añadir persona">
          <Text style={s.addTxt}>+</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={s.body} showsVerticalScrollIndicator={false}>
        <TextInput style={s.search} value={q} onChangeText={setQ} placeholder="Buscar por nombre o teléfono" />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.cats}>
          {[{ name: 'Todos', color: null }, ...cats].map((c) => (
            <Pressable key={c.name} onPress={() => setCat(c.name)} style={[s.chip, cat === c.name && s.chipOn]}>
              {c.color ? <View style={[s.dot, { backgroundColor: c.color }]} /> : null}
              <Text style={cat === c.name ? s.chipTxtOn : s.chipTxt}>{c.name}</Text>
            </Pressable>
          ))}
        </ScrollView>

        {error ? <Text style={s.error}>{error}</Text> : null}

        {today.length > 0 && (
          <Card style={s.mt}>
            <Text style={s.h}>Contactar hoy ({today.length})</Text>
            {today.map((c) => (
              <ContactRow key={c.id} c={c} hot color={cats.find((k) => k.name === c.category)?.color} onOpen={() => router.push(`/persona?id=${c.id}`)} />
            ))}
          </Card>
        )}

        <Text style={s.h2}>Todos ({shown.length})</Text>
        {shown.map((c) => (
          <ContactRow key={c.id} c={c} color={cats.find((k) => k.name === c.category)?.color} onOpen={() => router.push(`/persona?id=${c.id}`)} />
        ))}
        <View style={{ height: 30 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

export function ContactRow({ c, hot, onOpen, color }: { c: Contact; hot?: boolean; onOpen: () => void; color?: string | null }) {
  const s = useThemedStyles(createStyles);
  const name = `${c.firstName}${c.lastName ? ` ${c.lastName}` : ''}`;
  return (
    <Pressable onPress={onOpen} style={[s.row, hot && s.hot]}>
      <View style={[s.face, color ? { borderColor: color, borderWidth: 2 } : null]}>
        <Text style={{ fontSize: 20 }}>{categoryIcon(c.category)}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.name}>{name}</Text>
        <Text style={s.sub}>
          {c.category}
          {c.nextContactAt ? ` · próx: ${new Date(c.nextContactAt).toLocaleDateString()}` : ''}
        </Text>
      </View>
      <Text style={s.chev}>›</Text>
    </Pressable>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 8 },
  back: { width: 40, paddingVertical: 6 },
  backTxt: { fontSize: 28, color: colors.text },
  title: { flex: 1, fontSize: 22, fontWeight: '900', color: colors.text },
  add: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  addTxt: { color: '#fff', fontSize: 26 },
  body: { padding: 16, paddingTop: 0 },
  search: { backgroundColor: colors.card, borderRadius: 12, borderWidth: 1, borderColor: colors.line, padding: 13, marginBottom: 10 },
  cats: { gap: 8, paddingBottom: 4, height: 44 },
  chip: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: colors.line, borderRadius: 99, paddingHorizontal: 14, paddingVertical: 7, backgroundColor: colors.card, marginRight: 8, justifyContent: 'center' },
  dot: { width: 12, height: 12, borderRadius: 6, marginRight: 6 },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipTxt: { color: colors.text, fontWeight: '700', fontSize: 12 },
  chipTxtOn: { color: '#fff', fontWeight: '700', fontSize: 12 },
  error: { color: colors.danger, marginBottom: 8 },
  mt: { marginBottom: 12 },
  h: { fontSize: 16, fontWeight: '800', color: colors.text, marginBottom: 8 },
  h2: { fontSize: 16, fontWeight: '800', color: colors.text, marginVertical: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.card, borderRadius: 14, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: colors.line },
  hot: { borderColor: colors.accent, borderWidth: 2 },
  face: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.bgSoft, alignItems: 'center', justifyContent: 'center' },
  name: { fontWeight: '800', color: colors.text },
  sub: { fontSize: 12, color: colors.muted },
  chev: { fontSize: 20, color: colors.muted },
});
}
