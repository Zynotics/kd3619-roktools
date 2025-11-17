import React, { useState } from 'react';
import OverviewDashboard from './components/OverviewDashboard';
import HonorDashboard from './components/HonorDashboard';

// zentrale Backend-URL
const BACKEND_URL = process.env.NODE_ENV === 'production' 
  ? 'https://kd3619-backend.onrender.com'
  : 'http://localhost:4000';

// Login-Daten
const ADMIN_USERNAME = 'Stadmin';
const ADMIN_PASSWORD = '*3619rocks!';

type ActiveView = 'overview' | 'honor';

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

  const handleAdminLogout = () => {
    setIsAdmin(false);
    localStorage.setItem('isAdmin', 'false');
    setUsername('');
    setPassword('');
    setLoginError(null);
  };

  const handleCancelLogin = () => {
    setShowLoginDialog(false);
    setLoginError(null);
    setUsername('');
    setPassword('');
  };

  const NavButton: React.FC<{ view: ActiveView; label: string }> = ({ view, label }) => (
    <button
      onClick={() => setActiveView(view)}
      className={`px-6 py-2 rounded-lg text-lg font-bold transition-colors ${
        activeView === view
          ? 'bg-blue-600 text-white'
          : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="min-h-screen bg-gray-900 text-gray-200 font-sans">
      {/* Login Dialog */}
      {showLoginDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 p-6 rounded-xl shadow-lg w-96">
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
                  className="w-full bg-gray-700 border border-gray-600 text-white text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 p-2.5"
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
                  className="w-full bg-gray-700 border border-gray-600 text-white text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 p-2.5"
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
        <header className="flex flex-col sm:flex-row justify-between sm:items-center mb-8 gap-4">
          {/* Navigation (Tabs) */}
          <div className="flex items-center gap-4">
            <NavButton view="overview" label="3619 CH25 Overview" />
            <NavButton view="honor" label="Honor Dashboard" />
          </div>

          {/* Admin Login / Logout */}
          <div className="flex-shrink-0">
            {!isAdmin ? (
              <button
                onClick={handleAdminLogin}
                className="px-6 py-2 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 transition-colors text-lg"
              >
                Admin Login
              </button>
            ) : (
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-green-400">Admin Mode</p>
                <button
                  onClick={handleAdminLogout}
                  className="px-4 py-2 rounded-lg bg-red-600 text-white font-semibold hover:bg-red-700 transition-colors text-sm"
                >
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
        </main>
      </div>
    </div>
  );
};

export default App;