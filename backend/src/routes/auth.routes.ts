import { Router } from 'express';
import {
  changePassword,
  deleteAccount,
  login,
  me,
  refresh,
  register,
  updateMe,
} from '../controllers/auth.controller';
import { asyncHandler } from '../middleware/asyncHandler';
import { requireAuth } from '../middleware/auth';
import { loginLimiter, passwordLimiter, registerLimiter } from '../middleware/rateLimit';

export const authRoutes = Router();
authRoutes.post('/register', registerLimiter, asyncHandler(register));
authRoutes.post('/login', loginLimiter, asyncHandler(login));
authRoutes.post('/refresh', asyncHandler(refresh));
authRoutes.get('/me', requireAuth, asyncHandler(me));
authRoutes.patch('/me', requireAuth, asyncHandler(updateMe));
authRoutes.patch('/password', requireAuth, passwordLimiter, asyncHandler(changePassword));
authRoutes.delete('/account', requireAuth, asyncHandler(deleteAccount));
