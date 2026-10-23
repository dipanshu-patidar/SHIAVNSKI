import { Router } from 'express';
import { providerController } from '../controllers/provider.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';

export const providerRouter = Router();

// Safe public status check
providerRouter.get('/status', (req, res, next) =>
  providerController.getStatus(req, res, next)
);

// Harmless authenticated connectivity verification
providerRouter.post('/verify', requireAuth, (req, res, next) =>
  providerController.verifyConnectivity(req, res, next)
);

providerRouter.get('/verify', requireAuth, (req, res, next) =>
  providerController.verifyConnectivity(req, res, next)
);
