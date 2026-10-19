import { Router } from 'express';
import { login, me, refresh, register } from '../controllers/auth.controller';
import { asyncHandler } from '../middleware/asyncHandler';
import { requireAuth } from '../middleware/auth';

export const authRoutes = Router();
authRoutes.post('/register', asyncHandler(register));
authRoutes.post('/login', asyncHandler(login));
authRoutes.post('/refresh', asyncHandler(refresh));
authRoutes.get('/me', requireAuth, asyncHandler(me));
