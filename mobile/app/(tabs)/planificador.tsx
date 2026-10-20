import { useRouter } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { PanResponder, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AndeanTopBand } from '../../src/components/AndeanMotifs';
import { Card } from '../../src/components/Card';
import { HOUR_H, layoutDay, toHHMM, toMin, type PlacedBlock } from '../../src/components/DayAgenda';
import { DraggableBlock, type DropResult } from '../../src/components/DraggableBlock';
import { Icon, templateIconName } from '../../src/components/Icon';
import { UndoBar } from '../../src/components/UndoBar';
import { createEvent, deleteEvent, listEvents, updateEvent, type CalEvent } from '../../src/services/events';
import { dayRange, createTask, deleteTask, listTasks, updateTask, type Task } from '../../src/services/tasks';
import { deviceCountry, getHolidays, holidayMap, type Holiday } from '../../src/services/holidays';
import { useAppStore } from '../../src/store/useAppStore';
import { fmtHour, usePrefs } from '../../src/store/usePrefs';
import { useCatalog } from '../../src/store/useCatalog';
import { colors, useThemedStyles, type ThemeColors } from '../../src/theme/colors';
import { addDays, toLocalKey } from '../../src/utils/dates';
import { expandEvents, type Occurrence } from '../../src/utils/recurrence';

type ViewMode = 'day' | 'week' | 'month';

const DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const MESES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];

function startOfWeek(d: Date, weekStartsOn: 'monday' | 'sunday' = 'monday'): Date {
  const c = new Date(d);
  const first = weekStartsOn === 'sunday' ? 0 : 1;
  const diff = (c.getDay() - first + 7) % 7;
  c.setDate(c.getDate() - diff);
  c.setHours(0, 0, 0, 0);
  return c;
}

function sameDay(a: Date, b: Date): boolean {
  return toLocalKey(a) === toLocalKey(b);
}

function clampDay(d: Date): Date {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  return c;
}

