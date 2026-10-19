import { Router } from 'express';
import {
  createExpenseCategory,
  deleteExpenseCategory,
  listExpenseCategories,
} from '../controllers/expenseCategories.controller';
import { asyncHandler } from '../middleware/asyncHandler';
import { requireAuth } from '../middleware/auth';

export const expenseCategoriesRoutes = Router();
expenseCategoriesRoutes.use(requireAuth);
expenseCategoriesRoutes.get('/', asyncHandler(listExpenseCategories));
expenseCategoriesRoutes.post('/', asyncHandler(createExpenseCategory));
expenseCategoriesRoutes.delete('/:name', asyncHandler(deleteExpenseCategory));
