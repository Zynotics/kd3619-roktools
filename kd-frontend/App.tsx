// App.tsx - VOLLSTÄNDIGER CODE
import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './components/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import AdminUserManagement from './components/AdminUserManagement';
import OverviewDashboard from './components/OverviewDashboard';
import HonorDashboard from './components/HonorDashboard';
import PowerAnalyticsDashboard from './components/PowerAnalyticsDashboard';
import PowerHistoryChart from './components/PowerHistoryChart';
import LoginPrompt from './components/LoginPrompt'; 

const BACKEND_URL =
  process.env.NODE_ENV === 'production'
    ? 'https://api.rise-of-stats.com' 
    : 'http://localhost:4000';

type ActiveView = 'overview' | 'honor' | 'analytics' | 'admin';

const AppContent: React.FC = () => {
  const { user, logout, isLoading } = useAuth();
  const [activeView, setActiveView] = useState<ActiveView>('overview');
  const [headerTitle, setHeaderTitle] = useState<string>('Rise of Stats'); // Default

  // 🌐 Lese Slug aus URL
  const queryParams = new URLSearchParams(window.location.search);
  const publicSlug = queryParams.get('slug');
  
  // Rollen & View Logic
  const isSuperAdmin = user?.role === 'admin';
  const isR5 = user?.role === 'r5';
  const isAdmin = isSuperAdmin || isR5; 
  const isPublicView = !!publicSlug && !user; 
  const isAdminOverrideView = isSuperAdmin && !!publicSlug; 

  // Initiale View-Setzung
  useEffect(() => {
      if (publicSlug) setActiveView('overview');
      else if (isSuperAdmin && !isAdminOverrideView && activeView !== 'admin') setActiveView('admin');
  }, [publicSlug, isSuperAdmin, isAdminOverrideView]);

  // 👑 HEADER TITEL LOGIK
  useEffect(() => {
    const fetchTitle = async () => {
        // 1. Public View oder Admin Override (Slug vorhanden)
        if (publicSlug) {
            try {
                const res = await fetch(`${BACKEND_URL}/api/public/kingdom/${publicSlug}`);
                if (res.ok) {
                    const data = await res.json();
                    setHeaderTitle(data.displayName || 'Kingdom Analytics');
                } else {
                    setHeaderTitle(publicSlug.toUpperCase());
                }
            } catch (e) { setHeaderTitle('Kingdom Analytics'); }
            return;
        }

        // 2. Eingeloggter R5/R4 (kein Slug)
        if (user && (user.role === 'r5' || user.role === 'r4')) {
             // Wir nutzen den Admin-Endpoint, der für R5/R4 gescoped ist und nur IHR Kingdom zurückgibt
             try {
                const token = localStorage.getItem('authToken');
                const res = await fetch(`${BACKEND_URL}/api/admin/kingdoms`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                if (res.ok) {
                    const data = await res.json();
                    if (data && data.length > 0) {
                        setHeaderTitle(data[0].displayName);
                    }
                }
             } catch (e) { setHeaderTitle('Kingdom Analytics'); }
             return;
        }

        // 3. Superadmin (ohne Slug)
        if (isSuperAdmin) {
            setHeaderTitle('Superadmin Dashboard');
            return;
        }

        // 4. Fallback
        setHeaderTitle('Rise of Stats');
    };
    
    fetchTitle();
  }, [publicSlug, user, isSuperAdmin]);


  // Wenn nicht eingeloggt und kein Slug -> Login
  if (!user && !publicSlug && !isLoading) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-900 to-black text-gray-100">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
                <LoginPrompt />
                <div className="mt-8 text-center text-gray-500">
                    <p>Or access a Kingdom directly using a public link (e.g., ?slug=kingdom-name).</p>
                </div>
            </div>
        </div>
      );
  }

  const showDashboardTabs = !isSuperAdmin || isAdminOverrideView; 
  const showAdminTab = isAdmin || isSuperAdmin; 

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-900 to-black text-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* HEADER */}
        <header className="mb-6 border-b border-gray-800 pb-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center shadow-lg">
                <span className="font-bold text-xl text-white">KD</span>
              </div>
              <div>
                {/* 👑 DYNAMISCHER TITEL */}
                <h1 className="text-2xl font-bold tracking-tight text-white">
                  {headerTitle}
                </h1>
                <p className="text-xs text-gray-400">
                  Analytics Platform
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              {isLoading && <span className="text-xs text-gray-400">Checking login…</span>}
              {user && (
                <>
                  <div className="text-right">
                    <div className="text-sm font-semibold text-white">
                      {user.username}
                      {(user.role === 'admin' || user.role === 'r5') && (
                        <span className="ml-2 text-xs text-purple-400">({user.role.toUpperCase()})</span>
                      )}
                    </div>
                    <div className="text-xs text-gray-400">
                      {user.isApproved ? 'Approved' : 'Pending'}
                    </div>
                  </div>
                  <button onClick={logout} className="text-xs px-3 py-1.5 rounded-md border border-gray-600 text-gray-200 hover:bg-gray-800 transition-colors">
                    Log out
                  </button>
                </>
              )}
            </div>
          </div>

          {/* NAVIGATION */}
          <nav className="mt-4">
            <div className="flex flex-wrap gap-2">
              {showDashboardTabs && (
                <>
                  <button onClick={() => setActiveView('overview')} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeView === 'overview' ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-lg shadow-blue-500/25' : 'bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white border border-gray-700'}`}>
                    Kingdom Analytics
                  </button>
                  <button onClick={() => setActiveView('honor')} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeView === 'honor' ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg shadow-amber-500/25' : 'bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white border border-gray-700'}`}>
                    Honor Ranking
                  </button>
                  <button onClick={() => setActiveView('analytics')} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeView === 'analytics' ? 'bg-gradient-to-r from-emerald-500 to-lime-500 text-white shadow-lg shadow-emerald-500/25' : 'bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white border border-gray-700'}`}>
                    Player Analytics
                  </button>
                </>
              )}
              {showAdminTab && (
                <button onClick={() => setActiveView('admin')} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeView === 'admin' ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg shadow-purple-500/25' : 'bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white border border-gray-700'}`}>
                    Admin · Users
                </button>
              )}
            </div>
          </nav>
        </header>

        <main className="space-y-6">
          {activeView === 'overview' && (
            <PublicOrProtectedRoute isPublic={isPublicView} publicSlug={publicSlug} accessType="overview" isAdminOverride={isAdminOverrideView}>
              <OverviewDashboard isAdmin={!!isAdmin} backendUrl={BACKEND_URL} publicSlug={publicSlug} isAdminOverride={isAdminOverrideView} />
            </PublicOrProtectedRoute>
          )}
          {activeView === 'honor' && (
            <PublicOrProtectedRoute isPublic={isPublicView} publicSlug={publicSlug} accessType="honor" isAdminOverride={isAdminOverrideView}>
              <HonorDashboard isAdmin={!!isAdmin} backendUrl={BACKEND_URL} publicSlug={publicSlug} isAdminOverride={isAdminOverrideView} />
            </PublicOrProtectedRoute>
          )}
          {activeView === 'analytics' && (
            <PublicOrProtectedRoute isPublic={isPublicView} publicSlug={publicSlug} accessType="analytics" isAdminOverride={isAdminOverrideView}>
              <PowerAnalyticsDashboard isAdmin={!!isAdmin} backendUrl={BACKEND_URL} publicSlug={publicSlug} isAdminOverride={isAdminOverrideView} />
            </PublicOrProtectedRoute>
          )}
          {activeView === 'admin' && user && (isAdmin || user.role === 'r5') && (
            <ProtectedRoute>
              <AdminUserManagement />
            </ProtectedRoute>
          )}
          
          {/* Global Chart wenn eingeloggt und nicht im Admin View */}
          {user && user.isApproved && activeView !== 'admin' && !isPublicView && (
            <div className="mt-4">
              <PowerHistoryChart />
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

interface PublicOrProtectedRouteProps {
    children: React.ReactNode;
    isPublic: boolean;
    publicSlug: string | null;
    accessType: 'overview' | 'honor' | 'analytics';
    isAdminOverride: boolean;
}

const PublicOrProtectedRoute: React.FC<PublicOrProtectedRouteProps> = ({ children, isPublic, publicSlug, accessType, isAdminOverride }) => {
    if (isPublic || isAdminOverride) {
        if (!publicSlug && isPublic) {
             return <div className="text-center p-8 text-red-400 bg-gray-800 rounded-xl">Invalid Link.</div>;
        }
        return <>{children}</>;
    }
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