// Prueba de la capa local del modo invitado sin teléfono.
//
// Usa `node:sqlite` (Node 22+) como motor y un adaptador con la misma forma que
// expo-sqlite. Ejercita SQL real: esquema, filtros por rango, totales, metas y
// estadísticas. No toca React Native.
//
//   cd mobile; npm run test:local
import { DatabaseSync } from 'node:sqlite';
import { __injectDatabase, SCHEMA_SQL, countLocalRows } from '../src/services/local/db';
import * as tasks from '../src/services/local/tasks';
import * as events from '../src/services/local/events';
import * as incomes from '../src/services/local/incomes';
import * as expenses from '../src/services/local/expenses';
import * as goals from '../src/services/local/goals';
import * as contacts from '../src/services/local/contacts';
import * as places from '../src/services/local/places';
import * as catalog from '../src/services/local/catalog';
import * as stats from '../src/services/local/stats';

type Bind = string | number | null;

class NodeDb {
  private raw: DatabaseSync;
  constructor() {
    this.raw = new DatabaseSync(':memory:');
  }
  async execAsync(sql: string) {
    this.raw.exec(sql);
  }
  async runAsync(sql: string, params: Bind[] = []) {
    this.raw.prepare(sql).run(...params);
  }
  async getAllAsync(sql: string, params: Bind[] = []) {
    return this.raw.prepare(sql).all(...params) as never;
  }
  async getFirstAsync(sql: string, params: Bind[] = []) {
    return (this.raw.prepare(sql).get(...params) ?? null) as never;
  }
  async withTransactionAsync(fn: () => Promise<void>) {
    this.raw.exec('BEGIN');
    try {
      await fn();
      this.raw.exec('COMMIT');
    } catch (e) {
      this.raw.exec('ROLLBACK');
      throw e;
    }
  }
}

let passed = 0;
const failures: string[] = [];

function check(name: string, cond: boolean, detail?: unknown) {
  if (cond) {
    passed += 1;
    return;
  }
  failures.push(`${name}${detail === undefined ? '' : ` → ${JSON.stringify(detail)}`}`);
}

function eq(name: string, actual: unknown, expected: unknown) {
  check(name, Object.is(actual, expected), { actual, expected });
}

async function expectError(name: string, fn: () => Promise<unknown>, status: number) {
  try {
    await fn();
    failures.push(`${name} → no lanzó error`);
  } catch (e) {
    const s = (e as { status?: number }).status;
    check(`${name} (status ${status})`, s === status, { actual: s, message: String(e) });
  }
}

