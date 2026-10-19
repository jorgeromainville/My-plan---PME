import { Router } from 'express';
import {
  createIncome,
  deleteIncome,
  getIncome,
  listIncomes,
  updateIncome,
} from '../controllers/incomes.controller';
import { asyncHandler } from '../middleware/asyncHandler';
import { requireAuth } from '../middleware/auth';

export const incomesRoutes = Router();
incomesRoutes.use(requireAuth);
incomesRoutes.get('/', asyncHandler(listIncomes));
incomesRoutes.post('/', asyncHandler(createIncome));
incomesRoutes.get('/:id', asyncHandler(getIncome));
incomesRoutes.patch('/:id', asyncHandler(updateIncome));
incomesRoutes.delete('/:id', asyncHandler(deleteIncome));
