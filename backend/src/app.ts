import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import { asyncHandler } from './middleware/asyncHandler';
import { requireAuth } from './middleware/auth';
import { errorHandler } from './middleware/errorHandler';
import { authRoutes } from './routes/auth.routes';
import { contactCategoriesRoutes } from './routes/contactCategories.routes';
import { contactsRoutes } from './routes/contacts.routes';
import { eventsRoutes } from './routes/events.routes';
import { expenseCategoriesRoutes } from './routes/expenseCategories.routes';
import { expensesRoutes } from './routes/expenses.routes';
import { financeSummary } from './controllers/finance.controller';
import { goalsRoutes } from './routes/goals.routes';
import { incomesRoutes } from './routes/incomes.routes';
import { settingsRoutes } from './routes/settings.routes';
import { scannerRoutes } from './routes/scanner.routes';
import { placesRoutes } from './routes/places.routes';
import { statsRoutes } from './routes/stats.routes';
import { tasksRoutes } from './routes/tasks.routes';

export function buildApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet());
  // La app nativa no manda Origin; solo se permiten navegadores de desarrollo
  // locales y los orígenes declarados en CORS_ORIGINS (coma-separados).
  const allowedOrigins = (process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  app.use(
    cors({
      origin(origin, cb) {
        if (!origin) return cb(null, true);
        const local = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(origin);
        if (local || allowedOrigins.includes(origin)) return cb(null, true);
        return cb(null, false);
      },
    }),
  );
  app.use(express.json({ limit: '1mb' }));
  app.use(morgan('dev'));

  app.get('/health', (_req, res) => res.json({ ok: true }));

  app.use('/api/auth', authRoutes);
  app.use('/api/tasks', tasksRoutes);
  app.use('/api/events', eventsRoutes);
  app.use('/api/contacts', contactsRoutes); // mínimo Fase 2; CRUD completo en Fase 3
  app.use('/api/contact-categories', contactCategoriesRoutes);
  app.use('/api/settings', settingsRoutes); // tipos de evento, plantillas, ajustes

  app.use('/api/incomes', incomesRoutes);
  app.use('/api/expenses', expensesRoutes);
  app.use('/api/expense-categories', expenseCategoriesRoutes);
  app.get('/api/finance/summary', requireAuth, asyncHandler(financeSummary));
  app.use('/api/goals', goalsRoutes);
  app.use('/api/stats', statsRoutes);
  app.use('/api/places', placesRoutes);
  app.use('/api/scanner', scannerRoutes);

  // Placeholders Fase 7-8: montan aquí places.
  app.get('/api', (_req, res) => res.json({ name: 'Planner Today API', version: '0.1.0' }));

  app.use(errorHandler);
  return app;
}
