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

interface Kingdom {
  id: string;
  displayName: string;
  slug: string;
  rokIdentifier: string | null;
  status: string;
  plan: string;
  createdAt?: string;
  updatedAt?: string;
}

const BACKEND_URL =
  process.env.NODE_ENV === 'production'
    ? 'https://kd3619-backend.onrender.com'
    : 'http://localhost:4000';

const AdminUserManagement: React.FC = () => {
  // -------- User-Management State --------
  const [users, setUsers] = useState<User[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);
  const [userError, setUserError] = useState<string | null>(null);

  // -------- Kingdom-Management State --------
  const [kingdoms, setKingdoms] = useState<Kingdom[]>([]);
  const [isLoadingKingdoms, setIsLoadingKingdoms] = useState(true);
  const [kingdomError, setKingdomError] = useState<string | null>(null);

  const [newDisplayName, setNewDisplayName] = useState('');
  const [newSlug, setNewSlug] = useState('');
  const [newRokId, setNewRokId] = useState('');
  const [isCreatingKingdom, setIsCreatingKingdom] = useState(false);
  const [createKingdomError, setCreateKingdomError] = useState<string | null>(null);

  const { user: currentUser } = useAuth();

  // -------- Initial Load --------
  useEffect(() => {
    fetchUsers();
    fetchKingdoms();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // -------- Helper: Token holen --------
  const getTokenOrThrow = () => {
    const token = localStorage.getItem('authToken');
    if (!token) {
      throw new Error('Not signed in');
    }
    return token;
  };

  // ==================== USER-MANAGEMENT ====================

  const fetchUsers = async () => {
    setIsLoadingUsers(true);
    setUserError(null);
    try {
      const token = getTokenOrThrow();

      const response = await fetch(`${BACKEND_URL}/api/admin/users`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const userData: User[] = await response.json();
        setUsers(userData);
      } else if (response.status === 403) {
        setUserError('No admin privileges');
      } else {
        const errorText = await response.text();
        console.log('❌ Users fetch failed:', errorText);
        setUserError('Error loading users');
      }
    } catch (err) {
      console.error('💥 Error loading users:', err);
      setUserError('Could not load users');
    } finally {
      setIsLoadingUsers(false);
    }
  };

  const toggleApproval = async (userId: string, approved: boolean) => {
    try {
      const token = getTokenOrThrow();

      const response = await fetch(`${BACKEND_URL}/api/admin/users/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ userId, approved }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.log('❌ Approval toggle failed:', errorText);
        throw new Error('Failed to update approval');
      }

      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, isApproved: approved } : u))
      );
    } catch (err) {
      console.error('Error toggling approval:', err);
      alert('Error updating approval status.');
    }
  };

  const updateAccess = async (
    targetUser: User,
    changes: Partial<Pick<User, 'canAccessHonor' | 'canAccessAnalytics' | 'canAccessOverview'>>
  ) => {
    try {
      const token = getTokenOrThrow();

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
        throw new Error('Failed to update access rights');
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
    } catch (err) {
      console.error('Error updating access:', err);
      alert('Error updating access rights.');
    }
  };

  const updateRole = async (targetUser: User, newRole: UserRole) => {
    try {
      const token = getTokenOrThrow();

      const response = await fetch(`${BACKEND_URL}/api/admin/users/role`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ userId: targetUser.id, role: newRole }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.log('❌ Role update error:', errorText);
        throw new Error('Failed to update role');
      }

      setUsers((prev) =>
        prev.map((u) => (u.id === targetUser.id ? { ...u, role: newRole } : u))
      );
    } catch (err) {
      console.error('Error updating role:', err);
      alert('Error updating role.');
    }
  };

  const deleteUser = async (userId: string) => {
    if (
      !window.confirm(
        'Are you sure you want to delete this user? This cannot be undone.'
      )
    ) {
      return;
    }

    try {
      const token = getTokenOrThrow();

      const response = await fetch(`${BACKEND_URL}/api/admin/users/${userId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.log('❌ Delete user error:', errorText);
        throw new Error('Failed to delete user');
      }

      setUsers((prev) => prev.filter((u) => u.id !== userId));
    } catch (err) {
      console.error('Error deleting user:', err);
      alert('Error deleting user.');
    }
  };

  // ==================== KINGDOM-MANAGEMENT ====================

  const fetchKingdoms = async () => {
    setIsLoadingKingdoms(true);
    setKingdomError(null);
    try {
      const token = getTokenOrThrow();

      const response = await fetch(`${BACKEND_URL}/api/admin/kingdoms`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data: Kingdom[] = await response.json();
        setKingdoms(data);
      } else if (response.status === 403) {
        setKingdomError('No admin privileges');
      } else {
        const errorText = await response.text();
        console.log('❌ Kingdoms fetch failed:', errorText);
        setKingdomError('Error loading kingdoms');
      }
    } catch (err) {
      console.error('💥 Error loading kingdoms:', err);
      setKingdomError('Could not load kingdoms');
    } finally {
      setIsLoadingKingdoms(false);
    }
  };

  const normalizeSlug = (value: string) =>
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9\-]/g, '-');

  const handleCreateKingdom = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newDisplayName.trim()) {
      setCreateKingdomError('Display name is required');
      return;
    }

    const slug = newSlug.trim()
      ? normalizeSlug(newSlug)
      : normalizeSlug(newDisplayName);

    if (!slug) {
      setCreateKingdomError('Slug is required');
      return;
    }

    setIsCreatingKingdom(true);
    setCreateKingdomError(null);

    try {
      const token = getTokenOrThrow();

      const response = await fetch(`${BACKEND_URL}/api/admin/kingdoms`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          displayName: newDisplayName,
          slug,
          rokIdentifier: newRokId || null,
        }),
      });

      const text = await response.text();
      let json: any = null;
      try {
        json = JSON.parse(text);
      } catch {
        // ignore
      }

      if (!response.ok) {
        console.log('❌ Create kingdom error payload:', text);
        const msg =
          json?.error ||
          (response.status === 400
            ? 'Validation error while creating kingdom'
            : 'Failed to create kingdom');
        setCreateKingdomError(msg);
        return;
      }

      const created: Kingdom = json;
      setKingdoms((prev) => [created, ...prev]);

      // Felder leeren
      setNewDisplayName('');
      setNewSlug('');
      setNewRokId('');
    } catch (err) {
      console.error('Error creating kingdom:', err);
      setCreateKingdomError('Unexpected error while creating kingdom');
    } finally {
      setIsCreatingKingdom(false);
    }
  };

  // ==================== RENDER ====================

  const canManageUsers =
    currentUser?.role === 'admin' || currentUser?.role === 'r5';
  const canManageKingdoms = canManageUsers; // gleiche Rechte-Basis

  return (
    <div className="space-y-6">
      {/* USER MANAGEMENT */}
      <Card className="p-6">
        <h2 className="text-2xl font-bold text-white mb-6">User Management</h2>

        {userError && (
          <div className="mb-4 text-sm text-red-400 bg-red-900/30 border border-red-700 px-3 py-2 rounded">
            {userError}
          </div>
        )}

        {!canManageUsers && (
          <p className="text-sm text-yellow-400 mb-4">
            You do not have permission to manage users.
          </p>
        )}

        {isLoadingUsers ? (
          <p className="text-gray-300">Loading users...</p>
        ) : (
          <>
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
                {users.map((user) => {
                  const isSelf = user.id === currentUser?.id;
                  const isAdminUser = user.role === 'admin';

                  return (
                    <TableRow key={user.id}>
                      <TableCell align="left" className="font-medium text-white">
                        {user.username}
                        {isSelf && (
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
                        {user.createdAt
                          ? new Date(user.createdAt).toLocaleDateString('en-GB')
                          : '—'}
                      </TableCell>

                      {/* ROLE */}
                      <TableCell align="center">
                        {!canManageUsers || isSelf || isAdminUser ? (
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
                          disabled={!canManageUsers || isAdminUser}
                          onClick={() =>
                            updateAccess(user, {
                              canAccessHonor: !user.canAccessHonor,
                            })
                          }
                          className={`px-2 py-1 rounded text-xs font-semibold ${
                            user.canAccessHonor
                              ? 'bg-green-600 text-white'
                              : 'bg-gray-700 text-gray-300'
                          } ${
                            !canManageUsers || isAdminUser
                              ? 'opacity-50 cursor-not-allowed'
                              : ''
                          }`}
                        >
                          {user.canAccessHonor ? 'Yes' : 'No'}
                        </button>
                      </TableCell>

                      {/* Access: Analytics */}
                      <TableCell align="center">
                        <button
                          disabled={!canManageUsers || isAdminUser}
                          onClick={() =>
                            updateAccess(user, {
                              canAccessAnalytics: !user.canAccessAnalytics,
                            })
                          }
                          className={`px-2 py-1 rounded text-xs font-semibold ${
                            user.canAccessAnalytics
                              ? 'bg-green-600 text-white'
                              : 'bg-gray-700 text-gray-300'
                          } ${
                            !canManageUsers || isAdminUser
                              ? 'opacity-50 cursor-not-allowed'
                              : ''
                          }`}
                        >
                          {user.canAccessAnalytics ? 'Yes' : 'No'}
                        </button>
                      </TableCell>

                      {/* Access: Overview */}
                      <TableCell align="center">
                        <button
                          disabled={!canManageUsers || isAdminUser}
                          onClick={() =>
                            updateAccess(user, {
                              canAccessOverview: !user.canAccessOverview,
                            })
                          }
                          className={`px-2 py-1 rounded text-xs font-semibold ${
                            user.canAccessOverview
                              ? 'bg-green-600 text-white'
                              : 'bg-gray-700 text-gray-300'
                          } ${
                            !canManageUsers || isAdminUser
                              ? 'opacity-50 cursor-not-allowed'
                              : ''
                          }`}
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
                        {canManageUsers && !isSelf && !isAdminUser ? (
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
                              onClick={() => deleteUser(user.id)}
                              className="bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700 transition-colors text-sm"
                            >
                              Delete
                            </button>
                          </div>
                        ) : (
                          <span className="text-gray-500 text-xs">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </tbody>
            </Table>

            {users.length === 0 && !isLoadingUsers && (
              <div className="text-center text-gray-400 py-4">
                No users found
              </div>
            )}
          </>
        )}
      </Card>

      {/* KINGDOM MANAGEMENT */}
      <Card className="p-6">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6">
          <div>
            <h2 className="text-2xl font-bold text-white mb-2">
              Kingdom Management
            </h2>
            <p className="text-sm text-gray-400">
              Manage Rise of Kingdoms kingdoms, slugs and RoK IDs. Each slug
              will later map to its own URL (e.g.
              <span className="text-blue-300"> /k/3619-vikings</span>).
            </p>
          </div>
        </div>

        {kingdomError && (
          <div className="mb-4 text-sm text-red-400 bg-red-900/30 border border-red-700 px-3 py-2 rounded">
            {kingdomError}
          </div>
        )}

        {isLoadingKingdoms ? (
          <p className="text-gray-300 mb-4">Loading kingdoms...</p>
        ) : kingdoms.length === 0 ? (
          <p className="text-gray-400 mb-4">No kingdoms created yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <tr>
                <TableCell align="left" header>
                  Name
                </TableCell>
                <TableCell align="left" header>
                  Slug
                </TableCell>
                <TableCell align="center" header>
                  RoK ID
                </TableCell>
                <TableCell align="center" header>
                  Plan
                </TableCell>
                <TableCell align="center" header>
                  Status
                </TableCell>
                <TableCell align="center" header>
                  Created
                </TableCell>
              </tr>
            </TableHeader>
            <tbody>
              {kingdoms.map((k) => (
                <TableRow key={k.id}>
                  <TableCell align="left" className="font-medium text-white">
                    {k.displayName}
                  </TableCell>
                  <TableCell align="left">
                    <span className="font-mono text-xs text-blue-300">
                      {k.slug}
                    </span>
                  </TableCell>
                  <TableCell align="center">
                    {k.rokIdentifier || <span className="text-gray-500">—</span>}
                  </TableCell>
                  <TableCell align="center">
                    <span className="text-xs uppercase text-gray-300">
                      {k.plan || 'free'}
                    </span>
                  </TableCell>
                  <TableCell align="center">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-semibold ${
                        k.status === 'active'
                          ? 'bg-green-500 text-white'
                          : 'bg-gray-600 text-white'
                      }`}
                    >
                      {k.status}
                    </span>
                  </TableCell>
                  <TableCell align="center">
                    {k.createdAt
                      ? new Date(k.createdAt).toLocaleDateString('en-GB')
                      : '—'}
                  </TableCell>
                </TableRow>
              ))}
            </tbody>
          </Table>
        )}

        {/* Create Kingdom Form */}
        <div className="mt-6 border-t border-gray-700 pt-4">
          <h3 className="text-lg font-semibold text-white mb-3">
            Create new Kingdom
          </h3>
          {!canManageKingdoms && (
            <p className="text-sm text-yellow-400 mb-2">
              You do not have permission to create kingdoms.
            </p>
          )}

          <form
            onSubmit={handleCreateKingdom}
            className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end"
          >
            <div>
              <label className="block text-xs text-gray-400 mb-1">
                Display Name
              </label>
              <input
                type="text"
                value={newDisplayName}
                onChange={(e) => setNewDisplayName(e.target.value)}
                className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1 text-sm text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="Kingdom 3619 - Vikings"
                disabled={!canManageKingdoms || isCreatingKingdom}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">
                Slug (optional)
              </label>
              <input
                type="text"
                value={newSlug}
                onChange={(e) => setNewSlug(e.target.value)}
                className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1 text-sm text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="3619-vikings"
                disabled={!canManageKingdoms || isCreatingKingdom}
              />
              <p className="text-[10px] text-gray-500 mt-1">
                Will be auto-generated from display name if left empty.
              </p>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">
                RoK Kingdom ID (optional)
              </label>
              <input
                type="text"
                value={newRokId}
                onChange={(e) => setNewRokId(e.target.value)}
                className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1 text-sm text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="3619"
                disabled={!canManageKingdoms || isCreatingKingdom}
              />
            </div>
            <div className="flex flex-col items-stretch md:items-end gap-2">
              <button
                type="submit"
                disabled={
                  !canManageKingdoms ||
                  isCreatingKingdom ||
                  !newDisplayName.trim()
                }
                className={`px-4 py-2 rounded text-sm font-semibold ${
                  !canManageKingdoms
                    ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                {isCreatingKingdom ? 'Creating...' : 'Create Kingdom'}
              </button>
              {createKingdomError && (
                <p className="text-xs text-red-400">{createKingdomError}</p>
              )}
            </div>
          </form>
        </div>
      </Card>
    </div>
  );
};

export default AdminUserManagement;
