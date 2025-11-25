// App.tsx - KD3619 mit Login, Admin & Feature-Rechten
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
    ? 'https://kd3619-backend.onrender.com'
    : 'http://localhost:4000';

type ActiveView = 'overview' | 'honor' | 'analytics' | 'admin';

const AppContent: React.FC = () => {
  const [activeView, setActiveView] = useState<ActiveView>('overview');
  const { user, logout, isLoading } = useAuth();

  const isAdmin = user?.role === 'admin';

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-900 to-black text-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Header */}
        <header className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center shadow-lg">
              <span className="font-bold text-xl text-white">KD</span>
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white">
                KD3619 Kingdom Analytics
              </h1>
              <p className="text-xs text-gray-400">
                Honor Dashboard · Player Analytics · Overview Dashboard
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {isLoading && (
              <span className="text-xs text-gray-400">Prüfe Anmeldung…</span>
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
                    {user.isApproved ? 'Freigegeben' : 'Freigabe ausstehend'}
                  </div>
                </div>
                <button
                  onClick={logout}
                  className="text-xs px-3 py-1.5 rounded-md border border-gray-600 text-gray-200 hover:bg-gray-800 transition-colors"
                >
                  Abmelden
                </button>
              </>
            ) : (
              <span className="text-xs text-gray-400">
                Bitte anmelden oder registrieren, um Zugriff zu erhalten.
              </span>
            )}
          </div>
        </header>

        <div className="flex flex-col lg:flex-row gap-6">
          {/* Seiten-Navigation */}
          <nav className="lg:w-64 flex-shrink-0">
            <div className="bg-gray-900/70 border border-gray-800 rounded-xl p-4 shadow-xl shadow-black/40">
              <p className="text-xs font-semibold text-gray-400 mb-3">
                Ansichten
              </p>
              <div className="flex lg:flex-col gap-2">
                <button
                  onClick={() => setActiveView('overview')}
                  className={`flex items-center gap-3 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    activeView === 'overview'
                      ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-lg shadow-blue-500/25'
                      : 'bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white border border-gray-700'
                  }`}
                >
                  CH25 Kingdom Analytics
                </button>
                <button
                  onClick={() => setActiveView('honor')}
                  className={`flex items-center gap-3 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    activeView === 'honor'
                      ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg shadow-amber-500/25'
                      : 'bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white border border-gray-700'
                  }`}
                >
                  Honor Ranking
                </button>
                <button
                  onClick={() => setActiveView('analytics')}
                  className={`flex items-center gap-3 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    activeView === 'analytics'
                      ? 'bg-gradient-to-r from-emerald-500 to-lime-500 text-white shadow-lg shadow-emerald-500/25'
                      : 'bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white border border-gray-700'
                  }`}
                >
                  Player Analytics
                </button>
                {isAdmin && (
                  <button
                    onClick={() => setActiveView('admin')}
                    className={`flex items-center gap-3 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      activeView === 'admin'
                        ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg shadow-purple-500/25'
                        : 'bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white border border-gray-700'
                    }`}
                  >
                    Admin · Benutzer
                  </button>
                )}
              </div>
            </div>
          </nav>

          {/* Hauptinhalt */}
          <main className="flex-1 space-y-6">
            {/* Inhalt je nach aktiver View */}
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

            {activeView === 'admin' && isAdmin && (
              <ProtectedRoute>
                <AdminUserManagement />
              </ProtectedRoute>
            )}

            {/* Chart nur für angemeldete & freigegebene User */}
            {user && user.isApproved && (
              <div className="mt-4">
                <PowerHistoryChart />
              </div>
            )}
          </main>
        </div>
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
