import { apiClient } from './client';

export type CallStatus = 'INITIATED' | 'ONGOING' | 'ENDED' | 'FAILED';

export interface TranscriptTurn {
  role: 'agent' | 'user' | string;
  content: string;
  words?: Array<{ word: string; start?: number; end?: number }>;
}

export interface Call {
  id: string;
  userId: string;
  agentId: string;
  providerCallId: string;
  callType?: 'phone_call' | 'web_call' | string;
  recordingStatus?: 'available' | 'removed' | string | null;
  fromNumber: string;
  toNumber: string;
  maskedToNumber?: string;
  maskedFromNumber?: string;
  status: CallStatus;
  durationSeconds: number;
  disconnectionReason?: string | null;
  transcriptText?: string | null;
  transcriptObject?: TranscriptTurn[] | null;
  recordingUrl?: string | null;
  recordingMultiChannelUrl?: string | null;
  summary?: string | null;
  sentiment?: string | null;
  dynamicVariables?: Record<string, string> | null;
  startedAt?: string | null;
  endedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  isMock?: boolean;
  agent?: {
    id: string;
    name: string;
    voiceId: string;
    language: string;
  };
}

export interface CreateCallDTO {
  agentId: string;
  toNumber: string;
  fromNumber?: string;
  dynamicVariables?: Record<string, string>;
}

export interface ListCallsParams {
  page?: number;
  limit?: number;
  status?: CallStatus;
  agentId?: string;
  search?: string;
  startDate?: string;
  endDate?: string;
  sortBy?: 'createdAt' | 'durationSeconds' | 'status';
  sortOrder?: 'asc' | 'desc';
}

export interface CallListResponse {
  calls: Call[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface DashboardMetrics {
  totalCalls: number;
  completedCalls: number;
  failedCalls: number;
  ongoingCalls: number;
  initiatedCalls: number;
  avgDurationSeconds: number;
  successRate: number;
  activeAgents: number;
  recentCalls: Call[];
}

export interface DashboardFilterParams {
  startDate?: string;
  endDate?: string;
  agentId?: string;
  status?: string;
}

export interface WebCallResponse {
  call: Call;
  accessToken: string;
  providerCallId?: string;
  transport?: 'gateway' | 'livekit';
  iceServers?: Array<{ urls: string | string[]; username?: string; credential?: string }>;
}

export const callApi = {
  async initiateCall(data: CreateCallDTO, idempotencyKey?: string): Promise<Call> {
    const headers: Record<string, string> = {};
    if (idempotencyKey) {
      headers['X-Idempotency-Key'] = idempotencyKey;
    }

    const res = await apiClient.post<{ success: boolean; data: { call: Call } }>(
      '/calls',
      data,
      { headers }
    );
    return res.data.data.call;
  },

  async listCalls(params?: ListCallsParams): Promise<CallListResponse> {
    const res = await apiClient.get<{ success: boolean; data: CallListResponse }>('/calls', {
      params,
    });
    return res.data.data;
  },

  async getCall(id: string): Promise<Call> {
    const res = await apiClient.get<{ success: boolean; data: { call: Call } }>(`/calls/${id}`);
    return res.data.data.call;
  },

  async getDashboardMetrics(params?: DashboardFilterParams): Promise<DashboardMetrics> {
    const res = await apiClient.get<{ success: boolean; data: DashboardMetrics }>('/calls/stats', {
      params,
    });
    return res.data.data;
  },

  async simulateCallStep(id: string): Promise<Call> {
    const res = await apiClient.post<{ success: boolean; data: { call: Call } }>(
      `/calls/${id}/simulate-step`
    );
    return res.data.data.call;
  },

  async startWebCall(data: {
    agentId: string;
    dynamicVariables?: Record<string, string>;
  }): Promise<WebCallResponse> {
    const res = await apiClient.post<{
      success: boolean;
      data: WebCallResponse;
    }>('/calls/web-call', data);
    return res.data.data;
  },

  async deleteRecording(id: string): Promise<{
    call: Call;
    providerDeleted: boolean;
    message: string;
  }> {
    const res = await apiClient.delete<{
      success: boolean;
      data: { call: Call; providerDeleted: boolean };
      message: string;
    }>(`/calls/${id}/recording`);
    return {
      call: res.data.data.call,
      providerDeleted: res.data.data.providerDeleted,
      message: res.data.message,
    };
  },

  async syncCall(id: string): Promise<Call> {
    const res = await apiClient.post<{ success: boolean; data: { call: Call } }>(
      `/calls/${id}/sync`
    );
    return res.data.data.call;
  },
};

export default callApi;
