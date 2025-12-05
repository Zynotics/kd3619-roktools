import React from 'react';
import { useAuth, UserRole } from './AuthContext';
// Importiere ApprovalPending, falls es eine separate Komponente ist
// import ApprovalPending from './ApprovalPending'; 

interface ProtectedRouteProps {
  children: React.ReactNode;
  accessType?: 'overview' | 'honor' | 'analytics' | 'admin';
}

// Eine einfache Komponente für den Fall, dass die Freigabe aussteht
const ApprovalPending: React.FC = () => (
    <div className="text-center p-8 text-yellow-400 bg-gray-800 rounded-xl">
        <p className="text-xl font-bold mb-2">Approval Pending</p>
        <p>Your account registration is awaiting approval by a Kingdom R5 or Admin. Please check back later.</p>
    </div>
);


const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, accessType }) => {
  const { user, isLoading } = useAuth();

  // 📝 Zeige nichts an, solange der Auth-Status geladen wird
  if (isLoading) return null; 

  if (!user) {
    // Sollte im normalen Fluss nicht erreicht werden, da App.tsx zu LoginPrompt weiterleitet
    return (
        <div className="text-center p-8 text-red-400 bg-gray-800 rounded-xl">
            Access Denied: Please log in.
        </div>
    );
  }

  // 1. Check for Approval
  if (!user.isApproved) {
    return <ApprovalPending />; 
  }

  // 2. Check for Dashboard Access based on Role/Feature Flags
  const role = user.role;
  
  // 📝 R4, R5 und Admin erhalten pauschal Dashboard-Zugriff (Upload/Löschen/Vollansicht)
  const hasGlobalDashboardAccess = role === 'admin' || role === 'r5' || role === 'r4'; 

  // --- Spezifische Prüfung für Admin Panel ---
  if (accessType === 'admin') {
    // 📝 WICHTIG: Nur Admin und R5 sind erlaubt. R4 wird blockiert.
    if (role !== 'admin' && role !== 'r5') { 
      return (
          <div className="text-center p-8 text-red-400 bg-gray-800 rounded-xl">
              Access Denied. Only R5 or Admin can access User Management.
          </div>
      );
    }
  }

  // --- Dashboard Zugriffsprüfung ---
  if (!hasGlobalDashboardAccess) {
      // Nur für normale 'user' Rollen wird anhand der expliziten Flags geprüft
      if (accessType === 'overview' && !user.canAccessOverview) {
        return (
            <div className="text-center p-8 text-red-400 bg-gray-800 rounded-xl">
                Access Denied. You do not have permission to view the Overview dashboard.
            </div>
        );
      }
      if (accessType === 'honor' && !user.canAccessHonor) {
        return (
            <div className="text-center p-8 text-red-400 bg-gray-800 rounded-xl">
                Access Denied. You do not have permission to view the Honor Ranking.
            </div>
        );
      }
      if (accessType === 'analytics' && !user.canAccessAnalytics) {
        return (
            <div className="text-center p-8 text-red-400 bg-gray-800 rounded-xl">
                Access Denied. You do not have permission to view the Player Analytics.
            </div>
        );
      }
  }

  // Fallback, wenn der Benutzer ein normaler 'user' ist, aber keine Features freigeschaltet sind
  if (role === 'user' && accessType !== 'admin' && !user.canAccessOverview && !user.canAccessHonor && !user.canAccessAnalytics) {
    return (
        <div className="text-center p-8 text-yellow-400 bg-gray-800 rounded-xl">
            Access Pending. Your account is approved, but no features are currently enabled. Please contact your Kingdom R5.
        </div>
    );
  }


  return <>{children}</>;
};

export default ProtectedRoute;