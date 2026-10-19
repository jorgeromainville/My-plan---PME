import { Router } from 'express';
import {
  createExpense,
  deleteExpense,
  getExpense,
  listExpenses,
  updateExpense,
} from '../controllers/expenses.controller';
import { asyncHandler } from '../middleware/asyncHandler';
import { requireAuth } from '../middleware/auth';

export const expensesRoutes = Router();
expensesRoutes.use(requireAuth);
expensesRoutes.get('/', asyncHandler(listExpenses));
expensesRoutes.post('/', asyncHandler(createExpense));
expensesRoutes.get('/:id', asyncHandler(getExpense));
expensesRoutes.patch('/:id', asyncHandler(updateExpense));
expensesRoutes.delete('/:id', asyncHandler(deleteExpense));
