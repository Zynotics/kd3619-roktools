import React, { useState } from 'react';
import OverviewDashboard from './components/OverviewDashboard';
import HonorDashboard from './components/HonorDashboard';
import PowerAnalyticsDashboard from './components/PowerAnalyticsDashboard';

// zentrale Backend-URL
const BACKEND_URL = process.env.NODE_ENV === 'production' 
  ? 'https://kd3619-backend.onrender.com'
  : 'http://localhost:4000';

// Login-Daten
const ADMIN_USERNAME = 'Stadmin';
const ADMIN_PASSWORD = '*3619rocks!';

type ActiveView = 'overview' | 'honor' | 'analytics';

const App: React.FC = () => {
  const [activeView, setActiveView] = useState<ActiveView>('overview');

  // Admin-Status im localStorage speichern für Persistenz
  const [isAdmin, setIsAdmin] = useState<boolean>(() => {
    return localStorage.getItem('isAdmin') === 'true';
  });
  const [showLoginDialog, setShowLoginDialog] = useState<boolean>(false);
  const [username, setUsername] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [loginError, setLoginError] = useState<string | null>(null);

  const handleAdminLogin = () => {
    setShowLoginDialog(true);
    setLoginError(null);
    setUsername('');
    setPassword('');
  };

  const handleLoginSubmit = () => {
    if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
      setIsAdmin(true);
      localStorage.setItem('isAdmin', 'true');
      setLoginError(null);
      setShowLoginDialog(false);
      setUsername('');
      setPassword('');
    } else {
      setLoginError('Invalid username or password');
    }
  };

  const handleCancelLogin = () => {
    setShowLoginDialog(false);
    setLoginError(null);
    setUsername('');
    setPassword('');
  };

  const handleAdminLogout = () => {
    setIsAdmin(false);
    localStorage.setItem('isAdmin', 'false');
    setUsername('');
    setPassword('');
    setLoginError(null);
  };

  return (
    <div className="min-h-screen bg-gray-900 text-gray-200 font-sans">
      {/* Login Dialog */}
      {showLoginDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 p-6 rounded-xl shadow-lg w-96 border border-gray-700">
            <h3 className="text-lg font-semibold text-white mb-4">Admin Login</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">
                  Username
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleLoginSubmit()}
                  className="w-full bg-gray-700 border border-gray-600 text-white text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 p-2.5 transition-colors"
                  placeholder="Enter username"
                  autoFocus
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">
                  Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleLoginSubmit()}
                  className="w-full bg-gray-700 border border-gray-600 text-white text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 p-2.5 transition-colors"
                  placeholder="Enter password"
                />
              </div>
            </div>

            {loginError && (
              <p className="mt-2 text-sm text-red-400">{loginError}</p>
            )}

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={handleCancelLogin}
                className="px-4 py-2 rounded-lg bg-gray-600 text-white font-semibold hover:bg-gray-500 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleLoginSubmit}
                className="px-4 py-2 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 transition-colors"
              >
                Login
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header mit Tabs + Admin-Login */}
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
              CH25 Stats
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
              Power Analytics
            </button>
          </div>

          {/* Admin Login / Logout */}
          <div className="flex-shrink-0">
            {!isAdmin ? (
              <button
                onClick={handleAdminLogin}
                className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-green-500 to-emerald-500 text-white font-semibold hover:from-green-600 hover:to-emerald-600 transition-all duration-300 shadow-lg shadow-green-500/25 hover:shadow-green-500/40"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                </svg>
                Login
              </button>
            ) : (
              <div className="flex items-center gap-4 p-3 rounded-xl bg-gradient-to-r from-gray-800 to-gray-700 border border-gray-600">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                  <p className="text-sm font-semibold text-green-400">Admin Mode</p>
                </div>
                <button
                  onClick={handleAdminLogout}
                  className="flex items-center gap-2 px-3 py-1 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M3 3a1 1 0 00-1 1v12a1 1 0 102 0V4a1 1 0 00-1-1zm10.293 9.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L14.586 9H7a1 1 0 100 2h7.586l-1.293 1.293z" clipRule="evenodd" />
                  </svg>
                  Logout
                </button>
              </div>
            )}
          </div>
        </header>

        {/* Hauptinhalt */}
        <main>
          {activeView === 'overview' && (
            <OverviewDashboard
              isAdmin={isAdmin}
              backendUrl={BACKEND_URL}
            />
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
        </main>
      </div>
    </div>
  );
};

export default App;