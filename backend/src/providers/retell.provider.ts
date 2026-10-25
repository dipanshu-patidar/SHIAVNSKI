import Retell from 'retell-sdk';
import https from 'node:https';
import dns from 'node:dns/promises';
import { config } from '../config/index.js';
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

// Resilient DNS resolver to prevent IPv6 NAT64 timeout issues on Windows
const resolver = new dns.Resolver();
try {
  resolver.setServers(['1.1.1.1', '8.8.8.8']);
} catch {
  // Ignore fallback failure
}

const lookup = (hostname: string, options: any, callback: any) => {
  const cb = typeof options === 'function' ? options : callback;
  const opts = typeof options === 'object' ? options : {};
  resolver.resolve4(hostname)
    .then((addrs) => {
      if (opts.all) {
        cb(null, addrs.map((a) => ({ address: a, family: 4 })));
      } else {
        cb(null, addrs[0], 4);
      }
    })
    .catch((err) => cb(err));
};

const httpsAgent = new https.Agent({ lookup, keepAlive: true });

const createResilientFetch = () => {
  return (url: any, init: any = {}) => {
    return new Promise<Response>((resolve, reject) => {
      const parsed = new URL(url.toString());
      const headers = new Headers(init.headers);
      const reqHeaders = Object.fromEntries(headers.entries());

      const req = https.request(parsed, {
        method: init.method || 'GET',
        headers: reqHeaders,
        agent: httpsAgent,
      }, (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => {
          const body = Buffer.concat(chunks);
          const finalBody = (body.length === 0 && (res.statusCode === 204 || res.statusCode === 200))
            ? Buffer.from('{}')
            : body;
          resolve(new Response(finalBody, {
            status: res.statusCode,
            statusText: res.statusMessage,
            headers: res.headers as any,
          }));
        });
      });
      req.on('error', reject);
      if (init.body) {
        req.write(init.body);
      }
      req.end();
    });
  };
};

export interface RetellConnectivityCheckResult {
  connected: boolean;
  statusCode?: number;
  message: string;
  hasApiKey: boolean;
  callerNumberConfigured: string;
  fromNumberStatus: 'verified_in_account' | 'not_in_account' | 'no_numbers_in_account' | 'unverified';
  registeredPhoneNumbers: string[];
  agentCount: number;
  voiceCount: number;
  timestamp: string;
}

export class RetellVoiceProvider implements IVoiceProvider {
  public readonly providerName = 'retell' as const;
  public readonly isMock = false as const;
  private client: Retell;

  constructor(apiKey?: string) {
    const key = apiKey !== undefined ? apiKey : config.RETELL_API_KEY;
    if (!key || key.trim() === '') {
      throw new Error(
        'RetellVoiceProvider requires a valid RETELL_API_KEY in environment configuration'
      );
    }
    this.client = new Retell({
      apiKey: key,
      fetch: createResilientFetch() as any,
    });
  }

  /**
   * Create an AI Voice Agent in Retell AI.
   * Provisions a backing Retell LLM Response Engine and links it to the Agent.
   */
  async createAgent(params: CreateAgentParams): Promise<ProviderAgentResult> {
    try {
      // Step 1: Provision the Retell LLM Response Engine for the agent persona
      const llm = await this.client.llm.create({
        general_prompt: params.systemPrompt,
      });

      // Step 2: Create the Voice Agent bound to the LLM response engine
      const agent = await this.client.agent.create({
        agent_name: params.name,
        voice_id: params.voiceId,
        language: (params.language as any) || 'en-US',
        response_engine: {
          type: 'retell-llm',
          llm_id: llm.llm_id,
        },
        responsiveness: params.responsiveness ?? 1.0,
        interruption_sensitivity: params.interruptionSensitivity ?? 0.8,
      });

      return {
        providerAgentId: agent.agent_id,
        name: agent.agent_name || params.name,
        voiceId: agent.voice_id,
        language: (agent.language as string) || 'en-US',
        isMock: false,
        metadata: {
          llmId: llm.llm_id,
          lastModificationTimestamp: agent.last_modification_timestamp,
        },
      };
    } catch (error: any) {
      throw new Error(`Retell agent creation failed: ${error?.message || 'Unknown provider error'}`);
    }
  }

