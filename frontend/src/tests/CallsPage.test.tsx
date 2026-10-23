import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { CallsPage } from '../pages/CallsPage';
import { ToastProvider } from '../context/ToastContext';
import { callApi, Call } from '../api/call.api';
import { agentApi } from '../api/agent.api';

const mockCallsList: Call[] = [
  {
    id: 'call_1',
    userId: 'usr_1',
    agentId: 'agent_1',
    providerCallId: 'call_mock_1001_abc',
    fromNumber: '+14155551234',
    toNumber: '+14155552671',
    maskedToNumber: '+1 (415) ***-2671',
    status: 'INITIATED',
    durationSeconds: 45,
    isMock: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    agent: {
      id: 'agent_1',
      name: 'Sales Concierge',
      voiceId: '11labs-Adrian',
      language: 'en-US',
    },
  },
  {
    id: 'call_2',
    userId: 'usr_1',
    agentId: 'agent_2',
    providerCallId: 'call_mock_1002_xyz',
    fromNumber: '+14155551234',
    toNumber: '+12025550143',
    maskedToNumber: '+1 (202) ***-0143',
    status: 'ENDED',
    durationSeconds: 120,
    isMock: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    agent: {
      id: 'agent_2',
      name: 'Support Agent',
      voiceId: '11labs-Sarah',
      language: 'en-US',
    },
  },
];

vi.mock('../api/call.api', () => ({
  callApi: {
    listCalls: vi.fn(),
    getCall: vi.fn(),
    initiateCall: vi.fn(),
  },
}));

vi.mock('../api/agent.api', () => ({
  agentApi: {
    listAgents: vi.fn(),
  },
}));

describe('Call History Page (CallsPage)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(agentApi.listAgents).mockResolvedValue({
      agents: [],
      total: 0,
      page: 1,
      limit: 100,
    });
    vi.mocked(callApi.listCalls).mockResolvedValue({
      calls: [...mockCallsList],
      total: 2,
      page: 1,
      limit: 15,
      totalPages: 1,
    });
  });

  it('renders call records table with masked phone numbers and mock tags', async () => {
    render(
      <ToastProvider>
        <BrowserRouter>
          <CallsPage />
        </BrowserRouter>
      </ToastProvider>
    );

    // Wait for calls to load
    await waitFor(() => {
      expect(screen.getByText('+1 (415) ***-2671')).toBeInTheDocument();
      expect(screen.getByText('+1 (202) ***-0143')).toBeInTheDocument();
    });

    // Check statuses
    expect(screen.getByText('Initiated')).toBeInTheDocument();
    expect(screen.getByText('Ended')).toBeInTheDocument();

    // Check Mock indicator
    const mockTags = screen.getAllByText('MOCK');
    expect(mockTags.length).toBeGreaterThan(0);

    // Check agents displayed
    expect(screen.getByText('Sales Concierge')).toBeInTheDocument();
    expect(screen.getByText('Support Agent')).toBeInTheDocument();
  });

  it('supports searching calls by destination number or provider call ID', async () => {
    render(
      <ToastProvider>
        <BrowserRouter>
          <CallsPage />
        </BrowserRouter>
      </ToastProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('+1 (415) ***-2671')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(/Search by destination phone/i);
    fireEvent.change(searchInput, { target: { value: '415' } });

    expect(callApi.listCalls).toHaveBeenCalledWith(
      expect.objectContaining({
        search: '415',
      })
    );
  });

  it('opens Call Details modal when clicking Details button', async () => {
    render(
      <ToastProvider>
        <BrowserRouter>
          <CallsPage />
        </BrowserRouter>
      </ToastProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('+1 (415) ***-2671')).toBeInTheDocument();
    });

    const detailsBtns = screen.getAllByRole('button', { name: /View details for call/i });
    fireEvent.click(detailsBtns[0]);

    // Modal opens
    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Call Record Details' })).toBeInTheDocument();
    expect(within(dialog).getByText('call_mock_1001_abc')).toBeInTheDocument();
  });
});
