import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from '../context/AuthContext';
import LoginPage from '../pages/LoginPage';
import RegisterPage from '../pages/RegisterPage';

// Mock apiClient
vi.mock('../api/client', () => {
  const mockClient = {
    get: vi.fn().mockRejectedValue(new Error('Unauthenticated')),
    post: vi.fn().mockResolvedValue({
      data: {
        success: true,
        data: {
          user: {
            id: 'test_user_id',
            email: 'test@shiavnski.com',
            fullName: 'Test User',
            role: 'USER',
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

describe('Authentication Pages (Login & Register)', () => {
  it('renders Login page with email, password fields and toggle password visibility', () => {
    render(
      <AuthProvider>
        <BrowserRouter>
          <LoginPage />
        </BrowserRouter>
      </AuthProvider>
    );

    expect(screen.getByText('Welcome to Shiavnski Voice')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('name@company.com')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Enter your password')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Sign In to Dashboard/i })).toBeInTheDocument();

    // Check show/hide password toggle
    const toggleBtn = screen.getByLabelText(/Show password/i);
    expect(toggleBtn).toBeInTheDocument();
    const passwordInput = screen.getByPlaceholderText('Enter your password');
    expect(passwordInput).toHaveAttribute('type', 'password');

    fireEvent.click(toggleBtn);
    expect(passwordInput).toHaveAttribute('type', 'text');
  });

  it('renders Register page with name, email, password, confirm password fields', () => {
    render(
      <AuthProvider>
        <BrowserRouter>
          <RegisterPage />
        </BrowserRouter>
      </AuthProvider>
    );

    expect(screen.getByText('Create Your Account')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/enter a name/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText('name@company.com')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Min 8 chars/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Re-type your password')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Create Account & Continue/i })).toBeInTheDocument();
  });

  it('validates mismatched passwords on Register page', () => {
    render(
      <AuthProvider>
        <BrowserRouter>
          <RegisterPage />
        </BrowserRouter>
      </AuthProvider>
    );

    const nameInput = screen.getByPlaceholderText(/enter a name/i);
    const emailInput = screen.getByPlaceholderText('name@company.com');
    const passwordInput = screen.getByPlaceholderText(/Min 8 chars/i);
    const confirmInput = screen.getByPlaceholderText('Re-type your password');
    const submitBtn = screen.getByRole('button', { name: /Create Account & Continue/i });

    fireEvent.change(nameInput, { target: { value: 'Alex Mercer' } });
    fireEvent.change(emailInput, { target: { value: 'alex@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'Secret123!' } });
    fireEvent.change(confirmInput, { target: { value: 'Mismatch999!' } });

    fireEvent.click(submitBtn);

    expect(screen.getByText(/Passwords do not match/i)).toBeInTheDocument();
  });
});
