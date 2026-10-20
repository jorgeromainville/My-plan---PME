import { CameraView, useCameraPermissions } from 'expo-camera';
import * as FileSystem from 'expo-file-system/legacy';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeDate } from '../src/components/NativeTime';
import { randomFact } from '../src/data/funFacts';
import { defaultSemesterEnd, parseScheduleText, WEEKDAY_SHORT, type ScheduleCandidate } from '../src/services/scheduleParser';
import { aiStatus, createScannedEvents, parseScheduleWithAi, uploadScan } from '../src/services/scanner';
import { colors, useThemedStyles, type ThemeColors } from '../src/theme/colors';
import { parseLocalDay, toLocalKey } from '../src/utils/dates';

interface Row extends ScheduleCandidate {
  key: string;
}

const TIME_RE = /^\d{1,2}:\d{2}$/;

function normTime(t: string): string | null {
  const m = t.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

// La foto del horario es temporal: se borra al repetir y al salir de la pantalla.
function discardPhoto(uri: string | null) {
  if (!uri) return;
  FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {
    // ya no existe o no se puede borrar: no molesta
  });
}

// Escáner de horarios: foto → OCR → clases editables → eventos semanales.
// También acepta texto pegado (por si la foto sale mal).
export default function Escaner() {
  const s = useThemedStyles(createStyles);
  const router = useRouter();
  const cam = useRef<CameraView>(null);
  const [perm, requestPerm] = useCameraPermissions();
  const [tab, setTab] = useState<'foto' | 'texto'>('foto');
  const [photo, setPhoto] = useState<string | null>(null);
  const [busy, setBusy] = useState('');
  const [raw, setRaw] = useState('');
  const [showRaw, setShowRaw] = useState(false);
  const [pasted, setPasted] = useState('');
  const [rows, setRows] = useState<Row[]>([]);
  // Fin de la repetición: "AAAA-MM-DD" que sale del calendario nativo; '' = +4 meses.
  // (Antes era texto libre: un "2027 10 24" con espacios reventaba al convertir a fecha.)
  const [until, setUntil] = useState('');
  const [done, setDone] = useState(0);
  const [error, setError] = useState('');
  const [tick, setTick] = useState(0);
  const [aiOn, setAiOn] = useState<boolean | null>(null);
  const [fact, setFact] = useState('');

  // La foto vive solo en la caché del celular mientras esta pantalla está abierta.
  const photoRef = useRef<string | null>(null);
  useEffect(() => {
    photoRef.current = photo;
  }, [photo]);
  useEffect(() => () => discardPhoto(photoRef.current), []);

  // ¿La IA del escáner está configurada? (indica si conviene activarla)
  useEffect(() => {
    aiStatus()
      .then((s) => setAiOn(s.enabled))
      .catch(() => setAiOn(null));
  }, []);

  // Contador de segundos mientras trabaja (el OCR gratis tarda 15-45 s).
  useEffect(() => {
    if (!busy) {
      setTick(0);
      return;
    }
    const t = setInterval(() => setTick((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, [busy]);

  // Dato curioso rotando mientras la IA/OCR trabaja (para hacer la espera amena).
  const working = !!busy;
  useEffect(() => {
    if (!working) {
      setFact('');
      return;
    }
    setFact(randomFact());
    const t = setInterval(() => setFact((prev) => randomFact(prev)), 5500);
    return () => clearInterval(t);
  }, [working]);

  const busyTxt = busy ? `${busy}${tick > 2 ? ` (${tick}s)` : '…'}` : '';

  function toRows(cands: ScheduleCandidate[]) {
    setRows(cands.map((c, i) => ({ ...c, key: `${Date.now()}-${i}` })));
  }

  async function takePhoto() {
    try {
      const p = await cam.current?.takePictureAsync({ quality: 0.8 });
      if (p?.uri) {
        // Achica a 1600px para subir rápido (el OCR gratis tarda con fotos gigantes).
        let uri = p.uri;
        try {
          const { manipulateAsync, SaveFormat } = await import('expo-image-manipulator');
          const small = await manipulateAsync(
            p.uri,
            [{ resize: { width: 1600 } }],
            { compress: 0.7, format: SaveFormat.JPEG },
          );
          uri = small.uri;
        } catch {
          // sin compresor: sube la original
        }
        setPhoto(uri);
        setRaw('');
        setRows([]);
        discardPhoto(photoRef.current);
        if (p.uri !== uri) discardPhoto(p.uri);
        setDone(0);
      }
    } catch {
      setError('No se pudo tomar la foto.');
    }
  }

  // Gira la foto 90°: los horarios torcidos hacen que el OCR lea columnas en vez
  // de filas, y entonces ninguna regla puede emparejar materia con hora.
  async function rotatePhoto() {
    if (!photo || busy) return;
    try {
      const { manipulateAsync, SaveFormat } = await import('expo-image-manipulator');
      const old = photo;
      const r = await manipulateAsync(photo, [{ rotate: 90 }], { compress: 0.7, format: SaveFormat.JPEG });
      setPhoto(r.uri);
      discardPhoto(old);
    } catch {
      setError('No se pudo girar la foto.');
    }
  }

  async function readPhoto() {
    if (!photo) return;
    setBusy('Leyendo horario…');
    setError('');
    try {
      const r = await uploadScan(photo);
      setRaw(r.text);
      setAiOn(r.ai ?? false);
      // Preferimos lo que entendió la IA; si no hay, parser de reglas local.
      const cands = r.candidates?.length ? r.candidates : parseScheduleText(r.text);
      toRows(cands);
      if (cands.length === 0) {
        setError(
          r.ai
            ? `No detecté clases. ${r.aiError ?? 'Revisa el texto o agrégalas a mano.'}`
            : 'No detecté clases. Con el Modo IA activado (ver Perfil) las lee casi siempre. Mientras, revisa el texto o agrégalas a mano.',
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error inesperado.');
    } finally {
      setBusy('');
    }
  }

  async function readPasted() {
    setError('');
    const local = parseScheduleText(pasted);
    setRaw(pasted);
    toRows(local);
    if (aiOn) {
      setBusy('Analizando con IA…');
      try {
        const r = await parseScheduleWithAi(pasted);
        if (r.candidates.length > 0) {
          toRows(r.candidates);
          return;
        }
        if (r.aiError) setError(r.aiError);
      } catch {
        // sin servidor: nos quedamos con el resultado local
      } finally {
        setBusy('');
      }
    }
    if (local.length === 0) setError('No detecté clases en ese texto.');
  }

  function patch(key: string, p: Partial<Row>) {
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...p } : r)));
  }

  // Atajos para no navegar el calendario hasta el año que viene.
  function quickUntil(months: number | 'year') {
    const d = new Date();
    if (months === 'year') d.setMonth(11, 31);
    else d.setMonth(d.getMonth() + months);
    setUntil(toLocalKey(d));
  }

  async function confirm() {
    setError('');
    for (const r of rows) {
      if (!r.title.trim()) {
        setError('Toda clase necesita un nombre.');
        return;
      }
      const s = normTime(r.start);
      const e = normTime(r.end);
      if (!s || !e || e <= s) {
        setError(`Hora inválida en "${r.title || 'clase'}". Usa HH:MM y fin mayor que inicio.`);
        return;
      }
    }
    const end = until ? parseLocalDay(until) : null;
    if (until && !end) {
      setError('Fecha inválida. Vuelve a elegirla con el calendario.');
      return;
    }
    setBusy('Creando eventos…');
    try {
      const untilISO = end ? end.toISOString() : defaultSemesterEnd();
      const n = await createScannedEvents(
        rows.map((r) => ({ title: r.title.trim(), weekday: r.weekday, start: normTime(r.start)!, end: normTime(r.end)! })),
        untilISO,
      );
      setDone(n);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error inesperado.');
    } finally {
      setBusy('');
    }
  }

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.top}>
        <Pressable onPress={() => router.back()} style={s.x} accessibilityLabel="Volver">
          <Text style={s.xTxt}>‹</Text>
        </Pressable>
        <Text style={s.title}>Escanear horario</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={s.body} keyboardShouldPersistTaps="handled">
        <View style={s.seg}>
          <Pressable onPress={() => setTab('foto')} style={[s.segOpt, tab === 'foto' && s.segOn]}>
            <Text style={[s.segTxt, tab === 'foto' && s.segTxtOn]}>📷 Foto</Text>
          </Pressable>
          <Pressable onPress={() => setTab('texto')} style={[s.segOpt, tab === 'texto' && s.segOn]}>
            <Text style={[s.segTxt, tab === 'texto' && s.segTxtOn]}>📝 Texto</Text>
          </Pressable>
        </View>

        <View style={[s.aiBar, aiOn ? s.aiBarOn : s.aiBarOff]}>
          <Text style={s.aiTxt}>
            {aiOn === null
              ? 'Comprobando el Modo IA…'
              : aiOn
                ? '🤖 Modo IA activo: entiende la foto como una persona (tablas, columnas, fotos giradas).'
                : 'Modo IA apagado: el OCR lee el texto, pero empareja peor. Se activa gratis con GEMINI_API_KEY en backend/.env (aistudio.google.com/apikey).'}
          </Text>
        </View>

        {tab === 'foto' ? (
          <>
            {!perm ? null : !perm.granted ? (
              <Pressable style={s.btn} onPress={requestPerm}>
                <Text style={s.btnTxt}>Permitir cámara</Text>
              </Pressable>
            ) : photo ? (
              <>
                <Image source={{ uri: photo }} style={s.preview} resizeMode="contain" />
                <View style={s.row}>
                  <Pressable style={s.miniGhost} onPress={() => { discardPhoto(photo); setPhoto(null); setRows([]); setRaw(''); }}>
                    <Text style={s.miniGhostTxt}>Repetir</Text>
                  </Pressable>
                  <Pressable style={s.miniGhost} onPress={rotatePhoto} disabled={!!busy} accessibilityLabel="Girar 90 grados">
                    <Text style={s.miniGhostTxt}>🔄 Girar</Text>
                  </Pressable>
                  <Pressable style={s.mini} onPress={readPhoto} disabled={!!busy}>
                    <Text style={s.miniTxt}>{busyTxt || '🔍 Leer horario'}</Text>
                  </Pressable>
                </View>
                {busy ? <Text style={s.hint}>Con Modo IA puede tardar hasta ~40 s. No cierres la pantalla.</Text> : null}
                {busy && fact ? (
                  <View style={s.factBox}>
                    <Text style={s.factTxt}>💡 {fact}</Text>
                  </View>
                ) : null}
                {!busy && !raw ? <Text style={s.hint}>Si el horario sale de lado, gíralo con 🔄 antes de leer.</Text> : null}
              </>
            ) : (
              <>
                <CameraView ref={cam} style={s.cam} facing="back" />
                <Pressable style={s.btn} onPress={takePhoto}>
                  <Text style={s.btnTxt}>📷 Tomar foto del horario</Text>
                </Pressable>
                <Text style={s.hint}>Tip: buena luz, hoja derecha y que se lean las horas.</Text>
              </>
            )}
          </>
        ) : (
          <>
            <TextInput placeholderTextColor={colors.muted}
              style={[s.input, s.area]}
              value={pasted}
              onChangeText={setPasted}
              multiline
              placeholder={'Pega aquí el horario, ej.\nLun 8:00-10:00 Matemáticas\nMar y Jue 14:00-16:00 Física'}
            />
            <Pressable style={s.btn} onPress={readPasted}>
              <Text style={s.btnTxt}>🔍 Detectar clases</Text>
            </Pressable>
          </>
        )}

        {raw ? (
          <Pressable onPress={() => setShowRaw(!showRaw)} style={s.rawToggle}>
            <Text style={s.rawToggleTxt}>{showRaw ? 'Ocultar texto detectado' : 'Ver texto detectado'}</Text>
          </Pressable>
        ) : null}
        {showRaw && raw ? <Text style={s.raw}>{raw}</Text> : null}

        {rows.length > 0 ? (
          <>
            <Text style={s.h}>Clases detectadas ({rows.length}) — corrige lo que falle</Text>
            {rows.map((r) => (
              <View key={r.key} style={s.card}>
                <View style={s.row}>
                  <TextInput placeholderTextColor={colors.muted} style={[s.input, { flex: 1, marginBottom: 0 }]} value={r.title} onChangeText={(t) => patch(r.key, { title: t })} placeholder="Materia" />
                  <Pressable onPress={() => setRows((rs) => rs.filter((x) => x.key !== r.key))} style={s.del} accessibilityLabel="Quitar">
                    <Text style={s.delTxt}>✕</Text>
                  </Pressable>
                </View>
                <View style={s.days}>
                  {WEEKDAY_SHORT.map((d, wd) => (
                    <Pressable key={wd} onPress={() => patch(r.key, { weekday: wd })} style={[s.day, r.weekday === wd && s.dayOn]}>
                      <Text style={r.weekday === wd ? s.dayTxtOn : s.dayTxt}>{d}</Text>
                    </Pressable>
                  ))}
                </View>
                <View style={s.row}>
                  <TextInput placeholderTextColor={colors.muted} style={[s.input, s.time]} value={r.start} onChangeText={(t) => patch(r.key, { start: t })} placeholder="08:00" maxLength={5} />
                  <Text style={s.to}>→</Text>
                  <TextInput placeholderTextColor={colors.muted} style={[s.input, s.time]} value={r.end} onChangeText={(t) => patch(r.key, { end: t })} placeholder="10:00" maxLength={5} />
                </View>
              </View>
            ))}
            <Pressable
              style={s.miniGhost}
              onPress={() => setRows((rs) => [...rs, { key: `${Date.now()}`, title: '', weekday: 1, start: '08:00', end: '10:00' }])}
            >
              <Text style={s.miniGhostTxt}>+ Añadir clase a mano</Text>
            </Pressable>

            <Text style={s.label}>Repetir hasta</Text>
            <View style={s.chips}>
              <Pressable style={s.chip} onPress={() => quickUntil(4)}>
                <Text style={s.chipTxt}>+4 meses</Text>
              </Pressable>
              <Pressable style={s.chip} onPress={() => quickUntil(6)}>
                <Text style={s.chipTxt}>+6 meses</Text>
              </Pressable>
              <Pressable style={s.chip} onPress={() => quickUntil('year')}>
                <Text style={s.chipTxt}>Fin de año</Text>
              </Pressable>
            </View>
            <NativeDate
              label="Repetir hasta"
              value={until}
              onChange={setUntil}
              placeholder="Fin de semestre (+4 meses)"
            />

            <Pressable style={s.btn} onPress={confirm} disabled={!!busy}>
              <Text style={s.btnTxt}>{busyTxt || `✓ Crear ${rows.length} eventos semanales`}</Text>
            </Pressable>
          </>
        ) : null}

        {error ? <Text style={s.error}>{error}</Text> : null}

        {done > 0 ? (
          <View style={s.ok}>
            <Text style={s.okT}>✓ {done} eventos creados en tu planificador.</Text>
            <Pressable style={s.mini} onPress={() => router.replace('/planificador')}>
              <Text style={s.miniTxt}>Ver planificador</Text>
            </Pressable>
          </View>
        ) : null}
        <View style={{ height: 30 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  body: { padding: 16 },
  top: { flexDirection: 'row', alignItems: 'center' },
  x: { width: 40, paddingVertical: 6, paddingLeft: 16 },
  xTxt: { fontSize: 28, color: colors.text },
  title: { flex: 1, textAlign: 'center', fontSize: 18, fontWeight: '800', color: colors.text },
  seg: { flexDirection: 'row', backgroundColor: colors.bgSoft, borderRadius: 99, padding: 4, marginBottom: 12 },
  segOpt: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 99 },
  segOn: { backgroundColor: colors.coral, elevation: 2 },
  segTxt: { fontWeight: '700', color: colors.muted, fontSize: 13 },
  segTxtOn: { color: colors.onAccent },
  cam: { height: 320, borderRadius: 14, overflow: 'hidden', marginBottom: 10 },
  preview: { height: 320, borderRadius: 14, marginBottom: 10, backgroundColor: '#000' },
  hint: { color: colors.muted, fontSize: 12, marginTop: 8 },
  factBox: {
    backgroundColor: colors.bgSoft,
    borderRadius: 12,
    paddingVertical: 9,
    paddingHorizontal: 12,
    marginTop: 8,
  },
  factTxt: { color: colors.text, fontSize: 12.5, lineHeight: 18 },
  aiBar: { borderRadius: 12, padding: 10, marginBottom: 12 },
  aiBarOn: { backgroundColor: colors.greenBg },
  aiBarOff: { backgroundColor: colors.bgSoft },
  aiTxt: { fontSize: 12, color: colors.text, lineHeight: 17 },
  input: { backgroundColor: colors.card, borderRadius: 12, borderWidth: 1, borderColor: colors.line, padding: 13, marginBottom: 8, color: colors.text },
  area: { minHeight: 110, textAlignVertical: 'top', color: colors.text },
  row: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  mini: { flex: 1, backgroundColor: colors.primary, borderRadius: 12, padding: 12, alignItems: 'center' },
  miniTxt: { color: colors.onPrimary, fontWeight: '800' },
  miniGhost: { borderWidth: 1, borderColor: colors.line, borderRadius: 12, padding: 12, alignItems: 'center', marginBottom: 8 },
  miniGhostTxt: { color: colors.muted, fontWeight: '700' },
  btn: { marginTop: 12, backgroundColor: colors.purple, borderRadius: 14, padding: 15, alignItems: 'center' },
  btnTxt: { color: colors.onAccent, fontWeight: '800' },
  rawToggle: { marginTop: 12, alignItems: 'center' },
  rawToggleTxt: { color: colors.link, fontWeight: '700', fontSize: 12 },
  raw: { backgroundColor: colors.bgSoft, borderRadius: 12, padding: 10, marginTop: 8, fontSize: 11, color: colors.muted },
  h: { fontSize: 16, fontWeight: '800', color: colors.text, marginTop: 16, marginBottom: 8 },
  card: { backgroundColor: colors.card, borderRadius: 14, borderWidth: 1, borderColor: colors.line, padding: 12, marginBottom: 8, gap: 8 },
  del: { padding: 8 },
  delTxt: { color: colors.danger, fontWeight: '800' },
  days: { flexDirection: 'row', gap: 4 },
  day: { flex: 1, borderWidth: 1, borderColor: colors.line, borderRadius: 8, paddingVertical: 6, alignItems: 'center', backgroundColor: colors.card },
  dayOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  dayTxt: { fontSize: 11, fontWeight: '700', color: colors.muted },
  dayTxtOn: { fontSize: 11, fontWeight: '700', color: colors.onPrimary },
  time: { flex: 1, marginBottom: 0, textAlign: 'center', color: colors.text },
  to: { fontWeight: '800', color: colors.muted },
  label: { fontSize: 13, fontWeight: '700', color: colors.text, marginTop: 12, marginBottom: 6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  chip: { borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card, borderRadius: 99, paddingVertical: 7, paddingHorizontal: 12 },
  chipTxt: { fontSize: 12, fontWeight: '700', color: colors.muted },
  error: { color: colors.danger, marginTop: 12 },
  ok: { backgroundColor: colors.greenBg, borderRadius: 14, padding: 14, marginTop: 16, gap: 10 },
  okT: { fontWeight: '800', color: colors.green },
});
}
