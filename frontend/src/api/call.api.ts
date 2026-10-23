import { apiClient } from './client';

export type CallStatus = 'INITIATED' | 'ONGOING' | 'ENDED' | 'FAILED';

export interface Call {
  id: string;
  userId: string;
  agentId: string;
  providerCallId: string;
  fromNumber: string;
  toNumber: string;
  maskedToNumber?: string;
  maskedFromNumber?: string;
  status: CallStatus;
  durationSeconds: number;
  disconnectionReason?: string | null;
  transcriptText?: string | null;
  recordingUrl?: string | null;
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
};

export default callApi;
