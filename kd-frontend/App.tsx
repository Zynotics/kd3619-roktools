import React, { useState, useEffect, useCallback } from 'react';
import { AuthProvider, useAuth } from './components/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import AdminUserManagement from './components/AdminUserManagement';
import OverviewDashboard from './components/OverviewDashboard';
import HonorDashboard from './components/HonorDashboard';
import PowerAnalyticsDashboard from './components/PowerAnalyticsDashboard';
import LoginPrompt from './components/LoginPrompt';

const BACKEND_URL =
  process.env.NODE_ENV === 'production'
    ? 'https://api.rise-of-stats.com'
    : 'http://localhost:4000';

type ActiveView = 'overview' | 'honor' | 'analytics' | 'admin';

// 📝 NEU: Sidebar Navigation Item Component
const NavItem: React.FC<{
  view: ActiveView;
  currentActiveView: ActiveView;
  setActiveView: (view: ActiveView) => void;
  label: string;
  icon: React.ReactNode;
  isDisabled?: boolean;
}> = ({ view, currentActiveView, setActiveView, label, icon, isDisabled = false }) => {
  const isActive = view === currentActiveView;
  const baseClasses = 'flex items-center w-full px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap';
  const activeClasses = 'bg-gradient-to-r from-blue-600 to-cyan-500 text-white shadow-lg shadow-blue-500/25';
  const inactiveClasses = 'text-gray-300 hover:bg-gray-800 hover:text-white lg:border lg:border-gray-700';

  if (isDisabled) {
    return (
      <div className={`${baseClasses} opacity-50 cursor-not-allowed`} title="Access Denied">
        {icon}
        <span>{label}</span>
      </div>
    );
  }

  return (
    <button
      onClick={() => setActiveView(view)}
      className={`${baseClasses} ${isActive ? activeClasses : inactiveClasses}`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
};


const AppContent: React.FC = () => {
  const { user, logout, isLoading } = useAuth();
  const [activeView, setActiveView] = useState<ActiveView>('overview');
  const [headerTitle, setHeaderTitle] = useState<string>('Rise of Stats');
  
  // 📝 Temporäre State für Gov ID
  const [editingGovId, setEditingGovId] = useState<string | null>(null);
  const [currentGovIdValue, setCurrentGovIdValue] = useState<string>('');
  const [govIdValidationMessage, setGovIdValidationMessage] = useState<string | null>(null);
  const [govIdValidationStatus, setGovIdValidationStatus] = useState<'idle' | 'checking' | 'valid' | 'invalid'>('idle');


  const queryParams = new URLSearchParams(window.location.search);
  const publicSlug = queryParams.get('slug');
  const isRegisterInvite = queryParams.get('register') === 'true';

  const isSuperAdmin = user?.role === 'admin';
  const isR5 = user?.role === 'r5';
  const isAdmin = isSuperAdmin || isR5; 

  const isPublicView = !!publicSlug && !user && !isRegisterInvite;
  const isRegistrationInviteView = !!publicSlug && !user && isRegisterInvite;
  const isAdminOverrideView = isSuperAdmin && !!publicSlug; 

  // -------- Gov ID Handlers (Placeholder da Logik im Backend nicht implementiert ist) --------
  const handleEditGovIdStart = (userId: string, currentGovId: string | null | undefined) => {
      // Logic removed as requested
      alert(`Editing Gov ID for user ${userId}. Gov ID: ${currentGovId}`);
  }
  
  const validateAndSaveGovId = async (userId: string) => {
      // Logic removed as requested
      alert(`Saving new Gov ID ${currentGovIdValue} for user ${userId}. (Disabled)`);
  }
  // ---------------------------------------------------------------------------------


  // 1. VIEW ROUTING
  useEffect(() => {
    if (publicSlug && !user && !isRegisterInvite) {
        if (activeView === 'admin') setActiveView('overview');
    } 
    else if (isSuperAdmin && !publicSlug && activeView !== 'admin') {
        setActiveView('admin');
    }
    else if (isRegistrationInviteView) {
        setActiveView('overview');
    }
  }, [publicSlug, isSuperAdmin, activeView, user, isRegisterInvite, isRegistrationInviteView]);


  // 2. R5/R4 REDIRECT (Redirect von Root-URL zu Kingdom-URL, wenn Kingdom zugewiesen)
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


  // 3. DYNAMISCHER HEADER TITEL
  useEffect(() => {
    const fetchTitle = async () => {
      if (publicSlug) {
        try {
          const res = await fetch(`${BACKEND_URL}/api/public/kingdom/${publicSlug}`);
          if (res.ok) {
            const data = await res.json();
            const displayName = data.displayName && data.displayName.trim() ? data.displayName : publicSlug.toUpperCase();
            
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

      if (isSuperAdmin) {
        setHeaderTitle('Superadmin Dashboard');
        return;
      }

      setHeaderTitle('Rise of Stats');
    };

    fetchTitle();
  }, [publicSlug, user, isSuperAdmin]);


  // LANDING PAGE / LOGIN
  if (!user && !publicSlug && !isLoading || isRegistrationInviteView) {
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
            {isRegistrationInviteView && (
                <button
                    onClick={() => {
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
  
  const showDashboardTabs = user || isAdminOverrideView;
  
  // Haupt-Layout-Struktur
  return (
    // 📝 KORREKTUR: Main Grid Container
    <div className={`min-h-screen bg-gradient-to-br from-gray-900 via-gray-900 to-black text-gray-100 ${showDashboardTabs ? 'main-grid lg:main-grid-desktop' : ''}`}>
      
      {/* 📝 KORREKTUR: Sidebar Container. Hält lg:h-screen und lg:sticky um fixe linke Spalte im Grid zu sein. */}
      {showDashboardTabs && (
        <aside className="lg:sticky lg:top-0 lg:h-screen w-full lg:w-64 bg-gray-900/50 border-b lg:border-r border-gray-800 p-4 shadow-xl z-10 flex flex-col lg:flex-shrink-0">
          <div className="flex justify-between items-center h-full lg:flex-col lg:items-start lg:space-y-6">
            
            {/* Logo/Title (Desktop only - Mobile Logo/Title ist im Header unten) */}
            <div className="hidden lg:flex items-center gap-3 lg:w-full lg:mb-4">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center shadow-lg">
                <span className="font-bold text-lg text-white">KD</span>
              </div>
              <div className="hidden lg:block">
                  <h1 className="text-xl font-bold tracking-tight text-white">
                      {headerTitle}
                  </h1>
                   <p className="text-xs text-gray-400">
                      {isAdminOverrideView ? 'Admin Viewing Mode' : 'Analytics Platform'}
                   </p>
              </div>
            </div>

            {/* Navigation Links (Horizontal on small, Vertical on large) */}
            <nav className="flex flex-row lg:flex-col gap-2 lg:w-full overflow-x-auto pb-2">
                <NavItem
                  view="overview"
                  currentActiveView={activeView}
                  setActiveView={setActiveView}
                  label="Kingdom Analytics"
                  icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" /></svg>}
                />

                <NavItem
                  view="honor"
                  currentActiveView={activeView}
                  setActiveView={setActiveView}
                  label="Honor Ranking"
                  icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>}
                />

                <NavItem
                  view="analytics"
                  currentActiveView={activeView}
                  setActiveView={setActiveView}
                  label="Player Analytics"
                  icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
                />
                
                {isAdmin && (
                  <NavItem
                    view="admin"
                    currentActiveView={activeView}
                    setActiveView={setActiveView}
                    label="Admin · Users"
                    icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37.525.32 1.157.495 1.724.319v0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>}
                    isDisabled={user?.role === 'r4' && !isSuperAdmin}
                  />
                )}
            </nav>
            
            {/* User Info / Logout (Desktop Only) */}
            <div className="hidden lg:flex flex-col items-start w-full border-t border-gray-700 pt-4 mt-auto">
                {user ? (
                    <>
                        <div className="text-left">
                            <div className="text-sm font-semibold text-white">
                                {user.username}
                                {(user.role === 'admin' || user.role === 'r5' || user.role === 'r4') && (
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
                            className="mt-3 text-xs px-3 py-1.5 rounded-md border border-gray-600 text-gray-200 hover:bg-gray-800 transition-colors w-full text-center"
                        >
                            Log out
                        </button>
                    </>
                ) : (
                    <span className="text-xs text-gray-400">Not logged in</span>
                )}
            </div>

          </div>
        </aside>
      )}

      {/* MAIN CONTENT AREA */}
      <main className="lg:col-span-1 px-4 sm:px-6 lg:px-8 py-6 flex-grow overflow-y-auto"> 
        
        {/* HEADER (Mobile Only) */}
        <header className="mb-6 border-b border-gray-800 pb-4 lg:hidden">
          <div className="flex items-center justify-between gap-4">
            
            {/* Logo + Title (Mobile Only) */}
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

            {/* RECHTS OBEN: User Info ODER Login Button (Mobile Only) */}
            <div className="flex items-center gap-4 ml-auto">
              {isLoading && <span className="text-xs text-gray-400">Checking login…</span>}
              
              {user ? (
                /* Logout Button (Mobile Only, Info in Sidebar on Desktop) */
                <div className="flex items-center gap-4">
                    <div className="text-right">
                        <div className="text-sm font-semibold text-white">
                            {user.username}
                            {(user.role === 'admin' || user.role === 'r5' || user.role === 'r4') && (
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
                </div>
              ) : (
                /* Fall B: Nicht eingeloggt (Public View) -> Zeige Login Button */
                !isLoading && (
                    <button
                      onClick={() => (window.location.href = '/')}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-900/20"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" /></svg>
                      Login
                    </button>
                )
              )}
            </div>
          </div>
        </header>

        {/* MAIN DASHBOARD CONTENT */}
        <div className="space-y-6">
          
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
          {activeView === 'admin' && user && isAdmin && (
            <ProtectedRoute accessType='admin'>
              <AdminUserManagement />
            </ProtectedRoute>
          )}

        </div>
      </main>
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