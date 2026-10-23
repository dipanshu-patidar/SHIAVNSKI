import { Router, Request, Response } from 'express';
import { config } from '../config/index.js';

export const healthRouter = Router();

healthRouter.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    data: {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: config.NODE_ENV,
      providerMode: config.PROVIDER_MODE,
      service: 'ai-voice-agent-backend',
      version: '1.0.0',
    },
  });
});