  /**
   * Retrieve Agent details from Retell AI.
   */
  async getAgent(providerAgentId: string): Promise<ProviderAgentDetails> {
    try {
      const agent = await this.client.agent.retrieve(providerAgentId);

      let prompt = '';
      if (agent.response_engine?.type === 'retell-llm' && agent.response_engine.llm_id) {
        try {
          const llm = await this.client.llm.retrieve(agent.response_engine.llm_id);
          prompt = llm.general_prompt || '';
        } catch {
          prompt = '';
        }
      }

      return {
        providerAgentId: agent.agent_id,
        name: agent.agent_name || 'Retell Voice Agent',
        voiceId: agent.voice_id,
        language: (agent.language as string) || 'en-US',
        systemPrompt: prompt,
        responsiveness: agent.responsiveness ?? 1.0,
        interruptionSensitivity: agent.interruption_sensitivity ?? 0.8,
        isMock: false,
        createdAt: new Date(agent.last_modification_timestamp || Date.now()).toISOString(),
        updatedAt: new Date(agent.last_modification_timestamp || Date.now()).toISOString(),
        metadata: {
          responseEngineType: agent.response_engine?.type,
        },
      };
    } catch (error: any) {
      throw new Error(`Retell agent retrieval failed: ${error?.message || 'Agent not found'}`);
    }
  }

  /**
   * Update Agent in Retell AI.
   */
  async updateAgent(
    providerAgentId: string,
    params: UpdateAgentParams
  ): Promise<ProviderAgentResult> {
    try {
      const updateBody: any = {};
      if (params.name) updateBody.agent_name = params.name;
      if (params.voiceId) updateBody.voice_id = params.voiceId;
      if (params.language) updateBody.language = params.language;
      if (params.responsiveness !== undefined) updateBody.responsiveness = params.responsiveness;
      if (params.interruptionSensitivity !== undefined) {
        updateBody.interruption_sensitivity = params.interruptionSensitivity;
      }

      const agent = await this.client.agent.update(providerAgentId, updateBody);

      // If system prompt changed and agent uses Retell LLM, update the backing LLM prompt
      if (
        params.systemPrompt &&
        agent.response_engine?.type === 'retell-llm' &&
        agent.response_engine.llm_id
      ) {
        await this.client.llm.update(agent.response_engine.llm_id, {
          general_prompt: params.systemPrompt,
        });
      }

      return {
        providerAgentId: agent.agent_id,
        name: agent.agent_name || 'Updated Retell Agent',
        voiceId: agent.voice_id,
        language: (agent.language as string) || 'en-US',
        isMock: false,
        metadata: {
          lastModificationTimestamp: agent.last_modification_timestamp,
        },
      };
    } catch (error: any) {
      throw new Error(`Retell agent update failed: ${error?.message || 'Unknown provider error'}`);
    }
  }

  /**
   * Delete Agent in Retell AI.
   */
  async deleteAgent(providerAgentId: string): Promise<void> {
    try {
      await this.client.agent.delete(providerAgentId);
    } catch (error: any) {
      throw new Error(`Retell agent deletion failed: ${error?.message || 'Unknown provider error'}`);
    }
  }

  /**
   * Dispatch an outbound phone call via Retell AI telephony.
   */
  async createPhoneCall(params: CreateCallParams): Promise<ProviderCallResult> {
    try {
      const call = await this.client.call.createPhoneCall({
        from_number: params.fromNumber,
        to_number: params.toNumber,
        override_agent_id: params.providerAgentId,
        retell_llm_dynamic_variables: params.dynamicVariables,
        metadata: params.metadata,
      });

      let status: 'initiated' | 'ongoing' | 'ended' | 'failed' = 'initiated';
      if (call.call_status === 'ongoing') status = 'ongoing';
      else if (call.call_status === 'ended') status = 'ended';
      else if (call.call_status === 'error') status = 'failed';

      return {
        providerCallId: call.call_id,
        fromNumber: call.from_number,
        toNumber: call.to_number,
        status,
        isMock: false,
        metadata: {
          agentId: call.agent_id,
          callStatus: call.call_status,
          startTimestamp: call.start_timestamp,
        },
      };
    } catch (error: any) {
      throw new Error(`Retell outbound call dispatch failed: ${error?.message || 'Provider error'}`);
    }
  }

  /**
   * Create a browser WebRTC call session via Retell AI.
   * Returns call_id and access_token used by the Retell Web Client SDK.
   */
  async createWebCall(params: CreateWebCallParams): Promise<ProviderWebCallResult> {
    try {
      const call = await this.client.call.createWebCall({
        agent_id: params.providerAgentId,
        retell_llm_dynamic_variables: params.dynamicVariables,
        metadata: params.metadata,
      });

      const transport = ((call as any).transport as 'gateway' | 'livekit') || 'gateway';
      const iceServers = (call as any).ice_servers || [];

      console.log(
        `[RetellVoiceProvider] Created WebRTC call session: id=${call.call_id}, transport=${transport}, iceServersCount=${iceServers.length}`
      );

      return {
        providerCallId: call.call_id,
        accessToken: call.access_token,
        transport,
        iceServers,
        isMock: false,
        metadata: {
          agentId: (call as any).agent_id,
          expiresAt: (call as any).expires_at,
        },
      };
    } catch (error: any) {
      throw new Error(`Retell browser web call creation failed: ${error?.message || 'Provider error'}`);
    }
  }

