import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import type { Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/db';
import type { AuthedRequest } from '../middleware/auth';

// Importación de los datos creados en modo invitado (SQLite del teléfono).
//
// Reglas:
//   - Todo entra en **una transacción**: o se sube completo o no se sube nada.
//   - Los ids del teléfono **no** se reutilizan: se generan ids nuevos y se
//     reescriben las referencias (contactos de eventos, cliente de ingresos,
//     meta de tareas/eventos, registros de metas). Así un cliente no puede
//     pisar ni adivinar filas de otra cuenta.
//   - `batchId` da idempotencia: si el móvil reintenta tras un timeout, el
//     segundo envío no duplica nada.
//   - Los ajustes (tipos de evento/plantillas) solo se crean si la cuenta aún
//     no los tiene: la cuenta manda y nunca se sobrescribe lo que ya usa.

const LIMIT = 3000; // por colección
const MAX_TOTAL = 8000; // por envío completo
const MAX_SETTING_KEYS = ['eventTypes', 'templates'];

const iso = z.string().datetime();
const optIso = iso.nullish();
const optStr = (max: number) => z.string().max(max).nullish();

const contactIn = z.object({
  id: z.string().min(1).max(64),
  firstName: z.string().min(1).max(80),
  lastName: optStr(80),
  phone: optStr(30),
  whatsapp: optStr(30),
  email: optStr(120),
  address: optStr(200),
  latitude: z.number().min(-90).max(90).nullish(),
  longitude: z.number().min(-180).max(180).nullish(),
  category: z.string().max(40).nullish(),
  notes: optStr(1000),
  lastContactAt: optIso,
  nextContactAt: optIso,
  createdAt: optIso,
});

const placeIn = z.object({
  id: z.string().min(1).max(64),
  name: z.string().min(1).max(120),
  category: z.string().max(40).nullish(),
  address: optStr(200),
  latitude: z.number().min(-90).max(90).nullish(),
  longitude: z.number().min(-180).max(180).nullish(),
  note: optStr(500),
  color: optStr(9),
});

const goalIn = z.object({
  id: z.string().min(1).max(64),
  title: z.string().min(1).max(120),
  kind: z.enum(['ingresos', 'contactos', 'tareas', 'horas', 'veces', 'custom']).catch('custom'),
  filter: optStr(40),
  members: z.array(z.string()).max(100).nullish(),
  period: z.enum(['day', 'week', 'month']).catch('day'),
  target: z.number().positive(),
  current: z.number().min(0).nullish(),
  unit: z.string().max(10).nullish(),
  deadline: optIso,
  status: z.enum(['activa', 'pausada', 'completada']).catch('activa'),
  createdAt: optIso,
});

const taskIn = z.object({
  id: z.string().min(1).max(64),
  title: z.string().min(1).max(120),
  date: iso,
  time: optStr(5),
  priority: z.enum(['baja', 'media', 'alta']).catch('media'),
  category: z.string().max(40).nullish(),
  description: optStr(1000),
  status: z.enum(['pendiente', 'en_progreso', 'completada']).catch('pendiente'),
  contactId: optStr(64),
  goalId: optStr(64),
  createdAt: optIso,
});

const eventIn = z.object({
  id: z.string().min(1).max(64),
  title: z.string().min(1).max(120),
  type: z.string().max(40).nullish(),
  color: optStr(9),
  isBackup: z.boolean().nullish(),
  date: iso,
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  location: optStr(200),
  placeId: optStr(64),
  description: optStr(1000),
  notifyMins: z.number().int().min(0).max(10080).nullish(),
  repeat: z
    .enum([
      'none',
      'daily',
      'weekly',
      'monthly',
      'mon_wed',
      'tue_thu',
      'mon_wed_fri',
      'weekdays',
      'weekends',
    ])
    .catch('none'),
  repeatUntil: optIso,
  goalId: optStr(64),
  done: z.boolean().nullish(),
  contactIds: z.array(z.string().max(64)).max(100).nullish(),
});

const incomeIn = z.object({
  id: z.string().min(1).max(64),
  title: z.string().min(1).max(120),
  date: iso,
  category: z.string().max(40).nullish(),
  quantity: z.number().positive().nullish(),
  unitPrice: z.number().min(0),
  clientId: optStr(64),
  payMethod: z
    .enum(['Efectivo', 'Yape', 'Plin', 'Tarjeta', 'Transferencia', 'Otro'])
    .catch('Efectivo'),
  note: optStr(500),
  createdAt: optIso,
});

const expenseIn = z.object({
  id: z.string().min(1).max(64),
  title: z.string().min(1).max(120),
  date: iso,
  category: z.string().max(40).nullish(),
  amount: z.number().min(0),
  kind: z.enum(['fijo', 'variable']).catch('variable'),
  note: optStr(500),
  createdAt: optIso,
});

const goalLogIn = z.object({
  goalId: z.string().min(1).max(64),
  date: optIso,
  amount: z.number().positive(),
  note: optStr(200),
});

const categoryIn = z.object({
  name: z.string().min(1).max(40),
  color: optStr(9),
});

const importSchema = z.object({
  batchId: z.string().uuid(),
  contacts: z.array(contactIn).max(LIMIT).optional().default([]),
  places: z.array(placeIn).max(LIMIT).optional().default([]),
  goals: z.array(goalIn).max(LIMIT).optional().default([]),
  tasks: z.array(taskIn).max(LIMIT).optional().default([]),
  events: z.array(eventIn).max(LIMIT).optional().default([]),
  incomes: z.array(incomeIn).max(LIMIT).optional().default([]),
  expenses: z.array(expenseIn).max(LIMIT).optional().default([]),
  goalLogs: z.array(goalLogIn).max(LIMIT).optional().default([]),
  contactCategories: z.array(categoryIn).max(100).optional().default([]),
  expenseCategories: z.array(categoryIn).max(100).optional().default([]),
  settings: z
    .array(z.object({ key: z.string().max(40), value: z.unknown() }))
    .max(20)
    .optional()
    .default([]),
});

type ImportBody = z.infer<typeof importSchema>;

const round2 = (n: number) => Math.round(n * 100) / 100;

// Prisma nombra la tabla puente implícita Event↔Contact `_EventContacts`
// (A = Contact.id, B = Event.id). Se comprueba una vez por proceso y se cachea.
let joinTable: boolean | null = null;
async function hasEventContactsTable(tx: Prisma.TransactionClient): Promise<boolean> {
  if (joinTable !== null) return joinTable;
  const rows = await tx.$queryRaw<{ exists: boolean }[]>`
    SELECT to_regclass('"_EventContacts"') IS NOT NULL AS "exists"
  `;
  joinTable = rows[0]?.exists === true;
  return joinTable;
}

// POST /api/import — sube el lote del invitado a la cuenta del token.
export async function importData(req: AuthedRequest, res: Response) {
  const body: ImportBody = importSchema.parse(req.body);
  const userId = req.userId!;

  const total =
    body.contacts.length +
    body.places.length +
    body.goals.length +
    body.tasks.length +
    body.events.length +
    body.incomes.length +
    body.expenses.length +
    body.goalLogs.length;

  if (total > MAX_TOTAL) {
    return res.status(413).json({
      error: `Demasiados registros para una sola importación (${total}). El máximo es ${MAX_TOTAL}.`,
    });
  }

  const result = await prisma.$transaction(
    async (tx) => {
      // Idempotencia: el mismo lote no se aplica dos veces.
      const key = `import:${body.batchId}`;
      const seen = await tx.setting.findUnique({ where: { userId_key: { userId, key } } });
      if (seen) return { duplicate: true as const, imported: JSON.parse(seen.value) };

      // ── Contactos ────────────────────────────────────────────────────────
      const contactMap = new Map<string, string>();
      const contacts = body.contacts.map((c) => {
        const id = randomUUID();
        contactMap.set(c.id, id);
        return {
          id,
          userId,
          firstName: c.firstName,
          lastName: c.lastName ?? null,
          phone: c.phone ?? null,
          whatsapp: c.whatsapp ?? null,
          email: c.email ?? null,
          address: c.address ?? null,
          latitude: c.latitude ?? null,
          longitude: c.longitude ?? null,
          category: c.category ?? 'Otros',
          notes: c.notes ?? null,
          lastContactAt: c.lastContactAt ? new Date(c.lastContactAt) : null,
          nextContactAt: c.nextContactAt ? new Date(c.nextContactAt) : null,
          ...(c.createdAt ? { createdAt: new Date(c.createdAt) } : {}),
        };
      });
      if (contacts.length) await tx.contact.createMany({ data: contacts });

      // ── Lugares ──────────────────────────────────────────────────────────
      const placeMap = new Map<string, string>();
      const places = body.places.map((p) => {
        const id = randomUUID();
        placeMap.set(p.id, id);
        return {
          id,
          userId,
          name: p.name,
          category: p.category ?? 'Personalizado',
          address: p.address ?? null,
          latitude: p.latitude ?? null,
          longitude: p.longitude ?? null,
          note: p.note ?? null,
          color: p.color ?? null,
        };
      });
      if (places.length) await tx.place.createMany({ data: places });

      // ── Metas (los `members` se reescriben a los contactos nuevos) ────────
      const goalMap = new Map<string, string>();
      const goals = body.goals.map((g) => {
        const id = randomUUID();
        goalMap.set(g.id, id);
        const members = (g.members ?? [])
          .map((m) => contactMap.get(m))
          .filter((m): m is string => !!m);
        return {
          id,
          userId,
          title: g.title,
          kind: g.kind,
          filter: g.filter ?? null,
          members: members.length ? JSON.stringify(members) : null,
          period: g.period,
          target: g.target,
          current: g.current ?? 0,
          unit: g.unit ?? 'u',
          deadline: g.deadline ? new Date(g.deadline) : null,
          status: g.status,
          ...(g.createdAt ? { createdAt: new Date(g.createdAt) } : {}),
        };
      });
      if (goals.length) await tx.goal.createMany({ data: goals });

      // ── Tareas ───────────────────────────────────────────────────────────
      const tasks = body.tasks.map((t) => ({
        id: randomUUID(),
        userId,
        title: t.title,
        date: new Date(t.date),
        time: t.time ?? null,
        priority: t.priority,
        category: t.category ?? 'General',
        description: t.description ?? null,
        status: t.status,
        contactId: (t.contactId && contactMap.get(t.contactId)) || null,
        goalId: (t.goalId && goalMap.get(t.goalId)) || null,
        ...(t.createdAt ? { createdAt: new Date(t.createdAt) } : {}),
      }));
      if (tasks.length) await tx.task.createMany({ data: tasks });

      // ── Eventos ──────────────────────────────────────────────────────────
      // Todos entran en un solo `createMany`. Los vínculos con contactos viven en
      // la tabla puente implícita de Prisma (`_EventContacts`: A = Contact.id,
      // B = Event.id) y se insertan en bloque: un `create` por evento costaría
      // ~450 ms de ida y vuelta a Neon cada uno.
      const eventMap = new Map<string, string>(); // id del teléfono → id nuevo
      const events = body.events.map((e) => {
        const id = randomUUID();
        eventMap.set(e.id, id);
        return {
          id,
          userId,
          title: e.title,
          type: e.type ?? 'Evento',
          color: e.color ?? null,
          isBackup: e.isBackup ?? false,
          date: new Date(e.date),
          startTime: e.startTime,
          endTime: e.endTime,
          location: e.location ?? null,
          placeId: (e.placeId && placeMap.get(e.placeId)) || null,
          description: e.description ?? null,
          notifyMins: e.notifyMins ?? 30,
          repeat: e.repeat,
          repeatUntil: e.repeatUntil ? new Date(e.repeatUntil) : null,
          goalId: (e.goalId && goalMap.get(e.goalId)) || null,
          done: e.done ?? false,
        };
      });
      if (events.length) await tx.event.createMany({ data: events });

      const eventContacts: { contactId: string; eventId: string }[] = [];
      for (const e of body.events) {
        const eventId = eventMap.get(e.id);
        if (!eventId) continue;
        for (const raw of e.contactIds ?? []) {
          const contactId = contactMap.get(raw);
          if (contactId) eventContacts.push({ contactId, eventId });
        }
      }

      if (eventContacts.length) {
        if (await hasEventContactsTable(tx)) {
          const CHUNK = 400;
          for (let i = 0; i < eventContacts.length; i += CHUNK) {
            const values = Prisma.join(
              eventContacts
                .slice(i, i + CHUNK)
                .map((l) => Prisma.sql`(${l.contactId}, ${l.eventId})`),
            );
            await tx.$executeRaw`INSERT INTO "_EventContacts" ("A", "B") VALUES ${values} ON CONFLICT DO NOTHING`;
          }
        } else {
          // Esquema sin tabla puente (improbable): se conecta uno a uno.
          for (const l of eventContacts) {
            await tx.event.update({
              where: { id: l.eventId },
              data: { contacts: { connect: { id: l.contactId } } },
            });
          }
        }
      }

      // ── Ingresos y gastos ────────────────────────────────────────────────
      const incomes = body.incomes.map((i) => {
        const quantity = i.quantity ?? 1;
        return {
          id: randomUUID(),
          userId,
          title: i.title,
          date: new Date(i.date),
          category: i.category ?? 'General',
          quantity,
          unitPrice: i.unitPrice,
          total: round2(quantity * i.unitPrice),
          clientId: (i.clientId && contactMap.get(i.clientId)) || null,
          payMethod: i.payMethod,
          note: i.note ?? null,
          ...(i.createdAt ? { createdAt: new Date(i.createdAt) } : {}),
        };
      });
      if (incomes.length) await tx.income.createMany({ data: incomes });

      const expenses = body.expenses.map((e) => ({
        id: randomUUID(),
        userId,
        title: e.title,
        date: new Date(e.date),
        category: e.category ?? 'Otros',
        amount: e.amount,
        kind: e.kind,
        note: e.note ?? null,
        ...(e.createdAt ? { createdAt: new Date(e.createdAt) } : {}),
      }));
      if (expenses.length) await tx.expense.createMany({ data: expenses });

      // ── Registros de avance de metas ─────────────────────────────────────
      const goalLogs = body.goalLogs
        .map((l) => {
          const goalId = goalMap.get(l.goalId);
          if (!goalId) return null;
          return {
            id: randomUUID(),
            userId,
            goalId,
            date: l.date ? new Date(l.date) : new Date(),
            amount: l.amount,
            note: l.note ?? null,
          };
        })
        .filter((l): l is NonNullable<typeof l> => !!l);
      if (goalLogs.length) await tx.goalLog.createMany({ data: goalLogs });

      // ── Categorías personalizadas (las del sistema no se duplican) ────────
      // `skipDuplicates` = ON CONFLICT DO NOTHING: si la cuenta ya tenía esa
      // categoría se respeta la suya y no se pisa el color.
      if (body.contactCategories.length) {
        await tx.contactCategory.createMany({
          data: body.contactCategories.map((c) => ({
            userId,
            name: c.name,
            color: c.color ?? null,
          })),
          skipDuplicates: true,
        });
      }
      if (body.expenseCategories.length) {
        await tx.expenseCategory.createMany({
          data: body.expenseCategories.map((c) => ({
            userId,
            name: c.name,
            color: c.color ?? null,
          })),
          skipDuplicates: true,
        });
      }

      // ── Ajustes: solo si la cuenta no los tiene ───────────────────────────
      // Una sola consulta para saber cuáles existen, y un solo `createMany`:
      // cada ida y vuelta a Neon cuesta ~450 ms.
      const settingsToAdd = new Map<string, string>();
      for (const s of body.settings) {
        if (!MAX_SETTING_KEYS.includes(s.key) || settingsToAdd.has(s.key)) continue;
        const raw = JSON.stringify(s.value ?? null);
        if (raw.length > 20 * 1024) continue;
        settingsToAdd.set(s.key, raw);
      }
      if (settingsToAdd.size) {
        const existing = await tx.setting.findMany({
          where: { userId, key: { in: [...settingsToAdd.keys()] } },
          select: { key: true },
        });
        for (const s of existing) settingsToAdd.delete(s.key);
        if (settingsToAdd.size) {
          await tx.setting.createMany({
            data: [...settingsToAdd].map(([key, value]) => ({ userId, key, value })),
            skipDuplicates: true,
          });
        }
      }

      const imported = {
        contacts: contacts.length,
        places: places.length,
        goals: goals.length,
        tasks: tasks.length,
        events: body.events.length,
        incomes: incomes.length,
        expenses: expenses.length,
        goalLogs: goalLogs.length,
      };

      // Marca del lote (idempotencia y auditoría mínima).
      await tx.setting.create({ data: { userId, key, value: JSON.stringify(imported) } });

      return { duplicate: false as const, imported };
    },
    { timeout: 120000, maxWait: 15000 },
  );

  return res.status(result.duplicate ? 200 : 201).json({ ok: true, ...result });
}
