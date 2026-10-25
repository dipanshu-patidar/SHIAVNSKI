export interface CreateAgentParams {
  name: string;
  voiceId: string;
  language?: string;
  systemPrompt: string;
  responsiveness?: number;
  interruptionSensitivity?: number;
}

export interface UpdateAgentParams {
  name?: string;
  voiceId?: string;
  language?: string;
  systemPrompt?: string;
  responsiveness?: number;
  interruptionSensitivity?: number;
}

export interface ProviderAgentResult {
  providerAgentId: string;
  name: string;
  voiceId: string;
  language: string;
  isMock: boolean;
  metadata?: Record<string, unknown>;
}

export interface ProviderAgentDetails extends ProviderAgentResult {
  systemPrompt: string;
  responsiveness: number;
  interruptionSensitivity: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCallParams {
  fromNumber: string;
  toNumber: string;
  providerAgentId: string;
  dynamicVariables?: Record<string, string>;
  metadata?: Record<string, unknown>;
}

export interface ProviderCallResult {
  providerCallId: string;
  fromNumber: string;
  toNumber: string;
  status: 'initiated' | 'ongoing' | 'ended' | 'failed';
  isMock: boolean;
  metadata?: Record<string, unknown>;
}

export interface ProviderCallDetails extends ProviderCallResult {
  durationSeconds?: number;
  disconnectionReason?: string;
  startedAt?: string;
  endedAt?: string;
}

export interface CreateWebCallParams {
  providerAgentId: string;
  dynamicVariables?: Record<string, string>;
  metadata?: Record<string, unknown>;
}

export interface ProviderWebCallResult {
  providerCallId: string;
  accessToken: string;
  transport?: 'gateway' | 'livekit';
  iceServers?: Array<{ urls: string | string[]; username?: string; credential?: string }>;
  isMock: boolean;
  metadata?: Record<string, unknown>;
}

export interface DeleteRecordingResult {
  providerDeleted: boolean;
  message: string;
}

export interface IVoiceProvider {
  readonly providerName: 'mock' | 'retell';
  readonly isMock: boolean;

  createAgent(params: CreateAgentParams): Promise<ProviderAgentResult>;
  getAgent(providerAgentId: string): Promise<ProviderAgentDetails>;
  updateAgent(providerAgentId: string, params: UpdateAgentParams): Promise<ProviderAgentResult>;
  deleteAgent(providerAgentId: string): Promise<void>;

  createPhoneCall(params: CreateCallParams): Promise<ProviderCallResult>;
  createWebCall(params: CreateWebCallParams): Promise<ProviderWebCallResult>;
  getCallDetails(providerCallId: string): Promise<ProviderCallDetails>;
  deleteRecording(providerCallId: string): Promise<DeleteRecordingResult>;
}

