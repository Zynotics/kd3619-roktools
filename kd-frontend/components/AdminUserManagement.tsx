import React, { useState, useEffect } from 'react';
import { Card } from './Card';
import { Table, TableHeader, TableRow, TableCell } from './Table';
import { useAuth } from './AuthContext';

interface User {
  id: string;
  email: string;
  username: string;
  isApproved: boolean;
  role: 'user' | 'admin';
  createdAt: string;
  governorId?: string | null;
  canAccessHonor?: boolean;
  canAccessAnalytics?: boolean;
  canAccessOverview?: boolean;
}

const BACKEND_URL =
  process.env.NODE_ENV === 'production'
    ? 'https://kd3619-backend.onrender.com'
    : 'http://localhost:4000';

const AdminUserManagement: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user: currentUser } = useAuth();

  useEffect(() => {
    fetchUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchUsers = async () => {
    try {
      const token = localStorage.getItem('authToken');
      if (!token) {
        setError('Nicht angemeldet');
        return;
      }

      const response = await fetch(`${BACKEND_URL}/api/admin/users`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const userData: User[] = await response.json();
        setUsers(userData);
      } else if (response.status === 403) {
        setError('Keine Admin-Berechtigung');
      } else {
        const errorText = await response.text();
        console.log('❌ Users fetch failed:', errorText);
        throw new Error('Fehler beim Laden der Benutzer');
      }
    } catch (err) {
      console.error('💥 Error loading users:', err);
      setError('Konnte Benutzer nicht laden');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleApproval = async (userId: string, approved: boolean) => {
    try {
      const token = localStorage.getItem('authToken');
      if (!token) {
        throw new Error('Nicht angemeldet');
      }

      const response = await fetch(`${BACKEND_URL}/api/admin/users/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          userId,
          approved,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.log('❌ Server Error:', errorText);
        throw new Error(errorText || 'Serverfehler');
      }

      setUsers((prev) =>
        prev.map((user) =>
          user.id === userId ? { ...user, isApproved: approved } : user
        )
      );
    } catch (err: any) {
      console.error('💥 Frontend Error in toggleApproval:', err);
      alert('Aktion konnte nicht durchgeführt werden: ' + (err.message || err));
    }
  };

  const updateAccess = async (
    targetUser: User,
    changes: Partial<Pick<User, 'canAccessHonor' | 'canAccessAnalytics' | 'canAccessOverview'>>
  ) => {
    try {
      const token = localStorage.getItem('authToken');
      if (!token) {
        throw new Error('Nicht angemeldet');
      }

      const body = {
        userId: targetUser.id,
        canAccessHonor:
          changes.canAccessHonor ?? !!targetUser.canAccessHonor,
        canAccessAnalytics:
          changes.canAccessAnalytics ?? !!targetUser.canAccessAnalytics,
        canAccessOverview:
          changes.canAccessOverview ?? !!targetUser.canAccessOverview,
      };

      const response = await fetch(`${BACKEND_URL}/api/admin/users/access`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.log('❌ Access update error:', errorText);
        throw new Error(errorText || 'Zugriffsrechte konnten nicht aktualisiert werden.');
      }

      setUsers((prev) =>
        prev.map((u) =>
          u.id === targetUser.id
            ? {
                ...u,
                canAccessHonor: body.canAccessHonor,
                canAccessAnalytics: body.canAccessAnalytics,
                canAccessOverview: body.canAccessOverview,
              }
            : u
        )
      );
    } catch (err: any) {
      console.error('💥 Frontend Error in updateAccess:', err);
      alert('Zugriffsrechte konnten nicht geändert werden: ' + (err.message || err));
    }
  };

  const deleteUser = async (userId: string, username: string) => {
    const confirmed = window.confirm(
      `Benutzer "${username}" wirklich dauerhaft löschen?\nDies kann nicht rückgängig gemacht werden.`
    );
    if (!confirmed) return;

    try {
      const token = localStorage.getItem('authToken');
      if (!token) {
        throw new Error('Nicht angemeldet');
      }

      const response = await fetch(`${BACKEND_URL}/api/admin/users/${userId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.log('❌ Delete Server Error:', errorText);
        throw new Error(errorText || 'Serverfehler beim Löschen');
      }

      setUsers((prev) => prev.filter((user) => user.id !== userId));
    } catch (err: any) {
      console.error('💥 Frontend Error in deleteUser:', err);
      alert('Benutzer konnte nicht gelöscht werden: ' + (err.message || err));
    }
  };

  if (isLoading) {
    return (
      <Card className="p-6 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto" />
        <p className="mt-2 text-gray-400">Lade Benutzer.</p>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="p-6 text-center text-red-400 bg-red-900/50">
        {error}
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <h2 className="text-2xl font-bold text-white mb-6">Benutzerverwaltung</h2>

      <Table>
        <TableHeader>
          <tr>
            <TableCell align="left" header>
              Benutzername
            </TableCell>
            <TableCell align="left" header>
              E-Mail
            </TableCell>
            <TableCell align="center" header>
              Gov ID
            </TableCell>
            <TableCell align="center" header>
              Registriert am
            </TableCell>
            <TableCell align="center" header>
              Rolle
            </TableCell>
            <TableCell align="center" header>
              Honor
            </TableCell>
            <TableCell align="center" header>
              Analytics
            </TableCell>
            <TableCell align="center" header>
              Overview
            </TableCell>
            <TableCell align="center" header>
              Freigabe
            </TableCell>
            <TableCell align="center" header>
              Aktionen
            </TableCell>
          </tr>
        </TableHeader>
        <tbody>
          {users.map((user) => (
            <TableRow key={user.id}>
              <TableCell align="left" className="font-medium text-white">
                {user.username}
                {user.id === currentUser?.id && (
                  <span className="ml-2 text-xs text-blue-400">(Aktuell)</span>
                )}
              </TableCell>
              <TableCell align="left">{user.email}</TableCell>
              <TableCell align="center">
                <span className="text-xs text-gray-300">
                  {user.governorId && user.governorId.trim().length > 0
                    ? user.governorId
                    : '—'}
                </span>
              </TableCell>
              <TableCell align="center">
                {new Date(user.createdAt).toLocaleDateString('de-DE')}
              </TableCell>
              <TableCell align="center">
                <span
                  className={`px-2 py-1 rounded-full text-xs font-semibold ${
                    user.role === 'admin'
                      ? 'bg-purple-500 text-white'
                      : 'bg-gray-500 text-white'
                  }`}
                >
                  {user.role === 'admin' ? 'Admin' : 'User'}
                </span>
              </TableCell>
              {/* Zugriff: Honor */}
              <TableCell align="center">
                {user.role === 'admin' ? (
                  <span className="text-xs text-green-400 font-semibold">immer</span>
                ) : (
                  <button
                    onClick={() =>
                      updateAccess(user, {
                        canAccessHonor: !user.canAccessHonor,
                      })
                    }
                    className={`px-2 py-1 rounded text-xs font-semibold ${
                      user.canAccessHonor
                        ? 'bg-green-600 text-white'
                        : 'bg-gray-700 text-gray-300'
                    }`}
                  >
                    {user.canAccessHonor ? 'Ja' : 'Nein'}
                  </button>
                )}
              </TableCell>
              {/* Zugriff: Analytics */}
              <TableCell align="center">
                {user.role === 'admin' ? (
                  <span className="text-xs text-green-400 font-semibold">immer</span>
                ) : (
                  <button
                    onClick={() =>
                      updateAccess(user, {
                        canAccessAnalytics: !user.canAccessAnalytics,
                      })
                    }
                    className={`px-2 py-1 rounded text-xs font-semibold ${
                      user.canAccessAnalytics
                        ? 'bg-green-600 text-white'
                        : 'bg-gray-700 text-gray-300'
                    }`}
                  >
                    {user.canAccessAnalytics ? 'Ja' : 'Nein'}
                  </button>
                )}
              </TableCell>
              {/* Zugriff: Overview */}
              <TableCell align="center">
                {user.role === 'admin' ? (
                  <span className="text-xs text-green-400 font-semibold">immer</span>
                ) : (
                  <button
                    onClick={() =>
                      updateAccess(user, {
                        canAccessOverview: !user.canAccessOverview,
                      })
                    }
                    className={`px-2 py-1 rounded text-xs font-semibold ${
                      user.canAccessOverview
                        ? 'bg-green-600 text-white'
                        : 'bg-gray-700 text-gray-300'
                    }`}
                  >
                    {user.canAccessOverview ? 'Ja' : 'Nein'}
                  </button>
                )}
              </TableCell>
              <TableCell align="center">
                <span
                  className={`px-2 py-1 rounded-full text-xs font-semibold ${
                    user.isApproved
                      ? 'bg-green-500 text-white'
                      : 'bg-yellow-500 text-black'
                  }`}
                >
                  {user.isApproved ? 'Freigegeben' : 'Ausstehend'}
                </span>
              </TableCell>
              <TableCell align="center">
                {user.id !== currentUser?.id && user.role !== 'admin' && (
                  <div className="flex gap-2 justify-center">
                    {!user.isApproved ? (
                      <button
                        onClick={() => toggleApproval(user.id, true)}
                        className="bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700 transition-colors text-sm"
                      >
                        Freigeben
                      </button>
                    ) : (
                      <button
                        onClick={() => toggleApproval(user.id, false)}
                        className="bg-yellow-600 text-white px-3 py-1 rounded hover:bg-yellow-700 transition-colors text-sm"
                      >
                        Sperren
                      </button>
                    )}

                    <button
                      onClick={() => deleteUser(user.id, user.username)}
                      className="bg-red-700 text-white px-3 py-1 rounded hover:bg-red-800 transition-colors text-sm"
                    >
                      Löschen
                    </button>
                  </div>
                )}
                {user.id === currentUser?.id && (
                  <span className="text-gray-500 text-sm">Eigenes Konto</span>
                )}
                {user.role === 'admin' && user.id !== currentUser?.id && (
                  <span className="text-gray-500 text-sm">Admin</span>
                )}
              </TableCell>
            </TableRow>
          ))}
        </tbody>
      </Table>

      {users.length === 0 && (
        <div className="text-center text-gray-400 py-8">
          Keine Benutzer gefunden
        </div>
      )}
    </Card>
  );
};

export default AdminUserManagement;
