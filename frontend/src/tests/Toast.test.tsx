import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { ToastProvider, useToast } from '../context/ToastContext';

// Helper test consumer component
const TestToastConsumer: React.FC = () => {
  const toast = useToast();

  return (
    <div className="space-x-2">
      <button onClick={() => toast.success('Agent created successfully!', 'Created')}>
        Trigger Success
      </button>
      <button onClick={() => toast.error('Failed to connect to server', 'Error Occurred')}>
        Trigger Error
      </button>
      <button onClick={() => toast.warning('Low audio responsiveness', 'Warning')}>
        Trigger Warning
      </button>
      <button onClick={() => toast.info('System update scheduled', 'Notice')}>
        Trigger Info
      </button>
      <button onClick={() => toast.clearAll()}>Clear All</button>
    </div>
  );
};

describe('Reusable Toast Notification System', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders green success toast with proper message and accessibility role', () => {
    render(
      <ToastProvider>
        <TestToastConsumer />
      </ToastProvider>
    );

    fireEvent.click(screen.getByText('Trigger Success'));

    const successMessage = screen.getByText('Agent created successfully!');
    expect(successMessage).toBeInTheDocument();
    expect(screen.getByText('Created')).toBeInTheDocument();

    const toastCard = successMessage.closest('[role="status"]');
    expect(toastCard).toBeInTheDocument();
  });

  it('renders red error toast with alert role and dismisses upon clicking close button', () => {
    render(
      <ToastProvider>
        <TestToastConsumer />
      </ToastProvider>
    );

    fireEvent.click(screen.getByText('Trigger Error'));

    const errorMessage = screen.getByText('Failed to connect to server');
    expect(errorMessage).toBeInTheDocument();

    const alertCard = errorMessage.closest('[role="alert"]');
    expect(alertCard).toBeInTheDocument();

    // Click close button
    const closeBtn = screen.getByLabelText(/Dismiss notification/i);
    fireEvent.click(closeBtn);

    expect(screen.queryByText('Failed to connect to server')).not.toBeInTheDocument();
  });

  it('automatically dismisses toast after designated duration', () => {
    render(
      <ToastProvider>
        <TestToastConsumer />
      </ToastProvider>
    );

    fireEvent.click(screen.getByText('Trigger Warning'));
    expect(screen.getByText('Low audio responsiveness')).toBeInTheDocument();

    // Fast-forward past timeout (4500ms for warning)
    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(screen.queryByText('Low audio responsiveness')).not.toBeInTheDocument();
  });

  it('prevents duplicate active notifications for the same message', () => {
    render(
      <ToastProvider>
        <TestToastConsumer />
      </ToastProvider>
    );

    // Double click error button
    fireEvent.click(screen.getByText('Trigger Error'));
    fireEvent.click(screen.getByText('Trigger Error'));

    const errorToasts = screen.getAllByText('Failed to connect to server');
    expect(errorToasts.length).toBe(1);
  });
});
