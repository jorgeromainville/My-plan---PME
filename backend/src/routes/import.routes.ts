import { Router } from 'express';
import { importData } from '../controllers/import.controller';
import { asyncHandler } from '../middleware/asyncHandler';
import { requireAuth } from '../middleware/auth';
import { importLimiter } from '../middleware/rateLimit';

export const importRoutes = Router();

// POST /api/import — sube el lote del modo invitado a la cuenta del token.
importRoutes.post('/', requireAuth, importLimiter, asyncHandler(importData));
