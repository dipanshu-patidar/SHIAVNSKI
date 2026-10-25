import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CallDetailsModal } from '../components/calls/CallDetailsModal';
import { ToastProvider } from '../context/ToastContext';
import { callApi, Call } from '../api/call.api';

// Mock callApi
vi.mock('../api/call.api', () => ({
  callApi: {
    deleteRecording: vi.fn(),
    syncCall: vi.fn(),
    simulateCallStep: vi.fn(),
  },
}));

const mockCompletedCallWithRecording: Call = {
  id: 'call_test_rec_1',
  userId: 'user_1',
  agentId: 'agent_1',
  providerCallId: 'call_rec_retell_123',
  callType: 'web_call',
  fromNumber: 'Browser Client',
  toNumber: 'Shiavnski AI Assistant',
  status: 'ENDED',
  durationSeconds: 45,
  recordingUrl: 'https://storage.provider.com/recordings/test_rec.mp3',
  recordingStatus: 'available',
  transcriptText: 'User: Hello Shiavnski.\nAgent: Greetings! How may I assist you?',
  transcriptObject: [
    { role: 'user', content: 'Hello Shiavnski.' },
    { role: 'agent', content: 'Greetings! How may I assist you?' },
  ],
  summary: 'Client asked about AI software services.',
  sentiment: 'positive',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  agent: {
    id: 'agent_1',
    name: 'Shiavnski AI Assistant',
    voiceId: 'retell-Cimo',
    language: 'en-US',
  },
};

describe('CallDetailsModal: Recording Playback and Deletion Management', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders audio player with controls when recordingUrl is present', () => {
    render(
      <ToastProvider>
        <CallDetailsModal
          isOpen={true}
          call={mockCompletedCallWithRecording}
          onClose={vi.fn()}
        />
      </ToastProvider>
    );

    // Audio element exists
    const audioElement = document.querySelector('audio');
    expect(audioElement).not.toBeNull();
    expect(audioElement?.getAttribute('src')).toBe(
      'https://storage.provider.com/recordings/test_rec.mp3'
    );
    expect(audioElement?.hasAttribute('controls')).toBe(true);

    // Full transcript is displayed with speaker labels
    expect(screen.getByText(/Hello Shiavnski\./i)).toBeInTheDocument();
    expect(screen.getByText(/Greetings! How may I assist you\?/i)).toBeInTheDocument();

    // Delete Recording button is visible
    expect(screen.getByRole('button', { name: /delete recording/i })).toBeInTheDocument();
  });

  it('shows confirmation dialog before deleting recording, explaining that action is irreversible', async () => {
    render(
      <ToastProvider>
        <CallDetailsModal
          isOpen={true}
          call={mockCompletedCallWithRecording}
          onClose={vi.fn()}
        />
      </ToastProvider>
    );

    const deleteBtn = screen.getByRole('button', { name: /delete recording/i });
    fireEvent.click(deleteBtn);

    // Confirmation dialog appears
    expect(screen.getByText(/Delete Call Recording\?/i)).toBeInTheDocument();
    expect(screen.getByText(/Action is irreversible in this app/i)).toBeInTheDocument();
    expect(screen.getByText(/What will be preserved:/i)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /remove recording from app/i })
    ).toBeInTheDocument();
  });

  it('deletes recording reference, disables audio playback, and preserves transcript and call history', async () => {
    const onCallUpdated = vi.fn();

    const callAfterDeletion: Call = {
      ...mockCompletedCallWithRecording,
      recordingUrl: null,
      recordingStatus: 'removed',
    };

    (callApi.deleteRecording as any).mockResolvedValue({
      call: callAfterDeletion,
      providerDeleted: false,
      message: 'Recording reference removed from application.',
    });

    render(
      <ToastProvider>
        <CallDetailsModal
          isOpen={true}
          call={mockCompletedCallWithRecording}
          onClose={vi.fn()}
          onCallUpdated={onCallUpdated}
        />
      </ToastProvider>
    );

    // Click Delete Recording
    const deleteBtn = screen.getByRole('button', { name: /delete recording/i });
    fireEvent.click(deleteBtn);

    // Confirm deletion
    const confirmBtn = screen.getByRole('button', { name: /remove recording from app/i });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(callApi.deleteRecording).toHaveBeenCalledWith('call_test_rec_1');
      expect(onCallUpdated).toHaveBeenCalledWith(callAfterDeletion);
    });

    // Audio element should no longer be present
    expect(document.querySelector('audio')).toBeNull();

    // Removed notice is displayed
    expect(
      screen.getByText(/The audio recording was removed from this application/i)
    ).toBeInTheDocument();

    // Transcript remains completely intact!
    expect(screen.getByText(/Hello Shiavnski\./i)).toBeInTheDocument();
    expect(screen.getByText(/Greetings! How may I assist you\?/i)).toBeInTheDocument();
  });

  it('triggers provider synchronization when clicking Sync button', async () => {
    (callApi.syncCall as any).mockResolvedValue({
      ...mockCompletedCallWithRecording,
      durationSeconds: 50,
    });

    render(
      <ToastProvider>
        <CallDetailsModal
          isOpen={true}
          call={mockCompletedCallWithRecording}
          onClose={vi.fn()}
        />
      </ToastProvider>
    );

    const syncBtn = screen.getByTitle(/Refresh \/ Sync call data from provider/i);
    fireEvent.click(syncBtn);

    await waitFor(() => {
      expect(callApi.syncCall).toHaveBeenCalledWith('call_test_rec_1');
    });
  });
});
