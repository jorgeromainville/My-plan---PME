import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card } from '../src/components/Card';
import { NativeTime } from '../src/components/NativeTime';
import { DEFAULT_KINDS, DEFAULT_TEMPLATES, useCatalog, type EventKind, type Template } from '../src/store/useCatalog';
import { colors, useThemedStyles, type ThemeColors } from '../src/theme/colors';

const PALETTE = ['#6B9ECF', '#6FA287', '#C9A44A', '#D98162', '#8B7BC7', '#E07A5F', '#4DB6AC', '#BA68C8'];
const ICONS = ['📌', '🍳', '🍽️', '👥', '💼', '📚', '🏠', '✈️', '❤️', '⭐'];

// Ajustes: tipos de evento y plantillas, todo editable y con color.
export default function Ajustes() {
  const s = useThemedStyles(createStyles);
  const router = useRouter();
  const { kinds, templates, saveKinds, saveTemplates } = useCatalog();
  const [newKind, setNewKind] = useState('');
  const [newColor, setNewColor] = useState(PALETTE[0]);
  const [newT, setNewT] = useState<Template>({ title: '', icon: '📌', start: '09:00', end: '10:00', type: 'Evento' });

  async function renameKind(i: number, name: string) {
    const next = kinds.map((k, j) => (j === i ? { ...k, name } : k));
    await saveKinds(next.filter((k) => k.name.trim() !== ''));
  }

  async function recolorKind(i: number, color: string) {
    const next = kinds.map((k, j) => (j === i ? { ...k, color } : k));
    await saveKinds(next);
  }

  async function deleteKind(i: number) {
    if (kinds.length <= 1) return; // siempre queda al menos uno
    await saveKinds(kinds.filter((_, j) => j !== i));
  }

  async function addKind() {
    if (!newKind.trim()) return;
    await saveKinds([...kinds, { name: newKind.trim(), color: newColor }]);
    setNewKind('');
  }

  async function addTemplate() {
    if (!newT.title.trim()) return;
    await saveTemplates([...templates, { ...newT, title: newT.title.trim() }]);
    setNewT({ title: '', icon: '📌', start: '09:00', end: '10:00', type: kinds[0]?.name ?? 'Evento' });
  }

  async function deleteTemplate(i: number) {
    await saveTemplates(templates.filter((_, j) => j !== i));
  }

  async function resetAll() {
    await saveKinds(DEFAULT_KINDS);
    await saveTemplates(DEFAULT_TEMPLATES);
  }

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.body} keyboardShouldPersistTaps="handled">
        <View style={s.top}>
          <Pressable onPress={() => router.back()} style={s.x} accessibilityLabel="Volver">
            <Text style={s.xTxt}>‹</Text>
          </Pressable>
          <Text style={s.title}>Tipos y plantillas</Text>
          <View style={{ width: 40 }} />
        </View>

        <Card>
          <Text style={s.h}>Tipos de evento</Text>
          <Text style={s.hint}>El color del tipo es el color del evento.</Text>
          {kinds.map((k, i) => (
            <KindRow
              key={`${k.name}-${i}`}
              kind={k}
              onRename={(n) => renameKind(i, n)}
              onColor={(c) => recolorKind(i, c)}
              onDelete={() => deleteKind(i)}
              canDelete={kinds.length > 1}
            />
          ))}
          <TextInput placeholderTextColor={colors.muted} style={s.input} value={newKind} onChangeText={setNewKind} placeholder="Nuevo tipo (ej. Estudio)" />
          <View style={s.row}>
            {PALETTE.map((c) => (
              <Pressable key={c} onPress={() => setNewColor(c)} style={[s.dot, { backgroundColor: c }, newColor === c && s.dotOn]} />
            ))}
          </View>
          <Pressable onPress={addKind} style={s.btn}>
            <Text style={s.btnTxt}>Agregar tipo</Text>
          </Pressable>
        </Card>

        <Card>
          <Text style={s.h}>Plantillas</Text>
          <Text style={s.hint}>Crean el evento al toque desde el +.</Text>
          {templates.map((t, i) => (
            <View key={`${t.title}-${i}`} style={s.tRow}>
              <Text style={s.tIcon}>{t.icon}</Text>
              <View style={{ flex: 1 }}>
                <Text style={s.tTitle}>{t.title}</Text>
                <Text style={s.tSub}>
                  {t.start} – {t.end} · {t.type}
                </Text>
              </View>
              <Pressable onPress={() => deleteTemplate(i)} accessibilityLabel="Eliminar plantilla">
                <Text style={s.del}>✕</Text>
              </Pressable>
            </View>
          ))}
          <TextInput placeholderTextColor={colors.muted} style={s.input} value={newT.title} onChangeText={(v) => setNewT({ ...newT, title: v })} placeholder="Nueva plantilla (ej. Cena)" />
          <View style={s.row}>
            {ICONS.map((ic) => (
              <Pressable key={ic} onPress={() => setNewT({ ...newT, icon: ic })} style={[s.ichip, newT.icon === ic && s.ichipOn]}>
                <Text>{ic}</Text>
              </Pressable>
            ))}
          </View>
          <View style={s.row2}>
            <View style={{ flex: 1 }}>
              <Text style={s.lab}>Inicio</Text>
              <NativeTime label="Inicio plantilla" value={newT.start} onChange={(v) => setNewT({ ...newT, start: v })} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.lab}>Fin</Text>
              <NativeTime label="Fin plantilla" value={newT.end} onChange={(v) => setNewT({ ...newT, end: v })} />
            </View>
          </View>
          <Text style={s.lab}>Tipo</Text>
          <View style={s.row}>
            {kinds.map((k) => (
              <Pressable key={k.name} onPress={() => setNewT({ ...newT, type: k.name })} style={[s.chip, newT.type === k.name && s.chipOn]}>
                <Text style={newT.type === k.name ? s.chipTxtOn : s.chipTxt}>{k.name}</Text>
              </Pressable>
            ))}
          </View>
          <Pressable onPress={addTemplate} style={s.btn}>
            <Text style={s.btnTxt}>Agregar plantilla</Text>
          </Pressable>
        </Card>

        <Pressable onPress={resetAll} style={s.reset}>
          <Text style={s.resetTxt}>Restablecer valores</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function KindRow({ kind, onRename, onColor, onDelete, canDelete }: {
  kind: EventKind;
  onRename: (n: string) => void;
  onColor: (c: string) => void;
  onDelete: () => void;
  canDelete: boolean;
}) {
  const s = useThemedStyles(createStyles);
  const [name, setName] = useState(kind.name);
  return (
    <View style={s.kRow}>
      <View style={[s.dot, { backgroundColor: kind.color }]} />
      <TextInput placeholderTextColor={colors.muted}
        style={[s.input, { flex: 1, marginBottom: 0 }]}
        value={name}
        onChangeText={setName}
        onEndEditing={() => {
          if (name.trim() && name !== kind.name) onRename(name.trim());
          else setName(kind.name);
        }}
      />
      {canDelete ? (
        <Pressable onPress={onDelete} accessibilityLabel="Eliminar tipo">
          <Text style={s.del}>✕</Text>
        </Pressable>
      ) : null}
      <View style={s.kColors}>
        {PALETTE.slice(0, 4).map((c) => (
          <Pressable key={c} onPress={() => onColor(c)} style={[s.dotSm, { backgroundColor: c }, kind.color === c && s.dotOn]} />
        ))}
      </View>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  body: { padding: 16, gap: 12 },
  top: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  x: { width: 40, paddingVertical: 6 },
  xTxt: { fontSize: 28, color: colors.text },
  title: { flex: 1, textAlign: 'center', fontSize: 18, fontWeight: '800', color: colors.text },
  h: { fontSize: 17, fontWeight: '800', color: colors.text },
  hint: { fontSize: 12, color: colors.muted, marginBottom: 10 },
  input: { backgroundColor: colors.card, borderRadius: 12, borderWidth: 1, borderColor: colors.line, padding: 12, marginBottom: 10, color: colors.text },
  row: { flexDirection: 'row', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 10 },
  row2: { flexDirection: 'row', gap: 12 },
  lab: { fontSize: 12, fontWeight: '700', color: colors.text, marginBottom: 6, marginTop: 6 },
  dot: { width: 32, height: 32, borderRadius: 16, borderWidth: 3, borderColor: 'transparent' },
  dotSm: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: 'transparent' },
  dotOn: { borderColor: colors.primary },
  btn: { backgroundColor: colors.primary, borderRadius: 14, padding: 14, alignItems: 'center', marginTop: 4 },
  btnTxt: { color: colors.onPrimary, fontWeight: '800' },
  kRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' },
  kColors: { flexDirection: 'row', gap: 6 },
  del: { fontSize: 16, color: colors.danger, padding: 8 },
  tRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.line },
  tIcon: { fontSize: 22, color: colors.text },
  tTitle: { fontWeight: '800', color: colors.text },
  tSub: { fontSize: 12, color: colors.muted },
  ichip: { borderWidth: 1, borderColor: colors.line, borderRadius: 12, padding: 8, backgroundColor: colors.card },
  ichipOn: { borderColor: colors.primary, borderWidth: 2 },
  chip: { borderWidth: 1, borderColor: colors.line, borderRadius: 99, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: colors.card },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipTxt: { color: colors.text, fontWeight: '700', fontSize: 12 },
  chipTxtOn: { color: colors.onPrimary, fontWeight: '700', fontSize: 12 },
  reset: { padding: 14, alignItems: 'center' },
  resetTxt: { color: colors.muted, fontWeight: '700' },
});
}
