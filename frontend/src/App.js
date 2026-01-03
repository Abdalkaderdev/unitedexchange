import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { Layout } from './components/layout';
import { LoadingPage } from './components/common';

// Pages
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import TransactionsPage from './pages/TransactionsPage';
import CurrenciesPage from './pages/CurrenciesPage';
import RateHistoryPage from './pages/RateHistoryPage';
import ReportsPage from './pages/ReportsPage';
import UsersPage from './pages/UsersPage';
import CustomersPage from './pages/CustomersPage';
import CashDrawersPage from './pages/CashDrawersPage';
import ShiftsPage from './pages/ShiftsPage';
import ReportBuilderPage from './pages/ReportBuilderPage';
import TransactionDetailPage from './pages/TransactionDetailPage';
import AuditLogsPage from './pages/AuditLogsPage';
import PermissionsPage from './pages/PermissionsPage';
import PortalLayout from './components/layout/PortalLayout';
import PortalLoginPage from './pages/portal/PortalLoginPage';
import PortalDashboardPage from './pages/portal/PortalDashboardPage';

// i18n
import './i18n';

// Styles
import './index.css';

// Protected Route Component
const ProtectedRoute = ({ children, adminOnly = false }) => {
  const { isAuthenticated, loading, isAdmin } = useAuth();

  if (loading) {
    return <LoadingPage />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (adminOnly && !isAdmin()) {
    return <Navigate to="/" replace />;
  }

  return <Layout>{children}</Layout>;
};

// Public Route Component (redirect if authenticated)
const PublicRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return <LoadingPage />;
  }

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return children;
};

function AppRoutes() {
  return (
    <Routes>
      {/* Public Routes */}
      <Route
        path="/login"
        element={
          <PublicRoute>
            <LoginPage />
          </PublicRoute>
        }
      />

      {/* Protected Routes */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/transactions"
        element={
          <ProtectedRoute>
            <TransactionsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/transactions/:uuid"
        element={
          <ProtectedRoute>
            <TransactionDetailPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/currencies"
        element={
          <ProtectedRoute>
            <CurrenciesPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/rate-history"
        element={
          <ProtectedRoute>
            <RateHistoryPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/reports"
        element={
          <ProtectedRoute>
            <ReportsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/customers"
        element={
          <ProtectedRoute>
            <CustomersPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/cash-drawers"
        element={
          <ProtectedRoute>
            <CashDrawersPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/shifts"
        element={
          <ProtectedRoute>
            <ShiftsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/report-builder"
        element={
          <ProtectedRoute>
            <ReportBuilderPage />
          </ProtectedRoute>
        }
      />

      {/* Customer Portal Routes */}
      <Route path="/portal" element={<Navigate to="/portal/login" replace />} />
      <Route
        path="/portal/login"
        element={<PortalLoginPage />}
      />
      <Route
        path="/portal/dashboard"
        element={
          <PortalLayout />
        }
      >
        <Route index element={<PortalDashboardPage />} />
      </Route>

      {/* Admin Only Routes */}
      <Route
        path="/users"
        element={
          <ProtectedRoute adminOnly>
            <UsersPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/audit-logs"
        element={
          <ProtectedRoute adminOnly>
            <AuditLogsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/permissions"
        element={
          <ProtectedRoute adminOnly>
            <PermissionsPage />
          </ProtectedRoute>
        }
      />

      {/* Catch all - redirect to dashboard */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <ThemeProvider>
          <AppRoutes />
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 3000,
              style: {
                background: '#333',
                color: '#fff',
              },
              success: {
                style: {
                  background: '#10b981',
                },
              },
              error: {
                style: {
                  background: '#ef4444',
                },
              },
            }}
          />
        </ThemeProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;
