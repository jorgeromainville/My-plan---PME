import { Router } from 'express';
import { expensesByCategory, statsOverview } from '../controllers/stats.controller';
import { asyncHandler } from '../middleware/asyncHandler';
import { requireAuth } from '../middleware/auth';

export const statsRoutes = Router();statsRoutes.use(requireAuth);
statsRoutes.get('/overview', asyncHandler(statsOverview));
statsRoutes.get('/expenses-by-category', asyncHandler(expensesByCategory));
