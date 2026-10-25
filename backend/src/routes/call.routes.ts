import { Router } from 'express';
import { callController } from '../controllers/call.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';

export const callRouter = Router();

// Protect all call endpoints
callRouter.use(requireAuth);

callRouter.post('/', (req, res, next) => callController.create(req, res, next));
callRouter.post('/web-call', (req, res, next) => callController.createWebCall(req, res, next));
callRouter.get('/', (req, res, next) => callController.list(req, res, next));
callRouter.get('/stats', (req, res, next) => callController.getDashboardMetrics(req, res, next));
callRouter.get('/:id', (req, res, next) => callController.getById(req, res, next));
callRouter.delete('/:id/recording', (req, res, next) => callController.deleteRecording(req, res, next));
callRouter.post('/:id/sync', (req, res, next) => callController.syncCall(req, res, next));
callRouter.post('/:id/simulate-step', (req, res, next) => callController.simulateStep(req, res, next));

export default callRouter;

