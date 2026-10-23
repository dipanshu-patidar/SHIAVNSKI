import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { AgentsPage } from '../pages/AgentsPage';
import { ToastProvider } from '../context/ToastContext';
import { agentApi, Agent } from '../api/agent.api';

// Sample mock agents
const mockAgentsList: Agent[] = [
  {
    id: 'agent_cuid_1',
    userId: 'user_123',
    providerAgentId: 'agent_mock_1700000001_abc123',
    name: 'Sales Concierge Alpha',
    description: 'Lead qualification outbound representative',
    voiceId: '11labs-Adrian',
    language: 'en-US',
    systemPrompt: 'You are a friendly sales rep answering inquiries.',
    responsiveness: 1.0,
    interruptionSensitivity: 0.8,
    syncStatus: 'SYNCED',
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'agent_cuid_2',
    userId: 'user_123',
    providerAgentId: 'agent_mock_1700000002_xyz789',
    name: 'Technical Support Bot',
    description: 'Diagnoses internet router connection errors',
    voiceId: '11labs-Sarah',
    language: 'en-US',
    systemPrompt: 'You are a tier 1 tech support agent.',
    responsiveness: 0.9,
    interruptionSensitivity: 0.7,
    syncStatus: 'SYNCED',
    isActive: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

vi.mock('../api/agent.api', () => {
  return {
    agentApi: {
      listAgents: vi.fn(),
      getAgent: vi.fn(),
      createAgent: vi.fn(),
      updateAgent: vi.fn(),
      deleteAgent: vi.fn(),
    },
  };
});

describe('Voice Agents Management Frontend Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(agentApi.listAgents).mockResolvedValue({
      agents: [...mockAgentsList],
      total: 2,
      page: 1,
      limit: 50,
    });
  });

  it('renders agents list with mock simulation disclosure badges and metadata', async () => {
    render(
      <ToastProvider>
        <AgentsPage />
      </ToastProvider>
    );

    // Verify loading transitions to loaded state
    await waitFor(() => {
      expect(screen.getByText('Sales Concierge Alpha')).toBeInTheDocument();
      expect(screen.getByText('Technical Support Bot')).toBeInTheDocument();
    });

    // Verify MOCK/SIMULATED badge is prominently rendered (REQ-FE-05)
    const mockBadges = screen.getAllByText(/MOCK \/ SIMULATED/i);
    expect(mockBadges.length).toBeGreaterThan(0);

    // Verify metadata displayed
    expect(screen.getByText('11labs-Adrian')).toBeInTheDocument();
    expect(screen.getByText('11labs-Sarah')).toBeInTheDocument();
    expect(screen.getAllByText('Synced').length).toBe(2);
  });

  it('supports searching/filtering agents by query', async () => {
    render(
      <ToastProvider>
        <AgentsPage />
      </ToastProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Sales Concierge Alpha')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(/Search agents/i);
    fireEvent.change(searchInput, { target: { value: 'Technical' } });

    // Should call listAgents with search parameter
    expect(agentApi.listAgents).toHaveBeenCalledWith({ search: 'Technical' });
  });

  it('opens Create Agent modal and validates required fields', async () => {
    render(
      <ToastProvider>
        <AgentsPage />
      </ToastProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Sales Concierge Alpha')).toBeInTheDocument();
    });

    // Click Create Agent button
    const createBtn = screen.getAllByRole('button', { name: /Create Agent/i })[0];
    fireEvent.click(createBtn);

    // Modal opens
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByRole('heading', { name: 'Create New Voice Agent' })).toBeInTheDocument();

    // Clear name and try submitting
    const nameInput = within(dialog).getByLabelText(/Agent Name/i);
    fireEvent.change(nameInput, { target: { value: '' } });

    const submitBtn = within(dialog).getByRole('button', { name: 'Create Agent' });
    fireEvent.click(submitBtn);

    // Inline field validation error appears
    expect(within(dialog).getByText('Agent name is required')).toBeInTheDocument();
  });

  it('submits valid agent creation and updates state', async () => {
    const newAgent: Agent = {
      id: 'agent_cuid_3',
      userId: 'user_123',
      providerAgentId: 'agent_mock_1700000003_new',
      name: 'Billing Inquiry Bot',
      description: 'Handles invoice questions',
      voiceId: '11labs-Michael',
      language: 'en-US',
      systemPrompt: 'You help customers resolve billing inquiries.',
      responsiveness: 1.0,
      interruptionSensitivity: 0.8,
      syncStatus: 'SYNCED',
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    vi.mocked(agentApi.createAgent).mockResolvedValue(newAgent);

    render(
      <ToastProvider>
        <AgentsPage />
      </ToastProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Sales Concierge Alpha')).toBeInTheDocument();
    });

    // Click Create Agent button in header
    const headerCreateBtn = screen.getAllByRole('button', { name: /Create Agent/i })[0];
    fireEvent.click(headerCreateBtn);

    const dialog = screen.getByRole('dialog');

    // Fill form
    const nameInput = within(dialog).getByLabelText(/Agent Name/i);
    fireEvent.change(nameInput, { target: { value: 'Billing Inquiry Bot' } });

    const promptInput = within(dialog).getByLabelText(/System Persona Prompt/i);
    fireEvent.change(promptInput, {
      target: { value: 'You help customers resolve billing inquiries.' },
    });

    const submitBtn = within(dialog).getByRole('button', { name: 'Create Agent' });
    fireEvent.click(submitBtn);

    // Verify createAgent API was invoked
    await waitFor(() => {
      expect(agentApi.createAgent).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Billing Inquiry Bot',
        })
      );
    });

    // Verify new agent and success toast appear
    await waitFor(() => {
      expect(screen.getByText('Billing Inquiry Bot')).toBeInTheDocument();
      expect(screen.getByText(/Agent "Billing Inquiry Bot" created successfully/i)).toBeInTheDocument();
    });
  });

  it('prompts confirmation dialog before deleting an agent', async () => {
    vi.mocked(agentApi.deleteAgent).mockResolvedValue(undefined);

    render(
      <ToastProvider>
        <AgentsPage />
      </ToastProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Sales Concierge Alpha')).toBeInTheDocument();
    });

    // Find delete button for first agent
    const deleteBtn = screen.getByLabelText(/Delete Sales Concierge Alpha/i);
    fireEvent.click(deleteBtn);

    // Confirm dialog opens (proper confirmation dialog, NOT window.confirm)
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(/permanently delete "Sales Concierge Alpha"/i)).toBeInTheDocument();

    // Click confirm in dialog
    const confirmDeleteBtn = screen.getByRole('button', { name: 'Delete Agent' });
    fireEvent.click(confirmDeleteBtn);

    await waitFor(() => {
      expect(agentApi.deleteAgent).toHaveBeenCalledWith('agent_cuid_1');
    });

    // Toast notification confirms deletion
    await waitFor(() => {
      expect(screen.getByText(/Agent "Sales Concierge Alpha" deleted successfully/i)).toBeInTheDocument();
    });
  });
});
