import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

type UserRole = 'user' | 'r4' | 'r5' | 'admin';

// 📝 Export hinzugefügt und Felder erweitert
export interface User {
  id: string;
  email: string;
  username: string;
  isApproved: boolean;
  role: UserRole;
  governorId?: string | null;
  canAccessHonor?: boolean;
  canAccessAnalytics?: boolean;
  canAccessOverview?: boolean;
  kingdomId?: string | null;
  // 🆕 Neue Felder für Dateirechte (passend zum Backend Update)
  canManageOverviewFiles?: boolean;
  canManageHonorFiles?: boolean;
  canManageActivityFiles?: boolean;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (username: string, pass: string) => Promise<void>;
  register: (email: string, username: string, pass: string, govId: string, slug?: string | null) => Promise<{ message: string }>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const BACKEND_URL =
  process.env.NODE_ENV === 'production'
    ? 'https://api.rise-of-stats.com'
    : 'http://localhost:4000';

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const storedToken = localStorage.getItem('authToken');
    if (storedToken) {
      setToken(storedToken);
      validateToken(storedToken);
    } else {
      setIsLoading(false);
    }
  }, []);

  const validateToken = async (t: string) => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/auth/validate`, {
        headers: { Authorization: `Bearer ${t}` },
      });
      if (res.ok) {
        const u = await res.json();
        setUser(u);
        console.log('🔄 Session validated. Role:', u.role); // 🔍 Debugging
      } else {
        logout();
      }
    } catch {
      logout();
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (username: string, pass: string) => {
    const res = await fetch(`${BACKEND_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password: pass }),
    });
    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || 'Login failed');
    }

    localStorage.setItem('authToken', data.token);
    setToken(data.token);
    setUser(data.user);
    console.log('✅ Login successful. Role:', data.user.role); // 🔍 Debugging
  };

  const register = async (
    email: string, 
    username: string, 
    pass: string, 
    govId: string,
    slug?: string | null
  ) => {
    const body: any = { email, username, password: pass, governorId: govId };
    if (slug) {
        body.slug = slug;
    }

    const res = await fetch(`${BACKEND_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || 'Registration failed');
    }
    return data;
  };

  const logout = () => {
    localStorage.removeItem('authToken');
    setToken(null);
    setUser(null);
    // Optional: Hard Redirect, um States sicher zu clearen
    // window.location.href = '/'; 
  };

  const refreshUser = async () => {
    if (token) {
      setIsLoading(true); 
      await validateToken(token);
    }
  };

  return (
    <AuthContext.Provider value={{ user, token, login, register, logout, refreshUser, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};