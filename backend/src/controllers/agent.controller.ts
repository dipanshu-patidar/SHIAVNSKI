import { Request, Response, NextFunction } from 'express';
import { agentService } from '../services/agent.service.js';
import {
  createAgentSchema,
  updateAgentSchema,
  listAgentsQuerySchema,
} from '../schemas/agent.schema.js';
import { AppError } from '../middleware/error.middleware.js';

export class AgentController {
  /**
   * GET /api/agents
   * List voice agents scoped to authenticated user
   */
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError('Authentication required', 401, 'UNAUTHORIZED');
      }

      const query = listAgentsQuerySchema.parse(req.query);
      const result = await agentService.listAgents(req.user.id, query);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/agents/:id
   * Get single voice agent by ID
   */
  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError('Authentication required', 401, 'UNAUTHORIZED');
      }

      const agentId = req.params.id;
      const agent = await agentService.getAgentById(req.user.id, agentId);

      res.status(200).json({
        success: true,
        data: {
          agent,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/agents
   * Create voice agent
   */
  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError('Authentication required', 401, 'UNAUTHORIZED');
      }

      const input = createAgentSchema.parse(req.body);
      const agent = await agentService.createAgent(req.user.id, input);

      res.status(201).json({
        success: true,
        data: {
          agent,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PUT /api/agents/:id
   * Update existing voice agent
   */
  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError('Authentication required', 401, 'UNAUTHORIZED');
      }

      const agentId = req.params.id;
      const input = updateAgentSchema.parse(req.body);
      const agent = await agentService.updateAgent(req.user.id, agentId, input);

      res.status(200).json({
        success: true,
        data: {
          agent,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /api/agents/:id
   * Delete voice agent
   */
  async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError('Authentication required', 401, 'UNAUTHORIZED');
      }

      const agentId = req.params.id;
      await agentService.deleteAgent(req.user.id, agentId);

      res.status(200).json({
        success: true,
        message: 'Agent deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/agents/sync
   * Synchronize or import a published Retell agent into user account
   */
  async syncRetell(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError('Authentication required', 401, 'UNAUTHORIZED');
      }

      const providerAgentId = req.body?.providerAgentId as string | undefined;
      const agent = await agentService.syncRetellAgent(req.user.id, providerAgentId);

      res.status(200).json({
        success: true,
        data: {
          agent,
        },
      });
    } catch (error) {
      next(error);
    }
  }
}

export const agentController = new AgentController();
