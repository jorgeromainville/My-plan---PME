import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import * as Location from 'expo-location';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { buildPickerHtml, buildViewHtml } from '../src/components/mapHtml';
import { Card } from '../src/components/Card';
import { NativeDate, NativeTime } from '../src/components/NativeTime';
import { errorMessage } from '../src/services/api';
import {
  categoryIcon,
  createContact,
  createContactCategory,
  deleteContact,
  getContact,
  listContactCategories,
  touchContact,
  updateContact,
  type Contact,
  type ContactCategory,
} from '../src/services/contacts';
import { usePrefs } from '../src/store/usePrefs';
import { colors } from '../src/theme/colors';
import { parseLocalDay } from '../src/utils/dates';

const PALETTE = ['#C9A44A', '#6B9ECF', '#D98162', '#6FA287', '#8B7BC7', '#E07A5F'];

// Persona: con id abre en VISTA (info + llamar); Editar pasa al formulario.
// Sin id abre directo el formulario.
export default function PersonaScreen() {
  const router = useRouter();
  const { id, edit, lat: plat, lng: plng } = useLocalSearchParams<{ id?: string; edit?: string; lat?: string; lng?: string }>();
  const [editing, setEditing] = useState(!id);
  const [contact, setContact] = useState<Contact | null>(null);
  const [catColor, setCatColor] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (edit === '1') setEditing(true);
  }, [edit]);

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const c = await getContact(id);
        setContact(c);
        const cats = await listContactCategories().catch(() => []);
        setCatColor(cats.find((k) => k.name === c.category)?.color ?? null);
      } catch (e) {
        setError(errorMessage(e));
      }
    })();
  }, [id]);

  if (id && !editing && contact) {
    return (
      <PersonaView
        contact={contact}
        color={catColor}
        onEdit={() => setEditing(true)}
        onBack={() => router.back()}
        onTouched={(c) => setContact(c)}
        onError={setError}
        error={error}
      />
    );
  }

  return (
    <PersonaForm
      id={id}
      initial={contact}
      presetLat={plat ? Number(plat) : null}
      presetLng={plng ? Number(plng) : null}
      onBack={() => (id ? setEditing(false) : router.back())}
      onSaved={() => {
        if (id) {
          getContact(id).then(setContact).catch(() => {});
          setEditing(false);
        } else {
          router.back();
        }
      }}
    />
  );
}

// ---------------- vista ----------------
function PersonaView({ contact, color, onEdit, onBack, onTouched, onError, error }: {
  contact: Contact;
  color: string | null;
  onEdit: () => void;
  onBack: () => void;
  onTouched: (c: Contact) => void;
  onError: (m: string) => void;
  error: string;
}) {
  const name = `${contact.firstName}${contact.lastName ? ` ${contact.lastName}` : ''}`;
  const tel = (contact.phone ?? '').trim();
  const wa = (contact.whatsapp ?? tel).replace(/[^0-9+]/g, '');

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.body}>
        <View style={s.top}>
          <Pressable onPress={onBack} style={s.x} accessibilityLabel="Volver">
            <Text style={s.xTxt}>‹</Text>
          </Pressable>
          <Text style={s.title}>Contacto</Text>
          <Pressable onPress={onEdit} style={s.editBtn} accessibilityLabel="Editar">
            <Text style={s.editTxt}>Editar</Text>
          </Pressable>
        </View>

        <Card style={s.center}>
          <View style={[s.bigFace, color ? { borderColor: color } : null]}>
            <Text style={{ fontSize: 40 }}>{categoryIcon(contact.category)}</Text>
          </View>
          <Text style={s.name}>{name}</Text>
          <View style={s.catRow}>
            {color ? <View style={[s.dot, { backgroundColor: color }]} /> : null}
            <Text style={s.cat}>{contact.category}</Text>
          </View>
        </Card>

        {error ? <Text style={s.error}>{error}</Text> : null}

        {tel ? (
          <View style={s.actions}>
            <Pressable style={s.act} onPress={() => Linking.openURL(`tel:${tel}`)}>
              <Text style={s.actTxt}>📞 Llamar</Text>
            </Pressable>
            <Pressable style={s.act} onPress={() => Linking.openURL(`https://wa.me/${wa}`)}>
              <Text style={s.actTxt}>💬 WhatsApp</Text>
            </Pressable>
            <Pressable style={s.act} onPress={() => Linking.openURL(`sms:${tel}`)}>
              <Text style={s.actTxt}>✉️ SMS</Text>
            </Pressable>
          </View>
        ) : null}

        <Card>
          <Info k="Teléfono" v={contact.phone} />
          <Info k="WhatsApp" v={contact.whatsapp} />
          <Info k="Email" v={contact.email} />
          <Info k="Dirección" v={contact.address} />
          <Info k="Notas" v={contact.notes} />
          <Info
            k="Último contacto"
            v={contact.lastContactAt ? new Date(contact.lastContactAt).toLocaleString() : 'Sin registrar'}
          />
          <Info
            k="Próximo contacto"
            v={contact.nextContactAt ? new Date(contact.nextContactAt).toLocaleString() : 'Sin programar'}
          />
        </Card>

        {contact.latitude != null && contact.longitude != null ? (
          <Card>
            <Text style={s.label}>Ubicación</Text>
            {/* Mapa: MapLibre + OpenFreeMap (ver src/components/mapHtml.ts). */}
            <WebView
              source={{ html: buildViewHtml(contact.latitude, contact.longitude) }}
              style={s.map}
              androidLayerType="hardware"
              onShouldStartLoadWithRequest={() => false}
              javaScriptEnabled
              domStorageEnabled
              originWhitelist={['*']}
              scrollEnabled={false}
            />
          </Card>
        ) : null}

        <Pressable
          style={s.touched}
          onPress={async () => {
            try {
              const upd = await touchContact(contact.id);
              onTouched({ ...contact, ...upd });
            } catch (e) {
              onError(errorMessage(e));
            }
          }}
        >
          <Text style={s.touchedTxt}>✓ Marcar contactado hoy</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function Info({ k, v }: { k: string; v?: string | null }) {
  if (!v) return null;
  return (
    <View style={s.rowLine}>
      <Text style={s.k}>{k}</Text>
      <Text style={s.v}>{v}</Text>
    </View>
  );
}

