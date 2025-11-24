import React, { createContext, useState, useContext, useEffect } from 'react';

interface User {
  id: string;
  email: string;
  username: string;
  isApproved: boolean; // Jetzt Boolean!
  role: 'user' | 'admin';
}

interface AuthContextType {
  user: User | null;
  login: (username: string, password: string) => Promise<void>;
  register: (email: string, username: string, password: string) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
  hasOverviewAccess: boolean;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Backend URL aus App.tsx übernehmen
  const BACKEND_URL = process.env.NODE_ENV === 'production' 
    ? 'https://kd3619-backend.onrender.com'
    : 'http://localhost:4000';

  // REPARIERT: User-Daten vom Backend abrufen mit Boolean Konvertierung
  const refreshUser = async () => {
    const token = localStorage.getItem('authToken');
    if (!token) {
      setUser(null);
      return;
    }

    try {
      console.log('🔄 Refreshing user data...');
      const response = await fetch(`${BACKEND_URL}/api/auth/validate`, {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const userData = await response.json();
        
        // REPARIERT: Number zu Boolean konvertieren
        const processedUserData: User = {
          ...userData,
          isApproved: Boolean(userData.isApproved) // 1 -> true, 0 -> false
        };
        
        console.log('✅ User data refreshed:', processedUserData);
        setUser(processedUserData);
      } else {
        console.log('❌ Token invalid during refresh');
        localStorage.removeItem('authToken');
        setUser(null);
      }
    } catch (error) {
      console.error('💥 Error refreshing user:', error);
      localStorage.removeItem('authToken');
      setUser(null);
    }
  };

  useEffect(() => {
    // Session beim Start prüfen
    const token = localStorage.getItem('authToken');
    if (token) {
      refreshUser().finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
  }, []);

  const login = async (username: string, password: string) => {
    setIsLoading(true);
    try {
      console.log('🔄 Login attempt:', { username });
      
      const response = await fetch(`${BACKEND_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      console.log('📡 Login response status:', response.status);
      
      if (response.ok) {
        const { user: userData, token } = await response.json();
        
        // REPARIERT: Auch hier Number zu Boolean konvertieren
        const processedUserData: User = {
          ...userData,
          isApproved: Boolean(userData.isApproved)
        };
        
        console.log('✅ Login successful:', processedUserData);
        setUser(processedUserData);
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

  // REPARIERTE Zugriffslogik
  const hasOverviewAccess = user?.isApproved === true || user?.role === 'admin';
  
  console.log('🔐 Auth Status:', { 
    user: user?.username,
    isApproved: user?.isApproved,
    role: user?.role,
    hasOverviewAccess 
  });

  return (
    <AuthContext.Provider value={{ 
      user, 
      login, 
      register, 
      logout, 
      isLoading, 
      hasOverviewAccess,
      refreshUser
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