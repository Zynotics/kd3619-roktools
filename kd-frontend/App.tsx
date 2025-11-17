import React, { useState } from 'react';
import OverviewDashboard from './components/OverviewDashboard';
import HonorDashboard from './components/HonorDashboard';

// zentrale Backend-URL
const BACKEND_URL = process.env.NODE_ENV === 'production' 
  ? 'https://kd3619-backend.onrender.com'
  : 'http://localhost:4000';

// Einfaches clientseitiges Passwort – nur UI, keine echte Sicherheit
const ADMIN_PASSWORD = '*3619rocks!';

type ActiveView = 'overview' | 'honor';

const App: React.FC = () => {
  const [activeView, setActiveView] = useState<ActiveView>('overview');

  // Admin-Status im localStorage speichern für Persistenz
  const [isAdmin, setIsAdmin] = useState<boolean>(() => {
    return localStorage.getItem('isAdmin') === 'true';
  });
  const [adminInput, setAdminInput] = useState<string>('');
  const [adminError, setAdminError] = useState<string | null>(null);

  const handleAdminLogin = () => {
    if (adminInput === ADMIN_PASSWORD) {
      setIsAdmin(true);
      localStorage.setItem('isAdmin', 'true');
      setAdminError(null);
      setAdminInput('');
    } else {
      setIsAdmin(false);
      localStorage.setItem('isAdmin', 'false');
      setAdminError('Incorrect Password');
    }
  };

  const handleAdminLogout = () => {
    setIsAdmin(false);
    localStorage.setItem('isAdmin', 'false');
    setAdminInput('');
    setAdminError(null);
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
              <div className="flex items-center gap-2">
                <input
                  type="password"
                  value={adminInput}
                  onChange={(e) => setAdminInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAdminLogin()}
                  className="w-32 bg-gray-700 border border-gray-600 text-white text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 p-2 placeholder-gray-400"
                  placeholder="Admin Password"
                />
                <button
                  onClick={handleAdminLogin}
                  className="px-4 py-2 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 transition-colors text-sm"
                >
                  Login
                </button>
              </div>
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
            {adminError && (
              <p className="mt-1 text-sm text-red-400">{adminError}</p>
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