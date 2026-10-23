import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import { config } from './config/index.js';
import { healthRouter } from './routes/health.routes.js';
import { authRouter } from './routes/auth.routes.js';
import { agentRouter } from './routes/agent.routes.js';
import { callRouter } from './routes/call.routes.js';
import { webhookRouter } from './routes/webhook.routes.js';
import { providerRouter } from './routes/provider.routes.js';
import { errorHandler, AppError } from './middleware/error.middleware.js';

export function createApp(): Express {
  const app = express();

  // Security Headers
  app.use(helmet());

  // CORS Configuration with Credentials Enabled for HttpOnly Cookie Auth
  app.use(
    cors({
      origin: config.CORS_ORIGIN.split(',').map((origin) => origin.trim()),
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Retell-Signature', 'X-Idempotency-Key'],
    })
  );

  // Parse Cookie Headers
  app.use(cookieParser());

  // Request Logging (disabled in test suite)
  if (config.NODE_ENV !== 'test') {
    app.use(morgan('dev'));
  }

  // JSON Body Parsing with rawBody buffer preservation for Webhook HMAC verification
  app.use(
    express.json({
      verify: (req: Request, _res: Response, buf: Buffer) => {
        (req as Request & { rawBody?: Buffer }).rawBody = buf;
      },
    })
  );

  app.use(express.urlencoded({ extended: true }));

  // Root Welcome Endpoint
  app.get('/', (_req: Request, res: Response) => {
    res.status(200).json({
      message: 'AI Voice Agent Management System API',
      status: 'online',
      providerMode: config.PROVIDER_MODE,
      docs: '/api/health',
    });
  });

  // Mount API Endpoints
  app.use('/api', healthRouter);
  app.use('/api/auth', authRouter);
  app.use('/api/agents', agentRouter);
  app.use('/api/calls', callRouter);
  app.use('/api/webhooks', webhookRouter);
  app.use('/api/provider', providerRouter);

  // 404 Handler for Unmatched Routes
  app.use((req: Request, _res: Response, next: NextFunction) => {
    next(new AppError(`Route ${req.method} ${req.path} not found`, 404, 'NOT_FOUND'));
  });

  // Centralized Error Handling Middleware
  app.use(errorHandler);

  return app;
}

export const app = createApp();
export default app;
