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
  const [headerTitle, setHeaderTitle] = useState<string>('Rise of Stats');

  // 🌐 Lese Slug aus Query-Parametern
  const queryParams = new URLSearchParams(window.location.search);
  const publicSlug = queryParams.get('slug');

  // Rollen
  const isSuperAdmin = user?.role === 'admin';
  const isR5 = user?.role === 'r5';
  const isAdmin = isSuperAdmin || isR5; 

  // View-Modi
  const isPublicView = !!publicSlug && !user;
  const isAdminOverrideView = isSuperAdmin && !!publicSlug; 

  // 1. VIEW ROUTING
  useEffect(() => {
    if (publicSlug && !user) {
        if (activeView === 'admin') setActiveView('overview');
    } 
    else if (isSuperAdmin && !publicSlug && activeView !== 'admin') {
        setActiveView('admin');
    }
  }, [publicSlug, isSuperAdmin, activeView, user]);

  // 2. R5 REDIRECT
  useEffect(() => {
    const redirectToSlug = async () => {
        if (user && user.kingdomId && !publicSlug && !isSuperAdmin) {
            try {
                const token = localStorage.getItem('authToken');
                const res = await fetch(`${BACKEND_URL}/api/admin/kingdoms`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                if (res.ok) {
                    const kingdoms = await res.json();
                    if (kingdoms && kingdoms.length > 0) {
                        const mySlug = kingdoms[0].slug;
                        if (mySlug) {
                            const newUrl = new URL(window.location.href);
                            newUrl.searchParams.set('slug', mySlug);
                            window.location.href = newUrl.toString();
                        }
                    }
                }
            } catch (e) { console.error('Redirect failed', e); }
        }
    };
    if (!isLoading) redirectToSlug();
  }, [user, isLoading, publicSlug, isSuperAdmin]);

  // 3. DYNAMISCHER HEADER TITEL (Main Header)
  useEffect(() => {
    const fetchTitle = async () => {
      // Priorität 1: Der Slug in der URL bestimmt den Titel
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

      // Priorität 2: Eingeloggter R5 (Fallback, falls Redirect noch nicht griff)
      if (user && user.kingdomId) {
        try {
          const token = localStorage.getItem('authToken');
          const res = await fetch(`${BACKEND_URL}/api/admin/kingdoms`, {
            headers: { Authorization: `Bearer ${token}` },
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

      // Priorität 3: Superadmin Home
      if (isSuperAdmin) {
        setHeaderTitle('Superadmin Dashboard');
        return;
      }

      setHeaderTitle('Rise of Stats');
    };

    fetchTitle();
  }, [publicSlug, user, isSuperAdmin]);

  if (!user && !publicSlug && !isLoading) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-900 to-black text-gray-100">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
                <LoginPrompt />
                <div className="mt-8 text-center text-gray-500"><p>Or access a Kingdom directly via Link.</p></div>
            </div>
        </div>
      );
  }

  const showDashboardTabs = !isSuperAdmin || isAdminOverrideView; 
  const showAdminTab = isAdmin || isSuperAdmin; 

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-900 to-black text-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <header className="mb-6 border-b border-gray-800 pb-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center shadow-lg"><span className="font-bold text-xl text-white">KD</span></div>
              <div>
                  {/* Dieser Titel ist dynamisch basierend auf dem Kingdom */}
                  <h1 className="text-2xl font-bold tracking-tight text-white">{headerTitle}</h1>
              </div>
            </div>
            <div className="flex items-center gap-4">
              {isLoading && <span className="text-xs text-gray-400">Loading...</span>}
              {user ? (
                <>
                  <div className="text-right hidden sm:block">
                    <div className="text-sm font-semibold text-white">{user.username}</div>
                    <div className="text-xs text-gray-400">{user.role.toUpperCase()}</div>
                  </div>
                  <button onClick={logout} className="text-xs px-3 py-1.5 rounded border border-gray-600 text-gray-200 hover:bg-gray-800 transition-colors">Logout</button>
                </>
              ) : (
                !isLoading && (
                    <button onClick={() => (window.location.href = '/')} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors shadow-lg">
                      Login
                    </button>
                )
              )}
            </div>
          </div>
          <nav className="mt-4">
            <div className="flex flex-wrap gap-2">
              {showDashboardTabs && (
                <>
                  <button onClick={() => setActiveView('overview')} className={`px-4 py-2 rounded-lg text-sm font-medium ${activeView==='overview' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-300'}`}>Overview</button>
                  <button onClick={() => setActiveView('honor')} className={`px-4 py-2 rounded-lg text-sm font-medium ${activeView==='honor' ? 'bg-orange-600 text-white' : 'bg-gray-800 text-gray-300'}`}>Honor</button>
                  <button onClick={() => setActiveView('analytics')} className={`px-4 py-2 rounded-lg text-sm font-medium ${activeView==='analytics' ? 'bg-emerald-600 text-white' : 'bg-gray-800 text-gray-300'}`}>Analytics</button>
                </>
              )}
              {showAdminTab && <button onClick={() => setActiveView('admin')} className={`px-4 py-2 rounded-lg text-sm font-medium ${activeView==='admin' ? 'bg-purple-600 text-white' : 'bg-gray-800 text-gray-300'}`}>Admin</button>}
            </div>
          </nav>
        </header>
        <main className="space-y-6">
            {activeView === 'overview' && <PublicOrProtectedRoute isPublic={!!publicSlug} publicSlug={publicSlug} accessType="overview" isAdminOverride={isAdminOverrideView}><OverviewDashboard isAdmin={!!isAdmin} backendUrl={BACKEND_URL} publicSlug={publicSlug} isAdminOverride={isAdminOverrideView} /></PublicOrProtectedRoute>}
            {activeView === 'honor' && <PublicOrProtectedRoute isPublic={!!publicSlug} publicSlug={publicSlug} accessType="honor" isAdminOverride={isAdminOverrideView}><HonorDashboard isAdmin={!!isAdmin} backendUrl={BACKEND_URL} publicSlug={publicSlug} isAdminOverride={isAdminOverrideView} /></PublicOrProtectedRoute>}
            {activeView === 'analytics' && <PublicOrProtectedRoute isPublic={!!publicSlug} publicSlug={publicSlug} accessType="analytics" isAdminOverride={isAdminOverrideView}><PowerAnalyticsDashboard isAdmin={!!isAdmin} backendUrl={BACKEND_URL} publicSlug={publicSlug} isAdminOverride={isAdminOverrideView} /></PublicOrProtectedRoute>}
            {activeView === 'admin' && user && (isAdmin) && <ProtectedRoute><AdminUserManagement /></ProtectedRoute>}
            
            {/* Global Chart wird hier nicht mehr benötigt, da es in OverviewDashboard ist */}
        </main>
      </div>
    </div>
  );
};

interface PProps { children: React.ReactNode; isPublic: boolean; publicSlug: string | null; accessType: 'overview' | 'honor' | 'analytics'; isAdminOverride: boolean; }
const PublicOrProtectedRoute: React.FC<PProps> = ({ children, isPublic, publicSlug, accessType, isAdminOverride }) => {
    if (isPublic || isAdminOverride) return <>{children}</>;
    return <ProtectedRoute accessType={accessType}>{children}</ProtectedRoute>;
};

const App: React.FC = () => <AuthProvider><AppContent /></AuthProvider>;
export default App;