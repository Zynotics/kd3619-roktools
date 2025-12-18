import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './components/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import AdminUserManagement from './components/AdminUserManagement';
import OverviewDashboard from './components/OverviewDashboard';
import ActivityDashboard from './components/ActivityDashboard';
import PowerAnalyticsDashboard from './components/PowerAnalyticsDashboard';
import LoginPrompt from './components/LoginPrompt';
import KvkManager from './components/KvkManager';     
import PublicKvKView from './components/PublicKvKView'; 
import SuperadminKingdomOverview from './components/SuperadminKingdomOverview';
const BACKEND_URL =
  process.env.NODE_ENV === 'production'
    ? 'https://api.rise-of-stats.com'
    : 'http://localhost:4000';
// ðŸ†• 'kvk-manager' als eigener View-Typ hinzugefÃ¼gt
type ActiveView = 'overview' | 'kvk' | 'kvk-manager' | 'analytics' | 'admin' | 'activity' | 'kingdoms-overview';
// Sidebar Navigation Item
const NavItem: React.FC<{
  view: ActiveView;
  currentActiveView: ActiveView;
  setActiveView: (view: ActiveView) => void;
  label: string;
  icon: React.ReactNode;
  isDisabled?: boolean;
}> = ({ view, currentActiveView, setActiveView, label, icon, isDisabled = false }) => {
  const isActive = view === currentActiveView;
  const baseClasses = 'flex items-center w-full px-4 py-3 text-sm font-medium transition-colors duration-200 rounded-lg group';
  const activeClasses = 'bg-blue-600 text-white shadow-lg shadow-blue-900/50';
  const inactiveClasses = 'text-gray-400 hover:bg-gray-800 hover:text-white';
  if (isDisabled) {
    return (
      <div className={`${baseClasses} opacity-50 cursor-not-allowed`} title="Access Denied">
        <span className="mr-3">{icon}</span>
        <span>{label}</span>
      </div>
    );
  }
  return (
    <button
      onClick={() => setActiveView(view)}
      className={`${baseClasses} ${isActive ? activeClasses : inactiveClasses}`}
    >
      <span className={`${isActive ? 'text-white' : 'text-gray-400 group-hover:text-white'} mr-3`}>
        {icon}
      </span>
      <span>{label}</span>
    </button>
  );
};
const AppContent: React.FC = () => {
  const { user, logout, isLoading } = useAuth();
  const [activeView, setActiveView] = useState<ActiveView>('overview');
  const [headerTitle, setHeaderTitle] = useState<string>('Rise of Stats');
  const [slugKingdomId, setSlugKingdomId] = useState<string | null>(null);
  const queryParams = new URLSearchParams(window.location.search);
  const publicSlug = queryParams.get('slug');
  const forceLogin = queryParams.get('login') === 'true';
  const isRegisterInvite = queryParams.get('register') === 'true';
  const isSuperAdmin = user?.role === 'admin';
  const isR5 = user?.role === 'r5';
  const isR4 = user?.role === 'r4';
  const isR4OrR5 = isR5 || isR4;
  const isAdmin = isSuperAdmin || isR5;
  const hasKingdomSlug = !!publicSlug;
  // ðŸ†• Helper fÃ¼r KvK Manager Zugriff (freischaltbar Ã¼ber Rechte)
  const isSameKingdomAsSlug = user?.kingdomId && slugKingdomId ? user.kingdomId === slugKingdomId : false;
  const shouldForcePublicForForeignKingdom =
    !!publicSlug &&
    isR4OrR5 &&
    !isSuperAdmin &&
    slugKingdomId !== null &&
    !isSameKingdomAsSlug;

  const canManageKvk =
    !shouldForcePublicForForeignKingdom &&
    ((isSuperAdmin && hasKingdomSlug) || (!isSuperAdmin && (isR5 || isR4 || !!user?.canAccessKvkManager)));
  const canViewActivity =
    user && (isSuperAdmin || (!shouldForcePublicForForeignKingdom && (isR5 || isR4)));
  // User-Rolle soll dieselbe Ansicht wie der Public-Link sehen kÃ¶nnen
  const isUserPublicView = !!publicSlug && user?.role === 'user';
  const isPublicView = !!publicSlug && !user && !isRegisterInvite;
  const isRegistrationInviteView = !!publicSlug && !user && isRegisterInvite;
  const isAdminOverrideView = isSuperAdmin && !!publicSlug;
  const effectivePublicView = isPublicView || isUserPublicView || shouldForcePublicForForeignKingdom;
  const isSuperAdminWithoutSlug = isSuperAdmin && !publicSlug;
  const hideStandardNavigation = isSuperAdminWithoutSlug;
  const hasAdminAccess = isAdmin && !shouldForcePublicForForeignKingdom;
  const showAdminNavigation = hasAdminAccess || canManageKvk;
  const showSuperadminKingdomOverview = isSuperAdminWithoutSlug;
  const showDashboardInterface =
    (user || isAdminOverrideView || effectivePublicView) && !(forceLogin && !user);

  const redirectToLogin = () => {
    const newUrl = new URL(window.location.href);
    newUrl.searchParams.set('login', 'true');
    window.location.href = newUrl.toString();
  };
  // 1. VIEW ROUTING & RESET
  useEffect(() => {
    if (
      publicSlug &&
      ((!user || user.role === 'user') || shouldForcePublicForForeignKingdom) &&
      !isRegisterInvite
    ) {
        // Reset gesch?tzte Views wenn Public
        if (['admin', 'activity', 'kvk-manager', 'kingdoms-overview'].includes(activeView)) setActiveView('overview');
        return;
    } 
    if (isRegistrationInviteView) {
        if (activeView !== 'overview') {
            setActiveView('overview');
        }
        return;
    }
    if (isSuperAdminWithoutSlug) {
        if (activeView !== 'kingdoms-overview' && activeView !== 'admin') {
            setActiveView('kingdoms-overview');
        }
        if (activeView === 'kvk-manager') {
            setActiveView('kingdoms-overview');
        }
    }
    if (!isSuperAdminWithoutSlug && activeView === 'kingdoms-overview') {
        setActiveView('overview');
    }
  }, [
    publicSlug,
    isSuperAdminWithoutSlug,
    activeView,
    user,
    isRegisterInvite,
    isRegistrationInviteView,
    shouldForcePublicForForeignKingdom,
  ]);
  // 2. R5/R4 REDIRECT
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
  // 3. DYNAMISCHER HEADER TITEL
  useEffect(() => {
    const fetchTitle = async () => {
      if (publicSlug) {
        try {
          const res = await fetch(`${BACKEND_URL}/api/public/kingdom/${publicSlug}`);
          if (res.ok) {
            const data = await res.json();
            const displayNameCandidate = data.displayName || data.display_name;
            const displayName =
              displayNameCandidate && displayNameCandidate.trim() ? displayNameCandidate : publicSlug.toUpperCase();
            setSlugKingdomId(data.id || null);
            setHeaderTitle(displayName);
          } else {
            setHeaderTitle(`Kingdom ${publicSlug}`);
            setSlugKingdomId(null);
          }
        } catch (e) { setHeaderTitle(`Kingdom ${publicSlug}`); setSlugKingdomId(null); }
        return;
      }
      setSlugKingdomId(null);
      if (user && user.kingdomId) {
        setHeaderTitle('Kingdom Analytics');
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
  if (!showDashboardInterface && !isLoading) {
    return (
      <div className="min-h-screen bg-gray-900 text-gray-100 flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-md">
          <LoginPrompt />
          <div className="mt-8 text-center text-gray-500 text-sm">
            <p>
              {isRegistrationInviteView 
                ? 'Please login or register to access this kingdom.' 
                : 'Access requires a valid link or login.'}
            </p> 
            {isRegistrationInviteView && (
                <button
                    onClick={() => {
                        const newUrl = new URL(window.location.href);
                        newUrl.searchParams.delete('register');
                        window.location.href = newUrl.toString();
                    }}
                    className="text-blue-400 hover:text-blue-300 mt-2 underline"
                >
                    View Public Dashboard
                </button>
            )}
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-gray-900 text-white">
      
      {/* ================= SIDEBAR (Desktop Only) ================= */}
      <aside className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col bg-gray-900 border-r border-gray-800 z-50">
        
        <div className="flex h-16 items-center px-6 border-b border-gray-800 bg-gray-900">
           <div className="h-8 w-8 rounded-lg bg-blue-600 flex items-center justify-center shadow-lg mr-3">
             <span className="font-bold text-white text-sm">KD</span>
           </div>
           <span className="text-lg font-bold text-white tracking-wide truncate" title={headerTitle}>
             {headerTitle.length > 15 ? headerTitle.substring(0,15)+'...' : headerTitle}
           </span>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-6 space-y-2">
            {!hideStandardNavigation && (
              <>
                <NavItem
                  view="overview"
                  currentActiveView={activeView}
                  setActiveView={setActiveView}
                  label="Analytics"
                  icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" /></svg>}
                />
                {/* Activity */}
                {canViewActivity && (
                  <NavItem
                    view="activity"
                    currentActiveView={activeView}
                    setActiveView={setActiveView}
                    label="Activity"
                    icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>}
                  />
                )}
                {/* KvK Ansicht */}
                <NavItem
                  view="kvk"
                  currentActiveView={activeView}
                  setActiveView={setActiveView}
                  label="KvK"
                  icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>}
                />
                <NavItem
                  view="analytics"
                  currentActiveView={activeView}
                  setActiveView={setActiveView}
                  label="Players"
                  icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>}
                />
              </>
            )}
            {/* ========== ADMINISTRATION BEREICH ========== */}
            {showAdminNavigation && (
              <div className="pt-4 mt-4 border-t border-gray-800">
                <p className="px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                  Administration
                </p>
                {showSuperadminKingdomOverview && (
                  <NavItem
                    view="kingdoms-overview"
                    currentActiveView={activeView}
                    setActiveView={setActiveView}
                    label="Königreiche"
                    icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 11c1.326 0 2.402-1.105 2.402-2.468S13.326 6.064 12 6.064s-2.402 1.105-2.402 2.468S10.674 11 12 11z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.732 19.5a6.27 6.27 0 0112.536 0M4.5 7.5h15M4.5 12h15" /></svg>}
                  />
                )}
                {canManageKvk && (
                  <NavItem
                    view="kvk-manager"
                    currentActiveView={activeView}
                    setActiveView={setActiveView}
                    label="KvK Manager"
                    icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" /></svg>}
                  />
                )}
                {isAdmin && (
                  <NavItem
                    view="admin"
                    currentActiveView={activeView}
                    setActiveView={setActiveView}
                    label="User Management"
                    icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37.525.32 1.157.495 1.724.319v0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>}
                  />
                )}
              </div>
            )}
        </div>
        {/* Sidebar Footer (User Info) */}
        <div className="p-4 border-t border-gray-800 bg-gray-900/50">
            {user ? (
                <div className="flex flex-col space-y-3">
                    <div className="flex items-center">
                        <div className="ml-0">
                            <p className="text-sm font-medium text-white">{user.username}</p>
                            <p className="text-xs text-gray-500 capitalize">{user.role}</p>
                        </div>
                    </div>
                    <button
                        onClick={logout}
                        className="w-full flex items-center justify-center px-4 py-2 border border-gray-700 rounded-md shadow-sm text-xs font-medium text-gray-300 bg-gray-800 hover:bg-gray-700 focus:outline-none"
                    >
                        Log out
                    </button>
                </div>
            ) : (
                <div className="text-center space-y-2">
                  <div className="text-xs text-gray-500">Not logged in</div>
                  {publicSlug && (
                    <button
                      onClick={redirectToLogin}
                      className="w-full flex items-center justify-center px-4 py-2 border border-gray-700 rounded-md shadow-sm text-xs font-medium text-gray-300 bg-gray-800 hover:bg-gray-700 focus:outline-none"
                    >
                      Login to access
                    </button>
                  )}
                </div>
            )}
        </div>
      </aside>
      {/* ================= MAIN CONTENT WRAPPER ================= */}
      <div className="lg:pl-64 flex flex-col min-h-screen">
        
        {/* Mobile Header (Nur sichtbar bis lg) */}
        <header className="lg:hidden sticky top-0 z-40 flex h-16 items-center gap-x-4 border-b border-gray-800 bg-gray-900 px-4 shadow-sm">
             <div className="h-8 w-8 rounded-lg bg-blue-600 flex items-center justify-center">
                 <span className="font-bold text-white text-xs">KD</span>
             </div>
             <div className="flex-1 text-sm font-bold text-white truncate">{headerTitle}</div>
             
             {user && (
                <button onClick={logout} className="text-gray-400 hover:text-white">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" /></svg>
                </button>
             )}
             {!user && publicSlug && (
                <button onClick={redirectToLogin} className="text-gray-400 hover:text-white">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14M7 16v1a3 3 0 003 3h5a3 3 0 003-3V7a3 3 0 00-3-3h-5a3 3 0 00-3 3v1" /></svg>
                </button>
             )}
        </header>
        {/* Content Area */}
        <main className="flex-1 py-8 px-4 sm:px-6 lg:px-8 bg-black/20">
            <div className="max-w-7xl mx-auto">
                {activeView === 'kingdoms-overview' && showSuperadminKingdomOverview && (
                    <ProtectedRoute accessType='admin'>
                      <SuperadminKingdomOverview />
                    </ProtectedRoute>
                )}

                {activeView === 'overview' && (
                    <PublicOrProtectedRoute
                    isPublic={effectivePublicView}
                    publicSlug={publicSlug}
                    accessType="overview"
                    isAdminOverride={isAdminOverrideView}
                    >
                    <OverviewDashboard
                        isAdmin={!!hasAdminAccess}
                        backendUrl={BACKEND_URL}
                        publicSlug={publicSlug}
                        isAdminOverride={isAdminOverrideView}
                    />
                    </PublicOrProtectedRoute>
                )}
                {activeView === 'activity' && canViewActivity && (
                    <PublicOrProtectedRoute
                    isPublic={effectivePublicView}
                    publicSlug={publicSlug}
                    accessType="activity"
                    isAdminOverride={isAdminOverrideView}
                    >
                <ActivityDashboard
                        isAdmin={!!hasAdminAccess}
                        backendUrl={BACKEND_URL}
                        publicSlug={publicSlug}
                        isAdminOverride={isAdminOverrideView}
                    />
                    </PublicOrProtectedRoute>
                )}
                {/* ðŸ†• KVK PUBLIC VIEW: FÃ¼r alle sichtbar */}
                {activeView === 'kvk' && (
                    <PublicOrProtectedRoute
                    isPublic={effectivePublicView}
                    publicSlug={publicSlug}
                    accessType="honor" // Fallback access, falls user eingeloggt ist aber keine expliziten rechte hat
                    isAdminOverride={isAdminOverrideView}
                    >
                      <PublicKvKView kingdomSlug={publicSlug || ''} />
                    </PublicOrProtectedRoute>
                )}
                {/* ðŸ†• KVK MANAGER VIEW: Nur fÃ¼r Admins/R4/R5 */}
                {activeView === 'kvk-manager' && canManageKvk && (
                   <PublicOrProtectedRoute
                   isPublic={false} // Immer privat
                   publicSlug={null}
                   accessType="honor" // Wir nutzen 'honor' oder 'overview' als Basis-Recht, aber der Button ist eh versteckt
                   isAdminOverride={false}
                   >
                     <KvkManager />
                   </PublicOrProtectedRoute>
                )}
                {activeView === 'analytics' && (
                    <PublicOrProtectedRoute
                    isPublic={effectivePublicView}
                    publicSlug={publicSlug}
                    accessType="analytics"
                    isAdminOverride={isAdminOverrideView}
                    >
                <PowerAnalyticsDashboard
                        isAdmin={!!hasAdminAccess}
                        backendUrl={BACKEND_URL}
                        publicSlug={publicSlug}
                        isAdminOverride={isAdminOverrideView}
                    />
                </PublicOrProtectedRoute>
            )}
                {activeView === 'admin' && user && hasAdminAccess && (
                    <ProtectedRoute accessType='admin'>
                    <AdminUserManagement />
                    </ProtectedRoute>
                )}
            </div>
        </main>
      </div>
    </div>
  );
};
interface PublicOrProtectedRouteProps {
  children: React.ReactNode;
  isPublic: boolean;
  publicSlug: string | null;
  accessType: 'overview' | 'honor' | 'analytics' | 'activity' | 'admin';
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
        <div className="text-center p-8 text-red-400 bg-gray-800 rounded-xl mt-10">
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
