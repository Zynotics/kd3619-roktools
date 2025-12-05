import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, NavLink, useLocation, useNavigate, Link } from 'react-router-dom';
import { AuthProvider, useAuth } from './components/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import LoginPrompt from './components/LoginPrompt';
import ApprovalPending from './components/ApprovalPending';
import OverviewDashboard from './components/OverviewDashboard';
import HonorDashboard from './components/HonorDashboard';
import PowerAnalyticsDashboard from './components/PowerAnalyticsDashboard';
import AdminUserManagement from './components/AdminUserManagement';
import FileUpload from './components/FileUpload';

const BACKEND_URL =
  process.env.NODE_ENV === 'production'
    ? 'https://api.rise-of-stats.com'
    : 'http://localhost:4000';

// ----------------------------------------------------------------------
// HELPER: Navigation Link, der den ?slug Parameter behält
// ----------------------------------------------------------------------
const NavLinkWithSlug: React.FC<{ to: string; children: React.ReactNode; className?: string }> = ({ to, children }) => {
  const location = useLocation();
  const search = location.search; // z.B. "?slug=3619-vikings"

  return (
    <NavLink 
      to={to + search} 
      className={({ isActive }) => 
        `flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
          isActive 
            ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-lg shadow-blue-500/25 border border-transparent' 
            : 'bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white border border-gray-700'
        }`
      }
    >
      {children}
    </NavLink>
  );
};

// ----------------------------------------------------------------------
// WRAPPER: Public or Protected Route
// Erlaubt Zugriff, wenn ein Slug da ist (Public Mode) ODER wenn User eingeloggt (Protected Mode)
// ----------------------------------------------------------------------
const PublicOrProtected: React.FC<{ children: React.ReactNode; requiredAccess?: string }> = ({ children, requiredAccess }) => {
    const { user } = useAuth();
    const location = useLocation();
    const slug = new URLSearchParams(location.search).get('slug');

    // 1. Public Mode: Wenn Slug da ist, immer anzeigen (Read-Only)
    if (slug) {
        return <>{children}</>;
    }

    // 2. User Mode: Wenn eingeloggt, prüfen ob Rechte da sind
    if (user) {
        return <ProtectedRoute requiredAccess={requiredAccess}>{children}</ProtectedRoute>;
    }

    // 3. Fallback: Login (mit Erhalt der Params, falls welche da wären)
    return <Navigate to={`/login${location.search}`} replace />;
};