  /**
   * Delete or remove call recording.
   * Retell AI does not support isolated deletion of the audio recording without erasing the entire remote call.
   */
  async deleteRecording(_providerCallId: string): Promise<DeleteRecordingResult> {
    return {
      providerDeleted: false,
      message:
        'Retell AI does not provide an isolated recording-deletion API without erasing the entire remote call record. The recording reference has been safely removed from this application.',
    };
  }

  /**
   * Retrieve Call details from Retell AI.
   */
  async getCallDetails(providerCallId: string): Promise<ProviderCallDetails> {
    try {
      const call = await this.client.call.retrieve(providerCallId);

      let status: 'initiated' | 'ongoing' | 'ended' | 'failed' = 'initiated';
      if (call.call_status === 'ongoing') status = 'ongoing';
      else if (call.call_status === 'ended') status = 'ended';
      else if (call.call_status === 'error') status = 'failed';

      const durationSeconds = call.duration_ms ? Math.round(call.duration_ms / 1000) : 0;

      return {
        providerCallId: call.call_id,
        fromNumber: (call as any).from_number || '',
        toNumber: (call as any).to_number || '',
        status,
        isMock: false,
        durationSeconds,
        disconnectionReason: call.disconnection_reason,
        startedAt: call.start_timestamp ? new Date(call.start_timestamp).toISOString() : undefined,
        endedAt: call.end_timestamp ? new Date(call.end_timestamp).toISOString() : undefined,
        metadata: {
          callStatus: call.call_status,
          transcript: call.transcript,
          transcriptObject: (call as any).transcript_object,
          recordingUrl: call.recording_url,
          callAnalysis: (call as any).call_analysis,
        },
      };
    } catch (error: any) {
      throw new Error(`Retell call retrieval failed: ${error?.message || 'Call not found'}`);
    }
  }

  /**
   * Safe, 100% read-only connectivity check.
   * Performs read operations (phoneNumber.list, agent.list, voice.list) without creating or mutating anything.
   */
  async checkConnectivity(): Promise<RetellConnectivityCheckResult> {
    const configuredFromNumber = config.RETELL_FROM_NUMBER || '';

    try {
      // 1. List phone numbers in Retell account (read-only)
      const phoneNumbersResponse = await this.client.phoneNumber.list();
      const phoneItems = Array.isArray(phoneNumbersResponse)
        ? phoneNumbersResponse
        : (phoneNumbersResponse as any)?.items || [];
      const registeredPhoneNumbers = phoneItems
        .map((p: any) => p.phone_number || p.number)
        .filter(Boolean);

      // 2. List agents in Retell account (read-only)
      let agentCount = 0;
      try {
        const agentsResponse = await this.client.agent.list();
        const agentItems = Array.isArray(agentsResponse)
          ? agentsResponse
          : (agentsResponse as any)?.items || [];
        agentCount = agentItems.length;
      } catch {
        agentCount = 0;
      }

      // 3. List voices in Retell account (read-only)
      let voiceCount = 0;
      try {
        const voicesResponse = await this.client.voice.list();
        voiceCount = Array.isArray(voicesResponse) ? voicesResponse.length : 0;
      } catch {
        voiceCount = 0;
      }

      // 4. Verify whether configured RETELL_FROM_NUMBER is registered in the account
      let fromNumberStatus: RetellConnectivityCheckResult['fromNumberStatus'] = 'unverified';
      if (registeredPhoneNumbers.length === 0) {
        fromNumberStatus = 'no_numbers_in_account';
      } else if (configuredFromNumber && registeredPhoneNumbers.includes(configuredFromNumber)) {
        fromNumberStatus = 'verified_in_account';
      } else {
        fromNumberStatus = 'not_in_account';
      }

      return {
        connected: true,
        statusCode: 200,
        message: 'Successfully authenticated with Retell AI API',
        hasApiKey: true,
        callerNumberConfigured: configuredFromNumber,
        fromNumberStatus,
        registeredPhoneNumbers,
        agentCount,
        voiceCount,
        timestamp: new Date().toISOString(),
      };
    } catch (error: any) {
      const statusCode = error?.status || error?.statusCode || (error?.name === 'AuthenticationError' ? 401 : 500);
      return {
        connected: false,
        statusCode,
        message: error?.message || 'Failed to authenticate with Retell API',
        hasApiKey: true,
        callerNumberConfigured: configuredFromNumber,
        fromNumberStatus: 'unverified',
        registeredPhoneNumbers: [],
        agentCount: 0,
        voiceCount: 0,
        timestamp: new Date().toISOString(),
      };
    }
  }
}
