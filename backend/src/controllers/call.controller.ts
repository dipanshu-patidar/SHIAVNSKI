import { Request, Response, NextFunction } from 'express';
import { callService } from '../services/call.service.js';
import { createCallSchema, listCallsQuerySchema, dashboardMetricsQuerySchema } from '../schemas/call.schema.js';
import { AppError } from '../middleware/error.middleware.js';

export class CallController {
  /**
   * POST /api/calls
   * Dispatch an outbound call
   */
  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError('Authentication required', 401, 'UNAUTHORIZED');
      }

      const input = createCallSchema.parse(req.body);
      const idempotencyKey =
        (req.headers['x-idempotency-key'] as string) || (req.body.idempotencyKey as string);

      const call = await callService.initiateCall(req.user.id, input, idempotencyKey);

      res.status(201).json({
        success: true,
        data: {
          call,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/calls
   * List calls for authenticated user
   */
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError('Authentication required', 401, 'UNAUTHORIZED');
      }

      const query = listCallsQuerySchema.parse(req.query);
      const result = await callService.listCalls(req.user.id, query);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/calls/:id
   * Get single call details by ID
   */
  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError('Authentication required', 401, 'UNAUTHORIZED');
      }

      const callId = req.params.id;
      const call = await callService.getCallById(req.user.id, callId);

      res.status(200).json({
        success: true,
        data: {
          call,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/calls/:id/simulate-step
   * Progress a mock call's lifecycle (INITIATED -> ONGOING -> ENDED)
   */
  async simulateStep(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError('Authentication required', 401, 'UNAUTHORIZED');
      }

      const callId = req.params.id;
      const call = await callService.simulateCallStep(req.user.id, callId);

      res.status(200).json({
        success: true,
        data: {
          call,
        },
        message: `Mock call transitioned to ${call.status} [SIMULATED]`,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/calls/stats
   * Get aggregated dashboard KPIs and recent calls
   */
  async getDashboardMetrics(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError('Authentication required', 401, 'UNAUTHORIZED');
      }

      const query = dashboardMetricsQuerySchema.parse(req.query);
      const metrics = await callService.getDashboardMetrics(req.user.id, query);

      res.status(200).json({
        success: true,
        data: metrics,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const callController = new CallController();
