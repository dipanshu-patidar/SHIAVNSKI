import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CallDetailsModal } from '../components/calls/CallDetailsModal';
import { ToastProvider } from '../context/ToastContext';
import { callApi, Call } from '../api/call.api';

const mockInitiatedCall: Call = {
  id: 'call_test_cuid_1',
  userId: 'usr_1',
  agentId: 'agent_1',
  providerCallId: 'call_mock_1792700000_abc',
  fromNumber: '+1 (415) ***-1234',
  toNumber: '+1 (415) ***-2671',
  maskedToNumber: '+1 (415) ***-2671',
  maskedFromNumber: '+1 (415) ***-1234',
  status: 'INITIATED',
  durationSeconds: 0,
  disconnectionReason: null,
  isMock: true,
  dynamicVariables: {
    customer_name: 'John Doe',
    xss_test: '<script>alert("xss")</script>',
    html_injection: '<img src=x onerror=alert(1) />',
  },
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  agent: {
    id: 'agent_1',
    name: 'Sales Concierge Pro',
    voiceId: '11labs-Adrian',
    language: 'en-US',
  },
};

vi.mock('../api/call.api', () => ({
  callApi: {
    simulateCallStep: vi.fn(),
  },
}));

describe('CallDetailsModal Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders masked destination number and masked caller ID for privacy protection', () => {
    render(
      <ToastProvider>
        <CallDetailsModal isOpen={true} call={mockInitiatedCall} onClose={vi.fn()} />
      </ToastProvider>
    );

    // Assert masked numbers are rendered
    expect(screen.getByText('+1 (415) ***-2671')).toBeInTheDocument();
    expect(screen.getByText('+1 (415) ***-1234')).toBeInTheDocument();

    // Verify unmasked raw numbers are NOT displayed
    expect(screen.queryByText('+14155552671')).not.toBeInTheDocument();
    expect(screen.queryByText('+14155551234')).not.toBeInTheDocument();

    // Assert accurate initial disconnection label
    expect(screen.getByText('Awaiting Simulated Pickup')).toBeInTheDocument();
  });

  it('renders runtime variables safely as plain text without HTML injection or script execution', () => {
    render(
      <ToastProvider>
        <CallDetailsModal isOpen={true} call={mockInitiatedCall} onClose={vi.fn()} />
      </ToastProvider>
    );

    // Assert that the raw text is rendered safely as content
    expect(screen.getByText('<script>alert("xss")</script>')).toBeInTheDocument();
    expect(screen.getByText('<img src=x onerror=alert(1) />')).toBeInTheDocument();

    // Confirm that no <script> or <img> DOM elements were created from injected HTML
    expect(document.querySelector('img[onerror]')).toBeNull();
    expect(document.querySelector('script[src]')).toBeNull();
  });

  it('provides interactive mock simulation control and triggers simulateCallStep API', async () => {
    const mockOngoingCall: Call = {
      ...mockInitiatedCall,
      status: 'ONGOING',
    };

    vi.mocked(callApi.simulateCallStep).mockResolvedValue(mockOngoingCall);
    const onCallUpdated = vi.fn();

    render(
      <ToastProvider>
        <CallDetailsModal
          isOpen={true}
          call={mockInitiatedCall}
          onClose={vi.fn()}
          onCallUpdated={onCallUpdated}
        />
      </ToastProvider>
    );

    // Initial button is Simulate Pickup
    const pickupBtn = screen.getByRole('button', { name: /Simulate Pickup/i });
    expect(pickupBtn).toBeInTheDocument();

    fireEvent.click(pickupBtn);

    await waitFor(() => {
      expect(callApi.simulateCallStep).toHaveBeenCalledWith('call_test_cuid_1');
      expect(onCallUpdated).toHaveBeenCalledWith(mockOngoingCall);
    });

    // After updating to ONGOING, the button updates to Simulate Hangup
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Simulate Hangup/i })).toBeInTheDocument();
    });
  });

  it('displays accurate disconnection reason when call is concluded', () => {
    const mockEndedCall: Call = {
      ...mockInitiatedCall,
      status: 'ENDED',
      durationSeconds: 45,
      disconnectionReason: 'simulated_user_hangup',
    };

    render(
      <ToastProvider>
        <CallDetailsModal isOpen={true} call={mockEndedCall} onClose={vi.fn()} />
      </ToastProvider>
    );

    expect(screen.getByText('simulated_user_hangup')).toBeInTheDocument();
    expect(screen.getByText('00:45')).toBeInTheDocument();
    // No simulation button should appear once call has ended
    expect(screen.queryByRole('button', { name: /Simulate/i })).not.toBeInTheDocument();

    // Verify accurate Retell webhook telemetry notice and ensure outdated wording is removed
    expect(
      screen.getByText(/Live call status updates and available post-call telemetry are synchronized through the configured Retell webhook/i)
    ).toBeInTheDocument();
    expect(screen.queryByText(/upcoming phases/i)).not.toBeInTheDocument();
  });
});
