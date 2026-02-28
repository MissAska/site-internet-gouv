import "@fontsource/chakra-petch/400.css";
import "@fontsource/chakra-petch/600.css";
import "@fontsource/chakra-petch/700.css";
import "@fontsource/ibm-plex-sans/400.css";
import "@fontsource/ibm-plex-sans/500.css";
import "@fontsource/ibm-plex-sans/600.css";
import "@fontsource/jetbrains-mono/400.css";
import "@fontsource/jetbrains-mono/500.css";

import "./index.css";
import "./App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { Toaster } from "./components/ui/sonner";

// Pages
import LoginPage from "./pages/LoginPage";
import AdminDashboard from "./pages/admin/AdminDashboard";
import BusinessesPage from "./pages/admin/BusinessesPage";
import TaxNoticesPage from "./pages/admin/TaxNoticesPage";
import TaxBracketsPage from "./pages/admin/TaxBracketsPage";
import EmployeesAdminPage from "./pages/admin/EmployeesAdminPage";
import BusinessDashboard from "./pages/business/BusinessDashboard";
import EmployeesPage from "./pages/business/EmployeesPage";
import TransactionsPage from "./pages/business/TransactionsPage";
import AccountingPage from "./pages/business/AccountingPage";
import BusinessTaxNoticesPage from "./pages/business/BusinessTaxNoticesPage";
import CashRegisterPage from "./pages/CashRegisterPage";
import EmployeeTransactionsPage from "./pages/employee/EmployeeTransactionsPage";

// Protected Route Component
const ProtectedRoute = ({ children, allowedRoles }) => {
  const { isAuthenticated, user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user?.role)) {
    // Redirect based on role
    if (user?.role === 'admin') {
      return <Navigate to="/admin" replace />;
    } else if (user?.role === 'patron') {
      return <Navigate to="/business" replace />;
    } else {
      return <Navigate to="/cash-register" replace />;
    }
  }

  return children;
};

// Public Route (redirect if authenticated)
const PublicRoute = ({ children }) => {
  const { isAuthenticated, user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (isAuthenticated) {
    if (user?.role === 'admin') {
      return <Navigate to="/admin" replace />;
    } else if (user?.role === 'patron') {
      return <Navigate to="/business" replace />;
    } else {
      return <Navigate to="/cash-register" replace />;
    }
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

      {/* Admin Routes */}
      <Route
        path="/admin"
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <AdminDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/businesses"
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <BusinessesPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/employees"
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <EmployeesAdminPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/tax-notices"
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <TaxNoticesPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/tax-brackets"
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <TaxBracketsPage />
          </ProtectedRoute>
        }
      />

      {/* Business (Patron) Routes */}
      <Route
        path="/business"
        element={
          <ProtectedRoute allowedRoles={['patron']}>
            <BusinessDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/business/employees"
        element={
          <ProtectedRoute allowedRoles={['patron']}>
            <EmployeesPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/business/transactions"
        element={
          <ProtectedRoute allowedRoles={['patron']}>
            <TransactionsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/business/accounting"
        element={
          <ProtectedRoute allowedRoles={['patron']}>
            <AccountingPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/business/tax-notices"
        element={
          <ProtectedRoute allowedRoles={['patron']}>
            <BusinessTaxNoticesPage />
          </ProtectedRoute>
        }
      />

      {/* Cash Register (Patron & Employee) */}
      <Route
        path="/cash-register"
        element={
          <ProtectedRoute allowedRoles={['patron', 'employee']}>
            <CashRegisterPage />
          </ProtectedRoute>
        }
      />

      {/* Employee Routes */}
      <Route
        path="/employee/transactions"
        element={
          <ProtectedRoute allowedRoles={['employee']}>
            <EmployeeTransactionsPage />
          </ProtectedRoute>
        }
      />

      {/* Default Redirect */}
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <div className="App min-h-screen bg-background">
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
          <Toaster 
            position="top-right"
            toastOptions={{
              style: {
                background: 'hsl(217 33% 6%)',
                border: '1px solid hsl(217 33% 17%)',
                color: 'hsl(210 40% 98%)',
              },
            }}
          />
        </AuthProvider>
      </BrowserRouter>
    </div>
  );
}

export default App;
