// App.tsx - KD3619 with Login, Admin & Feature Permissions (Top Navigation)
import React, { useState } from 'react';
import { AuthProvider, useAuth } from './components/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import AdminUserManagement from './components/AdminUserManagement';
import OverviewDashboard from './components/OverviewDashboard';
import HonorDashboard from './components/HonorDashboard';
import PowerAnalyticsDashboard from './components/PowerAnalyticsDashboard';
import PowerHistoryChart from './components/PowerHistoryChart';

const BACKEND_URL =
  process.env.NODE_ENV === 'production'
    ? 'https://api.rise-of-stats.com' // <-- KORRIGIERT
    : 'http://localhost:4000';

type ActiveView = 'overview' | 'honor' | 'analytics' | 'admin';
// ... (Rest des Codes bleibt unverändert)

// App.tsx muss in seiner Gesamtheit korrigiert werden, hier der vollständige Code:
const AppContent: React.FC = () => {
  const [activeView, setActiveView] = useState<ActiveView>('overview');
  const { user, logout, isLoading } = useAuth();

  // 👉 R5 wird hier wie Admin behandelt
  const isAdmin = user?.role === 'admin' || user?.role === 'r5';

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-900 to-black text-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* HEADER */}
        <header className="mb-6 border-b border-gray-800 pb-4">
          <div className="flex items-center justify-between gap-4">
            {/* Logo + Title */}
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center shadow-lg">
                <span className="font-bold text-xl text-white">KD</span>
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-white">
                  KD3619 Kingdom Analytics
                </h1>
                <p className="text-xs text-gray-400">
                  {/* optionaler Untertitel */}
                </p>
              </div>
            </div>

            {/* User info / auth */}
            <div className="flex items-center gap-4">
              {isLoading && (
                <span className="text-xs text-gray-400">Checking login…</span>
              )}
              {user ? (
                <>
                  <div className="text-right">
                    <div className="text-sm font-semibold text-white">
                      {user.username}
                      {isAdmin && (
                        <span className="ml-2 text-xs text-purple-400">
                          (Admin)
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-400">
                      {user.isApproved ? 'Approved' : 'Pending approval'}
                    </div>
                  </div>
                  <button
                    onClick={logout}
                    className="text-xs px-3 py-1.5 rounded-md border border-gray-600 text-gray-200 hover:bg-gray-800 transition-colors"
                  >
                    Log out
                  </button>
                </>
              ) : (
                <span className="text-xs text-gray-400">
                  Please sign in or register.
                </span>
              )}
            </div>
          </div>

          {/* TOP NAVIGATION */}
          <nav className="mt-4">
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setActiveView('overview')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  activeView === 'overview'
                    ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-lg shadow-blue-500/25'
                    : 'bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white border border-gray-700'
                }`}
              >
                CH25 Kingdom Analytics
              </button>

              <button
                onClick={() => setActiveView('honor')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  activeView === 'honor'
                    ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg shadow-amber-500/25'
                    : 'bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white border border-gray-700'
                }`}
              >
                Honor Ranking
              </button>

              <button
                onClick={() => setActiveView('analytics')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  activeView === 'analytics'
                    ? 'bg-gradient-to-r from-emerald-500 to-lime-500 text-white shadow-lg shadow-emerald-500/25'
                    : 'bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white border border-gray-700'
                }`}
              >
                Player Analytics
              </button>

              {/* 👉 Admin-Users Button jetzt auch für R5 */}
              {isAdmin && (
                <button
                  onClick={() => setActiveView('admin')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    activeView === 'admin'
                      ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg shadow-purple-500/25'
                      : 'bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white border border-gray-700'
                  }`}
                >
                  Admin · Users
                </button>
              )}
            </div>
          </nav>
        </header>

        {/* MAIN CONTENT */}
        <main className="space-y-6">
          {/* View switching */}
          {activeView === 'overview' && (
            <ProtectedRoute accessType="overview">
              <OverviewDashboard isAdmin={!!isAdmin} backendUrl={BACKEND_URL} />
            </ProtectedRoute>
          )}

          {activeView === 'honor' && (
            <ProtectedRoute accessType="honor">
              <HonorDashboard isAdmin={!!isAdmin} backendUrl={BACKEND_URL} />
            </ProtectedRoute>
          )}

          {activeView === 'analytics' && (
            <ProtectedRoute accessType="analytics">
              <PowerAnalyticsDashboard
                isAdmin={!!isAdmin}
                backendUrl={BACKEND_URL}
              />
            </ProtectedRoute>
          )}

          {/* 👉 Admin-View nur rendern, wenn isAdmin (Admin oder R5) */}
          {activeView === 'admin' && isAdmin && (
            <ProtectedRoute>
              <AdminUserManagement />
            </ProtectedRoute>
          )}

          {/* Global chart (only for logged-in & approved users) */}
          {user && user.isApproved && (
            <div className="mt-4">
              <PowerHistoryChart />
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
};

export default App;