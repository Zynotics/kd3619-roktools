import React, { createContext, useState, useContext, useEffect } from 'react';

interface User {
  id: string;
  email: string;
  username: string;
  isApproved: boolean;
  role: 'user' | 'admin';
}

interface AuthContextType {
  user: User | null;
  login: (username: string, password: string) => Promise<void>;
  register: (email: string, username: string, password: string) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
  hasOverviewAccess: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Backend URL aus App.tsx übernehmen
  const BACKEND_URL = process.env.NODE_ENV === 'production' 
    ? 'https://kd3619-backend.onrender.com'
    : 'http://localhost:4000';

  useEffect(() => {
    // Session beim Start prüfen
    const token = localStorage.getItem('authToken');
    if (token) {
      validateToken(token);
    } else {
      setIsLoading(false);
    }
  }, []);

  // REPARIERTE validateToken Funktion
  const validateToken = async (token: string) => {
    try {
      console.log('🔄 Validating token...');
      const response = await fetch(`${BACKEND_URL}/api/auth/validate`, {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const userData = await response.json();
        console.log('✅ Token valid, user:', userData);
        setUser(userData);
      } else {
        // Token ungültig
        console.log('❌ Token invalid, clearing storage');
        localStorage.removeItem('authToken');
        setUser(null);
      }
    } catch (error) {
      console.error('Token validation error:', error);
      localStorage.removeItem('authToken');
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (username: string, password: string) => {
    setIsLoading(true);
    try {
      console.log('🔄 Login attempt:', { username, backendUrl: BACKEND_URL });
      
      const response = await fetch(`${BACKEND_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      console.log('📡 Login response status:', response.status);
      
      if (response.ok) {
        const { user: userData, token } = await response.json();
        console.log('✅ Login successful:', userData);
        setUser(userData);
        localStorage.setItem('authToken', token);
      } else {
        const errorData = await response.json();
        console.log('❌ Login failed:', errorData);
        throw new Error(errorData.error || 'Login fehlgeschlagen');
      }
    } catch (error) {
      console.error('💥 Login error:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (email: string, username: string, password: string) => {
    setIsLoading(true);
    try {
      const response = await fetch(`${BACKEND_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, username, password })
      });

      if (response.ok) {
        const result = await response.json();
        return result;
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Registrierung fehlgeschlagen');
      }
    } catch (error) {
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    console.log('🚪 Logging out...');
    setUser(null);
    localStorage.removeItem('authToken');
  };

  // REPARIERTE hasOverviewAccess Logik
  const hasOverviewAccess = user?.isApproved === true || user?.role === 'admin';
  console.log('🔐 Auth Debug:', { 
    user, 
    hasOverviewAccess,
    isApproved: user?.isApproved,
    role: user?.role
  });

  return (
    <AuthContext.Provider value={{ 
      user, 
      login, 
      register, 
      logout, 
      isLoading, 
      hasOverviewAccess 
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};