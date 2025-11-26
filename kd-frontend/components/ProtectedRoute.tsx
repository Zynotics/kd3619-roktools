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

  // Refresh user data when component mounts
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

  // Not logged in → show login prompt
  if (!user) {
    return <LoginPrompt />;
  }

  // 👉 R5 wird hier wie Admin behandelt (volle Rechte, keine Approval-Checks)
  const isAdmin = user.role === 'admin' || user.role === 'r5';

  // Not approved yet (and not admin/R5)
  if (!isAdmin && !user.isApproved) {
    return <ApprovalPending />;
  }

  // Check access rights
  let hasAccess = false;
  if (isAdmin) {
    hasAccess = true;
  } else {
    if (accessType === 'overview') hasAccess = hasOverviewAccess;
    if (accessType === 'honor') hasAccess = hasHonorAccess;
    if (accessType === 'analytics') hasAccess = hasAnalyticsAccess;
  }

  // No permission → show pending-style card
  if (!hasAccess) {
    return <ApprovalPending />;
  }

  // Allowed → render target component
  return <>{children}</>;
};

export default ProtectedRoute;
