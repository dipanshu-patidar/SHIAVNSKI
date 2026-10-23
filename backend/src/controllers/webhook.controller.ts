import { Request, Response, NextFunction } from 'express';
import { webhookService } from '../services/webhook.service.js';
import { retellWebhookSchema } from '../schemas/webhook.schema.js';

export class WebhookController {
  /**
   * Public webhook receiver endpoint for Retell AI event notifications.
   * Cryptographically authenticated via x-retell-signature HMAC header.
   */
  async handleRetellWebhook(req: Request, res: Response, next: NextFunction) {
    try {
      const signature = (req.headers['x-retell-signature'] || req.headers['X-Retell-Signature']) as string;

      if (!signature) {
        res.status(401).json({
          success: false,
          error: 'Authentication failed: Missing x-retell-signature header',
        });
        return;
      }

      // Extract raw body captured by Express verify hook
      const rawBody =
        (req as Request & { rawBody?: Buffer }).rawBody?.toString('utf8') ||
        (typeof req.body === 'string' ? req.body : JSON.stringify(req.body));

      const isVerified = await webhookService.verifySignature(rawBody, signature);

      if (!isVerified) {
        res.status(401).json({
          success: false,
          error: 'Authentication failed: Invalid webhook signature',
        });
        return;
      }

      // Validate event schema
      const parseResult = retellWebhookSchema.safeParse(req.body);
      if (!parseResult.success) {
        res.status(400).json({
          success: false,
          error: 'Validation failed: Invalid webhook payload structure',
          details: parseResult.error.format(),
        });
        return;
      }

      // Process event idempotently
      const result = await webhookService.processRetellWebhook(parseResult.data, req.headers as any);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const webhookController = new WebhookController();
