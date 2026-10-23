import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { DashboardPage } from '../pages/DashboardPage';
import { ToastProvider } from '../context/ToastContext';
import { callApi, DashboardMetrics } from '../api/call.api';
import { agentApi } from '../api/agent.api';

// Mock dependencies
vi.mock('../api/client', () => ({
  apiClient: {
    get: vi.fn().mockImplementation((url: string) => {
      if (url.includes('/health')) {
        return Promise.resolve({
          data: {
            success: true,
            data: {
              status: 'healthy',
              uptime: 3600,
              providerMode: 'mock',
            },
          },
        });
      }
      return Promise.resolve({ data: { success: true } });
    }),
  },
}));

vi.mock('../api/call.api', () => ({
  callApi: {
    getDashboardMetrics: vi.fn(),
    simulateCallStep: vi.fn(),
  },
}));

vi.mock('../api/agent.api', () => ({
  agentApi: {
    listAgents: vi.fn(),
  },
}));

const mockMetrics: DashboardMetrics = {
  totalCalls: 12,
  completedCalls: 10,
  failedCalls: 1,
  ongoingCalls: 1,
  initiatedCalls: 0,
  avgDurationSeconds: 145,
  successRate: 83.3,
  activeAgents: 3,
  recentCalls: [
    {
      id: 'call_1',
      userId: 'usr_1',
      agentId: 'agent_1',
      providerCallId: 'call_mock_123',
      fromNumber: '+1 (415) ***-1234',
      toNumber: '+1 (415) ***-2671',
      maskedToNumber: '+1 (415) ***-2671',
      maskedFromNumber: '+1 (415) ***-1234',
      status: 'ENDED',
      durationSeconds: 145,
      disconnectionReason: 'simulated_user_hangup',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      agent: {
        id: 'agent_1',
        name: 'Inbound Customer Bot',
        voiceId: '11labs-Adrian',
        language: 'en-US',
      },
    },
  ],
};

describe('Dynamic Dashboard Page (DashboardPage)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(agentApi.listAgents).mockResolvedValue({
      agents: [
        {
          id: 'agent_1',
          userId: 'usr_1',
          providerAgentId: 'agent_mock_123',
          name: 'Inbound Customer Bot',
          description: 'Handles customer calls',
          voiceId: '11labs-Adrian',
          language: 'en-US',
          systemPrompt: 'Assist customers',
          responsiveness: 1.0,
          interruptionSensitivity: 0.8,
          syncStatus: 'SYNCED',
          isActive: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
      total: 1,
      page: 1,
      limit: 100,
    });
  });

  it('renders dynamic KPIs calculated from persisted database records', async () => {
    vi.mocked(callApi.getDashboardMetrics).mockResolvedValue(mockMetrics);

    render(
      <BrowserRouter>
        <ToastProvider>
          <DashboardPage />
        </ToastProvider>
      </BrowserRouter>
    );

    // Verify operations dashboard header and mock status badge
    expect(screen.getByText('Operations Dashboard')).toBeInTheDocument();
    expect(screen.getByText('MOCK/SIMULATED')).toBeInTheDocument();

    await waitFor(() => {
      expect(callApi.getDashboardMetrics).toHaveBeenCalled();
    });

    // Wait for API metrics to load and display in KPI cards
    await waitFor(() => {
      expect(screen.getByText('12')).toBeInTheDocument(); // Total Calls
    });
    expect(screen.getAllByText('2m 25s').length).toBeGreaterThanOrEqual(1); // Avg Duration & Call Row Duration
    expect(screen.getByText('83.3%')).toBeInTheDocument(); // Success Rate
    expect(screen.getByText('3')).toBeInTheDocument(); // Active Agents

    // Sub-metric details
    expect(screen.getByText(/10 completed/i)).toBeInTheDocument();
    expect(screen.getByText(/1 active/i)).toBeInTheDocument();
    expect(screen.getByText(/1 failed/i)).toBeInTheDocument();

    // Verify recent call row rendered
    expect(screen.getByText('+1 (415) ***-2671')).toBeInTheDocument();
    expect(screen.getAllByText('Inbound Customer Bot').length).toBeGreaterThanOrEqual(1);
  });

  it('updates dashboard query when changing date range, agent, and status filters', async () => {
    vi.mocked(callApi.getDashboardMetrics).mockResolvedValue(mockMetrics);

    render(
      <BrowserRouter>
        <ToastProvider>
          <DashboardPage />
        </ToastProvider>
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(callApi.getDashboardMetrics).toHaveBeenCalledTimes(1);
    });

    // Change Date Range filter to 24h
    const dateRangeSelect = screen.getByLabelText(/Date Range/i);
    fireEvent.change(dateRangeSelect, { target: { value: '24h' } });

    await waitFor(() => {
      expect(callApi.getDashboardMetrics).toHaveBeenCalledTimes(2);
    });

    // Change Status filter to ENDED
    const statusSelect = screen.getByLabelText(/Status/i);
    fireEvent.change(statusSelect, { target: { value: 'ENDED' } });

    await waitFor(() => {
      expect(callApi.getDashboardMetrics).toHaveBeenCalledTimes(3);
    });
  });

  it('renders clean zero-call empty state when user has no call records', async () => {
    vi.mocked(callApi.getDashboardMetrics).mockResolvedValue({
      totalCalls: 0,
      completedCalls: 0,
      failedCalls: 0,
      ongoingCalls: 0,
      initiatedCalls: 0,
      avgDurationSeconds: 0,
      successRate: 0,
      activeAgents: 1,
      recentCalls: [],
    });

    render(
      <BrowserRouter>
        <ToastProvider>
          <DashboardPage />
        </ToastProvider>
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('No call records found')).toBeInTheDocument();
      expect(screen.getByText('Launch First Call')).toBeInTheDocument();
    });

    // Confirm 0 values in KPI cards without NaN or division errors
    expect(screen.getByText('0')).toBeInTheDocument();
    expect(screen.getByText('0m 0s')).toBeInTheDocument();
    expect(screen.getByText('0.0%')).toBeInTheDocument();
  });

  it('opens CallDetailsModal when Inspect button is clicked on recent call record', async () => {
    vi.mocked(callApi.getDashboardMetrics).mockResolvedValue(mockMetrics);

    render(
      <BrowserRouter>
        <ToastProvider>
          <DashboardPage />
        </ToastProvider>
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Inspect')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Inspect'));

    // Details modal opens showing destination and provider ID
    await waitFor(() => {
      expect(screen.getByText('Call Record Details')).toBeInTheDocument();
      expect(screen.getByText('call_mock_123')).toBeInTheDocument();
    });
  });
});
