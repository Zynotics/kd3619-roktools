import React, { useEffect } from 'react';
import { useAuth } from './AuthContext';
import LoginPrompt from './LoginPrompt';
import ApprovalPending from './ApprovalPending';

interface ProtectedRouteProps {
  children: React.ReactNode;
  accessType?: 'overview' | 'honor' | 'analytics';
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  accessType = 'overview',
}) => {
  const {
    user,
    isLoading,
    hasOverviewAccess,
    hasHonorAccess,
    hasAnalyticsAccess,
    refreshUser,
  } = useAuth();

  // User-Daten aktualisieren wenn Komponente mounted
  useEffect(() => {
    if (user) {
      refreshUser();
    }
  }, [user, refreshUser]);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500" />
      </div>
    );
  }

  if (!user) {
    return <LoginPrompt />;
  }

  const isAdmin = user.role === 'admin';

  // noch nicht generell freigegeben?
  if (!isAdmin && !user.isApproved) {
    return <ApprovalPending />;
  }

  let hasAccess = false;
  if (isAdmin) {
    hasAccess = true;
  } else {
    if (accessType === 'overview') hasAccess = hasOverviewAccess;
    if (accessType === 'honor') hasAccess = hasHonorAccess;
    if (accessType === 'analytics') hasAccess = hasAnalyticsAccess;
  }

  if (!hasAccess) {
    // einfacher Re-Use: gleiche Karte wie bei ausstehender Freigabe
    return <ApprovalPending />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
