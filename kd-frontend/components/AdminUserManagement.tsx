// AdminUserManagement.tsx
import React, { useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { Card } from './Card';
import { useTable, Column } from 'react-table';
import { Table } from './Table';
import { ColumnFilter } from './ColumnFilter';
import { fetchWrapper } from '../utils'; // Assuming this utility exists

const BACKEND_URL =
  process.env.NODE_ENV === 'production'
    ? 'https://api.rise-of-stats.com'
    : 'http://localhost:4000';

type UserRole = 'user' | 'r4' | 'r5' | 'admin';
type UserAccess = 'canAccessHonor' | 'canAccessAnalytics' | 'canAccessOverview';

interface UserData {
  id: string;
  email: string;
  username: string;
  isApproved: boolean;
  role: UserRole;
  createdAt: string;
  kingdomId: string | null;
  governorId: string | null;
  canAccessHonor: boolean;
  canAccessAnalytics: boolean;
  canAccessOverview: boolean;
}

interface KingdomData {
  id: string;
  displayName: string;
  slug: string;
  rokIdentifier: string;
  status: string;
  plan: string;
  createdAt: string;
  ownerUserId: string;
  ownerUsername: string;
  ownerEmail: string;
}

const AdminUserManagement: React.FC = () => {
  const { user, refreshUser } = useAuth();
  const [users, setUsers] = useState<UserData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  // 🆕 NEU: States für Kingdom-Info und Invite-Link
  const [kingdomSlug, setKingdomSlug] = useState<string | null>(null);
  const [kingdomDisplayName, setKingdomDisplayName] = useState<string | null>(null);
  const [inviteLink, setInviteLink] = useState<string | null>(null);

  const isAdmin = user?.role === 'admin' || user?.role === 'r5';
  const isSuperAdmin = user?.role === 'admin';

  // ==================== FETCH DATA ====================

  const fetchKingdomData = async () => {
    if (!user || !isAdmin) return;

    try {
      // Holt die Kingdoms, zu denen der User Admin/R5 Rechte hat (für R5 nur sein zugewiesenes Kingdom)
      const response = await fetchWrapper(`${BACKEND_URL}/api/admin/kingdoms`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('authToken')}` },
      });
      const data: KingdomData[] = await response.json();
      
      if (data && data.length > 0) {
        const primaryKingdom = data[0];
        setKingdomSlug(primaryKingdom.slug);
        
        // Verwende Slug als Fallback, falls DisplayName fehlt
        const displayName = primaryKingdom.displayName && primaryKingdom.displayName.trim() ? primaryKingdom.displayName : primaryKingdom.slug.toUpperCase();
        setKingdomDisplayName(displayName);

        // Erstellen des Invite Links mit dem neuen Query-Parameter
        // Beispiel: https://your-app.com/?slug=koenigreich-slug&register=true
        const hostname = window.location.origin;
        const newInviteLink = `${hostname}/?slug=${primaryKingdom.slug}&register=true`;
        setInviteLink(newInviteLink);
      }
    } catch (err: any) {
      console.error('Error fetching kingdom data:', err);
      // Fehler wird ignoriert, wenn kein Slug gefunden wird (z.B. für Superadmin ohne zugewiesenes Kingdom)
    }
  };

  const fetchUsers = async () => {
    if (!user || !isAdmin) return;

    setIsLoading(true);
    setError(null);
    try {
      const response = await fetchWrapper(`${BACKEND_URL}/api/admin/users`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('authToken')}` },
      });
      const data: UserData[] = await response.json();
      setUsers(data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch users');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
    // 🆕 Kingdom-Daten beim Laden abrufen
    fetchKingdomData();
  }, [user]);

  // ==================== ACTIONS ====================

  const handleApproveToggle = async (userId: string, approved: boolean) => {
    setMessage(null);
    try {
      const response = await fetchWrapper(`${BACKEND_URL}/api/admin/users/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('authToken')}` },
        body: JSON.stringify({ userId, approved }),
      });
      if (response.success) {
        setMessage(`User ${approved ? 'approved' : 'unapproved'} successfully.`);
        fetchUsers();
        if (userId === user?.id) refreshUser();
      }
    } catch (err: any) {
      setError(err.message || 'Failed to change approval status');
    }
  };
  
  const handleRoleChange = async (userId: string, newRole: UserRole) => {
    setMessage(null);
    try {
      const response = await fetchWrapper(`${BACKEND_URL}/api/admin/users/role`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('authToken')}` },
        body: JSON.stringify({ userId, role: newRole }),
      });
      if (response.success) {
        setMessage(`User role changed to ${newRole} successfully.`);
        fetchUsers();
        if (userId === user?.id) refreshUser();
      }
    } catch (err: any) {
      setError(err.message || 'Failed to change user role');
    }
  };

  const handleAccessChange = async (userId: string, key: UserAccess, value: boolean) => {
    setMessage(null);
    const targetUser = users.find(u => u.id === userId);
    if (!targetUser) return;

    const newAccess = {
        canAccessHonor: targetUser.canAccessHonor,
        canAccessAnalytics: targetUser.canAccessAnalytics,
        canAccessOverview: targetUser.canAccessOverview,
        [key]: value
    };

    try {
        const response = await fetchWrapper(`${BACKEND_URL}/api/admin/users/access`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('authToken')}` },
            body: JSON.stringify({ userId, ...newAccess }),
        });
        if (response.success) {
            setMessage(`User access updated successfully.`);
            fetchUsers();
            if (userId === user?.id) refreshUser();
        }
    } catch (err: any) {
        setError(err.message || 'Failed to update user access');
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!window.confirm('Are you sure you want to delete this user?')) return;
    setMessage(null);
    try {
        const response = await fetchWrapper(`${BACKEND_URL}/api/admin/users/${userId}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${localStorage.getItem('authToken')}` },
        });
        if (response.success) {
            setMessage('User deleted successfully.');
            fetchUsers();
        }
    } catch (err: any) {
        setError(err.message || 'Failed to delete user');
    }
  };

  // 🆕 NEU: Funktion zum Kopieren des Links
  const handleCopyInviteLink = () => {
    if (inviteLink) {
      navigator.clipboard.writeText(inviteLink).then(() => {
        setMessage('Einladungslink wurde in die Zwischenablage kopiert!');
        setTimeout(() => setMessage(null), 3000);
      }).catch(err => {
        setError('Kopieren fehlgeschlagen.');
      });
    }
  };

  // ==================== TABLE SETUP ====================

  const columns: Column<UserData>[] = React.useMemo(
    () => [
      { Header: 'Username', accessor: 'username', Filter: ColumnFilter },
      { Header: 'Email', accessor: 'email', Filter: ColumnFilter },
      { Header: 'Gov ID', accessor: 'governorId', Filter: ColumnFilter },
      {
        Header: 'Role',
        accessor: 'role',
        Filter: ColumnFilter,
        Cell: ({ row: { original: u } }) => (
          <select
            value={u.role}
            onChange={(e) => handleRoleChange(u.id, e.target.value as UserRole)}
            disabled={u.id === user?.id || u.role === 'admin' || (!isSuperAdmin && u.role === 'r5' && u.id !== user?.id)}
            className="p-1 bg-gray-700 border border-gray-600 rounded text-sm disabled:opacity-50"
          >
            <option value="user">User</option>
            <option value="r4">R4</option>
            <option value="r5">R5</option>
            {isSuperAdmin && <option value="admin">Admin</option>}
          </select>
        ),
      },
      {
        Header: 'Approved',
        accessor: 'isApproved',
        Filter: ColumnFilter,
        Cell: ({ row: { original: u } }) => (
          <input
            type="checkbox"
            checked={u.isApproved}
            onChange={(e) => handleApproveToggle(u.id, e.target.checked)}
            disabled={u.id === user?.id || u.role === 'admin' || (!isSuperAdmin && u.role === 'r5' && u.id !== user?.id)}
            className="form-checkbox h-4 w-4 text-blue-600 transition duration-150 ease-in-out bg-gray-700 border-gray-600 rounded"
          />
        ),
      },
      // Access columns
      {
        Header: 'Honor Access',
        accessor: 'canAccessHonor',
        Filter: ColumnFilter,
        Cell: ({ row: { original: u } }) => (
          <input
            type="checkbox"
            checked={u.canAccessHonor}
            onChange={(e) => handleAccessChange(u.id, 'canAccessHonor', e.target.checked)}
            disabled={u.id === user?.id || u.role === 'admin' || (!isSuperAdmin && u.role === 'r5' && u.id !== user?.id) || (u.role === 'user' && !u.isApproved && !isSuperAdmin)}
            className="form-checkbox h-4 w-4 text-amber-500 transition duration-150 ease-in-out bg-gray-700 border-gray-600 rounded"
          />
        ),
      },
      {
        Header: 'Analytics Access',
        accessor: 'canAccessAnalytics',
        Filter: ColumnFilter,
        Cell: ({ row: { original: u } }) => (
          <input
            type="checkbox"
            checked={u.canAccessAnalytics}
            onChange={(e) => handleAccessChange(u.id, 'canAccessAnalytics', e.target.checked)}
            disabled={u.id === user?.id || u.role === 'admin' || (!isSuperAdmin && u.role === 'r5' && u.id !== user?.id) || (u.role === 'user' && !u.isApproved && !isSuperAdmin)}
            className="form-checkbox h-4 w-4 text-emerald-500 transition duration-150 ease-in-out bg-gray-700 border-gray-600 rounded"
          />
        ),
      },
      {
        Header: 'Overview Access',
        accessor: 'canAccessOverview',
        Filter: ColumnFilter,
        Cell: ({ row: { original: u } }) => (
          <input
            type="checkbox"
            checked={u.canAccessOverview}
            onChange={(e) => handleAccessChange(u.id, 'canAccessOverview', e.target.checked)}
            disabled={u.id === user?.id || u.role === 'admin' || (!isSuperAdmin && u.role === 'r5' && u.id !== user?.id) || (u.role === 'user' && !u.isApproved && !isSuperAdmin)}
            className="form-checkbox h-4 w-4 text-blue-500 transition duration-150 ease-in-out bg-gray-700 border-gray-600 rounded"
          />
        ),
      },
      {
        Header: 'Actions',
        id: 'actions',
        Cell: ({ row: { original: u } }) => (
          <button
            onClick={() => handleDeleteUser(u.id)}
            disabled={u.id === user?.id || u.role === 'admin' || (!isSuperAdmin && u.role === 'r5' && u.id !== user?.id)}
            className="text-xs p-1 bg-red-800 hover:bg-red-700 rounded disabled:opacity-50"
          >
            Delete
          </button>
        ),
      },
    ],
    [user, isSuperAdmin, kingdomDisplayName]
  );

  const {
    getTableProps,
    getTableBodyProps,
    headerGroups,
    rows,
    prepareRow,
  } = useTable({ columns, data: users }, (hooks) => {
    hooks.visibleColumns.push((columns) => [
      ...columns,
      { Header: 'Actions', id: 'actions' },
    ]);
  });

  if (!isAdmin) {
    return <p className="text-red-500">Access Denied.</p>;
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-white">
        {isSuperAdmin ? 'Superadmin User & Kingdom Management' : `R5 User Management for ${kingdomDisplayName || 'Your Kingdom'}`}
      </h2>

      {/* 🆕 NEU: Invite Link Sektion */}
      {inviteLink && (
        <Card className="p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center bg-purple-900/30 border-purple-700">
          <div>
            <p className="text-sm font-semibold text-purple-300 mb-1">Einladungslink für {kingdomDisplayName}:</p>
            <p className="text-xs break-all text-white bg-gray-800 p-2 rounded max-w-full sm:max-w-lg">
                {inviteLink}
            </p>
          </div>
          <button
            onClick={handleCopyInviteLink}
            className="mt-3 sm:mt-0 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm"
          >
            Link kopieren
          </button>
        </Card>
      )}

      {error && <div className="p-3 bg-red-900/30 border border-red-700 text-red-400 rounded">{error}</div>}
      {message && <div className="p-3 bg-green-900/30 border border-green-700 text-green-400 rounded">{message}</div>}

      <Card className="p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Users</h3>
        {isLoading ? (
          <p className="text-gray-400">Loading users...</p>
        ) : (
          <Table
            getTableProps={getTableProps}
            getTableBodyProps={getTableBodyProps}
            headerGroups={headerGroups}
            rows={rows}
            prepareRow={prepareRow}
          />
        )}
      </Card>
      
      {/* Optional: Kingdom Management Section for Superadmin */}
      {isSuperAdmin && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-white">Kingdoms Management (TODO)</h3>
          <p className="text-gray-400 text-sm mt-2">Superadmin-Funktionen zur Verwaltung von Königreichen.</p>
        </Card>
      )}
    </div>
  );
};

export default AdminUserManagement;