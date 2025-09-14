import React from 'react';
import { Navigate } from 'react-router-dom';
import { getAuth } from '@/lib/storage';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const auth = getAuth();
  
  if (!auth.isAuthenticated) {
    return <Navigate to="/auth" replace />;
  }
  
  return <>{children}</>;
};