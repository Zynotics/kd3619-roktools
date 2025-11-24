import React, { useEffect } from 'react';
import { useAuth } from './AuthContext';
import LoginPrompt from './LoginPrompt';
import ApprovalPending from './ApprovalPending';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { user, isLoading, hasOverviewAccess, refreshUser } = useAuth();

  // User-Daten aktualisieren wenn Komponente mounted
  useEffect(() => {
    if (user) {
      console.log('🔄 ProtectedRoute: Refreshing user data on mount');
      refreshUser();
    }
  }, []);

  console.log('🔐 ProtectedRoute Check:', {
    user: user?.username,
    isLoading,
    hasOverviewAccess,
    isApproved: user?.isApproved,
    role: user?.role
  });

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (!user) {
    console.log('❌ ProtectedRoute: No user - showing login');
    return <LoginPrompt />;
  }

  if (!hasOverviewAccess) {
    console.log('❌ ProtectedRoute: No access - showing approval pending');
    return <ApprovalPending />;
  }

  console.log('✅ ProtectedRoute: Access granted');
  return <>{children}</>;
};

export default ProtectedRoute;