// Enrutador del modo invitado: imita `backend/src/app.ts` sobre SQLite.
//
// Cada ruta devuelve el mismo JSON que el servidor, así que las pantallas y los
// servicios (`tasks.ts`, `events.ts`, …) no saben si hablan con la nube o con el
// teléfono. Los errores usan `ApiError` con el mismo `status` y mensajes en español.
import { ApiError } from '../errors';
import { getGuestUser } from '../guestProfile';
import { parsePath } from './query';
import * as tasks from './tasks';
import * as events from './events';
import * as incomes from './incomes';
import * as expenses from './expenses';
import * as goals from './goals';
import * as contacts from './contacts';
import * as places from './places';
import * as catalog from './catalog';
import * as stats from './stats';
import * as auth from './auth';

function bodyOf(opts: RequestInit): Record<string, unknown> {
  if (typeof opts.body !== 'string' || !opts.body) return {};
  try {
    const parsed = JSON.parse(opts.body) as unknown;
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function idOf(parts: string[], index: number): string {
  const raw = parts[index];
  if (!raw) throw new ApiError(404, 'Ruta no encontrada');
  return raw;
}

function check(method: string, ...allowed: string[]): void {
  if (!allowed.includes(method)) throw new ApiError(405, 'Método no permitido');
}

export async function localRequest<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const method = String(opts.method ?? 'GET').toUpperCase();
  const body = bodyOf(opts);
  const { parts, q } = parsePath(path);
  if (parts[0] !== 'api') throw new ApiError(404, 'Ruta no encontrada');

  const resource = parts[1];
  const rest = parts.slice(2);

  // ── Sesión (perfil del invitado) ──────────────────────────────────────────
  if (resource === 'auth') {
    if (rest[0] === 'me') {
      check(method, 'GET', 'PATCH');
      return (method === 'GET' ? await auth.me() : await auth.updateMe(body)) as T;
    }
    if (rest[0] === 'account') {
      check(method, 'DELETE');
      return (await auth.deleteAccount(body)) as T;
    }
    if (rest[0] === 'password') {
      check(method, 'PATCH');
      return (await auth.changePassword()) as T;
    }
    throw new ApiError(400, 'El modo invitado no usa inicio de sesión.');
  }

  // ── Escáner: requiere servidor ────────────────────────────────────────────
  if (resource === 'scanner') {
    if (rest[0] === 'ai') return { enabled: false, provider: null } as T;
    throw new ApiError(
      503,
      'El escáner necesita conexión y una cuenta. Mientras tanto puedes crear eventos a mano.',
    );
  }

  // ── Tareas ────────────────────────────────────────────────────────────────
  if (resource === 'tasks') {
    if (rest.length === 0) {
      check(method, 'GET', 'POST');
      return (method === 'GET' ? await tasks.listTasks(q) : await tasks.createTask(body)) as T;
    }
    const id = idOf(rest, 0);
    check(method, 'GET', 'PATCH', 'DELETE');
    if (method === 'GET') return (await tasks.getTask(id)) as T;
    if (method === 'PATCH') return (await tasks.updateTask(id, body)) as T;
    return (await tasks.deleteTask(id)) as T;
  }

  // ── Eventos ───────────────────────────────────────────────────────────────
  if (resource === 'events') {
    if (rest.length === 0) {
      check(method, 'GET', 'POST');
      return (method === 'GET' ? await events.listEvents(q) : await events.createEvent(body)) as T;
    }
    const id = idOf(rest, 0);
    check(method, 'GET', 'PATCH', 'DELETE');
    if (method === 'GET') return (await events.getEvent(id)) as T;
    if (method === 'PATCH') return (await events.updateEvent(id, body)) as T;
    return (await events.deleteEvent(id)) as T;
  }

  // ── Ingresos y gastos ─────────────────────────────────────────────────────
  if (resource === 'incomes') {
    if (rest.length === 0) {
      check(method, 'GET', 'POST');
      return (method === 'GET' ? await incomes.listIncomes(q) : await incomes.createIncome(body)) as T;
    }
    const id = idOf(rest, 0);
    check(method, 'GET', 'PATCH', 'DELETE');
    if (method === 'GET') return (await incomes.getIncome(id)) as T;
    if (method === 'PATCH') return (await incomes.updateIncome(id, body)) as T;
    return (await incomes.deleteIncome(id)) as T;
  }

  if (resource === 'expenses') {
    if (rest.length === 0) {
      check(method, 'GET', 'POST');
      return (method === 'GET' ? await expenses.listExpenses(q) : await expenses.createExpense(body)) as T;
    }
    const id = idOf(rest, 0);
    check(method, 'GET', 'PATCH', 'DELETE');
    if (method === 'GET') return (await expenses.getExpense(id)) as T;
    if (method === 'PATCH') return (await expenses.updateExpense(id, body)) as T;
    return (await expenses.deleteExpense(id)) as T;
  }

  if (resource === 'finance' && rest[0] === 'summary') {
    check(method, 'GET');
    return (await stats.financeSummary(q)) as T;
  }

  // ── Metas ─────────────────────────────────────────────────────────────────
  if (resource === 'goals') {
    if (rest.length === 0) {
      check(method, 'GET', 'POST');
      return (method === 'GET' ? await goals.listGoals(q) : await goals.createGoal(body)) as T;
    }
    if (rest[0] === 'progress') {
      check(method, 'GET');
      const profile = await getGuestUser();
      return (await goals.goalsProgress(q, profile.weekStartsOn)) as T;
    }
    if (rest[0] === 'logs') {
      check(method, 'DELETE');
      return (await goals.deleteGoalLog(idOf(rest, 1))) as T;
    }
    const id = idOf(rest, 0);
    if (rest[1] === 'log') {
      check(method, 'POST');
      return (await goals.addGoalLog(id, body)) as T;
    }
    if (rest[1] === 'logs') {
      check(method, 'GET');
      return (await goals.listGoalLogs(id)) as T;
    }
    check(method, 'GET', 'PATCH', 'DELETE');
    if (method === 'GET') {
      const all = await goals.listGoals({});
      const found = all.goals.find((g) => g.id === id);
      if (!found) throw new ApiError(404, 'Meta no encontrada');
      return { goal: found } as T;
    }
    if (method === 'PATCH') return (await goals.updateGoal(id, body)) as T;
    return (await goals.deleteGoal(id)) as T;
  }

  // ── Contactos ─────────────────────────────────────────────────────────────
  if (resource === 'contacts') {
    if (rest.length === 0) {
      check(method, 'GET', 'POST');
      return (method === 'GET' ? await contacts.listContacts(q) : await contacts.createContact(body)) as T;
    }
    const id = idOf(rest, 0);
    if (rest[1] === 'touch') {
      check(method, 'POST');
      return (await contacts.touchContact(id)) as T;
    }
    check(method, 'GET', 'PATCH', 'DELETE');
    if (method === 'GET') return (await contacts.getContact(id)) as T;
    if (method === 'PATCH') return (await contacts.updateContact(id, body)) as T;
    return (await contacts.deleteContact(id)) as T;
  }

  if (resource === 'contact-categories') {
    if (rest.length === 0) {
      check(method, 'GET', 'POST');
      return (method === 'GET'
        ? await catalog.listContactCategories()
        : await catalog.createContactCategory(body)) as T;
    }
    check(method, 'DELETE');
    return (await catalog.deleteContactCategory(idOf(rest, 0))) as T;
  }

  if (resource === 'expense-categories') {
    if (rest.length === 0) {
      check(method, 'GET', 'POST');
      return (method === 'GET'
        ? await catalog.listExpenseCategories()
        : await catalog.createExpenseCategory(body)) as T;
    }
    check(method, 'DELETE');
    return (await catalog.deleteExpenseCategory(idOf(rest, 0))) as T;
  }

  // ── Lugares y mapa ────────────────────────────────────────────────────────
  if (resource === 'places') {
    if (rest[0] === 'map' && rest[1] === 'items') {
      check(method, 'GET');
      return (await places.mapItems(q)) as T;
    }
    if (rest.length === 0) {
      check(method, 'GET', 'POST');
      return (method === 'GET' ? await places.listPlaces(q) : await places.createPlace(body)) as T;
    }
    const id = idOf(rest, 0);
    check(method, 'GET', 'PATCH', 'DELETE');
    if (method === 'GET') return (await places.getPlace(id)) as T;
    if (method === 'PATCH') return (await places.updatePlace(id, body)) as T;
    return (await places.deletePlace(id)) as T;
  }

  // ── Ajustes genéricos ─────────────────────────────────────────────────────
  if (resource === 'settings') {
    const key = idOf(rest, 0);
    check(method, 'GET', 'PUT');
    if (method === 'GET') return (await catalog.getSetting(key)) as T;
    return (await catalog.putSetting(key, body.value)) as T;
  }

  // ── Estadísticas ──────────────────────────────────────────────────────────
  if (resource === 'stats') {
    check(method, 'GET');
    const profile = await getGuestUser();
    if (rest[0] === 'overview') return (await stats.statsOverview(q, profile.weekStartsOn)) as T;
    if (rest[0] === 'expenses-by-category') {
      return (await stats.expensesByCategory(q, profile.weekStartsOn)) as T;
    }
    throw new ApiError(404, 'Ruta no encontrada');
  }

  throw new ApiError(404, 'Ruta no encontrada');
}
