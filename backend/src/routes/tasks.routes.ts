import { Router } from 'express';
import {
  createTask,
  deleteTask,
  getTask,
  listTasks,
  updateTask,
} from '../controllers/tasks.controller';
import { asyncHandler } from '../middleware/asyncHandler';
import { requireAuth } from '../middleware/auth';

export const tasksRoutes = Router();
tasksRoutes.use(requireAuth);
tasksRoutes.get('/', asyncHandler(listTasks));
tasksRoutes.post('/', asyncHandler(createTask));
tasksRoutes.get('/:id', asyncHandler(getTask));
tasksRoutes.patch('/:id', asyncHandler(updateTask));
tasksRoutes.delete('/:id', asyncHandler(deleteTask));
