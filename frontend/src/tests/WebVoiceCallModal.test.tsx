import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WebVoiceCallModal } from '../components/calls/WebVoiceCallModal';
import { ToastProvider } from '../context/ToastContext';
import { callApi } from '../api/call.api';
import { Agent } from '../api/agent.api';

// Mock callApi
vi.mock('../api/call.api', () => ({
  callApi: {
    startWebCall: vi.fn(),
    syncCall: vi.fn(),
    endCall: vi.fn().mockResolvedValue(null),
  },
}));

const mockAgent: Agent = {
  id: 'agent_cuid_test_1',
  userId: 'user_1',
  providerAgentId: 'agent_ba6661e78710d75a9fe62d6451',
  name: 'Shiavnski AI Assistant',
  description: 'AI assistant for customer support',
  voiceId: 'retell-Cimo',
  language: 'en-US',
  systemPrompt: 'You are Shiavnski AI assistant.',
  responsiveness: 1.0,
  interruptionSensitivity: 0.9,
  syncStatus: 'SYNCED',
  isActive: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

describe('WebVoiceCallModal Component (Browser WebRTC Voice Conversation)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders modal when open with prominent Start Voice Conversation button', () => {
    render(
      <ToastProvider>
        <WebVoiceCallModal
          isOpen={true}
          agent={mockAgent}
          onClose={vi.fn()}
        />
      </ToastProvider>
    );

    expect(screen.getByText(/Browser Voice Conversation/i)).toBeInTheDocument();
    expect(screen.getByText(/Shiavnski AI Assistant/i)).toBeInTheDocument();
    const startBtn = screen.getByRole('button', { name: /start voice conversation/i });
    expect(startBtn).toBeInTheDocument();
  });

  it('handles microphone permission denial gracefully and displays actionable warning', async () => {
    // Mock navigator.mediaDevices.getUserMedia rejection
    const originalMediaDevices = navigator.mediaDevices;
    Object.defineProperty(navigator, 'mediaDevices', {
      writable: true,
      value: {
        getUserMedia: vi.fn().mockRejectedValue(new Error('Permission denied')),
      },
    });

    render(
      <ToastProvider>
        <WebVoiceCallModal
          isOpen={true}
          agent={mockAgent}
          onClose={vi.fn()}
        />
      </ToastProvider>
    );

    const startBtn = screen.getByRole('button', { name: /start voice conversation/i });
    fireEvent.click(startBtn);

    await waitFor(() => {
      expect(screen.getByText(/Microphone Permission Denied/i)).toBeInTheDocument();
      expect(screen.getByText(/Connection Failed/i)).toBeInTheDocument();
    });

    // Restore
    Object.defineProperty(navigator, 'mediaDevices', {
      writable: true,
      value: originalMediaDevices,
    });
  });

  it('successfully starts a voice session, displays Connected status, and provides End Call button', async () => {
    // Mock navigator.mediaDevices.getUserMedia resolution
    const mockTrack = { stop: vi.fn() };
    const mockStream = { getTracks: () => [mockTrack] };
    Object.defineProperty(navigator, 'mediaDevices', {
      writable: true,
      value: {
        getUserMedia: vi.fn().mockResolvedValue(mockStream),
      },
    });

    (callApi.startWebCall as any).mockResolvedValue({
      accessToken: 'mock_token_123',
      call: {
        id: 'call_web_123',
        userId: 'user_1',
        agentId: mockAgent.id,
        providerCallId: 'call_mock_web_123',
        callType: 'web_call',
        fromNumber: 'Browser Client',
        toNumber: mockAgent.name,
        status: 'INITIATED',
        durationSeconds: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    });

    render(
      <ToastProvider>
        <WebVoiceCallModal
          isOpen={true}
          agent={mockAgent}
          onClose={vi.fn()}
        />
      </ToastProvider>
    );

    const startBtn = screen.getByRole('button', { name: /start voice conversation/i });
    fireEvent.click(startBtn);

    // Verifies startWebCall was called with correct agentId
    await waitFor(() => {
      expect(callApi.startWebCall).toHaveBeenCalledWith(
        expect.objectContaining({ agentId: mockAgent.id })
      );
    });

    // In mock simulation mode, transitions to Connected and shows End Call button
    await waitFor(
      () => {
        expect(screen.getByRole('button', { name: /end call/i })).toBeInTheDocument();
        expect(screen.getByText(/Connected • Live/i)).toBeInTheDocument();
      },
      { timeout: 3000 }
    );

    // End the call
    const endBtn = screen.getByRole('button', { name: /end call/i });
    fireEvent.click(endBtn);

    await waitFor(() => {
      expect(screen.getByText(/Call Ended/i)).toBeInTheDocument();
    });
  });
});
