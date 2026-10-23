import { Router } from 'express';
import { webhookController } from '../controllers/webhook.controller.js';

export const webhookRouter = Router();

// Official Retell AI Webhook Endpoint
webhookRouter.post('/retell', (req, res, next) =>
  webhookController.handleRetellWebhook(req, res, next)
);

// Fallback alias for telephony webhooks
webhookRouter.post('/calls', (req, res, next) =>
  webhookController.handleRetellWebhook(req, res, next)
);
