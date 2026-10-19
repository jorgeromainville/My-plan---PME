import { Router } from 'express';
import {
  createCategory,
  deleteCategory,
  listCategories,
} from '../controllers/contactCategories.controller';
import { asyncHandler } from '../middleware/asyncHandler';
import { requireAuth } from '../middleware/auth';

export const contactCategoriesRoutes = Router();
contactCategoriesRoutes.use(requireAuth);
contactCategoriesRoutes.get('/', asyncHandler(listCategories));
contactCategoriesRoutes.post('/', asyncHandler(createCategory));
contactCategoriesRoutes.delete('/:name', asyncHandler(deleteCategory));
