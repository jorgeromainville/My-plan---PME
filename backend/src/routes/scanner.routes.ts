import { Router } from 'express';
import {
  createAttachment,
  deleteAttachment,
  listAttachments,
  ocrScan,
  parseScan,
  scanUpload,
  scannerAiStatus,
} from '../controllers/scanner.controller';
import { asyncHandler } from '../middleware/asyncHandler';
import { requireAuth } from '../middleware/auth';

export const scannerRoutes = Router();
scannerRoutes.use(requireAuth);
scannerRoutes.get('/ai', asyncHandler(scannerAiStatus));
scannerRoutes.post('/ocr', scanUpload.single('photo'), asyncHandler(ocrScan));
scannerRoutes.post('/parse', asyncHandler(parseScan));

export const attachmentsRoutes = Router();
attachmentsRoutes.use(requireAuth);
attachmentsRoutes.post('/', asyncHandler(createAttachment));
attachmentsRoutes.get('/', asyncHandler(listAttachments));
attachmentsRoutes.delete('/:id', asyncHandler(deleteAttachment));
