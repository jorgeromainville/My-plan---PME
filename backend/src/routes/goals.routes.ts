import { Router } from 'express';
import {
  addLog,
  createGoal,
  deleteGoal,
  deleteLog,
  goalsProgress,
  listGoals,
  listLogs,
  updateGoal,
} from '../controllers/goals.controller';
import { asyncHandler } from '../middleware/asyncHandler';
import { requireAuth } from '../middleware/auth';

export const goalsRoutes = Router();
goalsRoutes.use(requireAuth);
goalsRoutes.get('/', asyncHandler(listGoals));
goalsRoutes.get('/progress', asyncHandler(goalsProgress));
goalsRoutes.post('/', asyncHandler(createGoal));
goalsRoutes.patch('/:id', asyncHandler(updateGoal));
goalsRoutes.delete('/:id', asyncHandler(deleteGoal));
goalsRoutes.post('/:id/log', asyncHandler(addLog));
goalsRoutes.get('/:id/logs', asyncHandler(listLogs));
goalsRoutes.delete('/logs/:logId', asyncHandler(deleteLog));
