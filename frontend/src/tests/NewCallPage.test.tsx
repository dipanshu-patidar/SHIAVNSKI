import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { NewCallPage } from '../pages/NewCallPage';
import { ToastProvider } from '../context/ToastContext';
import { agentApi, Agent } from '../api/agent.api';
import { callApi, Call } from '../api/call.api';

const mockAgent: Agent = {
  id: 'agent_cuid_test1',
  userId: 'usr_1',
  providerAgentId: 'agent_mock_123',
  name: 'Sales Concierge Pro',
  description: 'Inbound sales agent',
  voiceId: '11labs-Adrian',
  language: 'en-US',
  systemPrompt: 'You are an AI sales assistant helping customers book appointments.',
  responsiveness: 1.0,
  interruptionSensitivity: 0.8,
  syncStatus: 'SYNCED',
  isActive: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const mockCallResponse: Call = {
  id: 'call_cuid_999',
  userId: 'usr_1',
  agentId: 'agent_cuid_test1',
  providerCallId: 'call_mock_1700000000_abc',
  fromNumber: '+14155551234',
  toNumber: '+14155552671',
  maskedToNumber: '+1 (415) ***-2671',
  status: 'INITIATED',
  durationSeconds: 0,
  isMock: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

vi.mock('../api/agent.api', () => ({
  agentApi: {
    listAgents: vi.fn(),
  },
}));

vi.mock('../api/call.api', () => ({
  callApi: {
    initiateCall: vi.fn(),
  },
}));

describe('Make a Call / Outbound Call Dispatch Page (NewCallPage)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(agentApi.listAgents).mockResolvedValue({
      agents: [mockAgent],
      total: 1,
      page: 1,
      limit: 100,
    });
    vi.mocked(callApi.initiateCall).mockResolvedValue(mockCallResponse);
  });

  it('renders agent selector with user agents, selected agent preview, and simulation banner', async () => {
    render(
      <ToastProvider>
        <BrowserRouter>
          <NewCallPage />
        </BrowserRouter>
      </ToastProvider>
    );

    // Wait for agent to load
    await waitFor(() => {
      expect(screen.getAllByText(/Sales Concierge Pro/i).length).toBeGreaterThan(0);
    });

    // Check Simulation Disclosures
    expect(screen.getAllByText(/MOCK\/SIMULATED/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Simulated Telephony Provider Mode Active/i)).toBeInTheDocument();

    // Check Selected Agent Persona Summary Card
    expect(screen.getByText('11labs-Adrian')).toBeInTheDocument();
    expect(screen.getByText('en-US')).toBeInTheDocument();
    expect(screen.getByText(/You are an AI sales assistant/i)).toBeInTheDocument();
  });

  it('validates invalid destination phone number format', async () => {
    render(
      <ToastProvider>
        <BrowserRouter>
          <NewCallPage />
        </BrowserRouter>
      </ToastProvider>
    );

    await waitFor(() => {
      expect(screen.getAllByText(/Sales Concierge Pro/i).length).toBeGreaterThan(0);
    });

    const phoneInput = screen.getByLabelText(/Destination Phone Number/i);
    fireEvent.change(phoneInput, { target: { value: '12345' } });

    const submitBtn = screen.getByRole('button', { name: /Initiate Voice Call/i });
    fireEvent.click(submitBtn);

    expect(
      screen.getByText(/Phone number must be in international E.164 format/i)
    ).toBeInTheDocument();
  });

  it('supports adding and editing dynamic prompt variables', async () => {
    render(
      <ToastProvider>
        <BrowserRouter>
          <NewCallPage />
        </BrowserRouter>
      </ToastProvider>
    );

    await waitFor(() => {
      expect(screen.getAllByText(/Sales Concierge Pro/i).length).toBeGreaterThan(0);
    });

    const addVarBtn = screen.getByRole('button', { name: /Add Variable/i });
    fireEvent.click(addVarBtn);

    const keyInputs = screen.getAllByPlaceholderText(/variable_key/i);
    expect(keyInputs.length).toBeGreaterThanOrEqual(1);

    // Enter invalid variable key (with space)
    const lastKeyInput = keyInputs[keyInputs.length - 1];
    fireEvent.change(lastKeyInput, { target: { value: 'bad key with spaces' } });

    const submitBtn = screen.getByRole('button', { name: /Initiate Voice Call/i });
    fireEvent.click(submitBtn);

    expect(
      screen.getByText(/Variable keys must contain only letters, numbers, or underscores/i)
    ).toBeInTheDocument();
  });

  it('successfully dispatches outbound call and invokes callApi with idempotency key', async () => {
    render(
      <ToastProvider>
        <BrowserRouter>
          <NewCallPage />
        </BrowserRouter>
      </ToastProvider>
    );

    await waitFor(() => {
      expect(screen.getAllByText(/Sales Concierge Pro/i).length).toBeGreaterThan(0);
    });

    const phoneInput = screen.getByLabelText(/Destination Phone Number/i);
    fireEvent.change(phoneInput, { target: { value: '+14155552671' } });

    const submitBtn = screen.getByRole('button', { name: /Initiate Voice Call/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(callApi.initiateCall).toHaveBeenCalledWith(
        expect.objectContaining({
          agentId: 'agent_cuid_test1',
          toNumber: '+14155552671',
        }),
        expect.stringMatching(/^call_dispatch_/)
      );
    });

    // Check toast notification appears
    await waitFor(() => {
      expect(
        screen.getByText(/Outbound call initiated successfully! Provider ID: call_mock_/i)
      ).toBeInTheDocument();
    });
  });
});
