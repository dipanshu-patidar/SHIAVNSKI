import {
  IVoiceProvider,
  CreateAgentParams,
  UpdateAgentParams,
  ProviderAgentResult,
  ProviderAgentDetails,
  CreateCallParams,
  ProviderCallResult,
  ProviderCallDetails,
  CreateWebCallParams,
  ProviderWebCallResult,
  DeleteRecordingResult,
} from './voice-provider.interface.js';

export class MockVoiceProvider implements IVoiceProvider {
  public readonly providerName = 'mock' as const;
  public readonly isMock = true as const;

  // In-memory simulation store for local development/testing
  private mockAgents: Map<string, ProviderAgentDetails> = new Map();
  private mockCalls: Map<string, ProviderCallDetails> = new Map();

  async createAgent(params: CreateAgentParams): Promise<ProviderAgentResult> {
    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).substring(2, 8);
    // Explicit mock prefix for unmistakable transparency (REQ-ARCH-03)
    const providerAgentId = `agent_mock_${timestamp}_${randomSuffix}`;

    const agentDetails: ProviderAgentDetails = {
      providerAgentId,
      name: params.name,
      voiceId: params.voiceId,
      language: params.language || 'en-US',
      systemPrompt: params.systemPrompt,
      responsiveness: params.responsiveness ?? 1.0,
      interruptionSensitivity: params.interruptionSensitivity ?? 0.8,
      isMock: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      metadata: {
        simulated: true,
        simulationEngine: 'MockVoiceProvider-v1',
      },
    };

    this.mockAgents.set(providerAgentId, agentDetails);

    return {
      providerAgentId,
      name: agentDetails.name,
      voiceId: agentDetails.voiceId,
      language: agentDetails.language,
      isMock: true,
      metadata: agentDetails.metadata,
    };
  }

  async getAgent(providerAgentId: string): Promise<ProviderAgentDetails> {
    const existing = this.mockAgents.get(providerAgentId);
    if (existing) {
      return existing;
    }

    // Support published Retell Agent ID in mock simulation mode
    if (
      providerAgentId === 'agent_ba6661e78710d75a9fe62d6451' ||
      providerAgentId.startsWith('agent_ba666')
    ) {
      return {
        providerAgentId,
        name: 'Shiavnski AI Assistant',
        voiceId: 'retell-Cimo',
        language: 'en-US',
        systemPrompt:
          '# Role\nYou are the AI Voice Assistant for Shiavnski Technologies.\n\n# Objective\nHelp callers with general enquiries about the company, its software services, and how to contact the team.',
        responsiveness: 1.0,
        interruptionSensitivity: 0.9,
        isMock: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        metadata: { simulated: true, agentSource: 'retell_published_agent' },
      };
    }

    // Return synthesized details for any agent_mock_* id
    return {
      providerAgentId,
      name: 'Simulated Voice Agent',
      voiceId: '11labs-Adrian',
      language: 'en-US',
      systemPrompt: 'Simulated prompt for zero-credential testing.',
      responsiveness: 1.0,
      interruptionSensitivity: 0.8,
      isMock: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      metadata: { simulated: true },
    };
  }

  async updateAgent(
    providerAgentId: string,
    params: UpdateAgentParams
  ): Promise<ProviderAgentResult> {
    const existing = this.mockAgents.get(providerAgentId);
    const updated: ProviderAgentDetails = {
      providerAgentId,
      name: params.name ?? existing?.name ?? 'Updated Simulated Agent',
      voiceId: params.voiceId ?? existing?.voiceId ?? '11labs-Adrian',
      language: params.language ?? existing?.language ?? 'en-US',
      systemPrompt: params.systemPrompt ?? existing?.systemPrompt ?? '',
      responsiveness: params.responsiveness ?? existing?.responsiveness ?? 1.0,
      interruptionSensitivity:
        params.interruptionSensitivity ?? existing?.interruptionSensitivity ?? 0.8,
      isMock: true,
      createdAt: existing?.createdAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      metadata: {
        simulated: true,
        lastModified: new Date().toISOString(),
      },
    };

    this.mockAgents.set(providerAgentId, updated);

    return {
      providerAgentId,
      name: updated.name,
      voiceId: updated.voiceId,
      language: updated.language,
      isMock: true,
      metadata: updated.metadata,
    };
  }

  async deleteAgent(providerAgentId: string): Promise<void> {
    this.mockAgents.delete(providerAgentId);
  }

  /**
   * Outbound Call Operations (Phase 3)
   */
  async createPhoneCall(params: CreateCallParams): Promise<ProviderCallResult> {
    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).substring(2, 8);
    // Explicit mock call identifier prefix (REQ-ARCH-03)
    const providerCallId = `call_mock_${timestamp}_${randomSuffix}`;

    const callDetails: ProviderCallDetails = {
      providerCallId,
      fromNumber: params.fromNumber,
      toNumber: params.toNumber,
      status: 'initiated',
      isMock: true,
      startedAt: new Date().toISOString(),
      metadata: {
        simulated: true,
        simulationEngine: 'MockVoiceProvider-v1',
        providerAgentId: params.providerAgentId,
        dynamicVariablesCount: params.dynamicVariables ? Object.keys(params.dynamicVariables).length : 0,
        ...params.metadata,
      },
    };

    this.mockCalls.set(providerCallId, callDetails);

    return {
      providerCallId,
      fromNumber: callDetails.fromNumber,
      toNumber: callDetails.toNumber,
      status: callDetails.status,
      isMock: true,
      metadata: callDetails.metadata,
    };
  }

  async createWebCall(params: CreateWebCallParams): Promise<ProviderWebCallResult> {
    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).substring(2, 8);
    const providerCallId = `call_mock_web_${timestamp}_${randomSuffix}`;
    const accessToken = `mock_access_token_${timestamp}_${randomSuffix}`;

    const callDetails: ProviderCallDetails = {
      providerCallId,
      fromNumber: 'Browser Client',
      toNumber: 'Shiavnski AI Assistant',
      status: 'initiated',
      isMock: true,
      startedAt: new Date().toISOString(),
      metadata: {
        simulated: true,
        simulationEngine: 'MockVoiceProvider-WebCall-v1',
        providerAgentId: params.providerAgentId,
        dynamicVariablesCount: params.dynamicVariables ? Object.keys(params.dynamicVariables).length : 0,
        ...params.metadata,
      },
    };

    this.mockCalls.set(providerCallId, callDetails);

    return {
      providerCallId,
      accessToken,
      transport: 'gateway',
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
      isMock: true,
      metadata: callDetails.metadata,
    };
  }

  async deleteRecording(providerCallId: string): Promise<DeleteRecordingResult> {
    const existing = this.mockCalls.get(providerCallId);
    if (existing && existing.metadata) {
      delete existing.metadata.recordingUrl;
    }
    return {
      providerDeleted: true,
      message: 'Simulated recording reference deleted [MOCK]',
    };
  }

  async endCall(providerCallId: string): Promise<void> {
    const existing = this.mockCalls.get(providerCallId);
    if (existing) {
      existing.status = 'ended';
      existing.endedAt = new Date().toISOString();
      existing.disconnectionReason = 'user_hangup';
    }
  }

  async getCallDetails(providerCallId: string): Promise<ProviderCallDetails> {
    const existing = this.mockCalls.get(providerCallId);
    if (existing) {
      return existing;
    }

    return {
      providerCallId,
      fromNumber: '+14155551234',
      toNumber: '+14155552671',
      status: 'initiated',
      isMock: true,
      durationSeconds: 0,
      startedAt: new Date().toISOString(),
      metadata: { simulated: true },
    };
  }
}
