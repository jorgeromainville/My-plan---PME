import { Router } from 'express';
import { getSetting, putSetting } from '../controllers/settings.controller';
import { asyncHandler } from '../middleware/asyncHandler';
import { requireAuth } from '../middleware/auth';

export const settingsRoutes = Router();
settingsRoutes.use(requireAuth);
settingsRoutes.get('/:key', asyncHandler(getSetting));
settingsRoutes.put('/:key', asyncHandler(putSetting));
