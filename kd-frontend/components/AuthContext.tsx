// AuthContext.tsx (VOLLSTÄNDIGER CODE)
import React, {
  createContext,
  useState,
  useContext,
  useEffect,
  ReactNode,
} from 'react';

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
}

interface AuthContextType {
  user: User | null;
  login: (username: string, password: string) => Promise<void>;
  register: (
    email: string,
    username: string,
    password: string,
    governorId: string
  ) => Promise<any>;
  logout: () => void;
  isLoading: boolean;
  hasOverviewAccess: boolean;
  hasHonorAccess: boolean;
  hasAnalyticsAccess: boolean;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// 🌐 NEU: BACKEND_URL auf die neue API-Domain aktualisieren
const BACKEND_URL =
  process.env.NODE_ENV === 'production'
    ? 'https://api.rise-of-stats.com' // <-- HIER IST DIE WICHTIGE ÄNDERUNG
    : 'http://localhost:4000';

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Load token & validate user
  useEffect(() => {
    const initAuth = async () => {
      const token = localStorage.getItem('authToken');
      if (!token) {
        setIsLoading(false);
        return;
      }

      try {
        const res = await fetch(`${BACKEND_URL}/api/auth/validate`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!res.ok) {
          localStorage.removeItem('authToken');
          setUser(null);
        } else {
          const data = await res.json();
          setUser({
            id: data.id,
            email: data.email,
            username: data.username,
            isApproved: !!data.isApproved,
            role: data.role as UserRole,
            governorId: data.governorId ?? null,
            canAccessHonor: !!data.canAccessHonor,
            canAccessAnalytics: !!data.canAccessAnalytics,
            canAccessOverview: !!data.canAccessOverview,
          });
        }
      } catch (err) {
        console.error('Auth init error:', err);
        localStorage.removeItem('authToken');
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();
  }, []);

  const login = async (username: string, password: string) => {
    const res = await fetch(`${BACKEND_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });

    if (!res.ok) {
      const text = await res.text();
      let message = 'Login failed';
      try {
        const errJson = JSON.parse(text);
        message = errJson.error || message;
      } catch {
        // ignore
      }
      throw new Error(message);
    }

    const data = await res.json();
    if (data.token) {
      localStorage.setItem('authToken', data.token);
    }

    setUser({
      id: data.user.id,
      email: data.user.email,
      username: data.user.username,
      isApproved: !!data.user.isApproved,
      role: data.user.role as UserRole,
      governorId: data.user.governorId ?? null,
      canAccessHonor: !!data.user.canAccessHonor,
      canAccessAnalytics: !!data.user.canAccessAnalytics,
      canAccessOverview: !!data.user.canAccessOverview,
    });
  };

  const register = async (
    email: string,
    username: string,
    password: string,
    governorId: string
  ) => {
    setIsLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, username, password, governorId }),
      });

      const text = await res.text();
      let json: any = {};
      try {
        json = text ? JSON.parse(text) : {};
      } catch {
        // Plain text
      }

      if (!res.ok) {
        const message = json.error || 'Registration failed';
        throw new Error(message);
      }

      return json;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('authToken');
    setUser(null);
  };

  const refreshUser = async () => {
    const token = localStorage.getItem('authToken');
    if (!token) return;

    try {
      const res = await fetch(`${BACKEND_URL}/api/auth/validate`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        localStorage.removeItem('authToken');
        setUser(null);
        return;
      }

      const data = await res.json();
      setUser({
        id: data.id,
        email: data.email,
        username: data.username,
        isApproved: !!data.isApproved,
        role: data.role as UserRole,
        governorId: data.governorId ?? null,
        canAccessHonor: !!data.canAccessHonor,
        canAccessAnalytics: !!data.canAccessAnalytics,
        canAccessOverview: !!data.canAccessOverview,
      });
    } catch (err) {
      console.error('refreshUser error:', err);
    }
  };

  const isElevated =
    user?.role === 'admin' || user?.role === 'r4' || user?.role === 'r5';

  const hasOverviewAccess =
    !!user && (isElevated || (user.isApproved && !!user.canAccessOverview));
  const hasHonorAccess =
    !!user && (isElevated || (user.isApproved && !!user.canAccessHonor));
  const hasAnalyticsAccess =
    !!user && (isElevated || (user.isApproved && !!user.canAccessAnalytics));

  return (
    <AuthContext.Provider
      value={{
        user,
        login,
        register,
        logout,
        isLoading,
        hasOverviewAccess,
        hasHonorAccess,
        hasAnalyticsAccess,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
};