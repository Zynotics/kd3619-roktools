// App.tsx - EINHEITLICHES LOGIN SYSTEM
import React, { useState } from 'react';
import { AuthProvider, useAuth } from './components/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import AdminUserManagement from './components/AdminUserManagement';
import OverviewDashboard from './components/OverviewDashboard';
import HonorDashboard from './components/HonorDashboard';
import PowerAnalyticsDashboard from './components/PowerAnalyticsDashboard';
import PowerHistoryChart from './components/PowerHistoryChart';

// zentrale Backend-URL
const BACKEND_URL = process.env.NODE_ENV === 'production' 
  ? 'https://kd3619-backend.onrender.com'
  : 'http://localhost:4000';

type ActiveView = 'overview' | 'honor' | 'analytics';

const AppContent: React.FC = () => {
  const [activeView, setActiveView] = useState<ActiveView>('overview');
  const { user, login, logout, isLoading } = useAuth();

  const [showLoginDialog, setShowLoginDialog] = useState<boolean>(false);
  const [username, setUsername] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState<boolean>(false);

  const handleLoginSubmit = async () => {
    if (!username || !password) {
      setLoginError('Bitte Benutzername und Passwort eingeben');
      return;
    }

    setIsLoggingIn(true);
    setLoginError(null);

    try {
      await login(username, password);
      setShowLoginDialog(false);
      setUsername('');
      setPassword('');
    } catch (error: any) {
      setLoginError(error.message || 'Anmeldung fehlgeschlagen');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleCancelLogin = () => {
    setShowLoginDialog(false);
    setLoginError(null);
    setUsername('');
    setPassword('');
  };

  // Admin Status basierend auf User-Rolle
  const isAdmin = user?.role === 'admin';

  return (
    <div className="min-h-screen bg-gray-900 text-gray-200 font-sans">
      {/* Login Dialog */}
      {showLoginDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 p-6 rounded-xl shadow-lg w-96 border border-gray-700">
            <h3 className="text-lg font-semibold text-white mb-4">Anmelden</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">
                  Benutzername
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleLoginSubmit()}
                  className="w-full bg-gray-700 border border-gray-600 text-white text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 p-2.5 transition-colors"
                  placeholder="Benutzername eingeben"
                  autoFocus
                  disabled={isLoggingIn}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">
                  Passwort
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleLoginSubmit()}
                  className="w-full bg-gray-700 border border-gray-600 text-white text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 p-2.5 transition-colors"
                  placeholder="Passwort eingeben"
                  disabled={isLoggingIn}
                />
              </div>
            </div>

            {loginError && (
              <p className="mt-2 text-sm text-red-400">{loginError}</p>
            )}

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={handleCancelLogin}
                disabled={isLoggingIn}
                className="px-4 py-2 rounded-lg bg-gray-600 text-white font-semibold hover:bg-gray-500 disabled:bg-gray-700 disabled:cursor-not-allowed transition-colors"
              >
                Abbrechen
              </button>
              <button
                onClick={handleLoginSubmit}
                disabled={isLoggingIn}
                className="px-4 py-2 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:bg-blue-800 disabled:cursor-not-allowed transition-colors"
              >
                {isLoggingIn ? 'Wird angemeldet...' : 'Anmelden'}
              </button>
            </div>

            <div className="mt-4 p-3 bg-gray-700 rounded-lg">
              <p className="text-xs text-gray-400">
                <strong>Test Accounts:</strong><br/>
                Admin: Stadmin / *3619rocks!<br/>
                Oder registriere einen neuen Account
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header mit Tabs + Login/Logout */}
        <header className="flex flex-col sm:flex-row justify-between sm:items-center mb-12 gap-6">
          {/* Navigation (Tabs) */}
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
            <button
              onClick={() => setActiveView('overview')}
              className={`flex items-center gap-3 px-6 py-3 rounded-xl text-lg font-bold transition-all duration-300 ${
                activeView === 'overview'
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/25'
                  : 'bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white border border-gray-700'
              }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" />
              </svg>
              Kingdom Development
            </button>
            
            <button
              onClick={() => setActiveView('honor')}
              className={`flex items-center gap-3 px-6 py-3 rounded-xl text-lg font-bold transition-all duration-300 ${
                activeView === 'honor'
                  ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg shadow-amber-500/25'
                  : 'bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white border border-gray-700'
              }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              Honor Ranking
            </button>

            <button
              onClick={() => setActiveView('analytics')}
              className={`flex items-center gap-3 px-6 py-3 rounded-xl text-lg font-bold transition-all duration-300 ${
                activeView === 'analytics'
                  ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg shadow-purple-500/25'
                  : 'bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white border border-gray-700'
              }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
              </svg>
              Player Analytics
            </button>
          </div>

          {/* User Info + Login / Logout */}
          <div className="flex items-center gap-4">
            {/* User Info wenn eingeloggt */}
            {user && (
              <div className="flex items-center gap-3 p-3 rounded-xl bg-gray-800 border border-gray-700">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${
                    user.isApproved ? 'bg-green-400 animate-pulse' : 'bg-yellow-400'
                  }`}></div>
                  <span className="text-sm font-semibold text-white">
                    {user.username}
                  </span>
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    user.isApproved 
                      ? 'bg-green-500 text-white' 
                      : 'bg-yellow-500 text-black'
                  }`}>
                    {user.isApproved ? 'Freigegeben' : 'Ausstehend'}
                  </span>
                  {user.role === 'admin' && (
                    <span className="text-xs px-2 py-1 rounded-full bg-purple-500 text-white">
                      Admin
                    </span>
                  )}
                </div>
                <button
                  onClick={logout}
                  className="text-sm text-gray-400 hover:text-white transition-colors"
                >
                  Abmelden
                </button>
              </div>
            )}

            {/* Login / Logout Button */}
            <div className="flex-shrink-0">
              {!user ? (
                <button
                  onClick={() => setShowLoginDialog(true)}
                  className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 text-white font-semibold hover:from-blue-600 hover:to-blue-700 transition-all duration-300 shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M3 3a1 1 0 011-1h12a1 1 0 011 1v3a1 1 0 01-.293.707L12 11.414V15a1 1 0 01-.293.707l-2 2A1 1 0 018 17v-5.586L3.293 6.707A1 1 0 013 6V3z" clipRule="evenodd" />
                  </svg>
                  Anmelden
                </button>
              ) : (
                <button
                  onClick={logout}
                  className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-red-500 to-red-600 text-white font-semibold hover:from-red-600 hover:to-red-700 transition-all duration-300 shadow-lg shadow-red-500/25 hover:shadow-red-500/40"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M3 3a1 1 0 00-1 1v12a1 1 0 102 0V4a1 1 0 00-1-1zm10.293 9.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L14.586 9H7a1 1 0 100 2h7.586l-1.293 1.293z" clipRule="evenodd" />
                  </svg>
                  Abmelden
                </button>
              )}
            </div>
          </div>
        </header>

        {/* Hauptinhalt */}
        <main>
          {/* Admin Bereich - Nur für Admin-User sichtbar */}
          {isAdmin && (
            <div className="mb-8">
              <AdminUserManagement />
            </div>
          )}

          {/* Tab Content */}
          {activeView === 'overview' && (
            <div>
              {/* Overview Dashboard - Nur für freigegebene User */}
                <OverviewDashboard
                  isAdmin={isAdmin}
                  backendUrl={BACKEND_URL}
                />
              </ProtectedRoute>
            </div>
          )}
          
          {activeView === 'honor' && (
            <HonorDashboard
              isAdmin={isAdmin}
              backendUrl={BACKEND_URL}
            />
          )}
          
          {activeView === 'analytics' && (
            <PowerAnalyticsDashboard
              isAdmin={isAdmin}
              backendUrl={BACKEND_URL}
            />
          )}

          {/* Kingdom Analytics Charts - Immer sichtbar (auch ohne Login) */}
          <div className="mt-8">
            <PowerHistoryChart />
          </div>
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