import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import App from '../App';

// Mock apiClient with dynamic endpoint handling
vi.mock('../api/client', () => {
  const mockClient = {
    get: vi.fn().mockImplementation((url: string) => {
      if (url.includes('/auth/me')) {
        return Promise.resolve({
          data: {
            success: true,
            data: {
              user: {
                id: 'usr_test123',
                email: 'sarah@shiavnski.com',
                fullName: 'Sarah J.',
                role: 'ADMIN',
              },
            },
          },
        });
      }
      if (url.includes('/calls/stats')) {
        return Promise.resolve({
          data: {
            success: true,
            data: {
              totalCalls: 0,
              completedCalls: 0,
              failedCalls: 0,
              ongoingCalls: 0,
              initiatedCalls: 0,
              avgDurationSeconds: 0,
              successRate: 0,
              activeAgents: 0,
              recentCalls: [],
            },
          },
        });
      }
      if (url.includes('/agents')) {
        return Promise.resolve({
          data: {
            success: true,
            data: {
              agents: [],
              total: 0,
              page: 1,
              limit: 100,
              totalPages: 1,
            },
          },
        });
      }
      return Promise.resolve({
        data: {
          success: true,
          data: {
            status: 'healthy',
            providerMode: 'mock',
            uptime: 120,
          },
        },
      });
    }),
    post: vi.fn().mockResolvedValue({
      data: {
        success: true,
        data: {
          user: {
            id: 'usr_test123',
            email: 'sarah@shiavnski.com',
            fullName: 'Sarah J.',
            role: 'ADMIN',
          },
        },
      },
    }),
  };
  return {
    default: mockClient,
    apiClient: mockClient,
  };
});

describe('Frontend Application & Authentication Shell', () => {
  beforeEach(() => {
    window.history.pushState({}, '', '/');
  });

  it('renders application navigation and persistent provider mode badge (REQ-FE-05) when authenticated', async () => {
    render(<App />);

    // Wait for auth verification and dashboard render
    await waitFor(() => {
      expect(screen.getAllByText('Shiavnski Voice').length).toBeGreaterThan(0);
    });

    // Persistent Provider Mode Badge (REQ-FE-05)
    expect(screen.getByTestId('provider-mode-badge')).toBeInTheDocument();
    expect(screen.getByText(/PROVIDER: MOCK SIMULATION/i)).toBeInTheDocument();

    // Navigation items (present in desktop/mobile sidebars)
    expect(screen.getAllByText('Voice Agents').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Call Records').length).toBeGreaterThan(0);

    await waitFor(() => {
      expect(screen.getByText(/API Online/i)).toBeInTheDocument();
    });
  });

  it('renders operations dashboard shell metrics placeholders and status check', async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('Operations Dashboard')).toBeInTheDocument();
    });

    // Metric titles
    expect(screen.getByText('Total Calls')).toBeInTheDocument();
    expect(screen.getByText('Avg Duration')).toBeInTheDocument();
    expect(screen.getByText('Success Rate')).toBeInTheDocument();
    expect(screen.getByText('Active Agents')).toBeInTheDocument();
  });
});
