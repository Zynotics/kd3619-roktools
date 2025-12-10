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

const BACKEND_URL =
  process.env.NODE_ENV === 'production'
    ? 'https://api.rise-of-stats.com'
    : 'http://localhost:4000';

// 🆕 'kvk-manager' als eigener View-Typ hinzugefügt
type ActiveView = 'overview' | 'kvk' | 'kvk-manager' | 'analytics' | 'admin' | 'activity';

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

  const queryParams = new URLSearchParams(window.location.search);
  const publicSlug = queryParams.get('slug');
  const isRegisterInvite = queryParams.get('register') === 'true';

  const isSuperAdmin = user?.role === 'admin';
  const isR5 = user?.role === 'r5';
  const isR4 = user?.role === 'r4';
  const isAdmin = isSuperAdmin || isR5; 
  // 🆕 Helper für KvK Manager Zugriff (freischaltbar über Rechte)
  const canManageKvk = isSuperAdmin || isR5 || isR4 || !!user?.canAccessKvkManager;

  const canViewActivity = user && (isSuperAdmin || isR5 || isR4);

  const isPublicView = !!publicSlug && !user && !isRegisterInvite;
  const isRegistrationInviteView = !!publicSlug && !user && isRegisterInvite;
  const isAdminOverrideView = isSuperAdmin && !!publicSlug; 
  
  const showDashboardInterface = user || isAdminOverrideView || isPublicView;

  // 1. VIEW ROUTING & RESET
  useEffect(() => {
    if (publicSlug && !user && !isRegisterInvite) {
        // Reset geschützte Views wenn Public
        if (['admin', 'activity', 'kvk-manager'].includes(activeView)) setActiveView('overview');
    } 
    else if (isSuperAdmin && !publicSlug && activeView !== 'admin' && activeView !== 'kvk-manager') {
        // Superadmin ohne Slug landet nicht zwingend auf Admin, aber kann
        if (activeView === 'overview') setActiveView('admin');
    }
    else if (isRegistrationInviteView) {
        setActiveView('overview');
    }
  }, [publicSlug, isSuperAdmin, activeView, user, isRegisterInvite, isRegistrationInviteView]);


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
            const displayName = data.displayName && data.displayName.trim() ? data.displayName : publicSlug.toUpperCase();
            setHeaderTitle(displayName);
          } else {
            setHeaderTitle(`Kingdom ${publicSlug}`);
          }
        } catch (e) { setHeaderTitle(`Kingdom ${publicSlug}`); }
        return;
      }
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
            <NavItem
              view="overview"
              currentActiveView={activeView}
              setActiveView={setActiveView}
              label="Analytics"
              icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" /></svg>}
            />
            
            {/* 🔒 Activity */}
            {canViewActivity && (
              <NavItem
                view="activity"
                currentActiveView={activeView}
                setActiveView={setActiveView}
                label="Activity"
                icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>}
              />
            )}
            
            {/* 🆕 KVK Ansicht (Für ALLE) */}
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

            {/* ========== ADMINISTRATION BEREICH ========== */}
            {canManageKvk && (
              <div className="pt-4 mt-4 border-t border-gray-800">
                <p className="px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                  Administration
                </p>
                
                {/* 🆕 KvK Manager (Nur R4/R5/Admin) */}
                <NavItem
                  view="kvk-manager"
                  currentActiveView={activeView}
                  setActiveView={setActiveView}
                  label="KvK Manager"
                  icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" /></svg>}
                />

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
                 <div className='text-xs text-gray-500 text-center'>Not logged in</div>
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
        </header>

        {/* Content Area */}
        <main className="flex-1 py-8 px-4 sm:px-6 lg:px-8 bg-black/20">
            <div className="max-w-7xl mx-auto">
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

                {activeView === 'activity' && canViewActivity && (
                    <PublicOrProtectedRoute
                    isPublic={isPublicView}
                    publicSlug={publicSlug}
                    accessType="activity"
                    isAdminOverride={isAdminOverrideView}
                    >
                    <ActivityDashboard
                        isAdmin={!!isAdmin}
                        backendUrl={BACKEND_URL}
                    />
                    </PublicOrProtectedRoute>
                )}

                {/* 🆕 KVK PUBLIC VIEW: Für alle sichtbar */}
                {activeView === 'kvk' && (
                    <PublicOrProtectedRoute
                    isPublic={isPublicView}
                    publicSlug={publicSlug}
                    accessType="honor" // Fallback access, falls user eingeloggt ist aber keine expliziten rechte hat
                    isAdminOverride={isAdminOverrideView}
                    >
                      <PublicKvKView kingdomSlug={publicSlug || ''} />
                    </PublicOrProtectedRoute>
                )}

                {/* 🆕 KVK MANAGER VIEW: Nur für Admins/R4/R5 */}
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

                {activeView === 'admin' && user && isAdmin && (
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
