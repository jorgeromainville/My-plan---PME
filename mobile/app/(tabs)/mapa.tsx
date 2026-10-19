import { useRouter } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import * as Linking from 'expo-linking';
import * as Location from 'expo-location';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { buildMainHtml, type MapPin } from '../../src/components/mapHtml';
import { errorMessage } from '../../src/services/api';
import { listContactCategories } from '../../src/services/contacts';
import { mapItems, placeIcon, type MapItem } from '../../src/services/places';
import { colors } from '../../src/theme/colors';

// Mapa con MapLibre + OpenFreeMap (gratis y con uso comercial permitido).
// Nota en src/components/mapHtml.ts.

const FILTERS = ['Todos', 'Personas', 'Lugares', 'Amigos', 'Clientes', 'Proveedores', 'Familia', 'Trabajo', 'Casa'];
// Centro neutral hasta que llegue tu ubicación o los pines (sin ciudades fijas).
const PERU = { lat: -9.19, lng: -75.0152 };

// Mapa a sangre completa (WebView absoluto + controles flotando encima):
// buscador + filtros + pines por tipo + tarjeta + mi ubicación + crear con mantener presionado.
export default function Mapa() {
  const router = useRouter();
  const web = useRef<WebView>(null);
  const ready = useRef(false);
  const lastCat = useRef('Todos');
  const located = useRef(false);
  const lastCreate = useRef(0);
  const catColors = useRef<Record<string, string>>({});
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('Todos');
  const [items, setItems] = useState<MapItem[]>([]);
  const [byId, setById] = useState<Record<string, MapItem>>({});
  const [sel, setSel] = useState<MapItem | null>(null);
  const [pending, setPending] = useState<{ lat: number; lng: number } | null>(null);
  const [error, setError] = useState('');
  const [locating, setLocating] = useState(false);

  const html = useMemo(() => buildMainHtml(PERU.lat, PERU.lng, 5), []);

  // Color real de cada categoría de contacto (una sola carga, se cachea).
  async function ensureCatColors() {
    if (Object.keys(catColors.current).length > 0) return;
    try {
      const cats = await listContactCategories();
      const m: Record<string, string> = {};
      cats.forEach((c) => {
        if (c.color) m[c.name] = c.color;
      });
      catColors.current = m;
    } catch {
      // sin colores: quedan los de respaldo
    }
  }

  function pushMarkers(list: MapItem[], fit: boolean) {
    const pins: MapPin[] = list.map((i) => ({
      id: i.id,
      name: i.name,
      kind: i.kind,
      lat: i.latitude,
      lng: i.longitude,
      color: i.color ?? catColors.current[i.category] ?? (i.kind === 'contact' ? colors.blue : colors.purple),
      icon: i.kind === 'contact' ? '👤' : placeIcon(i.category),
    }));
    const js = `window.setMarkers('${JSON.stringify(pins).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}', ${fit ? 'true' : 'false'});true;`;
    web.current?.injectJavaScript(js);
  }

  const load = useCallback(async () => {
    try {
      await ensureCatColors();
      const kindFilter = cat === 'Personas' ? 'contact' : cat === 'Lugares' ? 'place' : null;
      const list = await mapItems(
        kindFilter ? undefined : cat === 'Todos' ? undefined : cat,
        q.trim() || undefined,
      );
      const filtered = kindFilter ? list.filter((i) => i.kind === kindFilter) : list;
      setItems(filtered);
      const idx: Record<string, MapItem> = {};
      filtered.forEach((i) => {
        idx[i.id] = i;
      });
      setById(idx);
      setSel((s) => (s && idx[s.id] ? idx[s.id] : null));
      if (ready.current) pushMarkers(filtered, lastCat.current !== cat);
      lastCat.current = cat;
    } catch (e) {
      setError(errorMessage(e));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cat, q]);

  // Al abrir: centra en tu ubicación; si no hay permiso, encuadra los pines.
  const centerMine = useCallback(async () => {
    if (located.current) return;
    located.current = true;
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const last = await Location.getLastKnownPositionAsync().catch(() => null);
      const pos = last ?? (await Location.getCurrentPositionAsync({}).catch(() => null));
      if (pos && ready.current) {
        web.current?.injectJavaScript(
          `window.showMine(${pos.coords.latitude},${pos.coords.longitude});true;`,
        );
      }
    } catch {
      // sin ubicación: quedan los pines
    }
  }, []);

  useFocusEffect(useCallback(() => {
    load();
    centerMine();
  }, [load, centerMine]));

  function onMsg(e: WebViewMessageEvent) {
    try {
      const m = JSON.parse(e.nativeEvent.data);
      if (m.type === 'select' && byId[m.id]) {
        setPending(null);
        setSel(byId[m.id]);
      } else if (m.type === 'bg') {
        setSel(null);
      } else if (m.type === 'create') {
        // Deduplica el doble aviso touch + contextmenu.
        const now = Date.now();
        if (now - lastCreate.current < 1500) return;
        lastCreate.current = now;
        setSel(null);
        setPending({ lat: m.lat, lng: m.lng });
      }
    } catch {
      // mensaje no JSON, ignorar
    }
  }

  // Marca visible del punto elegido (📍 con pulso) para no confundir dónde se presionó.
  useEffect(() => {
    if (!ready.current) return;
    if (pending) web.current?.injectJavaScript(`window.showPick(${pending.lat},${pending.lng});true;`);
    else web.current?.injectJavaScript('window.clearPick();true;');
  }, [pending]);

  // Botón "mi ubicación": pinta al instante la última posición conocida y luego
  // afina con la exacta (antes solo centraba una vez al abrir la pestaña).
  async function goMine() {
    if (locating) return;
    setLocating(true);
    setError('');
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setError('Permiso de ubicación denegado.');
        return;
      }
      const last = await Location.getLastKnownPositionAsync().catch(() => null);
      if (last && ready.current) {
        web.current?.injectJavaScript(
          `window.showMine(${last.coords.latitude},${last.coords.longitude});true;`,
        );
      }
      const pos = await Location.getCurrentPositionAsync({}).catch(() => null);
      if (pos && ready.current) {
        web.current?.injectJavaScript(
          `window.showMine(${pos.coords.latitude},${pos.coords.longitude});true;`,
        );
      }
      if (!pos && !last) setError('No se pudo obtener tu ubicación.');
    } catch {
      setError('No se pudo obtener tu ubicación.');
    } finally {
      setLocating(false);
    }
  }

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.fill}>
        <WebView
          ref={web}
          source={{ html }}
          style={s.mapAbs}
          androidLayerType="hardware"
          onLoadEnd={() => {
            ready.current = true;
            web.current?.injectJavaScript('window.refresh();true;');
            pushMarkers(items, true);
            centerMine();
            if (pending) web.current?.injectJavaScript(`window.showPick(${pending.lat},${pending.lng});true;`);
          }}
          onMessage={onMsg}
          onShouldStartLoadWithRequest={() => false}
          javaScriptEnabled
          domStorageEnabled
          originWhitelist={['*']}
        />

        <View style={s.overlay} pointerEvents="box-none">
          <View style={s.header}>
            <Text style={s.title}>Mapa</Text>
            <Pressable onPress={() => router.push('/lugar')} style={s.add} accessibilityLabel="Añadir lugar">
              <Text style={s.addTxt}>+</Text>
            </Pressable>
          </View>
          <TextInput style={s.search} value={q} onChangeText={setQ} placeholder="Buscar lugares o personas…" />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filters}>
            {FILTERS.map((f) => (
              <Pressable key={f} onPress={() => setCat(f)} style={[s.chip, cat === f && s.chipOn]}>
                <Text style={cat === f ? s.chipTxtOn : s.chipTxt}>
                  {f === 'Personas' ? '👤 ' : f === 'Lugares' ? '📍 ' : ''}{f}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
          {error ? <Text style={s.error}>{error}</Text> : null}
        </View>

        <Pressable onPress={goMine} style={s.mine} accessibilityLabel="Mi ubicación">
          <Text style={s.mineTxt}>{locating ? '…' : '🎯'}</Text>
        </Pressable>
        <View style={s.zoom}>
          <Pressable
            onPress={() => web.current?.injectJavaScript('window.zoomBy(1);true;')}
            style={s.zBtn}
          >
            <Text style={s.zTxt}>+</Text>
          </Pressable>
          <Pressable
            onPress={() => web.current?.injectJavaScript('window.zoomBy(-1);true;')}
            style={s.zBtn}
          >
            <Text style={s.zTxt}>−</Text>
          </Pressable>
        </View>

        {sel ? (
          <View style={s.card}>
            <View style={s.cardTop}>
              <View style={{ flex: 1 }}>
                <Text style={s.cardName}>{sel.name}</Text>
                <Text style={s.cardSub}>
                  {sel.kind === 'contact' ? '👤' : '📍'} {sel.category}
                  {sel.address ? ` · ${sel.address}` : ''}
                </Text>
                {sel.phone ? <Text style={s.cardSub}>{sel.phone}</Text> : null}
              </View>
              <Pressable onPress={() => setSel(null)} accessibilityLabel="Cerrar">
                <Text style={s.x}>✕</Text>
              </Pressable>
            </View>
            <View style={s.cardRow}>
              {sel.phone ? (
                <Pressable style={s.call} onPress={() => Linking.openURL(`tel:${sel.phone}`)}>
                  <Text style={s.callTxt}>📞 Llamar</Text>
                </Pressable>
              ) : null}
              <Pressable
                style={s.visit}
                onPress={() => Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${sel.latitude},${sel.longitude}`)}
              >
                <Text style={s.visitTxt}>🧭 Cómo llegar</Text>
              </Pressable>
              {sel.kind === 'place' ? (
                <Pressable style={s.visit} onPress={() => { setSel(null); router.push(`/lugar?id=${sel.refId}`); }}>
                  <Text style={s.visitTxt}>Editar</Text>
                </Pressable>
              ) : (
                <Pressable style={s.visit} onPress={() => { setSel(null); router.push(`/persona?id=${sel.refId}`); }}>
                  <Text style={s.visitTxt}>Ver</Text>
                </Pressable>
              )}
            </View>
          </View>
        ) : null}

        {pending && !sel ? (
          <View style={s.card}>
            <View style={s.cardTop}>
              <View style={{ flex: 1 }}>
                <Text style={s.cardName}>📍 Punto elegido</Text>
                <Text style={s.cardSub}>
                  {pending.lat.toFixed(5)}, {pending.lng.toFixed(5)}
                </Text>
              </View>
              <Pressable onPress={() => setPending(null)} accessibilityLabel="Cerrar">
                <Text style={s.x}>✕</Text>
              </Pressable>
            </View>
            <View style={s.cardRow}>
              <Pressable
                style={s.call}
                onPress={() => {
                  const p = pending;
                  setPending(null);
                  router.push(`/persona?lat=${p.lat}&lng=${p.lng}`);
                }}
              >
                <Text style={s.callTxt}>👤 Persona aquí</Text>
              </Pressable>
              <Pressable
                style={s.visit}
                onPress={() => {
                  const p = pending;
                  setPending(null);
                  router.push(`/lugar?lat=${p.lat}&lng=${p.lng}`);
                }}
              >
                <Text style={s.visitTxt}>📌 Lugar aquí</Text>
              </Pressable>
            </View>
          </View>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  fill: { flex: 1, position: 'relative' },
  mapAbs: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, paddingTop: 16 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 8, gap: 8 },
  title: {
    flex: 1, fontSize: 24, fontWeight: '900', color: colors.text,
    textShadowColor: 'rgba(255,255,255,0.9)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 6,
  },
  add: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.purple, alignItems: 'center', justifyContent: 'center', elevation: 3 },
  addTxt: { color: '#fff', fontSize: 26 },
  search: { backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: colors.line, padding: 12, marginHorizontal: 16, marginBottom: 8, elevation: 2 },
  filters: { paddingHorizontal: 16, gap: 8, height: 40 },
  chip: { borderWidth: 1, borderColor: colors.line, borderRadius: 99, paddingHorizontal: 14, paddingVertical: 7, backgroundColor: colors.card, marginRight: 8, justifyContent: 'center', elevation: 2 },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipTxt: { color: colors.text, fontWeight: '700', fontSize: 12 },
  chipTxtOn: { color: '#fff', fontWeight: '700', fontSize: 12 },
  error: { color: colors.danger, marginHorizontal: 16, marginTop: 6, backgroundColor: '#fff', borderRadius: 8, padding: 6 },
  mine: { position: 'absolute', right: 12, top: 186, width: 44, height: 44, borderRadius: 22, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', elevation: 3 },
  mineTxt: { fontSize: 20 },
  zoom: { position: 'absolute', right: 12, top: 238, gap: 8 },
  zBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', elevation: 3 },
  zTxt: { fontSize: 22, fontWeight: '800', color: colors.text },
  card: { position: 'absolute', left: 16, right: 16, bottom: 16, backgroundColor: colors.card, borderRadius: 18, padding: 14, borderWidth: 1, borderColor: colors.line, elevation: 4 },
  cardTop: { flexDirection: 'row', gap: 8 },
  cardName: { fontSize: 17, fontWeight: '900', color: colors.text },
  cardSub: { fontSize: 12, color: colors.muted, marginTop: 2 },
  x: { fontSize: 18, color: colors.muted, padding: 6 },
  cardRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  call: { flex: 1, backgroundColor: colors.green, borderRadius: 12, padding: 12, alignItems: 'center' },
  callTxt: { color: '#fff', fontWeight: '800' },
  visit: { flex: 1, borderWidth: 1, borderColor: colors.line, borderRadius: 12, padding: 12, alignItems: 'center', backgroundColor: colors.bg },
  visitTxt: { fontWeight: '800', color: colors.text },
});
