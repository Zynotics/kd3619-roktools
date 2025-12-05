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
  // 🆕 NEU: Parameter für Registrierungseinladung hinzufügen
  const isRegisterInvite = queryParams.get('register') === 'true';

  // Rollen
  const isSuperAdmin = user?.role === 'admin';
  const isR5 = user?.role === 'r5';
  const isAdmin = isSuperAdmin || isR5; 

  // View-Modi bestimmen
  // 🆕 NEU: isPublicView schließt jetzt den Registrierungseinladungs-Modus aus
  const isPublicView = !!publicSlug && !user && !isRegisterInvite;
  
  // 🆕 NEU: Zustand für den Registrierungseinladungs-Modus
  const isRegistrationInviteView = !!publicSlug && !user && isRegisterInvite;

  const isAdminOverrideView = isSuperAdmin && !!publicSlug; 

  // 1. VIEW ROUTING
  useEffect(() => {
    // Wenn ein Public Slug da ist, aber KEIN User eingeloggt ist und KEIN Register Invite:
    if (publicSlug && !user && !isRegisterInvite) {
        if (activeView === 'admin') setActiveView('overview');
    } 
    // Wenn Superadmin auf der Root-Seite ist (kein Slug):
    else if (isSuperAdmin && !publicSlug && activeView !== 'admin') {
        setActiveView('admin');
    }
    // 🆕 Wenn im Registrierungseinladungs-Modus, auf 'overview' setzen, 
    // aber das Rendern wird durch die LANDING PAGE Logik unten übersteuert
    else if (isRegistrationInviteView) {
        setActiveView('overview');
    }
  }, [publicSlug, isSuperAdmin, activeView, user, isRegisterInvite, isRegistrationInviteView]);


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
    
    if (!isLoading) {
        redirectToSlug();
    }
  }, [user, isLoading, publicSlug, isSuperAdmin]);


  // 3. DYNAMISCHER HEADER TITEL (Main Header)
  useEffect(() => {
    const fetchTitle = async () => {
      // Fall A: Slug vorhanden (Public oder eingeloggt)
      if (publicSlug) {
        try {
          const res = await fetch(`${BACKEND_URL}/api/public/kingdom/${publicSlug}`);
          if (res.ok) {
            const data = await res.json();
            // 👑 FIX: Sicherstellen, dass data.displayName ein valider, nicht leerer String ist.
            const displayName = data.displayName && data.displayName.trim() ? data.displayName : publicSlug.toUpperCase();
            
            // Vermeide doppelte Anzeige, falls Name und Slug gleich sind (z.B. "3 - 3")
            if (displayName.toUpperCase() === publicSlug.toUpperCase()) {
                 setHeaderTitle(displayName);
            } else {
                 setHeaderTitle(`${displayName} - ${publicSlug}`);
            }
          } else {
            setHeaderTitle(`Kingdom Analytics - ${publicSlug}`);
          }
        } catch (e) { setHeaderTitle(`Kingdom Analytics - ${publicSlug}`); }
        return;
      }

      // Fall B: Eingeloggter R5 (Root-Ansicht, die durch den Redirect nur kurz sichtbar ist)
      if (user && user.kingdomId) {
        try {
          const token = localStorage.getItem('authToken');
          const res = await fetch(`${BACKEND_URL}/api/admin/kingdoms`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (res.ok) {
            const data = await res.json();
            if (data && data.length > 0) {
                const slug = data[0].slug.trim();
                const displayName = data[0].displayName && data[0].displayName.trim() ? data[0].displayName : slug.toUpperCase();
                
                if (displayName.toUpperCase() === slug.toUpperCase()) {
                     setHeaderTitle(displayName);
                } else {
                     setHeaderTitle(`${displayName} - ${slug}`);
                }
            }
          }
        } catch (e) { setHeaderTitle('Kingdom Analytics'); }
        return;
      }

      // Fall C: Superadmin Root
      if (isSuperAdmin) {
        setHeaderTitle('Superadmin Dashboard');
        return;
      }

      setHeaderTitle('Rise of Stats');
    };

    fetchTitle();
  }, [publicSlug, user, isSuperAdmin]);


  // LANDING PAGE / LOGIN
  // 🆕 NEUE BEDINGUNG: Zeige LoginPrompt, wenn kein User ODER im Registrierungseinladungs-Modus
  if ((!user && !publicSlug && !isLoading) || isRegistrationInviteView) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-900 to-black text-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <LoginPrompt />
          <div className="mt-8 text-center text-gray-500">
            <p>
              {isRegistrationInviteView 
                ? 'Login with an existing account or register for the Kingdom above.' 
                : 'Or access a Kingdom directly using a public link.'}
            </p> 
            {/* 🆕 Button um zur öffentlichen Dashboard-Ansicht zu wechseln */}
            {isRegistrationInviteView && (
                <button
                    onClick={() => {
                        // Entfernt den register=true Parameter, um zur normalen Dashboard-Ansicht zu wechseln
                        const newUrl = new URL(window.location.href);
                        newUrl.searchParams.delete('register');
                        window.location.href = newUrl.toString();
                    }}
                    className="text-sm text-gray-400 hover:text-gray-200 mt-2 inline-block"
                >
                    Switch to Public Dashboard View
                </button>
            )}
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

            {/* RECHTS OBEN: User Info ODER Login Button */}
            <div className="flex items-center gap-4">
              {isLoading && <span className="text-xs text-gray-400">Checking login…</span>}
              
              {user ? (
                /* Fall A: Eingeloggt -> Zeige Username + Logout */
                <>
                  <div className="text-right hidden sm:block">
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
              ) : (
                /* Fall B: Nicht eingeloggt (Public View) -> Zeige Login Button */
                !isLoading && (
                    <button
                      onClick={() => (window.location.href = '/')}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-900/20"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                      </svg>
                      Login
                    </button>
                )
              )}
            </div>
          </div>

          {/* NAVIGATION */}
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

          {/* Admin Panel */}
          {activeView === 'admin' && user && (isAdmin) && (
            <ProtectedRoute>
              <AdminUserManagement />
            </ProtectedRoute>
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

const PublicOrProtectedRoute: React.FC<PublicOrProtectedRouteProps> = ({
  children,
  isPublic,
  publicSlug,
  accessType,
  isAdminOverride,
}) => {
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