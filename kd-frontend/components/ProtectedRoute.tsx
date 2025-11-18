import React from 'react';
import { useAuth } from './AuthContext';
import LoginPrompt from './LoginPrompt';
import ApprovalPending from './ApprovalPending';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { user, isLoading, hasOverviewAccess } = useAuth();

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (!user) {
    return <LoginPrompt />;
  }

  if (!hasOverviewAccess) {
    return <ApprovalPending />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;