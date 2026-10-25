import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { Layout } from './components/layout/Layout';
import { DashboardPage } from './pages/DashboardPage';
import { AgentsPage } from './pages/AgentsPage';
import { CallsPage } from './pages/CallsPage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <ToastProvider>
        <BrowserRouter>
          <Routes>
            {/* Public Authentication Routes */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />

            {/* Protected Application Routes */}
            <Route element={<ProtectedRoute />}>
              <Route element={<Layout />}>
                <Route index element={<DashboardPage />} />
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/agents" element={<AgentsPage />} />
                <Route path="/calls" element={<CallsPage />} />
                <Route path="/calls/new" element={<Navigate to="/calls" replace />} />
                <Route path="/call/new" element={<Navigate to="/calls" replace />} />
              </Route>
            </Route>

            {/* Fallback & 404 Route */}
            <Route
              path="*"
              element={
                <div className="min-h-screen bg-[#090d16] flex flex-col items-center justify-center text-center p-4">
                  <h2 className="text-3xl font-bold text-slate-100 mb-2">404 - Page Not Found</h2>
                  <p className="text-slate-400 mb-6">The requested view does not exist in the navigation hierarchy.</p>
                  <a
                    href="/"
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl transition-colors font-medium text-sm shadow-lg shadow-blue-600/30"
                  >
                    Return to Dashboard
                  </a>
                </div>
              }
            />
          </Routes>
        </BrowserRouter>
      </ToastProvider>
    </AuthProvider>
  );
};

export default App;
