import { Router } from 'express';
import {
  createCategory,
  deleteCategory,
  listCategories,
} from '../controllers/contactCategories.controller';
import {
  createContact,
  deleteContact,
  getContact,
  listContacts,
  touchContact,
  updateContact,
} from '../controllers/contacts.controller';
import { asyncHandler } from '../middleware/asyncHandler';
import { requireAuth } from '../middleware/auth';

export const contactsRoutes = Router();
contactsRoutes.use(requireAuth);
contactsRoutes.get('/', asyncHandler(listContacts));
contactsRoutes.post('/', asyncHandler(createContact));
contactsRoutes.get('/:id', asyncHandler(getContact));
contactsRoutes.patch('/:id', asyncHandler(updateContact));
contactsRoutes.delete('/:id', asyncHandler(deleteContact));
contactsRoutes.post('/:id/touch', asyncHandler(touchContact));
