// kd-frontend/components/AuthContext.tsx
import React, { createContext, useState, useEffect, useContext } from 'react';

// URL Bestimmung
const BACKEND_URL =
  process.env.NODE_ENV === 'production'
    ? 'https://api.rise-of-stats.com'
    : 'http://localhost:4000';

// 👑 Definiere den User-Typ strikt passend zum Backend
export interface User {
  id: string;
  username: string;
  email?: string;
  role: 'admin' | 'r5' | 'r4' | 'user'; // Wichtig: Die Rollen müssen exakt stimmen
  kingdomId?: string | null;
  isApproved?: boolean;
  canManageOverviewFiles?: boolean;
  canManageHonorFiles?: boolean;
  canManageActivityFiles?: boolean;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (token: string, user: User) => void;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  token: null,
  login: () => {},
  logout: () => {},
  isLoading: true,
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('authToken'));
  const [isLoading, setIsLoading] = useState(true);

  // Login Funktion
  const login = (newToken: string, newUser: User) => {
    localStorage.setItem('authToken', newToken);
    setToken(newToken);
    setUser(newUser);
    // Debugging: Zeige in der Konsole, wer sich eingeloggt hat
    console.log('✅ Login successful. User role:', newUser.role);
  };

  // Logout Funktion
  const logout = () => {
    localStorage.removeItem('authToken');
    setToken(null);
    setUser(null);
    window.location.href = '/'; // Hard redirect zum Login
  };

  // Beim Laden: Token validieren & User-Daten holen
  useEffect(() => {
    const validateToken = async () => {
      const storedToken = localStorage.getItem('authToken');
      if (!storedToken) {
        setIsLoading(false);
        return;
      }

      try {
        const res = await fetch(`${BACKEND_URL}/api/auth/validate`, {
          headers: { Authorization: `Bearer ${storedToken}` },
        });

        if (res.ok) {
          const userData = await res.json();
          // Wir setzen den User direkt mit den Daten vom Backend
          setUser(userData);
          console.log('🔄 Session validated. Current Role:', userData.role);
        } else {
          console.warn('Session expired or invalid');
          logout();
        }
      } catch (error) {
        console.error('Auth validation error:', error);
        logout(); // Bei Netzwerkfehler oder so lieber ausloggen sicherheitshalber
      } finally {
        setIsLoading(false);
      }
    };

    validateToken();
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, login, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
};