export default function Planificador() {
  const s = useThemedStyles(createStyles);
  const router = useRouter();
  const { selectedDate, setSelectedDate } = useAppStore();
  const [view, setView] = useState<ViewMode>('day');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [dragging, setDragging] = useState(false);
  const [undo, setUndo] = useState<{ message: string; run: () => Promise<void> } | null>(null);
  const [monthCursor, setMonthCursor] = useState(() => new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1));
  const [typeFilter, setTypeFilter] = useState<string>('Todos');
  const [kindFilter, setKindFilter] = useState<'all' | 'event' | 'task'>('all');
  const [selecting, setSelecting] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [sheetOpen, setSheetOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [holidays, setHolidays] = useState<Map<string, Holiday>>(new Map());
  const [zoom, setZoom] = useState(1); // pellizco: 0.5x – 2x
  const touch = React.useRef({ x: 0, y: 0 });
  const prefs = usePrefs();
  const win = useWindowDimensions();
  const pager = useRef<ScrollView>(null);
  // Candado anti doble salto: ignora páginas dentro de 600ms.
  const pageLock = useRef(0);
  const gutterW = prefs.hourFormat === '12h' ? 58 : 44;
  const weekColW = Math.max(110, (win.width - 44 - 32) / 7); // responsive: caben 7 en tablet

  const load = useCallback(async () => {
    let from: Date;
    let to: Date;
    if (view === 'day') {
      const r = dayRange(selectedDate);
      from = new Date(r.from);
      to = new Date(r.to);
    } else if (view === 'week') {
      from = startOfWeek(selectedDate, prefs.weekStartsOn);
      to = addDays(from, 6);
      to.setHours(23, 59, 59, 999);
    } else {
      const first = new Date(monthCursor.getFullYear(), monthCursor.getMonth(), 1);
      from = startOfWeek(first, prefs.weekStartsOn);
      to = addDays(from, 41);
      to.setHours(23, 59, 59, 999);
    }
    try {
      // Las series se expanden en el teléfono: se piden 370 días atrás
      // para que una repetición creada hace meses siga apareciendo.
      // Las tareas (sin repetición) usan el rango exacto.
      const past = addDays(from, -370);
      past.setHours(0, 0, 0, 0);
      const [t, e] = await Promise.all([
        listTasks(from.toISOString(), to.toISOString()),
        listEvents(past.toISOString(), to.toISOString()),
      ]);
      setTasks(t);
      setEvents(e);
    } catch {
      setTasks([]);
      setEvents([]);
    }
  }, [view, selectedDate, monthCursor, prefs.weekStartsOn]);

  useFocusEffect(useCallback(() => {
    load();
  }, [load]));

  // Feriados del año visible (cache local) + clima si hay ubicación.
  // País: ajuste manual o el del dispositivo (PE, US, …).
  useFocusEffect(useCallback(() => {
    const year = (view === 'month' ? monthCursor : selectedDate).getFullYear();
    const country = prefs.holidayCountry || deviceCountry();
    getHolidays(year, country).then((l) => setHolidays(holidayMap(l))).catch(() => {});
  }, [view, selectedDate, monthCursor, prefs.holidayCountry]));

  const holidayToday = holidays.get(toLocalKey(selectedDate));

  // ---------- drag & drop ----------
  async function onDrop(block: PlacedBlock, drop: DropResult, visibleDate: Date) {
    if (drop.dayDelta === 0 && drop.minDelta === 0) return;
    setUndo(null);
    try {
      if (block.kind === 'task') {
        const t = block.raw as Task;
        const prev = { date: t.date, time: t.time };
        const base = new Date(t.date);
        const nd = addDays(clampDay(base), drop.dayDelta);
        nd.setHours(0, 0, 0, 0);
        const nt = t.time ? toHHMM(Math.min(1439, Math.max(0, toMin(t.time) + drop.minDelta))) : undefined;
        await updateTask(t.id, { date: nd.toISOString(), time: nt });
        setTasks((p) => p.map((x) => (x.id === t.id ? { ...x, date: nd.toISOString(), time: nt ?? x.time } : x)));
        setUndo({
          message: `Tarea movida${drop.dayDelta !== 0 ? ' de día' : ''}`,
          run: async () => {
            await updateTask(t.id, { date: prev.date, time: prev.time ?? undefined });
            load();
          },
        });
      } else {
        const e = block.raw as CalEvent;
        const prev = { date: e.date, startTime: e.startTime, endTime: e.endTime };
        const dur = toMin(e.endTime) - toMin(e.startTime);
        const nd = addDays(clampDay(new Date(e.date)), drop.dayDelta);
        nd.setHours(0, 0, 0, 0);
        const ns = toHHMM(Math.min(1439 - dur, Math.max(0, toMin(e.startTime) + drop.minDelta)));
        const ne = toHHMM(toMin(ns) + dur);
        await updateEvent(e.id, { date: nd.toISOString(), startTime: ns, endTime: ne });
        setEvents((p) => p.map((x) => (x.id === e.id ? { ...x, date: nd.toISOString(), startTime: ns, endTime: ne } : x)));
        setUndo({
          message: e.repeat !== 'none' ? 'Serie movida' : 'Evento movido',
          run: async () => {
            await updateEvent(e.id, { date: prev.date, startTime: prev.startTime, endTime: prev.endTime });
            load();
          },
        });
      }
      void visibleDate;
    } catch {
      load();
    }
  }

  async function toggleTask(t: Task) {
    const next = t.status === 'completada' ? 'pendiente' : 'completada';
    setTasks((prev) => prev.map((x) => (x.id === t.id ? { ...x, status: next } : x)));
    try {
      await updateTask(t.id, { status: next });
    } catch {
      load();
    }
  }

  function togglePick(key: string) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  // ---------- vistas ----------
  const weekStart = startOfWeek(selectedDate, prefs.weekStartsOn);
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  function dayData(d: Date) {
    let ts = tasks.filter((t) => sameDay(new Date(t.date), d));
    let occ = expandEvents(events, clampDay(d), clampDay(d));
    if (kindFilter === 'event') ts = [];
    if (kindFilter === 'task') occ = [];
    if (typeFilter !== 'Todos') {
      occ = occ.filter((o) => o.event.type === typeFilter);
      ts = [];
    }
    return layoutDay(ts, occ, prefs.dayStart, prefs.dayEnd, prefs.hourFormat, zoom);
  }

  // Al cambiar de día, vuelve a la página central del pager.
  React.useEffect(() => {
    pager.current?.scrollTo({ x: win.width, animated: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate]);

  // Acciones masivas en modo selección.
  async function bulkDelete() {
    const keys = [...picked];
    setPicked(new Set());
    setSelecting(false);
    for (const k of keys) {
      try {
        if (k.startsWith('t-')) await deleteTask(k.slice(2));
        else await deleteEvent(k.split('@')[0]);
      } catch {
        // sigue con el resto
      }
    }
    load();
  }

  async function bulkDone() {
    const keys = [...picked].filter((k) => k.startsWith('t-'));
    setPicked(new Set());
    setSelecting(false);
    for (const k of keys) {
      try {
        await updateTask(k.slice(2), { status: 'completada' });
      } catch {
        // sigue
      }
    }
    load();
  }

  const presentTypes = ['Todos', ...new Set(events.map((e) => e.type))];

  function goForm(kind: 'tarea' | 'evento', d: Date, time?: string, end?: string) {
    const iso = clampDay(d).toISOString();
    const q = `date=${iso}${time ? `&time=${time}` : ''}${end ? `&end=${end}` : ''}`;
    router.push((kind === 'tarea' ? `/tarea?${q}` : `/evento?${q}`) as never);
  }

  function openDetail(b: PlacedBlock) {
    setDetail({ kind: b.kind, raw: b.raw });
  }
  const [detail, setDetail] = useState<{ kind: 'task' | 'event'; raw: Task | CalEvent } | null>(null);
  const [confirmDel, setConfirmDel] = useState(false);
  const [busy, setBusy] = useState(false);

  async function duplicateDetail() {
    if (!detail || busy) return;
    setBusy(true);
    try {
      if (detail.kind === 'task') {
        const t = detail.raw as Task;
        const c = await createTask({
          title: `${t.title} (copia)`,
          date: t.date,
          time: t.time ?? undefined,
          priority: t.priority,
          category: t.category,
          description: t.description ?? undefined,
          status: 'pendiente',
        });
        setDetail(null);
        router.push(`/tarea?id=${c.id}` as never);
      } else {
        const e = detail.raw as CalEvent;
        const c = await createEvent({
          title: `${e.title} (copia)`,
          type: e.type,
          color: e.color ?? undefined,
          isBackup: false,
          date: e.date,
          startTime: e.startTime,
          endTime: e.endTime,
          location: e.location ?? undefined,
          description: e.description ?? undefined,
          notifyMins: e.notifyMins,
          repeat: 'none',
          contactIds: (e.contacts ?? []).map((ct) => ct.id),
        });
        setDetail(null);
        router.push(`/evento?id=${c.id}` as never);
      }
    } finally {
      setBusy(false);
    }
  }

  async function deleteDetail() {
    if (!detail) return;
    const id = (detail.raw as { id: string }).id;
    if (detail.kind === 'task') await deleteTask(id);
    else await deleteEvent(id);
    setDetail(null);
    setConfirmDel(false);
    load();
  }

  const TEMPLATES = useCatalog((c) => c.templates);

  async function quickCreate(t: (typeof TEMPLATES)[number]) {
    setSheetOpen(false);
    const d = clampDay(selectedDate);
    d.setHours(0, 0, 0, 0);
    try {
      await createEvent({
        title: t.title,
        type: t.type,
        isBackup: false,
        date: d.toISOString(),
        startTime: t.start,
        endTime: t.end,
        notifyMins: 30,
        repeat: 'none',
        contactIds: [],
      });
      load();
    } catch {
      // el error se verá al abrir el día; la lista se recarga igual
      load();
    }
  }

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <AndeanTopBand />
      <View style={s.header}>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>Planificador</Text>
          <Text style={s.sub}>
            {DIAS[selectedDate.getDay()]}, {selectedDate.getDate()} de {MESES[selectedDate.getMonth()]}
          </Text>
        </View>
        <Pressable style={s.today} onPress={() => { setSelectedDate(new Date()); setMonthCursor(new Date(new Date().getFullYear(), new Date().getMonth(), 1)); }}>
          <Text style={s.todayTxt}>Hoy</Text>
        </Pressable>
        <Pressable style={[s.today, (typeFilter !== 'Todos' || kindFilter !== 'all') && s.selOn]} onPress={() => setFilterOpen(true)} accessibilityLabel="Filtrar por tipo">
          <View style={s.iconRow}>
            <Icon
              name="filter"
              size={16}
              color={(typeFilter !== 'Todos' || kindFilter !== 'all') ? colors.onPrimary : colors.text}
            />
            {(typeFilter !== 'Todos' || kindFilter !== 'all') ? (
              <View style={[s.filterDot, { backgroundColor: colors.onPrimary }]} />
            ) : null}
          </View>
        </Pressable>
        <Pressable style={[s.today, selecting && s.selOn]} onPress={() => { setSelecting(!selecting); setPicked(new Set()); }} accessibilityLabel="Selección múltiple">
          <View style={s.iconRow}>
            <Icon name="checkSquare" size={16} color={selecting ? colors.onPrimary : colors.text} />
            {picked.size > 0 ? <Text style={[s.todayTxt, selecting && s.selOnTxt]}>{picked.size}</Text> : null}
          </View>
        </Pressable>
        <Pressable style={s.add} onPress={() => setSheetOpen(true)} accessibilityLabel="Crear actividad">
          <Icon name="plus" size={22} color={colors.onPrimary} />
        </Pressable>
      </View>

      {sheetOpen ? (
        <Pressable style={s.sheetBg} onPress={() => setSheetOpen(false)}>
          <View style={s.sheet}>
            <Text style={s.sheetT}>¿Qué deseas crear?</Text>
            <Pressable
              style={s.sheetOpt}
              onPress={() => { setSheetOpen(false); goForm('tarea', selectedDate); }}
            >
              <Icon name="checkSquare" size={22} color={colors.text} />
              <View style={{ flex: 1 }}>
                <Text style={s.sheetTitle}>Tarea</Text>
                <Text style={s.sheetSub}>Nueva tarea del día</Text>
              </View>
            </Pressable>
            <Pressable
              style={s.sheetOpt}
              onPress={() => { setSheetOpen(false); goForm('evento', selectedDate); }}
            >
              <Icon name="calendar" size={22} color={colors.text} />
              <View style={{ flex: 1 }}>
                <Text style={s.sheetTitle}>Evento</Text>
                <Text style={s.sheetSub}>Nuevo evento con hora</Text>
              </View>
            </Pressable>
            <Text style={s.sheetT2}>Plantillas (crean al toque)</Text>
            {TEMPLATES.map((t) => (
              <Pressable key={t.title} style={s.sheetOpt} onPress={() => quickCreate(t)}>
                <Icon name={templateIconName(t.icon)} size={22} color={colors.text} />
                <View style={{ flex: 1 }}>
                  <Text style={s.sheetTitle}>{t.title}</Text>
                  <Text style={s.sheetSub}>
                    {t.start} – {t.end} · hoy
                  </Text>
                </View>
              </Pressable>
            ))}
          </View>
        </Pressable>
      ) : null}

      {filterOpen ? (
        <Pressable style={s.sheetBg} onPress={() => setFilterOpen(false)}>
          <View style={s.sheet}>
            <Text style={s.sheetT}>Filtrar</Text>
            <View style={s.seg}>
              {([
                { v: 'all', label: 'Todo' },
                { v: 'event', label: 'Eventos' },
                { v: 'task', label: 'Tareas' },
              ] as const).map((o) => (
                <Pressable key={o.v} onPress={() => setKindFilter(o.v)} style={[s.segOpt, kindFilter === o.v && s.segOn]}>
                  <Text style={[s.segTxt, kindFilter === o.v && s.segTxtOn]}>{o.label}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={s.sheetT2}>Por tipo de evento</Text>
            {presentTypes.map((t) => (
              <Pressable key={t} onPress={() => { setTypeFilter(t); setKindFilter('all'); setFilterOpen(false); }} style={[s.sheetOpt, typeFilter === t && s.sheetOn]}>
                <View style={s.filterTypeRow}>
                  {t !== 'Todos' ? <View style={s.typeDot} /> : null}
                  <Text style={[s.sheetTitle, typeFilter === t && s.sheetTitleOn]}>{t}</Text>
                </View>
                {typeFilter === t ? <Icon name="check" size={18} color={colors.link} /> : null}
              </Pressable>
            ))}
          </View>
        </Pressable>
      ) : null}

      {selecting && picked.size > 0 && (
        <View style={s.bulk}>
          <Text style={s.bulkTxt}>{picked.size} elegidos</Text>
          <Pressable onPress={bulkDone} style={s.bulkBtn}><Text style={s.bulkBtnTxt}>Completar</Text></Pressable>
          <Pressable onPress={bulkDelete} style={[s.bulkBtn, s.bulkDel]}><Text style={s.bulkBtnTxt}>Eliminar</Text></Pressable>
        </View>
      )}
      <View style={s.tabs}>
        {(['day', 'week', 'month'] as ViewMode[]).map((m) => (
          <Pressable key={m} onPress={() => setView(m)} style={[s.tab, view === m && s.tabOn]}>
            <Text style={[s.tabTxt, view === m && s.tabTxtOn]}>
              {m === 'day' ? 'Día' : m === 'week' ? 'Semana' : 'Mes'}
            </Text>
          </Pressable>
        ))}
      </View>

      {view === 'day' && (
        <>
          <View style={s.weekRow}>
            <Pressable onPress={() => setSelectedDate(addDays(selectedDate, -7))} style={s.nav}><Icon name="chevronLeft" size={20} color={colors.muted} /></Pressable>
            <View style={s.week}>
              {weekDays.map((d, i) => {
                const active = sameDay(d, selectedDate);
                return (
                  <Pressable key={i} onPress={() => setSelectedDate(d)} style={[s.day, active && s.dayOn]}>
                    <Text style={[s.dow, active && s.on]}>{DIAS[d.getDay()]}</Text>
                    <Text style={[s.num, active && s.on]}>{d.getDate()}</Text>
                  </Pressable>
                );
              })}
            </View>
            <Pressable onPress={() => setSelectedDate(addDays(selectedDate, 7))} style={s.nav}><Icon name="chevronRight" size={20} color={colors.muted} /></Pressable>
          </View>
          <ScrollView
            ref={pager}
            horizontal
            pagingEnabled
            style={{ flex: 1 }}
            showsHorizontalScrollIndicator={false}
            contentOffset={{ x: win.width, y: 0 }}
            onMomentumScrollEnd={(e) => {
              if (dragging) return;
              const nowT = Date.now();
              if (nowT - pageLock.current < 600) return; // candado anti doble salto
              pageLock.current = nowT;
              const i = Math.round(e.nativeEvent.contentOffset.x / win.width);
              if (i === 0) setSelectedDate(addDays(selectedDate, -1));
              else if (i === 2) setSelectedDate(addDays(selectedDate, 1));
            }}
          >
            {[addDays(selectedDate, -1), selectedDate, addDays(selectedDate, 1)].map((d) => (
              <View key={toLocalKey(d)} style={{ width: win.width }}>
                <DayGrid
                  data={dayData(d)}
                  date={d}
                  dragging={dragging}
                  setDragging={setDragging}
                  onDrop={onDrop}
                  onToggle={toggleTask}
                  onOpen={openDetail}
                  onEmptyHour={(h) => goForm('evento', d, `${String(h).padStart(2, '0')}:00`)}
                  onCreateRange={(st, en, dd) => goForm('evento', dd, st, en)}
                  selecting={selecting}
                  picked={picked}
                  togglePick={togglePick}
                  zoom={zoom}
                  setZoom={setZoom}
                  gutterW={gutterW}
                  holidays={holidays}
                />
              </View>
            ))}
          </ScrollView>
        </>
      )}

      {view === 'week' && (
        <WeekGrid
          days={weekDays}
          dayData={dayData}
          onOpen={openDetail}
          onPickDay={(d) => { setSelectedDate(d); setView('day'); }}
          colW={weekColW}
          selecting={selecting}
          picked={picked}
          togglePick={togglePick}
          rangeH={prefs.dayEnd - prefs.dayStart}
          hourFormat={prefs.hourFormat}
        />
      )}

      {view === 'month' && (
        <MonthGrid
          cursor={monthCursor}
          setCursor={setMonthCursor}
          selected={selectedDate}
          holidays={holidays}
          onPick={(d) => setSelectedDate(d)}
          counts={(d) => {
            const ts = tasks.filter((t) => sameDay(new Date(t.date), d)).length;
            const oc = expandEvents(events, clampDay(d), clampDay(d)).length;
            return ts + oc;
          }}
          detail={dayData(selectedDate)}
          onOpen={openDetail}
          weekStartsOn={prefs.weekStartsOn}
        />
      )}

      {detail ? (
        <Pressable style={s.sheetBg} onPress={() => { setDetail(null); setConfirmDel(false); }}>
          <View style={s.sheet}>
            {detail.kind === 'task' ? (
              <>
                <Text style={s.sheetT}>{(detail.raw as Task).title}</Text>
                <Text style={s.sheetSub}>
                  {new Date((detail.raw as Task).date).toLocaleDateString()}
                  {(detail.raw as Task).time ? ` · ${fmtHour((detail.raw as Task).time!, prefs.hourFormat)}` : ' · Sin hora'} · {(detail.raw as Task).priority} · {(detail.raw as Task).status.replace('_', ' ')}
                </Text>
              </>
            ) : (
              <>
                <Text style={s.sheetT}>{(detail.raw as CalEvent).title}</Text>
                <Text style={s.sheetSub}>
                  {(detail.raw as CalEvent).type} · {fmtHour((detail.raw as CalEvent).startTime, prefs.hourFormat)} – {fmtHour((detail.raw as CalEvent).endTime, prefs.hourFormat)}
                  {(detail.raw as CalEvent).location ? ` · ${(detail.raw as CalEvent).location}` : ''}
                </Text>
                {(detail.raw as CalEvent).description ? (
                  <Text style={s.sheetSub}>{(detail.raw as CalEvent).description}</Text>
                ) : null}
                <Pressable
                  onPress={async () => {
                    const e = detail.raw as CalEvent;
                    const upd = await updateEvent(e.id, { done: !e.done });
                    setDetail({ kind: 'event', raw: { ...e, ...upd } });
                    load();
                  }}
                  style={s.dCheck}
                >
                  <Text style={s.dCheckTxt}>
                    {(detail.raw as CalEvent).done ? 'Realizado (toca para quitar)' : 'Marcar realizado'}
                  </Text>
                </Pressable>
              </>
            )}
            <View style={s.dRow}>
              <Pressable
                style={s.dBtn}
                onPress={() => {
                  const d = detail;
                  setDetail(null);
                  router.push((d.kind === 'task' ? `/tarea?id=${(d.raw as Task).id}` : `/evento?id=${(d.raw as CalEvent).id}`) as never);
                }}
              >
                <Text style={s.dBtnTxt}>Editar</Text>
              </Pressable>
              <Pressable style={[s.dBtn, s.dCopy]} onPress={duplicateDetail}>
                <Text style={[s.dBtnTxt, s.dCopyTxt]}>{busy ? '…' : 'Duplicar'}</Text>
              </Pressable>
            </View>
            {!confirmDel ? (
              <Pressable onPress={() => setConfirmDel(true)} style={s.dDel}>
                <Text style={s.dDelTxt}>Eliminar</Text>
              </Pressable>
            ) : (
              <View style={s.dConfirm}>
                <Text style={s.dConfirmT}>¿Eliminar definitivamente?</Text>
                <View style={s.row}>
                  <Pressable onPress={() => setConfirmDel(false)} style={s.keep}>
                    <Text style={s.keepTxt}>Conservar</Text>
                  </Pressable>
                  <Pressable onPress={deleteDetail} style={s.drop}>
                    <Text style={s.dropTxt}>Eliminar</Text>
                  </Pressable>
                </View>
              </View>
            )}
          </View>
        </Pressable>
      ) : null}

      {undo ? <UndoBar message={undo.message} onUndo={async () => { await undo.run(); setUndo(null); }} onDone={() => setUndo(null)} /> : null}
    </SafeAreaView>
  );
}

// ---------- parrilla del día ----------
function DayGrid({ data, date, dragging, setDragging, onDrop, onToggle, onOpen, onEmptyHour, onCreateRange, selecting, picked, togglePick, zoom, setZoom, gutterW, holidays }: {
  data: ReturnType<typeof layoutDay>;
  date: Date;
  dragging: boolean;
  setDragging: (v: boolean) => void;
  onDrop: (b: PlacedBlock, r: DropResult, d: Date) => void;
  onToggle: (t: Task) => void;
  onOpen: (b: PlacedBlock) => void;
  onEmptyHour: (h: number) => void;
  onCreateRange: (start: string, end: string, d: Date) => void;
  selecting: boolean;
  picked: Set<string>;
  togglePick: (k: string) => void;
  zoom: number;
  setZoom: (z: number) => void;
  gutterW: number;
  holidays: Map<string, Holiday>;
}) {
  const s = useThemedStyles(createStyles);
  const scroll = React.useRef<ScrollView>(null);
  const isToday = toLocalKey(date) === toLocalKey(new Date());
  const [now, setNow] = React.useState(() => new Date());
  const jumped = React.useRef(false);
  const prefs = usePrefs();
  const hh = HOUR_H * zoom;
  const rangeH = prefs.dayEnd - prefs.dayStart;
  const [creating, setCreating] = React.useState<{ startMin: number; endMin: number } | null>(null);

  // Zoom por botones (JS puro, sin warnings): pasos 0.5 – 2.
  const STEPS = [0.5, 0.75, 1, 1.5, 2];
  function zoomBy(dir: 1 | -1) {
    const i = STEPS.findIndex((s) => s >= zoom - 0.001);
    const next = STEPS[Math.min(STEPS.length - 1, Math.max(0, i + dir))];
    setZoom(next);
  }

  // Crear arrastrando: mantén una hora vacía, arrastra y suelta.
  // Espejos para el PanResponder clásico (hilo JS: aquí los refs sí valen,
  // este gesto nunca entra a un worklet).
  const creatingRef = React.useRef(creating);
  creatingRef.current = creating;
  const createDateRef = React.useRef(date);
  createDateRef.current = date;
  const createHhRef = React.useRef(hh);
  createHhRef.current = hh;
  const createCbRef = React.useRef({ onCreateRange, setDragging, setCreating });
  createCbRef.current = { onCreateRange, setDragging, setCreating };
  const createPan = React.useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, g) => creatingRef.current !== null && Math.abs(g.dy) > 8,
      onPanResponderMove: (_, g) => {
        const c = creatingRef.current;
        if (!c) return;
        const mins = Math.round(g.dy / (createHhRef.current / 2)) * 30;
        createCbRef.current.setCreating({ ...c, endMin: Math.max(c.startMin + 30, c.startMin + mins) });
      },
      onPanResponderRelease: () => {
        const cb = createCbRef.current;
        cb.setDragging(false);
        const c = creatingRef.current;
        if (c && c.endMin > c.startMin) {
          const sH = `${String(Math.floor(c.startMin / 60)).padStart(2, '0')}:${String(c.startMin % 60).padStart(2, '0')}`;
          const eH = `${String(Math.floor(c.endMin / 60)).padStart(2, '0')}:${String(c.endMin % 60).padStart(2, '0')}`;
          cb.onCreateRange(sH, eH, createDateRef.current);
        }
        cb.setCreating(null);
      },
      onPanResponderTerminate: () => {
        createCbRef.current.setDragging(false);
        createCbRef.current.setCreating(null);
      },
    }),
  ).current;

  // Mueve la línea sola cada minuto.
  React.useEffect(() => {
    if (!isToday) return;
    const t = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(t);
  }, [isToday]);

  const nowMin = now.getHours() * 60 + now.getMinutes();
  const nowTop = ((nowMin - prefs.dayStart * 60) / 60) * hh;
  const nowVisible = isToday && nowMin >= prefs.dayStart * 60 && nowMin < prefs.dayEnd * 60;

  // Al abrir el día actual, baja hasta la hora presente.
  React.useEffect(() => {
    jumped.current = false;
  }, [date]);
  function onLayout() {
    if (nowVisible && !jumped.current) {
      jumped.current = true;
      setTimeout(() => scroll.current?.scrollTo({ y: Math.max(0, nowTop - 220), animated: false }), 100);
    }
  }

  return (
    <ScrollView
      ref={scroll}
      onLayout={onLayout}
      contentContainerStyle={s.body}
      showsVerticalScrollIndicator={false}
      scrollEnabled={!dragging && creating === null}
      onScrollBeginDrag={() => {
        // salvavidas: si algo quedó prendido, al tocar se apaga
        if (creating) {
          setCreating(null);
          setDragging(false);
        }
      }}
    >
      {data.timeless.length > 0 && (
        <View style={s.timeless}>
          {data.timeless.map((b) => (
            <Pressable key={b.key} onPress={() => (selecting ? togglePick(b.key) : onOpen(b))} style={s.chipTask}>
              <View style={s.chipTaskRow}>
                <Icon name={b.icon} size={14} color={colors.text} />
                <Text style={s.chipTxt}>{b.title}</Text>
              </View>
            </Pressable>
          ))}
        </View>
      )}
      {holidays.get(toLocalKey(date)) ? (
        <View style={s.allday}>
          <View style={s.alldayRow}>
            <Icon name="party" size={15} color={colors.text} />
            <Text style={s.alldayTxt}>Todo el día · {holidays.get(toLocalKey(date))!.localName}</Text>
          </View>
        </View>
      ) : null}
      <View style={s.zoomRow}>
        <Pressable onPress={() => zoomBy(-1)} style={s.zoomBtn} accessibilityLabel="Achicar agenda">
          <Icon name="minus" size={18} color={colors.text} />
        </Pressable>
        <Text style={s.zoomLabel}>{Math.round(zoom * 100)}%</Text>
        <Pressable onPress={() => zoomBy(1)} style={s.zoomBtn} accessibilityLabel="Agrandar agenda">
          <Icon name="plus" size={18} color={colors.text} />
        </Pressable>
      </View>
      <View style={[s.grid, { paddingLeft: gutterW }]}>
          {data.lines.map((l) => (
            <Pressable
              key={l.hour}
              onPress={() => {
                if (creating) {
                  // salvavidas: si el modo crear quedó prendido, cualquier tap lo apaga
                  setCreating(null);
                  setDragging(false);
                } else {
                  onEmptyHour(l.hour);
                }
              }}
            onLongPress={() => {
              setCreating({ startMin: l.hour * 60, endMin: l.hour * 60 + 60 });
              setDragging(true);
            }}
            delayLongPress={500}
            style={[s.line, { top: (l.hour - prefs.dayStart) * hh }]}
          >
            <Text style={[s.lineTxt, { width: gutterW - 4 }]}>{l.label}</Text>
          </Pressable>
        ))}
        <View style={[s.blocks, { height: rangeH * hh }]}>
          {creating && (
            <View
              style={[s.preview, {
                top: ((creating.startMin - prefs.dayStart * 60) / 60) * hh,
                height: Math.max(((creating.endMin - creating.startMin) / 60) * hh, 30),
              }]}
              pointerEvents="none"
            />
          )}
          {nowVisible && (
            <View style={[s.now, { top: nowTop }]} pointerEvents="none">
              <View style={s.nowDot} />
              <View style={s.nowLine} />
            </View>
          )}
          {data.blocks.map((b) => (
            <View key={b.key} style={{ opacity: selecting && !picked.has(b.key) ? 0.55 : 1 }}>
              <DraggableBlock
                block={b}
                disabled={creating !== null}
                zoom={zoom}
                onPress={() => (selecting ? togglePick(b.key) : onOpen(b))}
                onToggle={b.kind === 'task' ? () => onToggle(b.raw as Task) : undefined}
                onDragStart={() => setDragging(true)}
                onDragEnd={(r) => { setDragging(false); if (!selecting) onDrop(b, r, date); }}
              />
              {selecting && picked.has(b.key) && (
                <View style={s.pickedTag}>
                  <Icon name="check" size={12} color={colors.onPrimary} strokeWidth={3} />
                </View>
              )}
            </View>
          ))}
        </View>
      </View>
      <Text style={s.swipeHint}>Desliza ↔ cambia día · mantén bloque para mover · mantén hora vacía para crear</Text>
      <View style={{ height: 90 }} />
    </ScrollView>
  );
}

