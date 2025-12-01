// App.tsx - KD3619 with Login, Admin & Feature Permissions (Top Navigation) (VOLLSTÄNDIGER CODE)
import React, { useState } from 'react';
import { AuthProvider, useAuth } from './components/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import AdminUserManagement from './components/AdminUserManagement';
import OverviewDashboard from './components/OverviewDashboard';
import HonorDashboard from './components/HonorDashboard';
import PowerAnalyticsDashboard from './components/PowerAnalyticsDashboard';
import PowerHistoryChart from './components/PowerHistoryChart';
import LoginPrompt from './components/LoginPrompt'; // LoginPrompt muss hinzugefügt werden

const BACKEND_URL =
  process.env.NODE_ENV === 'production'
    ? 'https://api.rise-of-stats.com' 
    : 'http://localhost:4000';

type ActiveView = 'overview' | 'honor' | 'analytics' | 'admin';

const AppContent: React.FC = () => {
  const { user, logout, isLoading } = useAuth();

  // 🌐 NEU: Lese Slug aus Query-Parametern (z.B. ?slug=kd3619)
  const queryParams = new URLSearchParams(window.location.search);
  const publicSlug = queryParams.get('slug');
  
  // Bestimme den aktiven View
  const [activeView, setActiveView] = useState<ActiveView>(
    publicSlug ? 'overview' : 'overview'
  );
  
  // NUR Public View, wenn KEIN User eingeloggt UND Slug vorhanden ist
  const isPublicView = !!publicSlug && !user;
  
  // Wenn Public View, zwinge den View auf die erlaubten Dashboards
  if (isPublicView && activeView === 'admin') {
      setActiveView('overview');
  }


  // 👉 R5 wird hier wie Admin behandelt
  const isAdmin = user?.role === 'admin' || user?.role === 'r5';
  
  // Wenn der Benutzer NICHT eingeloggt und KEIN Slug vorhanden ist
  if (!user && !publicSlug && !isLoading) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-900 to-black text-gray-100">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
                <LoginPrompt />
                <div className="mt-8 text-center text-gray-500">
                    <p>Or access a Kingdom directly using a public link (e.g., YourDomain.com?slug=kingdom-name).</p>
                </div>
            </div>
        </div>
      );
  }


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
                  {/* Zeige Slug im öffentlichen Modus */}
                  {publicSlug && `Viewing Public Data for: ${publicSlug}`}
                </p>
              </div>
            </div>

            {/* User info / auth */}
            <div className="flex items-center gap-4">
              {isLoading && (
                <span className="text-xs text-gray-400">Checking login…</span>
              )}
              {user ? (
                // Angemeldete Ansicht
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
              ) : null /* Im öffentlichen Modus nichts anzeigen */}
            </div>
          </div>

          {/* TOP NAVIGATION */}
          <nav className="mt-4">
            <div className="flex flex-wrap gap-2">
              {/* Overview (immer verfügbar) */}
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

              {/* Honor (immer verfügbar) */}
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
              
              {/* Analytics (immer verfügbar) */}
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


              {/* 👉 Admin-Users Button nur für eingeloggte Admins/R5 */}
              {user && (isAdmin || user.role === 'r5') && (
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
          {/* Lade die Dashboards mit dem Slug (Public) oder ProtectedRoute (Private) */}
          
          {activeView === 'overview' && (
            <PublicOrProtectedRoute isPublic={isPublicView} publicSlug={publicSlug} accessType="overview">
              <OverviewDashboard 
                  isAdmin={!!isAdmin} 
                  backendUrl={BACKEND_URL} 
                  publicSlug={publicSlug} 
              />
            </PublicOrProtectedRoute>
          )}

          {activeView === 'honor' && (
            <PublicOrProtectedRoute isPublic={isPublicView} publicSlug={publicSlug} accessType="honor">
              <HonorDashboard 
                  isAdmin={!!isAdmin} 
                  backendUrl={BACKEND_URL} 
                  publicSlug={publicSlug}
              />
            </PublicOrProtectedRoute>
          )}

          {activeView === 'analytics' && (
            <PublicOrProtectedRoute isPublic={isPublicView} publicSlug={publicSlug} accessType="analytics">
              <PowerAnalyticsDashboard
                isAdmin={!!isAdmin}
                backendUrl={BACKEND_URL}
                publicSlug={publicSlug}
              />
            </PublicOrProtectedRoute>
          )}

          {activeView === 'admin' && user && (isAdmin || user.role === 'r5') && (
            <ProtectedRoute>
              <AdminUserManagement />
            </ProtectedRoute>
          )}
        </main>
      </div>
    </div>
  );
};

// 🌐 NEU: Hilfs-Komponente, um ProtectedRoute zu umgehen, wenn ein Slug vorhanden ist.
interface PublicOrProtectedRouteProps {
    children: React.ReactNode;
    isPublic: boolean;
    publicSlug: string | null;
    accessType: 'overview' | 'honor' | 'analytics';
}

const PublicOrProtectedRoute: React.FC<PublicOrProtectedRouteProps> = ({ children, isPublic, publicSlug, accessType }) => {
    // Wenn es ein öffentlicher View ist, gib das Kind direkt zurück.
    if (isPublic) {
        if (!publicSlug) {
             return <div className="text-center p-8 text-red-400 bg-gray-800 rounded-xl">Invalid Public Link.</div>;
        }
        return <>{children}</>;
    }
    
    // Ansonsten, nutze die normale ProtectedRoute Logik (für eingeloggte User)
    return <ProtectedRoute accessType={accessType}>{children}</ProtectedRoute>;
};


const App: React.FC = () => {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
};

export default App;