// ----------------------------------------------------------------------
// LAYOUT COMPONENT (Header, Navigation, Title Logic, Redirects)
// ----------------------------------------------------------------------
const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, logout, isLoading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [headerTitle, setHeaderTitle] = useState<string>('Rise of Stats');

  const searchParams = new URLSearchParams(location.search);
  const publicSlug = searchParams.get('slug');

  const isSuperAdmin = user?.role === 'admin';
  const isR5 = user?.role === 'r5';
  const isR4 = user?.role === 'r4';
  const isAdminOrR5 = isSuperAdmin || isR5;

  // --- EFFECT 1: R5 REDIRECT ---
  // Wenn ein R5 eingeloggt ist, aber kein Slug in der URL steht, leite zu seinem Kingdom um.
  useEffect(() => {
    const handleR5Redirect = async () => {
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
                        // Aktuellen Pfad behalten, aber Slug anhängen
                        navigate(`${location.pathname}?slug=${mySlug}`, { replace: true });
                    }
                }
            }
        } catch (e) { console.error('R5 Redirect failed', e); }
      }
    };

    if (!isLoading) {
        handleR5Redirect();
    }
  }, [user, isLoading, publicSlug, isSuperAdmin, navigate, location.pathname]);


  // --- EFFECT 2: DYNAMISCHER HEADER TITEL ---
  useEffect(() => {
    const fetchTitle = async () => {
      // Fall A: Slug vorhanden (Public oder eingeloggt mit Slug)
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
            setHeaderTitle(`Kingdom - ${publicSlug}`);
          }
        } catch (e) { setHeaderTitle(`Kingdom - ${publicSlug}`); }
      } 
      // Fall B: Superadmin ohne Slug
      else if (isSuperAdmin) {
        setHeaderTitle('Superadmin Dashboard');
      } 
      // Fallback
      else {
        setHeaderTitle('Rise of Stats');
      }
    };
    fetchTitle();
  }, [publicSlug, isSuperAdmin]);


  // Bestimmen, welche Tabs angezeigt werden
  // Dashboard Tabs zeigen wir immer an, außer wir sind Superadmin OHNE Slug (dann sind wir im reinen Admin-Mode)
  const showDashboardTabs = publicSlug || (user && !isSuperAdmin) || (isSuperAdmin && publicSlug);
  
  // Admin Tabs zeigen wir, wenn entsprechende Rechte da sind
  const showAdminUsers = isSuperAdmin || isR5;
  const showUploads = isSuperAdmin || isR5 || isR4;


  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-900 to-black text-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        
        {/* HEADER AREA */}
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

            {/* User Info / Login Button */}
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
                   <Link 
                      to={`/login${location.search}`} 
                      className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-900/20"
                   >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                      </svg>
                      Login
                   </Link>
                )
              )}
            </div>
          </div>

          {/* NAVIGATION TABS */}
          <nav className="mt-4 overflow-x-auto">
            <div className="flex gap-2">
              {showDashboardTabs && (
                <>
                  <NavLinkWithSlug to="/">Kingdom Overview</NavLinkWithSlug>
                  <NavLinkWithSlug to="/honor">Honor Ranking</NavLinkWithSlug>
                  <NavLinkWithSlug to="/analytics">Player Analytics</NavLinkWithSlug>
                </>
              )}

              {showAdminUsers && (
                <NavLink 
                    to="/admin/users"
                    className={({ isActive }) => 
                      `flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${isActive 
                        ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg shadow-purple-500/25' 
                        : 'bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white border border-gray-700'}`
                    }
                >
                    Admin · Users
                </NavLink>
              )}

              {showUploads && (
                <NavLink 
                    to="/admin/uploads"
                    className={({ isActive }) => 
                      `flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${isActive 
                        ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg shadow-purple-500/25' 
                        : 'bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white border border-gray-700'}`
                    }
                >
                    Admin · Uploads
                </NavLink>
              )}
            </div>
          </nav>
        </header>

        {/* CONTENT */}
        <main className="space-y-6">
          {children}
        </main>

      </div>
    </div>
  );
};


// ----------------------------------------------------------------------
// APP ROUTES CONFIGURATION
// ----------------------------------------------------------------------
const AppRoutes: React.FC = () => {
  const { user } = useAuth();
  const location = useLocation();

  return (
    <Routes>
      {/* LOGIN PAGE */}
      <Route path="/login" element={
          user ? <Navigate to={`/${location.search}`} replace /> : (
             <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
                <LoginPrompt />
             </div>
          )
      } />

      {/* PENDING APPROVAL PAGE */}
      <Route path="/pending" element={
          user && !user.isApproved ? (
            <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
               <ApprovalPending />
            </div>
          ) : <Navigate to="/" replace />
      } />

      {/* --- PUBLIC / PROTECTED DASHBOARDS --- */}
      {/* Diese Routen sind sichtbar für:
          1. Jeden, der einen gültigen ?slug=... Parameter hat (Public View)
          2. Eingeloggte User (R4/R5/User), die ihrem Kingdom zugewiesen sind
      */}
      
      <Route path="/" element={
         <Layout>
             <PublicOrProtected requiredAccess="canAccessOverview">
                <OverviewDashboard />
             </PublicOrProtected>
         </Layout>
      } />
      
      <Route path="/honor" element={
         <Layout>
             <PublicOrProtected requiredAccess="canAccessHonor">
                <HonorDashboard />
             </PublicOrProtected>
         </Layout>
      } />

      <Route path="/analytics" element={
         <Layout>
             <PublicOrProtected requiredAccess="canAccessAnalytics">
                <PowerAnalyticsDashboard />
             </PublicOrProtected>
         </Layout>
      } />


      {/* --- ADMIN ROUTES (PROTECTED) --- */}
      <Route path="/admin/users" element={
         <ProtectedRoute>
             <Layout>
                <AdminUserManagement />
             </Layout>
         </ProtectedRoute>
      } />
      
      <Route path="/admin/uploads" element={
         <ProtectedRoute>
             <Layout>
                <FileUpload />
             </Layout>
         </ProtectedRoute>
      } />

      {/* FALLBACK */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <Router>
        <AppRoutes />
      </Router>
    </AuthProvider>
  );
};

export default App;