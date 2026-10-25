import { prisma } from '../db/prisma.js';
import { getVoiceProvider, IVoiceProvider } from '../providers/index.js';
import { config } from '../config/index.js';
import { AppError } from '../middleware/error.middleware.js';
import { CreateCallInput, CreateWebCallInput, ListCallsQuery } from '../schemas/call.schema.js';
import { maskPhoneNumber } from '../utils/phone.util.js';
import { Call, CallStatus, Prisma } from '@prisma/client';

export interface EnrichedCall extends Call {
  maskedToNumber: string;
  maskedFromNumber: string;
  isMock: boolean;
  agent?: {
    id: string;
    name: string;
    voiceId: string;
    language: string;
  };
}

export interface DashboardMetricsQuery {
  startDate?: string;
  endDate?: string;
  agentId?: string;
  status?: string;
}

export interface DashboardMetricsResult {
  totalCalls: number;
  completedCalls: number;
  failedCalls: number;
  ongoingCalls: number;
  initiatedCalls: number;
  avgDurationSeconds: number;
  successRate: number;
  activeAgents: number;
  recentCalls: EnrichedCall[];
}

// In-memory idempotency cache for duplicate request suppression (expires after 5 minutes)
interface CachedIdempotency {
  timestamp: number;
  result: EnrichedCall;
}
const idempotencyStore = new Map<string, CachedIdempotency>();

export class CallService {
  private get voiceProvider(): IVoiceProvider {
    return getVoiceProvider();
  }