// ---------- vista semana ----------
function WeekGrid({ days, dayData, onOpen, onPickDay, colW, selecting, picked, togglePick, rangeH, hourFormat }: {
  days: Date[];
  dayData: (d: Date) => ReturnType<typeof layoutDay>;
  onOpen: (b: PlacedBlock) => void;
  onPickDay: (d: Date) => void;
  colW: number;
  selecting: boolean;
  picked: Set<string>;
  togglePick: (k: string) => void;
  rangeH: number;
  hourFormat: '24h' | '12h';
}) {
  const s = useThemedStyles(createStyles);
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.weekBody}>
      <View>
        <View style={[s.wHead, { paddingLeft: 44 }]}>
          {days.map((d, i) => (
            <Pressable key={i} onPress={() => onPickDay(d)} style={[s.wColHead, { width: colW }]}>
              <Text style={s.wDow}>{DIAS[d.getDay()]} {d.getDate()}</Text>
            </Pressable>
          ))}
        </View>
        <ScrollView showsVerticalScrollIndicator={false}>
          <View style={s.wGrid}>
            <View>
              {dayData(days[0]).lines.map((l) => (
                <View key={l.hour} style={[s.wLine, { height: HOUR_H }]}>
                  <Text style={s.lineTxt}>{l.label}</Text>
                </View>
              ))}
            </View>
            {days.map((d, i) => {
              const data = dayData(d);
              return (
                <Pressable key={i} onPress={() => onPickDay(d)} style={[s.wCol, { width: colW, height: rangeH * HOUR_H }]}>
                  {data.blocks.map((b) => (
                    <Pressable
                      key={b.key}
                      onPress={() => (selecting ? togglePick(b.key) : onOpen(b))}
                      style={[s.wBlock, { top: b.top, height: Math.max(b.height, 22), left: `${b.leftPct}%`, width: `${b.widthPct}%`, backgroundColor: b.bg, opacity: selecting && !picked.has(b.key) ? 0.55 : 1, borderWidth: selecting && picked.has(b.key) ? 2 : 0, borderColor: colors.primary }]}
                    >
                      <Text style={s.wBlockTxt} numberOfLines={2}>{b.title}</Text>
                    </Pressable>
                  ))}
                </Pressable>
              );
            })}
          </View>
          <View style={{ height: 40 }} />
        </ScrollView>
      </View>
    </ScrollView>
  );
}

