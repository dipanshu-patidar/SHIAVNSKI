import { Request, Response, NextFunction } from 'express';
import { callService } from '../services/call.service.js';
import {
  createCallSchema,
  createWebCallSchema,
  endCallSchema,
  listCallsQuerySchema,
  dashboardMetricsQuerySchema,
} from '../schemas/call.schema.js';
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
   * POST /api/calls/:id/end
   * Explicitly terminate/end an active call session
   */
  async endCall(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError('Authentication required', 401, 'UNAUTHORIZED');
      }

      const callId = req.params.id;
      const parsedBody = endCallSchema.safeParse(req.body);
      const durationSeconds = parsedBody.success ? parsedBody.data.durationSeconds : undefined;

      const call = await callService.endCall(req.user.id, callId, durationSeconds);

      res.status(200).json({
        success: true,
        data: {
          call,
        },
        message: 'Call terminated successfully',
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

  /**
   * POST /api/calls/web-call
   * Create a browser WebRTC voice session and return access token + call record
   */
  async createWebCall(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError('Authentication required', 401, 'UNAUTHORIZED');
      }

      const input = createWebCallSchema.parse(req.body);
      const result = await callService.createWebCall(req.user.id, input);

      res.status(201).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /api/calls/:id/recording
   * Remove/delete call recording reference while preserving transcript and call history
   */
  async deleteRecording(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError('Authentication required', 401, 'UNAUTHORIZED');
      }

      const callId = req.params.id;
      const result = await callService.deleteCallRecording(req.user.id, callId);

      res.status(200).json({
        success: true,
        data: result,
        message: result.message,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /api/calls/:id
   * Permanently delete a call record scoped to the authenticated user
   */
  async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError('Authentication required', 401, 'UNAUTHORIZED');
      }

      const callId = req.params.id;
      const result = await callService.deleteCall(req.user.id, callId);

      res.status(200).json({
        success: true,
        data: result,
        message: result.message,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/calls/:id/sync
   * Fetch and sync the latest call details, transcript, and recording from Retell
   */
  async syncCall(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError('Authentication required', 401, 'UNAUTHORIZED');
      }

      const callId = req.params.id;
      const call = await callService.syncCallDetails(req.user.id, callId);

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
}

export const callController = new CallController();