// ---------------- formulario ----------------
function PersonaForm({ id, initial, presetLat, presetLng, onBack, onSaved }: {
  id?: string;
  initial: Contact | null;
  presetLat?: number | null;
  presetLng?: number | null;
  onBack: () => void;
  onSaved: () => void;
}) {
  const lastCategory = usePrefs((p) => p.lastCategory);
  const setPrefs = usePrefs((p) => p.set);
  const [firstName, setFirstName] = useState(initial?.firstName ?? '');
  const [lastName, setLastName] = useState(initial?.lastName ?? '');
  const [phone, setPhone] = useState(initial?.phone ?? '');
  const [whatsapp, setWhatsapp] = useState(initial?.whatsapp ?? '');
  const [email, setEmail] = useState(initial?.email ?? '');
  const [address, setAddress] = useState(initial?.address ?? '');
  const [category, setCategory] = useState(initial?.category ?? lastCategory);
  const [cats, setCats] = useState<ContactCategory[]>([]);
  const [newCat, setNewCat] = useState('');
  const [newColor, setNewColor] = useState(PALETTE[0]);
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [hasNext, setHasNext] = useState(!!initial?.nextContactAt);
  const [nextDate, setNextDate] = useState('');
  const [nextTime, setNextTime] = useState('09:00');
  const [lat, setLat] = useState<number | null>(initial?.latitude ?? presetLat ?? null);
  const [lng, setLng] = useState<number | null>(initial?.longitude ?? presetLng ?? null);
  const pickWeb = useRef<WebView>(null);
  const [mapKey, setMapKey] = useState(0);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState('');
  const [confirmDel, setConfirmDel] = useState(false);

  useEffect(() => {
    listContactCategories().then(setCats).catch(() => {});
    if (initial?.nextContactAt) {
      const d = new Date(initial.nextContactAt);
      setNextDate(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
      setNextTime(`${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`);
    }
  }, []);

  function nextISO(): string | undefined {
    if (!hasNext || !nextDate) return undefined;
    const d = parseLocalDay(nextDate);
    if (!d) return undefined;
    const m = /^(\d{2}):(\d{2})$/.exec(nextTime);
    d.setHours(m ? Number(m[1]) : 9, m ? Number(m[2]) : 0, 0, 0);
    return d.toISOString();
  }

  async function useMyLocation() {
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

  const pickerHtml = useMemo(
    () => (lat != null && lng != null ? buildPickerHtml(lat, lng) : null),
    // solo se reconstruye al montar (mapKey); los arrastres no remontan
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mapKey],
  );

  async function onSave() {
    setError('');
    if (!firstName.trim()) {
      setError('Ponle un nombre.');
      return;
    }
    try {
      const payload = {
        firstName: firstName.trim(),
        lastName: lastName.trim() || undefined,
        phone: phone.trim() || undefined,
        whatsapp: whatsapp.trim() || phone.trim() || undefined,
        email: email.trim() || undefined,
        address: address.trim() || undefined,
        latitude: lat ?? undefined,
        longitude: lng ?? undefined,
        category,
        notes: notes.trim() || undefined,
        nextContactAt: nextISO(),
      };
      if (id) await updateContact(id, payload);
      else await createContact(payload);
      await setPrefs({ lastCategory: category }); // queda por defecto la próxima
      onSaved();
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  async function onDelete() {
    if (!id) return;
    try {
      await deleteContact(id);
      onBack();
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  async function addCategory() {
    if (!newCat.trim()) return;
    try {
      await createContactCategory(newCat.trim(), newColor);
      const list = await listContactCategories();
      setCats(list);
      setCategory(newCat.trim());
      setNewCat('');
      await setPrefs({ lastCategory: newCat.trim() });
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.body} keyboardShouldPersistTaps="handled">
        <View style={s.top}>
          <Pressable onPress={onBack} style={s.x} accessibilityLabel="Volver">
            <Text style={s.xTxt}>‹</Text>
          </Pressable>
          <Text style={s.title}>{id ? 'Editar contacto' : 'Nueva persona'}</Text>
          <View style={{ width: 60 }} />
        </View>

        <Card>
          <Text style={s.label}>Nombre *</Text>
          <TextInput style={s.input} value={firstName} onChangeText={setFirstName} placeholder="Juan" />
          <Text style={s.label}>Apellido</Text>
          <TextInput style={s.input} value={lastName} onChangeText={setLastName} placeholder="Pérez" />
          <Text style={s.label}>Teléfono</Text>
          <TextInput style={s.input} value={phone} onChangeText={setPhone} placeholder="+51 987 654 321" keyboardType="phone-pad" />
          <Text style={s.label}>WhatsApp</Text>
          <TextInput style={s.input} value={whatsapp} onChangeText={setWhatsapp} placeholder="Vacío = igual que teléfono" keyboardType="phone-pad" />
          <Text style={s.label}>Email</Text>
          <TextInput style={s.input} value={email} onChangeText={setEmail} placeholder="Opcional" autoCapitalize="none" keyboardType="email-address" />
          <Text style={s.label}>Dirección</Text>
          <TextInput style={s.input} value={address} onChangeText={setAddress} placeholder="Opcional" />
        </Card>

        <Card>
          <Text style={s.label}>Ubicación en el mapa (opcional)</Text>
          {lat != null && lng != null && pickerHtml ? (
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
          ) : (
            <Text style={s.hint}>Sin ubicación. Usa tu posición o arrastra el marcador.</Text>
          )}
          <View style={s.row}>
            <Pressable onPress={useMyLocation} style={s.mini} disabled={locating}>
              <Text style={s.miniTxt}>{locating ? '…' : '📍'} Usar mi ubicación</Text>
            </Pressable>
            {lat != null ? (
              <Pressable onPress={() => { setLat(null); setLng(null); }} style={s.miniGhost}>
                <Text style={s.miniGhostTxt}>Quitar</Text>
              </Pressable>
            ) : null}
          </View>
          <Text style={s.hint}>Tip: después de "usar mi ubicación" arrastra el 📍 para ajustar.</Text>
        </Card>

        <Card>
          <Text style={s.label}>Categoría</Text>
          <View style={s.wrap}>
            {cats.map((c) => (
              <Pressable key={c.name} onPress={() => setCategory(c.name)} style={[s.chip, category === c.name && s.chipOn]}>
                {c.color ? <View style={[s.dot, { backgroundColor: c.color }]} /> : null}
                <Text style={category === c.name ? s.chipTxtOn : s.chipTxt}>{categoryIcon(c.name)} {c.name}</Text>
              </Pressable>
            ))}
          </View>
          <View style={s.newCat}>
            <TextInput style={[s.input, { flex: 1, marginBottom: 0 }]} value={newCat} onChangeText={setNewCat} placeholder="Nueva categoría" />
            <Pressable onPress={addCategory} style={s.plus}>
              <Text style={s.plusTxt}>+</Text>
            </Pressable>
          </View>
          <View style={s.row}>
            {PALETTE.map((c) => (
              <Pressable key={c} onPress={() => setNewColor(c)} style={[s.dotLg, { backgroundColor: c }, newColor === c && s.dotOn]} />
            ))}
          </View>
        </Card>

        <Card>
          <Text style={s.label}>Notas</Text>
          <TextInput style={[s.input, s.area]} value={notes} onChangeText={setNotes} multiline placeholder="Opcional" />
          <Pressable onPress={() => setHasNext(!hasNext)} style={s.check} accessibilityRole="checkbox">
            <View style={[s.box, hasNext && s.boxOn]}>{hasNext ? <Text>✓</Text> : null}</View>
            <Text style={s.checkTxt}>Próximo contacto</Text>
          </Pressable>
          {hasNext ? (
            <>
              <Text style={s.label}>Fecha</Text>
              <NativeDate label="Fecha del próximo contacto" value={nextDate} onChange={setNextDate} />
              <Text style={s.label}>Hora</Text>
              <NativeTime label="Hora próximo contacto" value={nextTime} onChange={setNextTime} />
            </>
          ) : null}
        </Card>

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
              <Text style={s.confirmT}>¿Eliminar contacto?</Text>
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

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  body: { padding: 16, gap: 12 },
  top: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  x: { width: 40, paddingVertical: 6 },
  xTxt: { fontSize: 28, color: colors.text },
  title: { flex: 1, textAlign: 'center', fontSize: 18, fontWeight: '800', color: colors.text },
  center: { alignItems: 'center' },
  bigFace: { width: 84, height: 84, borderRadius: 42, backgroundColor: colors.bgSoft, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: colors.line },
  name: { fontSize: 22, fontWeight: '900', color: colors.text, marginTop: 8 },
  catRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  dot: { width: 12, height: 12, borderRadius: 6 },
  cat: { color: colors.muted, fontWeight: '700' },
  editBtn: { borderWidth: 1, borderColor: colors.line, borderRadius: 99, paddingHorizontal: 16, paddingVertical: 8, backgroundColor: colors.card },
  editTxt: { fontWeight: '800', color: colors.text },
  actions: { flexDirection: 'row', gap: 8 },
  act: { flex: 1, backgroundColor: colors.green, borderRadius: 14, padding: 13, alignItems: 'center' },
  actTxt: { color: '#fff', fontWeight: '800' },
  label: { fontSize: 13, fontWeight: '700', color: colors.text, marginTop: 10, marginBottom: 6 },
  input: { backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: colors.line, padding: 13, marginBottom: 4 },
  area: { minHeight: 70, textAlignVertical: 'top' },
  rowLine: { flexDirection: 'row', paddingVertical: 6, gap: 10 },
  k: { width: 110, color: colors.muted, fontWeight: '700', fontSize: 13 },
  v: { flex: 1, color: colors.text, fontWeight: '600', fontSize: 13 },
  row: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  wrap: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  chip: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: colors.line, borderRadius: 99, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: '#fff' },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipTxt: { color: colors.text, fontWeight: '700', fontSize: 12 },
  chipTxtOn: { color: '#fff', fontWeight: '700', fontSize: 12 },
  dotLg: { width: 32, height: 32, borderRadius: 16, borderWidth: 3, borderColor: 'transparent', marginTop: 8 },
  dotOn: { borderColor: colors.primary },
  newCat: { flexDirection: 'row', gap: 8, alignItems: 'center', marginTop: 10 },
  plus: { width: 46, height: 46, borderRadius: 23, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  plusTxt: { color: '#fff', fontSize: 22 },
  map: { height: 220, borderRadius: 14, overflow: 'hidden', marginBottom: 8 },
  mini: { flex: 1, backgroundColor: colors.primary, borderRadius: 12, padding: 12, alignItems: 'center' },
  miniTxt: { color: '#fff', fontWeight: '800' },
  miniGhost: { borderWidth: 1, borderColor: colors.line, borderRadius: 12, padding: 12, alignItems: 'center' },
  miniGhostTxt: { color: colors.muted, fontWeight: '700' },
  hint: { color: colors.muted, fontSize: 12, marginTop: 6 },
  check: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12 },
  box: { width: 26, height: 26, borderRadius: 8, borderWidth: 2, borderColor: colors.muted, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  boxOn: { backgroundColor: colors.greenBg, borderColor: colors.green },
  checkTxt: { fontWeight: '600', color: colors.text },
  touched: { marginTop: 4, borderWidth: 1, borderColor: colors.green, borderRadius: 12, padding: 12, alignItems: 'center' },
  touchedTxt: { fontWeight: '800', color: colors.green },
  error: { color: colors.danger },
  btn: { backgroundColor: colors.primary, borderRadius: 14, padding: 15, alignItems: 'center' },
  btnTxt: { color: '#fff', fontWeight: '800' },
  del: { padding: 14, alignItems: 'center' },
  delTxt: { color: colors.danger, fontWeight: '700' },
  confirm: { backgroundColor: colors.card, borderRadius: 14, borderWidth: 1, borderColor: colors.line, padding: 14 },
  confirmT: { fontWeight: '800', color: colors.text, marginBottom: 10 },
  keep: { flex: 1, backgroundColor: colors.primary, borderRadius: 12, padding: 12, alignItems: 'center' },
  keepTxt: { color: '#fff', fontWeight: '800' },
  drop: { flex: 1, padding: 12, alignItems: 'center' },
  dropTxt: { color: colors.danger, fontWeight: '800' },
});