// ---------- vista mes ----------
function MonthGrid({ cursor, setCursor, selected, holidays, onPick, counts, detail, onOpen, weekStartsOn }: {
  cursor: Date;
  setCursor: (d: Date) => void;
  selected: Date;
  holidays: Map<string, Holiday>;
  onPick: (d: Date) => void;
  counts: (d: Date) => number;
  detail: ReturnType<typeof layoutDay>;
  onOpen: (b: PlacedBlock) => void;
  weekStartsOn: 'monday' | 'sunday';
}) {
  const s = useThemedStyles(createStyles);
  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const start = startOfWeek(first, weekStartsOn);
  const cells = Array.from({ length: 42 }, (_, i) => addDays(start, i));
  return (
    <ScrollView contentContainerStyle={s.body} showsVerticalScrollIndicator={false}>
      <View style={s.mHead}>
        <Pressable onPress={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))} style={s.nav}>
          <Icon name="chevronLeft" size={20} color={colors.muted} />
        </Pressable>
        <Text style={s.mTitle}>{MESES[cursor.getMonth()]} {cursor.getFullYear()}</Text>
        <Pressable onPress={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))} style={s.nav}>
          <Icon name="chevronRight" size={20} color={colors.muted} />
        </Pressable>
      </View>
      <View style={s.mGrid}>
        {(weekStartsOn === 'sunday' ? ['D', 'L', 'M', 'M', 'J', 'V', 'S'] : ['L', 'M', 'M', 'J', 'V', 'S', 'D']).map((d, i) => (
          <Text key={i} style={s.mDow}>{d}</Text>
        ))}
        {cells.map((d, i) => {
          const inMonth = d.getMonth() === cursor.getMonth();
          const sel = sameDay(d, selected);
          const n = inMonth ? counts(d) : 0;
          const hol = inMonth ? holidays.get(toLocalKey(d)) : undefined;
          return (
            <Pressable key={i} onPress={() => onPick(d)} style={[s.mCell, sel && s.mSel]}>
              <Text style={[s.mNum, !inMonth && s.mOut, sel && s.on]}>{d.getDate()}</Text>
              {n > 0 && <View style={s.dot} />}
              {hol ? <View style={[s.dot, s.holDot]} /> : null}
            </Pressable>
          );
        })}
      </View>
      <Text style={s.detailTitle}>
        {DIAS[selected.getDay()]} {selected.getDate()} · {detail.blocks.length + detail.timeless.length} actividades
      </Text>
      {[...detail.timeless, ...detail.blocks].map((b) => (
        <Pressable key={b.key} onPress={() => onOpen(b)} style={[s.mItem, { backgroundColor: b.bg || colors.card }]}>
          <Text style={s.mItemTitle}>{b.title}</Text>
          <Text style={s.mItemSub}>{b.timeLabel}</Text>
        </Pressable>
      ))}
      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 8 },
  title: { fontSize: 24, fontWeight: '900', color: colors.text },
  sub: { fontSize: 13, color: colors.muted },
  allday: { backgroundColor: colors.coralBg, borderRadius: 12, padding: 10, marginBottom: 8, borderWidth: 1, borderColor: colors.coral },
  alldayRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  alldayTxt: { fontWeight: '800', color: colors.coral, fontSize: 13 },
  today: { borderWidth: 1, borderColor: colors.line, borderRadius: 99, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: colors.card },
  todayTxt: { fontWeight: '800', color: colors.text, fontSize: 12 },
  iconRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  filterDot: { width: 5, height: 5, borderRadius: 99 },
  sheetBg: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end', zIndex: 50 },
  sheet: { backgroundColor: colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, gap: 12 },
  sheetT: { fontWeight: '900', fontSize: 18, color: colors.text },
  sheetT2: { fontWeight: '800', fontSize: 13, color: colors.muted, marginTop: 4 },
  seg: { flexDirection: 'row', backgroundColor: colors.bgSoft, borderRadius: 99, padding: 4 },
  segOpt: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 99 },
  segOn: { backgroundColor: colors.card, elevation: 2, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 4 },
  segTxt: { fontWeight: '700', color: colors.muted, fontSize: 13 },
  segTxtOn: { color: colors.text },
  sheetOpt: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.bg, borderRadius: 16, padding: 14 },
  sheetOn: { borderWidth: 2, borderColor: colors.primary },
  sheetIcon: { fontSize: 24, color: colors.text },
  sheetTitle: { fontWeight: '800', color: colors.text, fontSize: 16 },
  sheetTitleOn: { color: colors.link },
  sheetSub: { color: colors.muted, fontSize: 12 },
  filterTypeRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  typeDot: { width: 8, height: 8, borderRadius: 99, backgroundColor: colors.primary },
  selOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  selOnTxt: { color: colors.onPrimary },
  filters: { paddingHorizontal: 16, marginBottom: 8, height: 40 },
  fchip: { borderWidth: 1, borderColor: colors.line, borderRadius: 99, paddingHorizontal: 14, paddingVertical: 7, backgroundColor: colors.card, marginRight: 8, justifyContent: 'center' },
  fchipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  fchipTxt: { fontWeight: '700', color: colors.text, fontSize: 12 },
  fchipTxtOn: { color: colors.onPrimary },
  bulk: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, marginBottom: 8, backgroundColor: colors.card, borderRadius: 14, padding: 10, borderWidth: 1, borderColor: colors.line },
  bulkTxt: { flex: 1, fontWeight: '800', color: colors.text },
  bulkBtn: { backgroundColor: colors.green, borderRadius: 99, paddingHorizontal: 14, paddingVertical: 8 },
  bulkDel: { backgroundColor: colors.danger },
  bulkBtnTxt: { color: colors.onAccent, fontWeight: '800', fontSize: 12 },
  dRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  dBtn: { flex: 1, backgroundColor: colors.primary, borderRadius: 14, padding: 14, alignItems: 'center' },
  dCopy: { backgroundColor: colors.blue },
  dCopyTxt: { color: colors.onAccent },
  dBtnTxt: { color: colors.onPrimary, fontWeight: '800' },
  dDel: { padding: 12, alignItems: 'center' },
  dDelTxt: { color: colors.danger, fontWeight: '700' },
  dConfirm: { backgroundColor: colors.bg, borderRadius: 14, padding: 12 },
  dCheck: { marginTop: 8, borderWidth: 1, borderColor: colors.green, borderRadius: 12, padding: 12, alignItems: 'center' },
  dCheckTxt: { fontWeight: '800', color: colors.green },
  dConfirmT: { fontWeight: '800', color: colors.text, marginBottom: 10 },
  keep: { flex: 1, backgroundColor: colors.primary, borderRadius: 12, padding: 12, alignItems: 'center' },
  keepTxt: { color: colors.onPrimary, fontWeight: '800' },
  drop: { flex: 1, padding: 12, alignItems: 'center' },
  dropTxt: { color: colors.danger, fontWeight: '800' },
  pickedTag: { position: 'absolute', top: -8, right: 0, width: 24, height: 24, borderRadius: 12, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', zIndex: 20 },
  pickedTxt: { color: colors.onPrimary, fontWeight: '900', fontSize: 12 },
  preview: { position: 'absolute', left: 0, right: 4, backgroundColor: '#6B9ECF55', borderWidth: 2, borderColor: colors.blue, borderRadius: 12, zIndex: 15 },
  add: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  addTxt: { color: colors.onPrimary, fontSize: 26 },
  tabs: { flexDirection: 'row', marginHorizontal: 16, backgroundColor: colors.bgSoft, borderRadius: 99, padding: 4, marginBottom: 8 },
  tab: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 99 },
  tabOn: { backgroundColor: colors.card, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 4, elevation: 2 },
  tabTxt: { fontWeight: '700', color: colors.muted, fontSize: 13 },
  tabTxtOn: { color: colors.text },
  weekRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, marginBottom: 4 },
  nav: { paddingHorizontal: 10, paddingVertical: 6 },
  navTxt: { fontSize: 24, color: colors.muted, fontWeight: '700' },
  week: { flex: 1, flexDirection: 'row', gap: 2 },
  row: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  day: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 14 },
  dayOn: { backgroundColor: colors.primary },
  dow: { fontSize: 10, color: colors.muted, fontWeight: '700' },
  num: { fontSize: 15, fontWeight: '800', color: colors.text },
  on: { color: colors.onPrimary },
  body: { padding: 16, paddingTop: 4 },
  timeless: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  chipTask: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, borderRadius: 99, paddingHorizontal: 12, paddingVertical: 8 },
  chipTaskRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  chipTxt: { fontWeight: '700', color: colors.text, fontSize: 12 },
  grid: { position: 'relative', paddingLeft: 44 },
  line: { position: 'absolute', left: 0, right: 0, height: HOUR_H, borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 2 },
  lineTxt: { fontSize: 11, color: colors.muted, fontWeight: '700', width: 40 },
  blocks: { position: 'relative' },
  now: { position: 'absolute', left: 0, right: 0, flexDirection: 'row', alignItems: 'center', zIndex: 5, opacity: 0.85 },
  nowDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.danger, marginLeft: 38 },
  nowLine: { flex: 1, height: 1.5, backgroundColor: colors.danger },
  swipeHint: { textAlign: 'center', color: colors.muted, fontSize: 11, marginTop: 10 },
  zoomRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 8, marginBottom: 6 },
  zoomBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  zoomTxt: { fontSize: 18, fontWeight: '800', color: colors.text },
  zoomLabel: { fontSize: 12, fontWeight: '700', color: colors.muted, minWidth: 40, textAlign: 'center' },
  weekBody: { padding: 12 },
  wHead: { flexDirection: 'row' },
  wColHead: { width: 110, alignItems: 'center', paddingVertical: 6 },
  wDow: { fontWeight: '800', color: colors.text, fontSize: 12 },
  wGrid: { flexDirection: 'row' },
  wLine: { width: 44, borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 2 },
  wCol: { width: 110, borderLeftWidth: 1, borderLeftColor: colors.line, position: 'relative' },
  wBlock: { position: 'absolute', borderRadius: 8, padding: 4 },
  wBlockTxt: { fontSize: 10, fontWeight: '700', color: colors.text },
  mHead: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  mTitle: { flex: 1, textAlign: 'center', fontWeight: '900', fontSize: 17, color: colors.text, textTransform: 'capitalize' },
  mGrid: { flexDirection: 'row', flexWrap: 'wrap', backgroundColor: colors.card, borderRadius: 18, padding: 8, borderWidth: 1, borderColor: colors.line },
  mDow: { width: '14.28%', textAlign: 'center', fontWeight: '800', color: colors.muted, fontSize: 11, paddingVertical: 4 },
  mCell: { width: '14.28%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 12 },
  mSel: { backgroundColor: colors.primary },
  mNum: { fontWeight: '700', color: colors.text },
  mOut: { color: colors.line },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.accent, marginTop: 2 },
  holDot: { backgroundColor: colors.danger },
  detailTitle: { fontWeight: '800', color: colors.text, marginTop: 14, marginBottom: 8, textTransform: 'capitalize' },
  mItem: { borderRadius: 12, padding: 12, marginBottom: 8 },
  mItemTitle: { fontWeight: '800', color: colors.text },
  mItemSub: { fontSize: 12, color: colors.muted },
});
}
