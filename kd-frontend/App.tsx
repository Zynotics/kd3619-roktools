// App.tsx (RÜCKBAU)
import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './components/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import AdminUserManagement from './components/AdminUserManagement';
import OverviewDashboard from './components/OverviewDashboard';
import HonorDashboard from './components/HonorDashboard';
import PowerAnalyticsDashboard from './components/PowerAnalyticsDashboard';
import FileUpload from './components/FileUpload';
import LoginPrompt from './components/LoginPrompt';

const BACKEND_URL =
  process.env.NODE_ENV === 'production'
    ? 'https://api.rise-of-stats.com'
    : 'http://localhost:4000';

type ActiveView = 'overview' | 'honor' | 'analytics' | 'admin' | 'uploads';

// WICHTIG: Die Hauptlogik, die die Ansicht steuert, wird hier zentralisiert.
const AppContent: React.FC = () => {
  const { user, logout, isLoading } = useAuth();
  const [activeView, setActiveView] = useState<ActiveView>('overview');
  const [headerTitle, setHeaderTitle] = useState<string>('Rise of Stats');

  // 🌐 Lese Slug aus Query-Parametern (z.B. ?slug=kd3619)
  const queryParams = new URLSearchParams(window.location.search);
  const publicSlug = queryParams.get('slug');

  // Rollen
  const isSuperAdmin = user?.role === 'admin';
  const isR5 = user?.role === 'r5';
  const isR4 = user?.role === 'r4';
  const isAdminOrR5 = isSuperAdmin || isR5; 

  // View-Modi bestimmen
  const isPublicView = !!publicSlug && !user;
  const isAdminOverrideView = isSuperAdmin && !!publicSlug; 
  
  // 1. R5 REDIRECT (Logik für zustandsbasiertes Routing)
  useEffect(() => {
    const redirectToSlug = async () => {
        // Wenn User eingeloggt, Kingdom-ID hat und KEIN Slug in URL ist, und NICHT Superadmin
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
                            // Einfache Weiterleitung durch Neuladen der Seite mit Slug
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


  // 2. DYNAMISCHER HEADER TITEL
  useEffect(() => {
    const fetchTitle = async () => {
      if (publicSlug) {
        try {
          const res = await fetch(`${BACKEND_URL}/api/public/kingdom/${publicSlug}`);
          if (res.ok) {
            const data = await res.json();
            const displayName = data.displayName && data.displayName.trim() ? data.displayName : publicSlug.toUpperCase();
            setHeaderTitle(`${displayName} - ${publicSlug}`);
          } else {
            setHeaderTitle(`Kingdom - ${publicSlug}`);
          }
        } catch (e) { setHeaderTitle(`Kingdom - ${publicSlug}`); }
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
  if (!user && !publicSlug && !isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-900 to-black text-gray-100">
        <div className="max-w-lg mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <LoginPrompt />
          <div className="mt-8 text-center text-gray-500">
            <p>Or access a Kingdom directly using a public link.</p>
          </div>
        </div>
      </div>
    );
  }

  // APPROVAL PENDING
  if (user && !user.isApproved) {
     return (
        <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
           <ApprovalPending />
        </div>
     );
  }


  // Bedingte Zugriffsprüfung für Dashboard-Tabs
  const hasAccess = (view: ActiveView) => {
    if (isPublicView) return true; // Public view hat immer Zugriff, aber nur auf Overview/Honor/Analytics
    if (!user) return false;

    if (view === 'admin' || view === 'uploads') {
        return isAdminOrR5 || isR4;
    }
    
    // Für die Dashboard-Views die spezifischen Rechte prüfen
    if (view === 'overview') return user.canAccessOverview || isAdminOrR5;
    if (view === 'honor') return user.canAccessHonor || isAdminOrR5;
    if (view === 'analytics') return user.canAccessAnalytics || isAdminOrR5;

    return false;
  }
  
  const showDashboardTabs = publicSlug || (user && !isSuperAdmin) || isAdminOverrideView; 
  const showAdminUsers = isSuperAdmin || isR5; 
  const showUploads = isSuperAdmin || isR5 || isR4; 
  

  const renderContent = () => {
    if (!hasAccess(activeView) && user && activeView !== 'admin' && activeView !== 'uploads') {
        return <div className="p-8 text-center text-red-400">Access Denied.</div>;
    }

    switch (activeView) {
      case 'overview':
        return <OverviewDashboard backendUrl={BACKEND_URL} publicSlug={publicSlug} isAdminOverride={isAdminOverrideView} />;
      case 'honor':
        return <HonorDashboard backendUrl={BACKEND_URL} publicSlug={publicSlug} isAdminOverride={isAdminOverrideView} />;
      case 'analytics':
        return <PowerAnalyticsDashboard backendUrl={BACKEND_URL} publicSlug={publicSlug} isAdminOverride={isAdminOverrideView} />;
      case 'admin':
        if (isAdminOrR5) return <AdminUserManagement />;
        return <div className="p-8 text-center text-red-400">Access Denied.</div>;
      case 'uploads':
        if (showUploads) return <FileUpload />;
        return <div className="p-8 text-center text-red-400">Access Denied.</div>;
      default:
        return <OverviewDashboard backendUrl={BACKEND_URL} publicSlug={publicSlug} isAdminOverride={isAdminOverrideView} />;
    }
  };


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
                  {isSuperAdmin && publicSlug ? 'Admin Viewing Mode' : 'Analytics Platform'}
                </p>
              </div>
            </div>

            {/* User Info / Logout Button */}
            <div className="flex items-center gap-4">
              {isLoading && <span className="text-xs text-gray-400">Checking...</span>}
              
              {user ? (
                <>
                  <div className="text-right hidden sm:block">
                    <div className="text-sm font-semibold text-white">
                      {user.username}
                      <span className="ml-2 text-xs text-purple-400">({user.role.toUpperCase()})</span>
                    </div>
                    <div className="text-xs text-gray-400">
                      {user.isApproved ? 'Approved' : 'Pending'}
                    </div>
                  </div>
                  <button onClick={logout} className="text-xs px-3 py-1.5 rounded-md border border-gray-600 text-gray-200 hover:bg-gray-800 transition-colors">
                    Log out
                  </button>
                </>
              ) : (
                !isLoading && (
                   <a 
                      href={`/login${window.location.search}`} // Link zum Login mit Slug
                      className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-900/20"
                   >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                      </svg>
                      Login
                   </a>
                )
              )}
            </div>
          </div>

          {/* NAVIGATION TABS */}
          <nav className="mt-4 overflow-x-auto">
            <div className="flex gap-2">
              {showDashboardTabs && (
                <>
                  <button
                    onClick={() => setActiveView('overview')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                      activeView === 'overview'
                        ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-lg shadow-blue-500/25'
                        : 'bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white border border-gray-700'
                    }`}
                  >
                    Kingdom Overview
                  </button>

                  <button
                    onClick={() => setActiveView('honor')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                      activeView === 'honor'
                        ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg shadow-amber-500/25'
                        : 'bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white border border-gray-700'
                    }`}
                  >
                    Honor Ranking
                  </button>

                  <button
                    onClick={() => setActiveView('analytics')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                      activeView === 'analytics'
                        ? 'bg-gradient-to-r from-emerald-500 to-lime-500 text-white shadow-lg shadow-emerald-500/25'
                        : 'bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white border border-gray-700'
                    }`}
                  >
                    Player Analytics
                  </button>
                </>
              )}
              
              {showUploads && (
                  <button
                    onClick={() => setActiveView('uploads')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                      activeView === 'uploads'
                        ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg shadow-purple-500/25'
                        : 'bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white border border-gray-700'
                    }`}
                  >
                    Admin · Uploads
                  </button>
              )}

              {showAdminUsers && (
                <button
                  onClick={() => setActiveView('admin')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
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
          {renderContent()}
        </main>
      </div>
    </div>
  );
};


const App: React.FC = () => {
  return (
    <AuthProvider>
      <Router>
         <Routes>
            {/* Base Route fängt alle Requests ab, die nicht /login oder /pending sind */}
            <Route path="*" element={<AppContent />} />
            
            {/* Separate Routes für Login/Pending, da sie Full-Screen sein sollen */}
            <Route path="/login" element={
                <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
                  <LoginPrompt />
                </div>
            } />
            <Route path="/pending" element={
                 <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
                  <ApprovalPending />
                 </div>
            } />
        </Routes>
      </Router>
    </AuthProvider>
  );
};

export default App;