function dayIso(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function dayRange(offsetDays = 0): { from: string; to: string } {
  const from = new Date(dayIso(offsetDays));
  const to = new Date(from);
  to.setHours(23, 59, 59, 999);
  return { from: from.toISOString(), to: to.toISOString() };
}

async function main() {
  const db = new NodeDb();
  await db.execAsync(SCHEMA_SQL);
  __injectDatabase(db);

  const today = dayRange();
  const yesterday = dayRange(-1);

  // ── Tareas ────────────────────────────────────────────────────────────────
  const { task } = await tasks.createTask({
    title: '  Comprar pan  ',
    date: today.from,
    time: '09:30',
    priority: 'alta',
    category: 'Casa',
    status: 'pendiente',
  });
  eq('tarea: id generado', task.id.startsWith('c'), true);
  eq('tarea: título recortado', task.title, 'Comprar pan');
  eq('tarea: prioridad', task.priority, 'alta');

  const inRange = await tasks.listTasks({ from: today.from, to: today.to });
  eq('tarea: aparece en el día', inRange.tasks.length, 1);
  const outRange = await tasks.listTasks({ from: yesterday.from, to: yesterday.to });
  eq('tarea: no aparece ayer', outRange.tasks.length, 0);

  await tasks.updateTask(task.id, { status: 'completada', time: null });
  const done = await tasks.getTask(task.id);
  eq('tarea: actualizada', done.task.status, 'completada');
  eq('tarea: hora borrada', done.task.time, null);

  await expectError('tarea: get inexistente', () => tasks.getTask('nope'), 404);
  await expectError('tarea: título vacío', () => tasks.createTask({ title: '   ', date: today.from }), 400);

  // ── Contactos ─────────────────────────────────────────────────────────────
  const { contact } = await contacts.createContact({
    firstName: 'Ana',
    lastName: 'Quispe',
    category: 'Clientes',
    phone: '999111222',
    nextContactAt: yesterday.from,
  });
  eq('contacto: nombre', contact.firstName, 'Ana');

  const overdue = await contacts.listContacts({ followup: 'overdue' });
  eq('contacto: seguimiento vencido', overdue.contacts.length, 1);
  const upcoming = await contacts.listContacts({ followup: 'today' });
  eq('contacto: sin seguimiento hoy', upcoming.contacts.length, 0);

  const searched = await contacts.listContacts({ q: 'quis' });
  eq('contacto: búsqueda sin distinguir mayúsculas', searched.contacts.length, 1);

  await contacts.touchContact(contact.id);
  const touched = await contacts.getContact(contact.id);
  check('contacto: touch marca último contacto', !!touched.contact.lastContactAt);
  eq('contacto: touch limpia próximo', touched.contact.nextContactAt, null);

  // ── Ingresos ──────────────────────────────────────────────────────────────
  const { income } = await incomes.createIncome({
    title: 'Diseño',
    date: today.from,
    quantity: 2,
    unitPrice: 50,
    clientId: contact.id,
    payMethod: 'Yape',
  });
  eq('ingreso: total calculado', income.total, 100);
  eq('ingreso: cliente enlazado', income.client?.firstName, 'Ana');

  const incomeList = await incomes.listIncomes({ from: today.from, to: today.to });
  eq('ingreso: total del período', incomeList.total, 100);

  await incomes.updateIncome(income.id, { quantity: 3 });
  const income2 = await incomes.getIncome(income.id);
  eq('ingreso: total recalculado', income2.income.total, 150);

  await expectError('ingreso: cliente ajeno', () => incomes.createIncome({
    title: 'X', date: today.from, unitPrice: 1, clientId: 'nope',
  }), 403);

  // ── Gastos ────────────────────────────────────────────────────────────────
  await expenses.createExpense({ title: 'Taxi', date: today.from, amount: 12.5, category: 'Transporte' });
  await expenses.createExpense({ title: 'Almuerzo', date: today.from, amount: 20, category: 'Alimentación', kind: 'fijo' });
  const expenseList = await expenses.listExpenses({ from: today.from, to: today.to });
  eq('gasto: total', expenseList.total, 32.5);
  const grouped = await stats.expensesByCategory({ period: 'day' });
  eq('gasto: categoría mayor primero', grouped.categories[0]?.name, 'Alimentación');
  eq('gasto: porcentaje', grouped.categories[0]?.pct, 62);

  // ── Eventos ───────────────────────────────────────────────────────────────
  const { event } = await events.createEvent({
    title: 'Reunión',
    type: 'Reunión',
    isBackup: false,
    date: today.from,
    startTime: '10:00',
    endTime: '11:30',
    notifyMins: 30,
    repeat: 'weekly',
    contactIds: [contact.id],
  });
  eq('evento: contacto adjunto', event.contacts?.[0]?.firstName, 'Ana');
  const eventList = await events.listEvents({ from: today.from, to: today.to });
  eq('evento: en el día', eventList.events.length, 1);
  eq('evento: repeated', eventList.events[0].repeat, 'weekly');

  await events.updateEvent(event.id, { done: true, contactIds: [], repeatUntil: null });
  const event2 = await events.getEvent(event.id);
  eq('evento: hecho', event2.event.done, true);
  eq('evento: contactos quitados', event2.event.contacts?.length, 0);

  // El backend valida solo el formato HH:MM (regex), no el rango; se replica igual.
  await expectError('evento: formato de hora inválido', () => events.createEvent({
    title: 'X', date: today.from, startTime: '9:00', endTime: '10:00',
  }), 400);

  // ── Metas ─────────────────────────────────────────────────────────────────
  const { goal: custom } = await goals.createGoal({
    title: 'Leer', kind: 'custom', period: 'day', target: 10, unit: 'pág', current: 2,
  });
  await goals.addGoalLog(custom.id, { amount: 3 });
  const progress = await goals.goalsProgress({ date: today.from }, 'monday');
  const customProgress = progress.goals.find((g) => g.id === custom.id);
  eq('meta: base + manual', customProgress?.current, 5);
  eq('meta: porcentaje', customProgress?.pct, 50);

  const { goal: salesGoal } = await goals.createGoal({
    title: 'Vender', kind: 'ingresos', period: 'day', target: 300, unit: 'S/',
  });
  const progress2 = await goals.goalsProgress({ date: today.from, status: 'all' }, 'monday');
  const salesProgress = progress2.goals.find((g) => g.id === salesGoal.id);
  eq('meta: avance automático por ingresos', salesProgress?.current, 150);
  eq('meta: detalle', salesProgress?.source.includes('ingreso'), true);

  await goals.deleteGoal(custom.id);
  await expectError('meta: borrada', () => goals.updateGoal(custom.id, { title: 'x' }), 404);

  // ── Lugares y mapa ────────────────────────────────────────────────────────
  const { place } = await places.createPlace({
    name: 'Oficina', category: 'Trabajo', latitude: -12.04, longitude: -77.03,
  });
  const map = await places.mapItems({});
  eq('mapa: lugar presente', map.items.length, 1);
  eq('mapa: color por categoría', map.items[0].color, '#6B9ECF');

  await events.createEvent({
    title: 'Visita', date: today.from, startTime: '15:00', endTime: '16:00', placeId: place.id,
  });
  await places.deletePlace(place.id);
  const orphan = await db.getAllAsync('SELECT placeId FROM events WHERE title = ?', ['Visita']);
  eq('lugar: eventos quedan sin lugar', (orphan as { placeId: string | null }[])[0].placeId, null);

  // ── Ajustes y categorías ──────────────────────────────────────────────────
  await catalog.putSetting('eventTypes', [{ name: 'Clase', color: '#123456' }]);
  const setting = await catalog.getSetting('eventTypes');
  eq('ajuste: ida y vuelta', (setting.value as { name: string }[])[0].name, 'Clase');

  const cats = await catalog.listContactCategories();
  eq('categorías: 6 del sistema', cats.categories.length, 6);
  await catalog.createContactCategory({ name: 'Vecinos', color: '#abcdef' });
  const cats2 = await catalog.listContactCategories();
  eq('categorías: personalizada agregada', cats2.categories.length, 7);
  await expectError('categoría: en uso', () => catalog.deleteContactCategory('Clientes'), 400);

  // ── Estadísticas y finanzas ───────────────────────────────────────────────
  const overview = await stats.statsOverview({ period: 'day' });
  eq('resumen: ingresos', overview.incomes, 150);
  eq('resumen: gastos', overview.expenses, 32.5);
  eq('resumen: neto', overview.net, 117.5);
  eq('resumen: tareas hechas', overview.tasksDone, 1);
  eq('resumen: horas de eventos', overview.hours, 2.5);
  check('resumen: productividad 0-100', overview.productivity >= 0 && overview.productivity <= 100, overview.productivity);

  const finance = await stats.financeSummary({ from: today.from, to: today.to });
  eq('finanzas: conteo ingresos', finance.incomesCount, 1);
  eq('finanzas: conteo gastos', finance.expensesCount, 2);
  eq('finanzas: neto', finance.net, 117.5);

  // ── Integridad ────────────────────────────────────────────────────────────
  const rows = await countLocalRows();
  check('datos: filas contadas', rows > 0, rows);

  // Un contacto con ingresos no se puede borrar.
  await expectError('contacto: con ingresos', () => contacts.deleteContact(contact.id), 400);

  await events.deleteEvent(event.id);
  await expectError('evento: borrado', () => events.getEvent(event.id), 404);

  console.log(`\n${passed} comprobaciones OK`);
  if (failures.length) {
    console.error(`\n${failures.length} FALLARON:`);
    for (const f of failures) console.error(` - ${f}`);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error('Error en la prueba:', e);
  process.exit(1);
});