  /**
   * Dispatch an outbound phone call with multi-tenant agent ownership verification,
   * idempotency protection, provider abstraction, and PostgreSQL persistence.
   */
  async initiateCall(
    userId: string,
    input: CreateCallInput,
    idempotencyKey?: string
  ): Promise<EnrichedCall> {
    // 1. Check idempotency cache if header/key supplied
    if (idempotencyKey) {
      const cached = idempotencyStore.get(idempotencyKey);
      if (cached && Date.now() - cached.timestamp < 5 * 60 * 1000) {
        return cached.result;
      }
    }

    // 2. Debounce duplicate submissions: check if identical call was placed in last 5 seconds
    const fiveSecondsAgo = new Date(Date.now() - 5000);
    const recentDuplicate = await prisma.call.findFirst({
      where: {
        userId,
        agentId: input.agentId,
        toNumber: input.toNumber,
        createdAt: { gte: fiveSecondsAgo },
      },
      include: {
        agent: {
          select: { id: true, name: true, voiceId: true, language: true },
        },
      },
    });

    if (recentDuplicate) {
      return this.enrichCall(recentDuplicate);
    }

    // 3. Verify that the agent belongs strictly to the authenticated user
    const agent = await prisma.agent.findFirst({
      where: {
        id: input.agentId,
        userId,
      },
    });

    if (!agent) {
      throw new AppError('Voice agent not found or access denied', 404, 'AGENT_NOT_FOUND');
    }

    if (!agent.isActive) {
      throw new AppError(
        'Cannot dispatch call using an inactive agent. Please activate the agent first.',
        400,
        'AGENT_INACTIVE'
      );
    }

    // 4. Resolve caller ID
    const fromNumber = input.fromNumber || config.RETELL_FROM_NUMBER || '+14155551234';

    // 5. Dispatch call through telephony provider abstraction
    let providerResult;
    try {
      providerResult = await this.voiceProvider.createPhoneCall({
        fromNumber,
        toNumber: input.toNumber,
        providerAgentId: agent.providerAgentId || config.RETELL_AGENT_ID || 'agent_mock_default',
        dynamicVariables: input.dynamicVariables,
        metadata: {
          userId,
          agentId: agent.id,
        },
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown telephony provider dispatch error';
      throw new AppError(
        `Telephony provider call dispatch failed: ${msg}`,
        502,
        'PROVIDER_DISPATCH_FAILED',
        { error: msg }
      );
    }

    if (!providerResult || !providerResult.providerCallId) {
      throw new AppError(
        'Telephony provider returned a malformed response without a call identifier',
        502,
        'PROVIDER_MALFORMED_RESPONSE'
      );
    }

    // 6. Persist initial Call record in PostgreSQL
    const createdCall = await prisma.call.create({
      data: {
        userId,
        agentId: agent.id,
        providerCallId: providerResult.providerCallId,
        fromNumber,
        toNumber: input.toNumber,
        status: CallStatus.INITIATED,
        durationSeconds: 0,
        dynamicVariables: input.dynamicVariables
          ? (input.dynamicVariables as Prisma.InputJsonValue)
          : undefined,
        startedAt: new Date(),
      },
      include: {
        agent: {
          select: { id: true, name: true, voiceId: true, language: true },
        },
      },
    });

    const enriched = this.enrichCall(createdCall);

    // Save to idempotency store
    if (idempotencyKey) {
      idempotencyStore.set(idempotencyKey, {
        timestamp: Date.now(),
        result: enriched,
      });
    }

    return enriched;
  }

  /**
   * List calls scoped strictly to authenticated user with filters and pagination.
   */
  async listCalls(
    userId: string,
    query: ListCallsQuery
  ): Promise<{
    calls: EnrichedCall[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const { page, limit, status, agentId, search, startDate, endDate, sortBy, sortOrder } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.CallWhereInput = {
      userId,
    };

    if (status) {
      where.status = status as CallStatus;
    }

    if (agentId) {
      where.agentId = agentId;
    }

    if (search && search.trim() !== '') {
      where.OR = [
        { toNumber: { contains: search, mode: 'insensitive' } },
        { providerCallId: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    const [calls, total] = await Promise.all([
      prisma.call.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          [sortBy]: sortOrder,
        },
        include: {
          agent: {
            select: { id: true, name: true, voiceId: true, language: true },
          },
        },
      }),
      prisma.call.count({ where }),
    ]);

    return {
      calls: calls.map((c) => this.enrichCall(c, true)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  /**
   * Retrieve single call details strictly owned by authenticated user.
   * Masks recipient and caller ID for privacy protection.
   */
  async getCallById(userId: string, callId: string): Promise<EnrichedCall> {
    const call = await prisma.call.findFirst({
      where: {
        id: callId,
        userId,
      },
      include: {
        agent: {
          select: { id: true, name: true, voiceId: true, language: true },
        },
      },
    });

    if (!call) {
      throw new AppError('Call record not found or access denied', 404, 'CALL_NOT_FOUND');
    }

    return this.enrichCall(call, true);
  }

  /**
   * Deterministic simulated lifecycle transition for mock calls (INITIATED -> ONGOING -> ENDED).
   * Validates multi-tenant ownership and ensures live Retell calls cannot be spoofed.
   */
  async simulateCallStep(userId: string, callId: string): Promise<EnrichedCall> {
    const call = await prisma.call.findFirst({
      where: { id: callId, userId },
      include: {
        agent: {
          select: { id: true, name: true, voiceId: true, language: true },
        },
      },
    });

    if (!call) {
      throw new AppError('Call record not found or access denied', 404, 'CALL_NOT_FOUND');
    }

    if (!call.providerCallId.startsWith('call_mock_')) {
      throw new AppError(
        'Simulated lifecycle transitions are only permitted on mock calls (call_mock_*)',
        400,
        'SIMULATION_NOT_ALLOWED'
      );
    }

    if (call.status === CallStatus.ENDED || call.status === CallStatus.FAILED) {
      return this.enrichCall(call, true);
    }

    let updatedCall;
    if (call.status === CallStatus.INITIATED) {
      // Step 1: Simulate recipient answering (transition to ONGOING)
      updatedCall = await prisma.call.update({
        where: { id: call.id },
        data: {
          status: CallStatus.ONGOING,
          startedAt: new Date(),
        },
        include: {
          agent: {
            select: { id: true, name: true, voiceId: true, language: true },
          },
        },
      });
    } else {
      // Step 2: Simulate call completion (transition from ONGOING to ENDED)
      const now = new Date();
      const elapsedSeconds = call.startedAt
        ? Math.max(5, Math.round((now.getTime() - call.startedAt.getTime()) / 1000))
        : 35;

      updatedCall = await prisma.call.update({
        where: { id: call.id },
        data: {
          status: CallStatus.ENDED,
          endedAt: now,
          durationSeconds: elapsedSeconds,
          disconnectionReason: 'simulated_user_hangup',
        },
        include: {
          agent: {
            select: { id: true, name: true, voiceId: true, language: true },
          },
        },
      });
    }

    return this.enrichCall(updatedCall, true);
  }

  /**
   * Aggregate dashboard KPIs (total, completed, failed, ongoing, average duration, success rate, active agents)
   * and recent calls calculated from persisted database records with strict user isolation and filters.
   */
  async getDashboardMetrics(
    userId: string,
    query: DashboardMetricsQuery
  ): Promise<DashboardMetricsResult> {
    const { startDate, endDate, agentId, status } = query;

    const where: Prisma.CallWhereInput = {
      userId,
    };

    if (agentId && agentId !== 'ALL') {
      where.agentId = agentId;
    }

    if (status && status !== 'ALL') {
      where.status = status as CallStatus;
    }

    if (startDate || endDate) {
      const createdAtFilter: Prisma.DateTimeFilter = {};
      if (startDate) {
        const parsedStart = new Date(startDate);
        if (!isNaN(parsedStart.getTime())) {
          createdAtFilter.gte = parsedStart;
        }
      }
      if (endDate) {
        const parsedEnd = new Date(endDate);
        if (!isNaN(parsedEnd.getTime())) {
          createdAtFilter.lte = parsedEnd;
        }
      }
      if (createdAtFilter.gte || createdAtFilter.lte) {
        where.createdAt = createdAtFilter;
      }
    }

    const hasStatusFilter = status && status !== 'ALL';

    const [
      totalCalls,
      completedCalls,
      failedCalls,
      ongoingCalls,
      initiatedCalls,
      durationAgg,
      activeAgents,
      recentCalls,
    ] = await Promise.all([
      prisma.call.count({ where }),
      hasStatusFilter
        ? status === 'ENDED'
          ? prisma.call.count({ where })
          : 0
        : prisma.call.count({ where: { ...where, status: CallStatus.ENDED } }),
      hasStatusFilter
        ? status === 'FAILED'
          ? prisma.call.count({ where })
          : 0
        : prisma.call.count({ where: { ...where, status: CallStatus.FAILED } }),
      hasStatusFilter
        ? status === 'ONGOING'
          ? prisma.call.count({ where })
          : 0
        : prisma.call.count({ where: { ...where, status: CallStatus.ONGOING } }),
      hasStatusFilter
        ? status === 'INITIATED'
          ? prisma.call.count({ where })
          : 0
        : prisma.call.count({ where: { ...where, status: CallStatus.INITIATED } }),
      hasStatusFilter && status !== 'ENDED'
        ? { _avg: { durationSeconds: null } }
        : prisma.call.aggregate({
            where: { ...where, status: CallStatus.ENDED },
            _avg: { durationSeconds: true },
          }),
      prisma.agent.count({
        where: { userId, isActive: true },
      }),
      prisma.call.findMany({
        where,
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: {
          agent: {
            select: { id: true, name: true, voiceId: true, language: true },
          },
        },
      }),
    ]);

    const avgDurationSeconds = Math.round(durationAgg._avg.durationSeconds || 0);
    const successRate = totalCalls > 0 ? Number(((completedCalls / totalCalls) * 100).toFixed(1)) : 0;

    return {
      totalCalls,
      completedCalls,
      failedCalls,
      ongoingCalls,
      initiatedCalls,
      avgDurationSeconds,
      successRate,
      activeAgents,
      recentCalls: recentCalls.map((c) => this.enrichCall(c, true)),
    };
  }

  /**
   * Create a browser-based real-time voice call session via Retell WebRTC.
   * Connects the browser microphone/speaker directly to the published Retell agent.
   * Persists the web call record in PostgreSQL with callType = 'web_call'.
   */
  async createWebCall(
    userId: string,
    input: CreateWebCallInput
  ): Promise<{
    call: EnrichedCall;
    accessToken: string;
    providerCallId: string;
    transport: 'gateway' | 'livekit';
    iceServers?: Array<{ urls: string | string[]; username?: string; credential?: string }>;
  }> {
    // 1. Verify agent ownership and tenant isolation
    const agent = await prisma.agent.findFirst({
      where: {
        id: input.agentId,
        userId,
      },
    });

    if (!agent) {
      throw new AppError('Voice agent not found or access denied', 404, 'AGENT_NOT_FOUND');
    }

    if (!agent.isActive) {
      throw new AppError(
        'Cannot start browser voice session with an inactive agent. Please activate the agent first.',
        400,
        'AGENT_INACTIVE'
      );
    }

    // 2. Dispatch browser web call session via voice provider
    const isMockAgentId = agent.providerAgentId?.startsWith('agent_mock_');
    const providerAgentId =
      (config.PROVIDER_MODE === 'retell' && isMockAgentId)
        ? (config.RETELL_AGENT_ID || 'agent_ba6661e78710d75a9fe62d6451')
        : (agent.providerAgentId || config.RETELL_AGENT_ID || 'agent_ba6661e78710d75a9fe62d6451');
    let providerResult;
    try {
      providerResult = await this.voiceProvider.createWebCall({
        providerAgentId,
        dynamicVariables: input.dynamicVariables,
        metadata: {
          userId,
          agentId: agent.id,
          callType: 'web_call',
        },
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown browser call creation error';
      throw new AppError(
        `Failed to create browser voice call session: ${msg}`,
        502,
        'PROVIDER_DISPATCH_FAILED',
        { error: msg }
      );
    }

    if (!providerResult || !providerResult.providerCallId) {
      throw new AppError(
        'Voice provider returned an invalid session response without a call identifier',
        502,
        'PROVIDER_MALFORMED_RESPONSE'
      );
    }

    // 3. Persist the browser Call in PostgreSQL
    const createdCall = await prisma.call.create({
      data: {
        userId,
        agentId: agent.id,
        providerCallId: providerResult.providerCallId,
        callType: 'web_call',
        fromNumber: 'Browser Client',
        toNumber: agent.name,
        status: CallStatus.INITIATED,
        durationSeconds: 0,
        dynamicVariables: input.dynamicVariables
          ? (input.dynamicVariables as Prisma.InputJsonValue)
          : undefined,
        startedAt: new Date(),
      },
      include: {
        agent: {
          select: { id: true, name: true, voiceId: true, language: true },
        },
      },
    });

    return {
      call: this.enrichCall(createdCall),
      accessToken: providerResult.accessToken,
      providerCallId: providerResult.providerCallId,
      transport: providerResult.transport || 'gateway',
      iceServers: providerResult.iceServers,
    };
  }

  /**
   * Delete or remove a call recording with strict tenant isolation and error handling.
   * Removes recordingUrl and recordingMultiChannelUrl references from PostgreSQL,
   * completely preserving the call history, transcript, duration, sentiment, and metadata.
   */
  async deleteCallRecording(
    userId: string,
    callId: string
  ): Promise<{ call: EnrichedCall; providerDeleted: boolean; message: string }> {
    // 1. Strict tenant verification: confirm call belongs to authenticated user
    const call = await prisma.call.findFirst({
      where: { id: callId, userId },
      include: {
        agent: {
          select: { id: true, name: true, voiceId: true, language: true },
        },
      },
    });

    if (!call) {
      throw new AppError('Call record not found or access denied', 404, 'CALL_NOT_FOUND');
    }

    // 2. Delegate to provider deletion (checks if provider supports isolated recording erasure)
    const providerRes = await this.voiceProvider.deleteRecording(call.providerCallId);

    // 3. Update PostgreSQL: remove recording references from app database
    // Call metadata, transcript, timestamps, and duration are strictly preserved!
    const updatedCall = await prisma.call.update({
      where: { id: call.id },
      data: {
        recordingUrl: null,
        recordingMultiChannelUrl: null,
        recordingStatus: 'removed',
      },
      include: {
        agent: {
          select: { id: true, name: true, voiceId: true, language: true },
        },
      },
    });

    return {
      call: this.enrichCall(updatedCall, true),
      providerDeleted: providerRes.providerDeleted,
      message: providerRes.message,
    };
  }

  /**
   * Asynchronously synchronize call details, transcript, and recording from Retell AI.
   * Useful when webhooks cannot reach local dev environments or to fetch latest data on demand.
   */
  async syncCallDetails(userId: string, callId: string): Promise<EnrichedCall> {
    const call = await prisma.call.findFirst({
      where: { id: callId, userId },
      include: {
        agent: {
          select: { id: true, name: true, voiceId: true, language: true },
        },
      },
    });

    if (!call) {
      throw new AppError('Call record not found or access denied', 404, 'CALL_NOT_FOUND');
    }

    // If mock call, nothing to query from remote provider
    if (call.providerCallId.startsWith('call_mock_')) {
      return this.enrichCall(call, true);
    }

    try {
      const details = await this.voiceProvider.getCallDetails(call.providerCallId);

      const updateData: Prisma.CallUpdateInput = {};

      if (details.status) {
        if (details.status === 'ongoing' && call.status === 'INITIATED') {
          updateData.status = CallStatus.ONGOING;
        } else if (details.status === 'ended') {
          updateData.status = CallStatus.ENDED;
        } else if (details.status === 'failed') {
          updateData.status = CallStatus.FAILED;
        }
      }

      if (details.durationSeconds !== undefined && details.durationSeconds > 0) {
        updateData.durationSeconds = details.durationSeconds;
      }

      if (details.disconnectionReason) {
        updateData.disconnectionReason = details.disconnectionReason;
      }

      if (details.startedAt) {
        updateData.startedAt = new Date(details.startedAt);
      }

      if (details.endedAt) {
        updateData.endedAt = new Date(details.endedAt);
      }

      const meta = details.metadata as Record<string, any> | undefined;
      if (meta) {
        if (meta.transcript) {
          updateData.transcriptText = meta.transcript;
        }
        if (meta.transcriptObject) {
          updateData.transcriptObject = meta.transcriptObject;
        }
        // Only restore recordingUrl if user hasn't explicitly removed it
        if (meta.recordingUrl && call.recordingStatus !== 'removed') {
          updateData.recordingUrl = meta.recordingUrl;
        }
        if (meta.callAnalysis) {
          if (meta.callAnalysis.call_summary) {
            updateData.summary = meta.callAnalysis.call_summary;
          }
          if (meta.callAnalysis.user_sentiment) {
            updateData.sentiment = meta.callAnalysis.user_sentiment;
          }
          if (meta.callAnalysis.call_successful !== undefined) {
            updateData.callSuccessful = meta.callAnalysis.call_successful;
          }
          if (meta.callAnalysis.custom_analysis_data) {
            updateData.customAnalysis = meta.callAnalysis.custom_analysis_data;
          }
        }
      }

      const updated = await prisma.call.update({
        where: { id: call.id },
        data: updateData,
        include: {
          agent: {
            select: { id: true, name: true, voiceId: true, language: true },
          },
        },
      });

      return this.enrichCall(updated, true);
    } catch {
      // If retrieval fails (e.g. call not yet registered or network issue), return current call
      return this.enrichCall(call, true);
    }
  }

  private enrichCall(
    call: Call & {
      agent?: {
        id: string;
        name: string;
        voiceId: string;
        language: string;
      };
    },
    maskFullNumber = false
  ): EnrichedCall {
    const isWebCall = call.callType === 'web_call';
    const maskedTo = isWebCall ? call.toNumber : maskPhoneNumber(call.toNumber);
    const maskedFrom = isWebCall ? call.fromNumber : maskPhoneNumber(call.fromNumber);

    return {
      ...call,
      toNumber: maskFullNumber ? maskedTo : call.toNumber,
      fromNumber: maskFullNumber ? maskedFrom : call.fromNumber,
      maskedToNumber: maskedTo,
      maskedFromNumber: maskedFrom,
      isMock: call.providerCallId.startsWith('call_mock_'),
    };
  }
}

export const callService = new CallService();

