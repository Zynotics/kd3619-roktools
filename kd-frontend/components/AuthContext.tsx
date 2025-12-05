// AuthContext.tsx (VOLLSTÄNDIGER CODE MIT INVITE-SLUG SUPPORT)
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

type UserRole = 'user' | 'r4' | 'r5' | 'admin';

interface User {
  id: string;
  email: string;
  username: string;
  isApproved: boolean;
  role: UserRole;
  governorId?: string | null;
  canAccessHonor?: boolean;
  canAccessAnalytics?: boolean;
  canAccessOverview?: boolean;
  kingdomId?: string | null; // NEU
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (username: string, pass: string) => Promise<void>;
  register: (email: string, username: string, pass: string, govId: string, slug?: string | null) => Promise<{ message: string }>; // 🆕 slug hinzugefügt
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const BACKEND_URL =
  process.env.NODE_ENV === 'production'
    ? 'https://api.rise-of-stats.com'
    : 'http://localhost:4000';

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const storedToken = localStorage.getItem('authToken');
    if (storedToken) {
      setToken(storedToken);
      validateToken(storedToken);
    } else {
      setIsReady(true);
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
      } else {
        logout();
      }
    } catch {
      logout();
    } finally {
      setIsReady(true);
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
  };

  // 🆕 register mit slug Parameter
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
  };

  const refreshUser = async () => {
    if (token) {
      await validateToken(token);
    }
  };

  if (!isReady) return null; // or loading spinner

  return (
    <AuthContext.Provider value={{ user, token, login, register, logout, refreshUser }}>
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