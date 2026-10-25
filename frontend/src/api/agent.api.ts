import { apiClient } from './client';

export interface Agent {
  id: string;
  userId: string;
  providerAgentId: string | null;
  name: string;
  description: string | null;
  voiceId: string;
  language: string;
  systemPrompt: string;
  responsiveness: number;
  interruptionSensitivity: number;
  syncStatus: 'SYNCED' | 'PENDING_SYNC' | 'SYNC_FAILED';
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAgentDTO {
  name: string;
  description?: string | null;
  voiceId: string;
  language?: string;
  systemPrompt: string;
  responsiveness?: number;
  interruptionSensitivity?: number;
  isActive?: boolean;
  providerAgentId?: string | null;
}

export interface UpdateAgentDTO {
  name?: string;
  description?: string | null;
  voiceId?: string;
  language?: string;
  systemPrompt?: string;
  responsiveness?: number;
  interruptionSensitivity?: number;
  isActive?: boolean;
  providerAgentId?: string | null;
}

export interface AgentListResponse {
  agents: Agent[];
  total: number;
  page: number;
  limit: number;
}

export const agentApi = {
  async listAgents(params?: { search?: string; page?: number; limit?: number }): Promise<AgentListResponse> {
    const res = await apiClient.get<{ success: boolean; data: AgentListResponse }>('/agents', {
      params,
    });
    return res.data.data;
  },

  async getAgent(id: string): Promise<Agent> {
    const res = await apiClient.get<{ success: boolean; data: { agent: Agent } }>(`/agents/${id}`);
    return res.data.data.agent;
  },

  async createAgent(data: CreateAgentDTO): Promise<Agent> {
    const res = await apiClient.post<{ success: boolean; data: { agent: Agent } }>('/agents', data);
    return res.data.data.agent;
  },

  async updateAgent(id: string, data: UpdateAgentDTO): Promise<Agent> {
    const res = await apiClient.put<{ success: boolean; data: { agent: Agent } }>(`/agents/${id}`, data);
    return res.data.data.agent;
  },

  async syncRetellAgent(providerAgentId?: string): Promise<Agent> {
    const res = await apiClient.post<{ success: boolean; data: { agent: Agent } }>('/agents/sync', {
      providerAgentId,
    });
    return res.data.data.agent;
  },

  async deleteAgent(id: string): Promise<void> {
    await apiClient.delete(`/agents/${id}`);
  },
};

export default agentApi;
