import { Router } from 'express';
import { agentController } from '../controllers/agent.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';

export const agentRouter = Router();

// Enforce authentication on all agent routes
agentRouter.use(requireAuth);

agentRouter.get('/', (req, res, next) => agentController.list(req, res, next));
agentRouter.post('/', (req, res, next) => agentController.create(req, res, next));
agentRouter.post('/sync', (req, res, next) => agentController.syncRetell(req, res, next));
agentRouter.get('/:id', (req, res, next) => agentController.getById(req, res, next));
agentRouter.put('/:id', (req, res, next) => agentController.update(req, res, next));
agentRouter.patch('/:id', (req, res, next) => agentController.update(req, res, next));
agentRouter.delete('/:id', (req, res, next) => agentController.delete(req, res, next));

export default agentRouter;
