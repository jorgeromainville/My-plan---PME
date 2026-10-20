import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Location from 'expo-location';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { buildPickerHtml } from '../src/components/mapHtml';
import { errorMessage } from '../src/services/api';
import { createPlace, deletePlace, getPlace, updatePlace, DEFAULT_PLACE_CATS } from '../src/services/places';
import { colors, useThemedStyles, type ThemeColors } from '../src/theme/colors';

// Formulario de lugar: punto arrastrable (MapLibre + OpenFreeMap) + categorías con color.
const PERU = { lat: -9.19, lng: -75.0152 };

export default function LugarForm() {
  const s = useThemedStyles(createStyles);
  const router = useRouter();
  const pickWeb = useRef<WebView>(null);
  const [mapKey, setMapKey] = useState(0);
  const { id, lat: plat, lng: plng } = useLocalSearchParams<{ id?: string; lat?: string; lng?: string }>();
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Casa');
  const [cats, setCats] = useState(DEFAULT_PLACE_CATS);
  const [newCat, setNewCat] = useState('');
  const [address, setAddress] = useState('');
  const [note, setNote] = useState('');
  const [lat, setLat] = useState<number | null>(plat ? Number(plat) : null);
  const [lng, setLng] = useState<number | null>(plng ? Number(plng) : null);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState('');
  const [confirmDel, setConfirmDel] = useState(false);

  const catColor = cats.find((c) => c.name === category)?.color ?? '#8B7BC7';

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const p = await getPlace(id);
        setName(p.name);
        setCategory(p.category);
        setAddress(p.address ?? '');
        setNote(p.note ?? '');
        setLat(p.latitude);
        setLng(p.longitude);
        setMapKey((k) => k + 1);
      } catch (e) {
        setError(errorMessage(e));
      }
    })();
  }, [id]);

  async function useMine() {
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setError('Permiso de ubicación denegado.');
        return;
      }
      const pos = await Location.getCurrentPositionAsync({});
      setLat(pos.coords.latitude);
      setLng(pos.coords.longitude);
      if (lat == null || lng == null) setMapKey((k) => k + 1);
      else pickWeb.current?.injectJavaScript(`window.setPoint(${pos.coords.latitude},${pos.coords.longitude});true;`);
    } catch {
      setError('No se pudo obtener la ubicación.');
    } finally {
      setLocating(false);
    }
  }

  function onPickMsg(e: WebViewMessageEvent) {
    try {
      const m = JSON.parse(e.nativeEvent.data);
      if (m.type === 'move') {
        setLat(m.lat);
        setLng(m.lng);
      }
    } catch {
      // ignorar
    }
  }

  // Siempre hay mapa: si aún no hay punto, se muestra neutral para tocarlo.
  const pickerHtml = useMemo(
    () => buildPickerHtml(lat ?? PERU.lat, lng ?? PERU.lng, lat != null && lng != null),
    // solo se reconstruye al montar (mapKey); los arrastres no remontan
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mapKey],
  );

  async function onSave() {
    setError('');
    if (!name.trim()) {
      setError('Ponle un nombre.');
      return;
    }
    if (lat == null || lng == null) {
      setError('Marca el punto en el mapa o usa tu ubicación.');
      return;
    }
    try {
      const payload = {
        name: name.trim(),
        category,
        address: address.trim() || undefined,
        latitude: lat,
        longitude: lng,
        note: note.trim() || undefined,
        color: catColor,
      };
      if (id) await updatePlace(id, payload);
      else await createPlace(payload);
      router.back();
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  async function onDelete() {
    if (!id) return;
    try {
      await deletePlace(id);
      router.back();
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.body} keyboardShouldPersistTaps="handled">
        <View style={s.top}>
          <Pressable onPress={() => router.back()} style={s.x} accessibilityLabel="Volver">
            <Text style={s.xTxt}>‹</Text>
          </Pressable>
          <Text style={s.title}>{id ? 'Editar lugar' : 'Nuevo lugar'}</Text>
          <View style={{ width: 40 }} />
        </View>

        <Text style={s.label}>Nombre *</Text>
        <TextInput style={s.input} value={name} onChangeText={setName} placeholder="Ej. Oficina, Casa de Juan" />

        <Text style={s.label}>Categoría</Text>
        <View style={s.wrap}>
          {cats.map((c) => (
            <Pressable key={c.name} onPress={() => setCategory(c.name)} style={[s.chip, category === c.name && s.chipOn]}>
              <View style={[s.dot, { backgroundColor: c.color }]} />
              <Text style={category === c.name ? s.chipTxtOn : s.chipTxt}>{c.name}</Text>
            </Pressable>
          ))}
        </View>
        <View style={s.newCat}>
          <TextInput style={[s.input, { flex: 1, marginBottom: 0 }]} value={newCat} onChangeText={setNewCat} placeholder="Nueva categoría" />
          <Pressable
            style={s.plus}
            onPress={() => {
              if (!newCat.trim()) return;
              setCats([...cats, { name: newCat.trim(), color: '#8B7BC7' }]);
              setCategory(newCat.trim());
              setNewCat('');
            }}
          >
            <Text style={s.plusTxt}>+</Text>
          </Pressable>
        </View>

        <Text style={s.label}>Punto en el mapa *</Text>
        {pickerHtml ? (
          <WebView
            key={mapKey}
            ref={pickWeb}
            source={{ html: pickerHtml }}
            style={s.map}
            androidLayerType="hardware"
            onMessage={onPickMsg}
            onShouldStartLoadWithRequest={() => false}
            javaScriptEnabled
            domStorageEnabled
            originWhitelist={['*']}
            scrollEnabled={false}
          />
        ) : null}
        {lat == null ? (
          <Text style={s.hint}>Toca el mapa para marcar el punto o usa «Mi ubicación».</Text>
        ) : null}
        <View style={s.row}>
          <Pressable onPress={useMine} style={s.mini} disabled={locating}>
            <Text style={s.miniTxt}>{locating ? '…' : '📍'} Mi ubicación</Text>
          </Pressable>
        </View>

        <Text style={s.label}>Dirección</Text>
        <TextInput style={s.input} value={address} onChangeText={setAddress} placeholder="Opcional" />

        <Text style={s.label}>Nota</Text>
        <TextInput style={s.input} value={note} onChangeText={setNote} placeholder="Opcional" />

        {error ? <Text style={s.error}>{error}</Text> : null}
        <Pressable style={s.btn} onPress={onSave}>
          <Text style={s.btnTxt}>Guardar</Text>
        </Pressable>
        {id ? (
          !confirmDel ? (
            <Pressable onPress={() => setConfirmDel(true)} style={s.del}>
              <Text style={s.delTxt}>Eliminar</Text>
            </Pressable>
          ) : (
            <View style={s.confirm}>
              <Text style={s.confirmT}>¿Eliminar lugar?</Text>
              <View style={s.row}>
                <Pressable onPress={() => setConfirmDel(false)} style={s.keep}>
                  <Text style={s.keepTxt}>Conservar</Text>
                </Pressable>
                <Pressable onPress={onDelete} style={s.drop}>
                  <Text style={s.dropTxt}>Eliminar</Text>
                </Pressable>
              </View>
            </View>
          )
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  body: { padding: 18 },
  top: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  x: { width: 40, paddingVertical: 6 },
  xTxt: { fontSize: 28, color: colors.text },
  title: { flex: 1, textAlign: 'center', fontSize: 18, fontWeight: '800', color: colors.text },
  label: { fontSize: 13, fontWeight: '700', color: colors.text, marginTop: 12, marginBottom: 6 },
  input: { backgroundColor: colors.card, borderRadius: 12, borderWidth: 1, borderColor: colors.line, padding: 13, marginBottom: 4 },
  row: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  wrap: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  chip: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: colors.line, borderRadius: 99, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: colors.card },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipTxt: { color: colors.text, fontWeight: '700', fontSize: 12 },
  chipTxtOn: { color: '#fff', fontWeight: '700', fontSize: 12 },
  dot: { width: 12, height: 12, borderRadius: 6, marginRight: 6 },
  newCat: { flexDirection: 'row', gap: 8, alignItems: 'center', marginTop: 10 },
  plus: { width: 46, height: 46, borderRadius: 23, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  plusTxt: { color: '#fff', fontSize: 22 },
  map: { height: 240, borderRadius: 14, overflow: 'hidden', marginBottom: 8 },
  hint: { color: colors.muted, fontSize: 12, marginBottom: 8 },
  mini: { flex: 1, backgroundColor: colors.primary, borderRadius: 12, padding: 12, alignItems: 'center' },
  miniTxt: { color: '#fff', fontWeight: '800' },
  error: { color: colors.danger, marginTop: 12 },
  btn: { marginTop: 18, backgroundColor: colors.purple, borderRadius: 14, padding: 15, alignItems: 'center' },
  btnTxt: { color: '#fff', fontWeight: '800' },
  del: { marginTop: 10, padding: 14, alignItems: 'center' },
  delTxt: { color: colors.danger, fontWeight: '700' },
  confirm: { backgroundColor: colors.card, borderRadius: 14, borderWidth: 1, borderColor: colors.line, padding: 14, marginTop: 10 },
  confirmT: { fontWeight: '800', color: colors.text, marginBottom: 10 },
  keep: { flex: 1, backgroundColor: colors.primary, borderRadius: 12, padding: 12, alignItems: 'center' },
  keepTxt: { color: '#fff', fontWeight: '800' },
  drop: { flex: 1, padding: 12, alignItems: 'center' },
  dropTxt: { color: colors.danger, fontWeight: '800' },
});
}
