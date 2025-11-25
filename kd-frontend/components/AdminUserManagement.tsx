import React, { useState, useEffect } from 'react';
import { Card } from './Card';
import { Table, TableHeader, TableRow, TableCell } from './Table';
import { useAuth } from './AuthContext';

type UserRole = 'user' | 'r4' | 'r5' | 'admin';

interface User {
  id: string;
  email: string;
  username: string;
  isApproved: boolean;
  role: UserRole;
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
        setError('Not signed in');
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
        setError('No admin privileges');
      } else {
        const errorText = await response.text();
        console.log('❌ Users fetch failed:', errorText);
        throw new Error('Error loading users');
      }
    } catch (err) {
      console.error('💥 Error loading users:', err);
      setError('Could not load users');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleApproval = async (userId: string, approved: boolean) => {
    try {
      const token = localStorage.getItem('authToken');
      if (!token) {
        throw new Error('Not signed in');
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
        throw new Error(errorText || 'Server error');
      }

      setUsers((prev) =>
        prev.map((user) =>
          user.id === userId ? { ...user, isApproved: approved } : user
        )
      );
    } catch (err: any) {
      console.error('💥 Frontend Error in toggleApproval:', err);
      alert('Action could not be completed: ' + (err.message || String(err)));
    }
  };

  const updateAccess = async (
    targetUser: User,
    changes: Partial<
      Pick<User, 'canAccessHonor' | 'canAccessAnalytics' | 'canAccessOverview'>
    >
  ) => {
    try {
      const token = localStorage.getItem('authToken');
      if (!token) {
        throw new Error('Not signed in');
      }

      const body = {
        userId: targetUser.id,
        canAccessHonor: changes.canAccessHonor ?? !!targetUser.canAccessHonor,
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
        throw new Error(errorText || 'Could not update access rights.');
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
      alert(
        'Access rights could not be changed: ' + (err.message || String(err))
      );
    }
  };

  const updateRole = async (targetUser: User, newRole: UserRole) => {
    try {
      const token = localStorage.getItem('authToken');
      if (!token) throw new Error('Not signed in');

      const response = await fetch(`${BACKEND_URL}/api/admin/users/role`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          userId: targetUser.id,
          role: newRole,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.log('❌ Role update error:', errorText);
        throw new Error(errorText || 'Could not update role.');
      }

      setUsers((prev) =>
        prev.map((u) =>
          u.id === targetUser.id ? { ...u, role: newRole } : u
        )
      );
    } catch (err: any) {
      console.error('💥 Frontend Error in updateRole:', err);
      alert('Role could not be changed: ' + (err.message || String(err)));
    }
  };

  const deleteUser = async (userId: string, username: string) => {
    const confirmed = window.confirm(
      `Really permanently delete user "${username}"?\nThis cannot be undone.`
    );
    if (!confirmed) return;

    try {
      const token = localStorage.getItem('authToken');
      if (!token) {
        throw new Error('Not signed in');
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
        throw new Error(errorText || 'Server error while deleting');
      }

      setUsers((prev) => prev.filter((user) => user.id !== userId));
    } catch (err: any) {
      console.error('💥 Frontend Error in deleteUser:', err);
      alert('User could not be deleted: ' + (err.message || String(err)));
    }
  };

  if (isLoading) {
    return (
      <Card className="p-6 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto" />
        <p className="mt-2 text-gray-400">Loading users…</p>
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

  const canManageUsers =
    currentUser?.role === 'admin' || currentUser?.role === 'r5';

  return (
    <Card className="p-6">
      <h2 className="text-2xl font-bold text-white mb-6">
        User Management
      </h2>

      {!canManageUsers && (
        <p className="text-sm text-yellow-400 mb-4">
          You do not have permission to manage users.
        </p>
      )}

      <Table>
        <TableHeader>
          <tr>
            <TableCell align="left" header>
              Username
            </TableCell>
            <TableCell align="left" header>
              E-mail
            </TableCell>
            <TableCell align="center" header>
              Gov ID
            </TableCell>
            <TableCell align="center" header>
              Registered on
            </TableCell>
            <TableCell align="center" header>
              Role
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
              Approval
            </TableCell>
            <TableCell align="center" header>
              Actions
            </TableCell>
          </tr>
        </TableHeader>
        <tbody>
          {users.map((user) => (
            <TableRow key={user.id}>
              <TableCell align="left" className="font-medium text-white">
                {user.username}
                {user.id === currentUser?.id && (
                  <span className="ml-2 text-xs text-blue-400">
                    (Current)
                  </span>
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
                {new Date(user.createdAt).toLocaleDateString('en-GB')}
              </TableCell>

              {/* ROLE */}
              <TableCell align="center">
                {!canManageUsers || user.id === currentUser?.id ? (
                  <span className="text-gray-300 text-sm capitalize">
                    {user.role}
                  </span>
                ) : (
                  <select
                    value={user.role}
                    onChange={(e) =>
                      updateRole(user, e.target.value as UserRole)
                    }
                    className="bg-gray-800 border border-gray-600 text-gray-200 text-xs px-2 py-1 rounded-lg"
                  >
                    <option value="user">User</option>
                    <option value="r4">R4</option>
                    <option value="r5">R5</option>
                  </select>
                )}
              </TableCell>

              {/* Access: Honor */}
              <TableCell align="center">
                <button
                  disabled={!canManageUsers}
                  onClick={() =>
                    updateAccess(user, {
                      canAccessHonor: !user.canAccessHonor,
                    })
                  }
                  className={`px-2 py-1 rounded text-xs font-semibold ${
                    user.canAccessHonor
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-700 text-gray-300'
                  } ${!canManageUsers ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {user.canAccessHonor ? 'Yes' : 'No'}
                </button>
              </TableCell>

              {/* Access: Analytics */}
              <TableCell align="center">
                <button
                  disabled={!canManageUsers}
                  onClick={() =>
                    updateAccess(user, {
                      canAccessAnalytics: !user.canAccessAnalytics,
                    })
                  }
                  className={`px-2 py-1 rounded text-xs font-semibold ${
                    user.canAccessAnalytics
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-700 text-gray-300'
                  } ${!canManageUsers ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {user.canAccessAnalytics ? 'Yes' : 'No'}
                </button>
              </TableCell>

              {/* Access: Overview */}
              <TableCell align="center">
                <button
                  disabled={!canManageUsers}
                  onClick={() =>
                    updateAccess(user, {
                      canAccessOverview: !user.canAccessOverview,
                    })
                  }
                  className={`px-2 py-1 rounded text-xs font-semibold ${
                    user.canAccessOverview
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-700 text-gray-300'
                  } ${!canManageUsers ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {user.canAccessOverview ? 'Yes' : 'No'}
                </button>
              </TableCell>

              {/* Approval */}
              <TableCell align="center">
                <span
                  className={`px-2 py-1 rounded-full text-xs font-semibold ${
                    user.isApproved
                      ? 'bg-green-500 text-white'
                      : 'bg-yellow-500 text-black'
                  }`}
                >
                  {user.isApproved ? 'Approved' : 'Pending'}
                </span>
              </TableCell>

              {/* Actions */}
              <TableCell align="center">
                {user.id !== currentUser?.id && user.role !== 'admin' && canManageUsers ? (
                  <div className="flex gap-2 justify-center">
                    {!user.isApproved ? (
                      <button
                        onClick={() => toggleApproval(user.id, true)}
                        className="bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700 transition-colors text-sm"
                      >
                        Approve
                      </button>
                    ) : (
                      <button
                        onClick={() => toggleApproval(user.id, false)}
                        className="bg-yellow-600 text-white px-3 py-1 rounded hover:bg-yellow-700 transition-colors text-sm"
                      >
                        Block
                      </button>
                    )}

                    <button
                      onClick={() => deleteUser(user.id, user.username)}
                      className="bg-red-700 text-white px-3 py-1 rounded hover:bg-red-800 transition-colors text-sm"
                    >
                      Delete
                    </button>
                  </div>
                )}
                {(!canManageUsers || user.id === currentUser?.id) && (
                  <span className="text-gray-500 text-sm">No actions</span>
                )}
              </TableCell>
            </TableRow>
          ))}
        </tbody>
      </Table>

      {users.length === 0 && (
        <div className="text-center text-gray-400 py-8">
          No users found
        </div>
      )}
    </Card>
  );
};

export default AdminUserManagement;
