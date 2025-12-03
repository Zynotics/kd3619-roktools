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

  // 🌐 Lese Slug aus Query-Parametern (z.B. ?slug=kd3619)
  const queryParams = new URLSearchParams(window.location.search);
  const publicSlug = queryParams.get('slug');

  // Rollen-Definitionen
  const isSuperAdmin = user?.role === 'admin';
  const isR5 = user?.role === 'r5';
  const isAdmin = isSuperAdmin || isR5; // R5 hat Admin-Rechte im eigenen KD

  // View-Modi bestimmen
  const isPublicView = !!publicSlug && !user;
  const isAdminOverrideView = isSuperAdmin && !!publicSlug; // Admin schaut sich spezifisches KD an

  // 1. Initiale Routing-Logik
  useEffect(() => {
    if (publicSlug) {
      // Wenn ein Link da ist, zeigen wir standardmäßig die Overview
      // (verhindert, dass man im Admin-Panel "hängen bleibt" wenn man einen Link klickt)
      if (activeView === 'admin') setActiveView('overview');
    } else if (isSuperAdmin && !isAdminOverrideView && activeView !== 'admin') {
      // Wenn Superadmin OHNE Link eingeloggt ist -> Ab zum Admin Panel
      setActiveView('admin');
    }
  }, [publicSlug, isSuperAdmin, isAdminOverrideView, activeView]);

  // 2. Dynamischer Header Titel
  useEffect(() => {
    const fetchTitle = async () => {
      // Fall A: Public Link oder Admin Override (wir schauen ein spezifisches KD an)
      if (publicSlug) {
        try {
          const res = await fetch(`${BACKEND_URL}/api/public/kingdom/${publicSlug}`);
          if (res.ok) {
            const data = await res.json();
            setHeaderTitle(data.displayName || 'Kingdom Analytics');
          } else {
            setHeaderTitle(publicSlug.toUpperCase());
          }
        } catch (e) {
          setHeaderTitle('Kingdom Analytics');
        }
        return;
      }

      // Fall B: Eingeloggter R5 oder R4 (sehen ihr eigenes Kingdom)
      if (user && (user.role === 'r5' || user.role === 'r4') && user.kingdomId) {
        try {
          const token = localStorage.getItem('authToken');
          // Wir nutzen den Admin-Endpoint, der für R5 gescoped ist und nur das eigene KD liefert
          const res = await fetch(`${BACKEND_URL}/api/admin/kingdoms`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (res.ok) {
            const data = await res.json();
            if (data && data.length > 0) {
              setHeaderTitle(data[0].displayName);
            }
          }
        } catch (e) {
          setHeaderTitle('Kingdom Analytics');
        }
        return;
      }

      // Fall C: Superadmin im Root (kein Slug)
      if (isSuperAdmin) {
        setHeaderTitle('Superadmin Dashboard');
        return;
      }

      // Fall D: Fallback
      setHeaderTitle('Rise of Stats');
    };

    fetchTitle();
  }, [publicSlug, user, isSuperAdmin]);

  // 3. Landing Page (Nicht eingeloggt, kein Link)
  if (!user && !publicSlug && !isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-900 to-black text-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <LoginPrompt />
          <div className="mt-8 text-center text-gray-500">
            <p>Or access a Kingdom directly using a public link (e.g. ?slug=kingdom-name).</p>
          </div>
        </div>
      </div>
    );
  }

  // Bestimmen, welche Tabs sichtbar sind
  const showDashboardTabs = !isSuperAdmin || isAdminOverrideView; // Superadmin sieht Tabs nur im Override-Modus
  const showAdminTab = isAdmin || isSuperAdmin; // Admin-Tab für SA und R5

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
                  {headerTitle}
                </h1>
                <p className="text-xs text-gray-400">
                  {isAdminOverrideView ? 'Admin Viewing Mode' : 'Analytics Platform'}
                </p>
              </div>
            </div>

            {/* User Status / Logout */}
            <div className="flex items-center gap-4">
              {isLoading && <span className="text-xs text-gray-400">Checking login…</span>}
              {user ? (
                <>
                  <div className="text-right">
                    <div className="text-sm font-semibold text-white">
                      {user.username}
                      {(user.role === 'admin' || user.role === 'r5') && (
                        <span className="ml-2 text-xs text-purple-400">
                          ({user.role.toUpperCase()})
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-400">
                      {user.isApproved ? 'Approved' : 'Pending'}
                    </div>
                  </div>
                  <button
                    onClick={logout}
                    className="text-xs px-3 py-1.5 rounded-md border border-gray-600 text-gray-200 hover:bg-gray-800 transition-colors"
                  >
                    Log out
                  </button>
                </>
              ) : null}
            </div>
          </div>

          {/* TOP NAVIGATION */}
          <nav className="mt-4">
            <div className="flex flex-wrap gap-2">
              {showDashboardTabs && (
                <>
                  <button
                    onClick={() => setActiveView('overview')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      activeView === 'overview'
                        ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-lg shadow-blue-500/25'
                        : 'bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white border border-gray-700'
                    }`}
                  >
                    Kingdom Analytics
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
                </>
              )}

              {showAdminTab && (
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

        {/* MAIN CONTENT AREA */}
        <main className="space-y-6">
          {/* View Switching Logic */}

          {activeView === 'overview' && (
            <PublicOrProtectedRoute
              isPublic={isPublicView}
              publicSlug={publicSlug}
              accessType="overview"
              isAdminOverride={isAdminOverrideView}
            >
              <OverviewDashboard
                isAdmin={!!isAdmin}
                backendUrl={BACKEND_URL}
                publicSlug={publicSlug}
                isAdminOverride={isAdminOverrideView}
              />
            </PublicOrProtectedRoute>
          )}

          {activeView === 'honor' && (
            <PublicOrProtectedRoute
              isPublic={isPublicView}
              publicSlug={publicSlug}
              accessType="honor"
              isAdminOverride={isAdminOverrideView}
            >
              <HonorDashboard
                isAdmin={!!isAdmin}
                backendUrl={BACKEND_URL}
                publicSlug={publicSlug}
                isAdminOverride={isAdminOverrideView}
              />
            </PublicOrProtectedRoute>
          )}

          {activeView === 'analytics' && (
            <PublicOrProtectedRoute
              isPublic={isPublicView}
              publicSlug={publicSlug}
              accessType="analytics"
              isAdminOverride={isAdminOverrideView}
            >
              <PowerAnalyticsDashboard
                isAdmin={!!isAdmin}
                backendUrl={BACKEND_URL}
                publicSlug={publicSlug}
                isAdminOverride={isAdminOverrideView}
              />
            </PublicOrProtectedRoute>
          )}

          {/* Admin Panel: Nur sichtbar für Admin/R5, wenn angemeldet */}
          {activeView === 'admin' && user && (isSuperAdmin || isR5) && (
            <ProtectedRoute>
              <AdminUserManagement />
            </ProtectedRoute>
          )}

          {/* Global Chart: Nur wenn eingeloggt, approved und nicht im Admin/Public Modus */}
          {user && user.isApproved && activeView !== 'admin' && (!isPublicView || isAdminOverrideView) && (
            <div className="mt-4">
              <PowerHistoryChart />
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

// Helper Component for Public/Private Routing
interface PublicOrProtectedRouteProps {
  children: React.ReactNode;
  isPublic: boolean;
  publicSlug: string | null;
  accessType: 'overview' | 'honor' | 'analytics';
  isAdminOverride: boolean;
}

const PublicOrProtectedRoute: React.FC<PublicOrProtectedRouteProps> = ({
  children,
  isPublic,
  publicSlug,
  accessType,
  isAdminOverride,
}) => {
  // Wenn es öffentlich ist oder ein Admin Override vorliegt -> Direkt anzeigen
  if (isPublic || isAdminOverride) {
    if (!publicSlug && isPublic) {
      return (
        <div className="text-center p-8 text-red-400 bg-gray-800 rounded-xl">
          Invalid Public Link.
        </div>
      );
    }
    return <>{children}</>;
  }

  // Sonst normale Authentifizierung über ProtectedRoute
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