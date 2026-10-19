import { Router } from 'express';
import {
  createPlace,
  deletePlace,
  getPlace,
  listPlaces,
  mapItems,
  updatePlace,
} from '../controllers/places.controller';
import { asyncHandler } from '../middleware/asyncHandler';
import { requireAuth } from '../middleware/auth';

export const placesRoutes = Router();
placesRoutes.use(requireAuth);
placesRoutes.get('/map/items', asyncHandler(mapItems));
placesRoutes.get('/', asyncHandler(listPlaces));
placesRoutes.post('/', asyncHandler(createPlace));
placesRoutes.get('/:id', asyncHandler(getPlace));
placesRoutes.patch('/:id', asyncHandler(updatePlace));
placesRoutes.delete('/:id', asyncHandler(deletePlace));
