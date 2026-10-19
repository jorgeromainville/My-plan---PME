import { Router } from 'express';
import {
  createEvent,
  deleteEvent,
  getEvent,
  listEvents,
  updateEvent,
} from '../controllers/events.controller';
import { asyncHandler } from '../middleware/asyncHandler';
import { requireAuth } from '../middleware/auth';

export const eventsRoutes = Router();
eventsRoutes.use(requireAuth);
eventsRoutes.get('/', asyncHandler(listEvents));
eventsRoutes.post('/', asyncHandler(createEvent));
eventsRoutes.get('/:id', asyncHandler(getEvent));
eventsRoutes.patch('/:id', asyncHandler(updateEvent));
eventsRoutes.delete('/:id', asyncHandler(deleteEvent));
