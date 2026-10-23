import { prisma } from '../db/prisma.js';
import { getVoiceProvider } from '../providers/index.js';
import { AppError } from '../middleware/error.middleware.js';
import { CreateAgentInput, UpdateAgentInput, ListAgentsQuery } from '../schemas/agent.schema.js';
import { Agent, Prisma, SyncStatus } from '@prisma/client';

export class AgentService {
  private voiceProvider = getVoiceProvider();

  /**
   * List voice agents scoped strictly to the authenticated user.
   */
  async listAgents(
    userId: string,
    query: ListAgentsQuery
  ): Promise<{ agents: Agent[]; total: number; page: number; limit: number }> {
    const { search, page, limit, sortBy, sortOrder } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.AgentWhereInput = {
      userId,
    };

    if (search && search.trim() !== '') {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { voiceId: { contains: search, mode: 'insensitive' } },
        { language: { contains: search, mode: 'insensitive' } },
        { providerAgentId: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [agents, total] = await Promise.all([
      prisma.agent.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          [sortBy]: sortOrder,
        },
      }),
      prisma.agent.count({ where }),
    ]);

    return {
      agents,
      total,
      page,
      limit,
    };
  }

  /**
   * Get single agent by ID, verifying authenticated ownership.
   */
  async getAgentById(userId: string, agentId: string): Promise<Agent> {
    const agent = await prisma.agent.findFirst({
      where: {
        id: agentId,
        userId,
      },
    });

    if (!agent) {
      throw new AppError('Agent not found or access denied', 404, 'AGENT_NOT_FOUND');
    }

    return agent;
  }

  /**
   * Create new voice agent with provider synchronization and PostgreSQL persistence.
   */
  async createAgent(userId: string, input: CreateAgentInput): Promise<Agent> {
    // 1. Dispatch create to voice provider abstraction (MockVoiceProvider in Phase 2)
    const providerResult = await this.voiceProvider.createAgent({
      name: input.name,
      voiceId: input.voiceId,
      language: input.language,
      systemPrompt: input.systemPrompt,
      responsiveness: input.responsiveness,
      interruptionSensitivity: input.interruptionSensitivity,
    });

    // 2. Persist in PostgreSQL scoped to the authenticated user
    const agent = await prisma.agent.create({
      data: {
        userId,
        providerAgentId: providerResult.providerAgentId,
        name: input.name,
        description: input.description,
        voiceId: input.voiceId,
        language: input.language ?? 'en-US',
        systemPrompt: input.systemPrompt,
        responsiveness: input.responsiveness ?? 1.0,
        interruptionSensitivity: input.interruptionSensitivity ?? 0.8,
        syncStatus: SyncStatus.SYNCED,
        isActive: input.isActive ?? true,
      },
    });

    return agent;
  }

  /**
   * Update existing voice agent with ownership verification.
   */
  async updateAgent(
    userId: string,
    agentId: string,
    input: UpdateAgentInput
  ): Promise<Agent> {
    // 1. Verify existence and ownership
    const existingAgent = await this.getAgentById(userId, agentId);

    // 2. Propagate updates to voice provider if providerAgentId exists
    if (existingAgent.providerAgentId) {
      await this.voiceProvider.updateAgent(existingAgent.providerAgentId, {
        name: input.name,
        voiceId: input.voiceId,
        language: input.language,
        systemPrompt: input.systemPrompt,
        responsiveness: input.responsiveness,
        interruptionSensitivity: input.interruptionSensitivity,
      });
    }

    // 3. Persist update in PostgreSQL
    const updatedAgent = await prisma.agent.update({
      where: {
        id: agentId,
      },
      data: {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.description !== undefined && { description: input.description }),
        ...(input.voiceId !== undefined && { voiceId: input.voiceId }),
        ...(input.language !== undefined && { language: input.language }),
        ...(input.systemPrompt !== undefined && { systemPrompt: input.systemPrompt }),
        ...(input.responsiveness !== undefined && { responsiveness: input.responsiveness }),
        ...(input.interruptionSensitivity !== undefined && {
          interruptionSensitivity: input.interruptionSensitivity,
        }),
        ...(input.isActive !== undefined && { isActive: input.isActive }),
        syncStatus: SyncStatus.SYNCED,
      },
    });

    return updatedAgent;
  }

  /**
   * Delete voice agent with ownership verification and foreign key protection.
   */
  async deleteAgent(userId: string, agentId: string): Promise<void> {
    // 1. Verify existence and ownership
    const existingAgent = await prisma.agent.findFirst({
      where: {
        id: agentId,
        userId,
      },
      include: {
        _count: {
          select: { calls: true },
        },
      },
    });

    if (!existingAgent) {
      throw new AppError('Agent not found or access denied', 404, 'AGENT_NOT_FOUND');
    }

    // 2. Check if agent is linked to existing calls
    if (existingAgent._count.calls > 0) {
      throw new AppError(
        'Cannot delete agent with existing call history. You can deactivate the agent instead.',
        400,
        'AGENT_HAS_CALLS'
      );
    }

    // 3. Notify voice provider abstraction
    if (existingAgent.providerAgentId) {
      await this.voiceProvider.deleteAgent(existingAgent.providerAgentId);
    }

    // 4. Delete from PostgreSQL
    await prisma.agent.delete({
      where: {
        id: agentId,
      },
    });
  }
}

export const agentService = new AgentService();
