// App.tsx (VOLLSTÄNDIG)
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './components/AuthContext';
import LoginPrompt from './components/LoginPrompt';
import ProtectedRoute from './components/ProtectedRoute';
import ApprovalPending from './components/ApprovalPending';
import OverviewDashboard from './components/OverviewDashboard';
import HonorDashboard from './components/HonorDashboard';
import PowerAnalyticsDashboard from './components/PowerAnalyticsDashboard';
import AdminUserManagement from './components/AdminUserManagement';
import FileUpload from './components/FileUpload';
import { Layout } from './components/Layout'; // Angenommen, du hast eine Layout-Komponente

const AppRoutes = () => {
  const { user } = useAuth();

  return (
    <Routes>
      {/* ROOT ROUTE:
         Zeigt OverviewDashboard (öffentlich wenn ?slug=... da ist, sonst protected oder redirect)
         OverviewDashboard kümmert sich selbst um die Anzeige basierend auf Auth/Slug.
      */}
      <Route path="/" element={
         <Layout>
            <OverviewDashboard />
         </Layout>
      } />

      {/* LOGIN ROUTE */}
      <Route
        path="/login"
        element={
          user ? <Navigate to="/" replace /> : (
             <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
                <LoginPrompt />
             </div>
          )
        }
      />

      {/* APPROVAL PENDING */}
      <Route
        path="/pending"
        element={
          user && !user.isApproved ? (
            <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
               <ApprovalPending />
            </div>
          ) : <Navigate to="/" replace />
        }
      />

      {/* PROTECTED ROUTES (Require Login & Approval) */}
      
      {/* Honor */}
      <Route
        path="/honor"
        element={
          <ProtectedRoute requiredAccess="canAccessHonor">
            <Layout>
              <HonorDashboard />
            </Layout>
          </ProtectedRoute>
        }
      />

      {/* Analytics */}
      <Route
        path="/analytics"
        element={
          <ProtectedRoute requiredAccess="canAccessAnalytics">
             <Layout>
               <PowerAnalyticsDashboard />
             </Layout>
          </ProtectedRoute>
        }
      />

      {/* Admin / R5 User Management */}
      <Route
        path="/admin/users"
        element={
          <ProtectedRoute>
             <Layout>
                <AdminUserManagement />
             </Layout>
          </ProtectedRoute>
        }
      />

      {/* File Uploads (Admin/R4) */}
      <Route
        path="/admin/uploads"
        element={
          <ProtectedRoute>
             <Layout>
                <FileUpload />
             </Layout>
          </ProtectedRoute>
        }
      />

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <Router>
        <AppRoutes />
      </Router>
    </AuthProvider>
  );
};

// Einfache Layout-Komponente inline, falls du keine separate Datei hast
// (Normalerweise in components/Layout.tsx)
import { Link } from 'react-router-dom';

const Layout: React.FC<{children: React.ReactNode}> = ({ children }) => {
  const { user, logout } = useAuth();
  
  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 font-sans">
      {/* Navbar */}
      <nav className="bg-gray-800 border-b border-gray-700 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <Link to="/" className="text-xl font-bold text-blue-500">
                Rise of Stats
              </Link>
              <div className="hidden md:block ml-10 space-x-4">
                <Link to="/" className="hover:text-white px-3 py-2 rounded-md text-sm font-medium">Overview</Link>
                {user && user.canAccessHonor && <Link to="/honor" className="hover:text-white px-3 py-2 rounded-md text-sm font-medium">Honor</Link>}
                {user && user.canAccessAnalytics && <Link to="/analytics" className="hover:text-white px-3 py-2 rounded-md text-sm font-medium">Analytics</Link>}
                {user && (user.role === 'admin' || user.role === 'r5' || user.role === 'r4') && (
                    <Link to="/admin/uploads" className="hover:text-white px-3 py-2 rounded-md text-sm font-medium">Uploads</Link>
                )}
                {user && (user.role === 'admin' || user.role === 'r5') && (
                    <Link to="/admin/users" className="hover:text-white px-3 py-2 rounded-md text-sm font-medium">Users</Link>
                )}
              </div>
            </div>
            <div>
              {user ? (
                <div className="flex items-center gap-4">
                  <span className="text-sm text-gray-400 hidden sm:inline">{user.username} ({user.role})</span>
                  <button onClick={logout} className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-sm">Logout</button>
                </div>
              ) : (
                 // Auch hier in der Navbar den Login-Link dynamisch halten, falls möglich, 
                 // aber meistens reicht der Button im Dashboard-Content.
                 // Wir lassen ihn hier statisch oder nutzen location hook auch hier.
                 <NavbarLoginLink />
              )}
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        {children}
      </main>
    </div>
  );
};

// Helper für Navbar Login Link
const NavbarLoginLink = () => {
    const location = useLocation();
    const search = location.search;
    return (
        <Link to={`/login${search}`} className="text-gray-300 hover:text-white text-sm font-medium">
            Login
        </Link>
    );
}

export default App;