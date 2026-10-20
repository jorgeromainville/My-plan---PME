import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { LegalSection } from '../data/legal';
import { colors, useThemedStyles, type ThemeColors } from '../theme/colors';
import { Card } from './Card';

// Página legal reutilizable: privacidad y términos comparten el mismo diseño.
export function LegalPage({
  title,
  updated,
  sections,
}: {
  title: string;
  updated: string;
  sections: LegalSection[];
}) {
  const s = useThemedStyles(createStyles);
  const router = useRouter();

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.body}>
        <View style={s.top}>
          <Pressable onPress={() => router.back()} style={s.x} accessibilityLabel="Volver">
            <Text style={s.xTxt}>‹</Text>
          </Pressable>
          <Text style={s.title} accessibilityRole="header">
            {title}
          </Text>
          <View style={{ width: 40 }} />
        </View>
        <Text style={s.updated}>Última actualización: {updated}</Text>

        {sections.map((section) => (
          <Card key={section.title} style={s.card}>
            <Text style={s.h}>{section.title}</Text>
            {section.paragraphs.map((p, i) => (
              <Text key={i} style={s.p} selectable>
                {p}
              </Text>
            ))}
            {section.bullets?.map((b, i) => (
              <View key={i} style={s.bulletRow}>
                <Text style={s.bulletDot}>•</Text>
                <Text style={s.bullet} selectable>
                  {b}
                </Text>
              </View>
            ))}
          </Card>
        ))}

        <Text style={s.foot}>Planner Today · Perú</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bg },
    body: { padding: 16, gap: 12 },
    top: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
    x: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
    xTxt: { fontSize: 28, color: colors.text },
    title: { flex: 1, textAlign: 'center', fontSize: 20, fontWeight: '900', color: colors.text },
    updated: { textAlign: 'center', fontSize: 12, color: colors.muted, marginBottom: 4 },
    card: { gap: 8 },
    h: { fontSize: 16, fontWeight: '800', color: colors.text },
    p: { fontSize: 14, lineHeight: 21, color: colors.text },
    bulletRow: { flexDirection: 'row', gap: 8 },
    bulletDot: { fontSize: 14, lineHeight: 21, color: colors.link, fontWeight: '900' },
    bullet: { flex: 1, fontSize: 14, lineHeight: 21, color: colors.text },
    foot: { textAlign: 'center', fontSize: 12, color: colors.muted, marginTop: 8 },
  });
}
