// AdminUserManagement.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { Card } from './Card';
import { Table, TableHeader, TableRow, TableCell } from './Table';
import { useAuth } from './AuthContext';
// 📝 Importiere Kingdom-Interface aus types.ts 
import { Kingdom as KingdomType } from '../types'; 

type UserRole = 'user' | 'r4' | 'r5' | 'admin';

// 📝 ERWEITERT: User-Interface um kingdomId
interface User {
  id: string;
  email: string;
  username: string;
  isApproved: boolean;
  role: UserRole;
  createdAt: string;
  governorId?: string | null;
  kingdomId?: string | null; // NEU
  canAccessHonor?: boolean;
  canAccessAnalytics?: boolean;
  canAccessOverview?: boolean;
}

type Kingdom = KingdomType;

// 🌐 BACKEND_URL
const BACKEND_URL =
  process.env.NODE_ENV === 'production'
    ? 'https://api.rise-of-stats.com'
    : 'http://localhost:4000';
    
// 🌐 NEU: Frontend URL für den Link
const FRONTEND_URL = 
  process.env.NODE_ENV === 'production'
    ? 'https://rise-of-stats.com'
    : 'http://localhost:5173';


const AdminUserManagement: React.FC = () => {
  // -------- User-Management State --------
  const [users, setUsers] = useState<User[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);
  const [userError, setUserError] = useState<string | null>(null);

  // -------- Kingdom-Management State --------
  const [kingdoms, setKingdoms] = useState<Kingdom[]>([]);
  const [isLoadingKingdoms, setIsLoadingKingdoms] = useState(true);
  const [kingdomError, setKingdomError] = useState<string | null>(null);

  // 🆕 NEU: States für Kingdom-Info und Invite-Link
  const [kingdomSlug, setKingdomSlug] = useState<string | null>(null);
  const [kingdomDisplayName, setKingdomDisplayName] = useState<string | null>(null);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  
  // -------- Create Kingdom State --------
  const [newDisplayName, setNewDisplayName] = useState('');
  const [newSlug, setNewSlug] = useState('');
  const [newRokId, setNewRokId] = useState('');
  const [isCreatingKingdom, setIsCreatingKingdom] = useState(false);
  const [createKingdomError, setCreateKingdomError] = useState<string | null>(null);
  
  // -------- Edit Kingdom State (Rename) --------
  const [editingKingdomId, setEditingKingdomId] = useState<string | null>(null);
  const [editDisplayName, setEditDisplayName] = useState('');
  const [editSlug, setEditSlug] = useState('');

  // 👑 NEU: R5 Assign State (Bestehend)
  const [r5UserId, setR5UserId] = useState<string>('');
  const [r5KingdomId, setR5KingdomId] = useState<string>('');
  const [isAssigningR5, setIsAssigningR5] = useState(false);
  const [assignR5Error, setAssignR5Error] = useState<string | null>(null);

  // 📝 NEU: R4 Assign State
  const [r4UserId, setR4UserId] = useState<string>('');
  const [r4KingdomId, setR4KingdomId] = useState<string>('');
  const [isAssigningR4, setIsAssigningR4] = useState(false);
  const [assignR4Error, setAssignR4Error] = useState<string | null>(null);


  const { user: currentUser, refreshUser } = useAuth();

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

  const fetchUsers = useCallback(async () => {
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
        setUserError('Error loading users. Server reported an issue.');
      }
    } catch (err) {
      console.error('💥 Error loading users:', err);
      setUserError('Could not load users');
    } finally {
      setIsLoadingUsers(false);
    }
  }, []); // Keine Abhängigkeiten

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
      if (currentUser?.id === userId) {
        refreshUser();
      }
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
      if (currentUser?.id === targetUser.id) {
        refreshUser();
      }
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
        const errorJson = JSON.parse(errorText || '{}');
        console.log('❌ Role update error:', errorText);
        throw new Error(errorJson.error || 'Failed to update role');
      }

      // Bei Erfolg: User-Liste neu laden, um korrekte kingdomId/role-Kombination zu bekommen
      fetchUsers(); 
      if (currentUser?.id === targetUser.id) {
        refreshUser();
      }
    } catch (err) {
      console.error('Error updating role:', err);
      alert(err instanceof Error ? err.message : 'Error updating role.');
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
        const errorJson = JSON.parse(errorText || '{}');
        console.log('❌ Delete user error:', errorText);
        throw new Error(errorJson.error || 'Failed to delete user');
      }

      setUsers((prev) => prev.filter((u) => u.id !== userId));
    } catch (err) {
      console.error('Error deleting user:', err);
      alert(err instanceof Error ? err.message : 'Error deleting user.');
    }
  };

  // ==================== KINGDOM-MANAGEMENT ====================

  const fetchKingdoms = useCallback(async () => {
    setIsLoadingKingdoms(true);
    setKingdomError(null);
    try {
      const token = getTokenOrThrow();

      const response = await fetch(`${BACKEND_URL}/api/admin/kingdoms`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data: Kingdom[] = await response.json();
        // Sortiere nach Name (case-insensitiv)
        data.sort((a, b) => a.displayName.localeCompare(b.displayName));
        setKingdoms(data);

        // 🆕 NEU: Setze Slug und DisplayName für den Invite Link des aktuellen Königreichs
        const isR5 = currentUser?.role === 'r5';
        const isSuperAdmin = currentUser?.role === 'admin';
        
        let targetKingdom: Kingdom | undefined;
        
        if (isR5 && currentUser?.kingdomId) {
             targetKingdom = data.find(k => k.id === currentUser.kingdomId);
        } else if (isSuperAdmin && data.length > 0) {
            // Superadmin: Wähle das Default-Kingdom oder das erste
            targetKingdom = data.find(k => k.slug === 'default-kingdom') || data[0];
        }

        if (targetKingdom) {
            setKingdomSlug(targetKingdom.slug);
            const displayName = targetKingdom.displayName && targetKingdom.displayName.trim() ? targetKingdom.displayName : targetKingdom.slug.toUpperCase();
            setKingdomDisplayName(displayName);
            
            // Generiere den Invite Link mit dem neuen &register=true Parameter
            const newInviteLink = `${FRONTEND_URL}/?slug=${targetKingdom.slug}&register=true`;
            setInviteLink(newInviteLink);
        } else {
            setKingdomSlug(null);
            setKingdomDisplayName(null);
            setInviteLink(null);
        }

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
  }, [currentUser]); // currentUser ist eine Abhängigkeit, um nach Login/Rollenwechsel zu aktualisieren

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

  // 🖊️ EDIT KINGDOM (Start/Cancel/Update)
  const startEditing = (k: Kingdom) => {
    setEditingKingdomId(k.id);
    setEditDisplayName(k.displayName);
    setEditSlug(k.slug);
  };

  const cancelEditing = () => {
    setEditingKingdomId(null);
    setEditDisplayName('');
    setEditSlug('');
  };

  const handleUpdateKingdomDetails = async (kingdomId: string) => {
    if (!editDisplayName.trim() || !editSlug.trim()) {
        alert("Display Name and Slug are required.");
        return;
    }

    const normalizedSlug = normalizeSlug(editSlug);

    try {
      const token = getTokenOrThrow();
      const res = await fetch(`${BACKEND_URL}/api/admin/kingdoms/${kingdomId}`, {
          method: 'PUT', 
          headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
              displayName: editDisplayName,
              slug: normalizedSlug,
          }),
      });

      const json = await res.json();
      if (!res.ok) {
          throw new Error(json.error || 'Failed to update kingdom.');
      }

      const updatedKingdom = json.kingdom || json; // Je nach Backend-Response-Format

      // State Update
      setKingdoms(prev => prev.map(k => k.id === kingdomId ? { ...k, ...updatedKingdom } : k));
      
      cancelEditing();
      alert(`Kingdom updated successfully.`);
    } catch (err: any) {
        console.error('Error updating kingdom:', err);
        alert(err.message || 'Error updating kingdom.');
    }
  };

  // 👑 NEU: R5 Zuweisung (auch für Owner Change)
  const handleAssignR5 = async (e: React.FormEvent) => {
    e.preventDefault();
    setAssignR5Error(null);
    if (!r5UserId || !r5KingdomId) return;

    setIsAssigningR5(true);
    try {
      const token = getTokenOrThrow();
      const res = await fetch(`${BACKEND_URL}/api/admin/kingdoms/${r5KingdomId}/assign-r5`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ r5UserId }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Failed to assign R5.');
      }

      // Backend sollte das Kingdom mit den neuen Owner-Daten zurückgeben
      const updatedKingdom = kingdoms.find(k => k.id === r5KingdomId) || json.kingdom; 
      
      // 1. Kingdom-Liste aktualisieren (owner info wird vom fetchKingdoms geholt)
      fetchKingdoms();
      
      // 2. User-Liste neu laden, um die Rolle und kingdomId des betroffenen Users zu aktualisieren
      fetchUsers();
      
      setR5UserId('');
      setR5KingdomId('');
      alert(`R5 successfully assigned to ${updatedKingdom?.displayName || 'Kingdom'}. User's role and Kingdom owner updated.`);
    } catch (err: any) {
      setAssignR5Error(err.message || 'An unexpected error occurred during R5 assignment.');
    } finally {
      setIsAssigningR5(false);
    }
  };
  
  // 📝 NEU: R4 Zuweisung
  const handleAssignR4 = async (e: React.FormEvent) => {
    e.preventDefault();
    setAssignR4Error(null);
    if (!r4UserId || !r4KingdomId) return;

    setIsAssigningR4(true);
    try {
      const token = getTokenOrThrow();
      // Nutzt den neuen Backend-Endpoint
      const res = await fetch(`${BACKEND_URL}/api/admin/users/assign-r4`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ userId: r4UserId, kingdomId: r4KingdomId }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Failed to assign R4.');
      }
      
      // State-Updates:
      fetchUsers(); 
      
      setR4UserId('');
      setR4KingdomId('');
      const assignedKingdom = kingdoms.find(k => k.id === r4KingdomId)?.displayName || r4KingdomId;
      alert(`R4 successfully assigned to ${assignedKingdom}.`);
    } catch (err: any) {
      setAssignR4Error(err.message || 'An unexpected error occurred during R4 assignment.');
    } finally {
      setIsAssigningR4(false);
    }
  };


  // 🔒 NEU: Kingdom Status ändern
  const handleUpdateKingdomStatus = async (kingdomId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
    if (!window.confirm(`Are you sure you want to set this kingdom to ${newStatus}?`)) {
        return;
    }
    
    // Optimistisches Update
    setKingdoms(currentKingdoms => currentKingdoms.map(k => k.id === kingdomId ? { ...k, status: newStatus } : k));
    setKingdomError(null);

    try {
        const token = getTokenOrThrow();
        const res = await fetch(`${BACKEND_URL}/api/admin/kingdoms/${kingdomId}/status`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ status: newStatus }),
        });

        const json = await res.json();
        if (!res.ok) {
            throw new Error(json.error || `Failed to set status to ${newStatus}.`);
        }
        
        // Bei Erfolg: State ist schon aktualisiert
    } catch (err: any) {
        // Bei Fehler: ursprünglichen Status wiederherstellen und Fehler anzeigen
        setKingdoms(currentKingdoms => currentKingdoms.map(k => k.id === kingdomId ? { ...k, status: currentStatus } : k));
        setKingdomError(err.message || 'An unexpected error occurred.');
    }
  };

  const handleDeleteKingdom = async (kingdomId: string, kingdomName: string) => {
    if (kingdomId === 'kdm-default') {
      alert('The Default Kingdom cannot be deleted.');
      return;
    }
    
    if (!window.confirm(`PERMANENTLY DELETE Kingdom ${kingdomName}? This will delete ALL associated files and reset all users associated with this kingdom. ARE YOU SURE?`)) {
        return;
    }
    
    // Optimistisches Update
    setKingdoms(currentKingdoms => currentKingdoms.filter(k => k.id !== kingdomId));
    setKingdomError(null);

    try {
        const token = getTokenOrThrow();
        const res = await fetch(`${BACKEND_URL}/api/admin/kingdoms/${kingdomId}`, {
            method: 'DELETE',
            headers: {
                Authorization: `Bearer ${token}`,
            },
        });

        const json = await res.json();
        if (!res.ok) {
            throw new Error(json.error || `Failed to delete kingdom ${kingdomName}.`);
        }
        
        // Benutzerliste neu laden, da Benutzer-Zuordnung zurückgesetzt wurde
        fetchUsers(); 

        // Bei Erfolg: Alert
        alert(`Kingdom ${kingdomName} successfully deleted.`);
    } catch (err: any) {
        // Bei Fehler: Kingdoms neu laden und Fehler anzeigen
        fetchKingdoms(); 
        setKingdomError(err.message || 'An unexpected error occurred during deletion.');
    }
  };
  
  // 🆕 NEU: Funktion zum Kopieren des Links
  const handleCopyInviteLink = () => {
    if (inviteLink) {
      // Nutzt das native Clipboard API
      navigator.clipboard.writeText(inviteLink).then(() => {
        alert('Einladungslink wurde in die Zwischenablage kopiert!');
      }).catch(err => {
        console.error('Kopieren fehlgeschlagen:', err);
        alert('Kopieren fehlgeschlagen. Bitte manuell kopieren.');
      });
    }
  };


  // ==================== RENDER ====================

  const canManageUsers = currentUser?.role === 'admin' || currentUser?.role === 'r5';
  const isSuperAdmin = currentUser?.role === 'admin';
  const canManageKingdoms = isSuperAdmin; // Nur Superadmin darf Königreiche erstellen/löschen/R5 zuweisen

  // 🚩 NEU: Bestimme, welche Rollen der aktuelle Benutzer vergeben darf
  const allowedRoles = isSuperAdmin ? ['user', 'r4', 'r5'] : ['user', 'r4'];
  const canAssignR5 = isSuperAdmin || currentUser?.role === 'r5';
  
  // 🆕 Neu: R5 darf auch den Link sehen
  const showInviteLinkCard = canManageUsers && !!inviteLink; 
  
  // Filtere Benutzer, die bereits Admin oder R5 sind, um sie nicht erneut zuzuweisen
  const assignableUsersR5 = users.filter(u => u.role !== 'admin' && u.role !== 'r5' && u.id !== currentUser?.id);
  // Filtere Benutzer, die bereits Admin oder R4/R5 sind, um sie nicht erneut zuzuweisen (R4 zu R4 Zuweisung ist redundant)
  const assignableUsersR4 = users.filter(u => u.role !== 'admin' && u.role !== 'r5' && u.role !== 'r4' && u.id !== currentUser?.id);

  return (
    <div className="space-y-6">
      {/* USER MANAGEMENT */}
      <Card className="p-6">
        <h2 className="text-2xl font-bold text-white mb-6">User Management</h2>

        {/* 🆕 NEU: Invite Link Sektion */}
        {showInviteLinkCard && (
          <Card className="p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center bg-purple-900/30 border-purple-700 mb-6">
            <div>
              <p className="text-sm font-semibold text-purple-300 mb-1">Einladungslink für {kingdomDisplayName || 'das Königreich'}:</p>
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
                    Kingdom
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
                  const userKingdom = kingdoms.find(k => k.id === user.kingdomId);

                  // R5/R4 darf keine Admin/Superadmin-Benutzer verwalten
                  const isManagementRestricted = isSelf || isAdminUser || (currentUser?.role === 'r5' && user.role === 'r5');


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
                        {!canManageUsers || isManagementRestricted ? (
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
                            {/* R5 kann Rolle selbst nur zuweisen, wenn Kingdom zugewiesen */}
                            {canAssignR5 && <option value="r5">R5</option>} 
                          </select>
                        )}
                      </TableCell>
                      
                      {/* KINGDOM ID/NAME */}
                      <TableCell align="left">
                        {userKingdom ? (
                          <span className="text-xs text-blue-300" title={userKingdom.displayName}>
                            {userKingdom.slug}
                          </span>
                        ) : (
                          <span className="text-gray-500 text-xs">—</span>
                        )}
                      </TableCell>


                      {/* Access: Honor */}
                      <TableCell align="center">
                        <button
                          disabled={!canManageUsers || isManagementRestricted}
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
                            !canManageUsers || isManagementRestricted
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
                          disabled={!canManageUsers || isManagementRestricted}
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
                            !canManageUsers || isManagementRestricted
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
                          disabled={!canManageUsers || isManagementRestricted}
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
                            !canManageUsers || isManagementRestricted
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
                        {canManageUsers && !isManagementRestricted ? (
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

      {/* KINGDOM MANAGEMENT SECTIONS (NUR SICHTBAR FÜR isSuperAdmin) */}
      {isSuperAdmin && (
        <>
          {/* KINGDOM ASSIGNMENT FORMS */}
          <div className="space-y-6">

            {/* 👑 ASSIGN R5 (sets owner) */}
            <Card className="p-6 bg-yellow-900/30 border-yellow-700">
                <h3 className="text-lg font-semibold text-yellow-200 mb-4">
                    👑 Assign R5 Role & Kingdom Owner
                </h3>
                <form onSubmit={handleAssignR5} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                    {/* User Select */}
                    <div className="flex flex-col md:col-span-2">
                      <label htmlFor="r5-user-select" className="text-xs text-gray-400 mb-1">
                        Select User (will become R5 and Owner)
                      </label>
                      <select
                        id="r5-user-select"
                        value={r5UserId}
                        onChange={(e) => setR5UserId(e.target.value)}
                        className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1 text-sm text-gray-100 focus:outline-none focus:ring-1 focus:ring-yellow-500 h-9"
                        required
                        disabled={isAssigningR5 || isLoadingUsers || assignableUsersR5.length === 0}
                      >
                        <option value="">Select User...</option>
                        {assignableUsersR5.map((user) => (
                          <option key={user.id} value={user.id}>
                            {user.username} ({user.role}) - {user.email}
                          </option>
                        ))}
                      </select>
                       {assignableUsersR5.length === 0 && <p className='text-xs text-gray-500 mt-1'>No suitable users (must not be Admin/R5).</p>}
                    </div>

                    {/* Kingdom Select */}
                    <div className="flex flex-col">
                      <label htmlFor="r5-kingdom-select" className="text-xs text-gray-400 mb-1">
                        Select Kingdom
                      </label>
                      <select
                        id="r5-kingdom-select"
                        value={r5KingdomId}
                        onChange={(e) => setR5KingdomId(e.target.value)}
                        className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1 text-sm text-gray-100 focus:outline-none focus:ring-1 focus:ring-yellow-500 h-9"
                        required
                        disabled={isAssigningR5 || isLoadingKingdoms}
                      >
                        <option value="">Select Kingdom...</option>
                        {kingdoms.map((k) => (
                          <option key={k.id} value={k.id}>
                            {k.displayName} ({k.slug})
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Submit */}
                    <div className="flex flex-col justify-end">
                      <button
                        type="submit"
                        disabled={isAssigningR5 || !r5UserId || !r5KingdomId}
                        className={`px-4 py-2 rounded text-sm font-semibold h-9 ${
                          !r5UserId || !r5KingdomId || isAssigningR5
                            ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                            : 'bg-yellow-600 text-white hover:bg-yellow-700 transition-colors'
                        }`}
                      >
                        {isAssigningR5 ? 'Assigning...' : 'Assign R5 & Set Owner'}
                      </button>
                    </div>
                  </div>
                  {assignR5Error && (
                    <p className="text-xs text-red-400 mt-2">{assignR5Error}</p>
                  )}
                </form>
            </Card>

            {/* 📝 NEU: ASSIGN R4 (Superadmin) */}
            <Card className="p-6 bg-blue-900/30 border-blue-700">
                <h3 className="text-lg font-semibold text-blue-200 mb-4">
                    🛠️ Assign R4 Role to Kingdom
                </h3>
                <form onSubmit={handleAssignR4} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                    {/* User Select */}
                    <div className="flex flex-col md:col-span-2">
                      <label htmlFor="r4-user-select" className="text-xs text-gray-400 mb-1">
                        Select User (will become R4)
                      </label>
                      <select
                        id="r4-user-select"
                        value={r4UserId}
                        onChange={(e) => setR4UserId(e.target.value)}
                        className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1 text-sm text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500 h-9"
                        required
                        disabled={isAssigningR4 || isLoadingUsers || assignableUsersR4.length === 0}
                      >
                        <option value="">Select User...</option>
                        {assignableUsersR4.map((user) => (
                          <option key={user.id} value={user.id}>
                            {user.username} ({user.role}) - {user.email}
                          </option>
                        ))}
                      </select>
                      {assignableUsersR4.length === 0 && <p className='text-xs text-gray-500 mt-1'>No suitable users (must not be Admin/R5/R4).</p>}
                    </div>

                    {/* Kingdom Select */}
                    <div className="flex flex-col">
                      <label htmlFor="r4-kingdom-select" className="text-xs text-gray-400 mb-1">
                        Select Kingdom
                      </label>
                      <select
                        id="r4-kingdom-select"
                        value={r4KingdomId}
                        onChange={(e) => setR4KingdomId(e.target.value)}
                        className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1 text-sm text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500 h-9"
                        required
                        disabled={isAssigningR4 || isLoadingKingdoms}
                      >
                        <option value="">Select Kingdom...</option>
                        {kingdoms.map((k) => (
                          <option key={k.id} value={k.id}>
                            {k.displayName} ({k.slug})
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Submit */}
                    <div className="flex flex-col justify-end">
                      <button
                        type="submit"
                        disabled={isAssigningR4 || !r4UserId || !r4KingdomId}
                        className={`px-4 py-2 rounded text-sm font-semibold h-9 ${
                          !r4UserId || !r4KingdomId || isAssigningR4
                            ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                            : 'bg-blue-600 text-white hover:bg-blue-700 transition-colors'
                        }`}
                      >
                        {isAssigningR4 ? 'Assigning...' : 'Assign R4 Role'}
                      </button>
                    </div>
                  </div>
                  {assignR4Error && (
                    <p className="text-xs text-red-400 mt-2">{assignR4Error}</p>
                  )}
                </form>
            </Card>


            {/* KINGDOM MANAGEMENT: LIST AND ACTIONS */}
            <Card className="p-6">
              <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-white mb-2">
                    Kingdom Management
                  </h2>
                  <p className="text-sm text-gray-400">
                    Manage Rise of Kingdoms kingdoms, slugs and RoK IDs. Each slug
                    will later map to its own URL (z.B.
                    <span className="text-blue-300"> {FRONTEND_URL}/?slug=3619-vikings</span>).
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
                      <TableCell align="left" header>
                        Owner (R5)
                      </TableCell>
                      {/* 🌐 NEU: Public Link Spalte */}
                      {isSuperAdmin && <TableCell align="left" header>Public Link</TableCell>}
                      <TableCell align="center" header>
                        Status
                      </TableCell>
                      <TableCell align="center" header>
                        Actions
                      </TableCell>
                    </tr>
                  </TableHeader>
                  <tbody>
                    {kingdoms.map((k) => {
                      const publicLink = `${FRONTEND_URL}/?slug=${k.slug}`;
                      const fullAccessLink = `${publicLink}`; // Superadmin nutzt den gleichen Link
                      const isEditing = editingKingdomId === k.id;

                      return (
                      <TableRow key={k.id}>
                        
                        {/* NAME CELL (Editable) */}
                        <TableCell align="left" className="font-medium text-white">
                          {isEditing ? (
                              <input
                                  type="text"
                                  value={editDisplayName}
                                  onChange={(e) => setEditDisplayName(e.target.value)}
                                  className="bg-gray-800 text-white border border-gray-600 rounded px-2 py-1 text-xs w-full"
                              />
                          ) : (
                              k.displayName
                          )}
                        </TableCell>

                        {/* SLUG CELL (Editable) */}
                        <TableCell align="left">
                          {isEditing ? (
                              <input
                                  type="text"
                                  value={editSlug}
                                  onChange={(e) => setEditSlug(e.target.value)}
                                  className="bg-gray-800 text-blue-300 border border-gray-600 rounded px-2 py-1 text-xs font-mono w-full"
                              />
                          ) : (
                              <span className="font-mono text-xs text-blue-300">
                                  {k.slug}
                              </span>
                          )}
                        </TableCell>

                        {/* Owner/R5 anzeigen */}
                        <TableCell align="left">
                          {k.ownerUsername ? (
                            <span className="text-xs text-green-300" title={k.ownerEmail || undefined}>
                              {k.ownerUsername}
                            </span>
                          ) : (
                            <span className="text-gray-500 text-xs">—</span>
                          )}
                        </TableCell>

                        {/* 🌐 NEU: Public Link Anzeige */}
                        {isSuperAdmin && (
                          <TableCell align="left">
                              <a
                                  href={fullAccessLink} // Link führt zur App mit Slug-Parameter
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs text-blue-400 hover:text-blue-300 underline truncate block max-w-xs"
                                  title={fullAccessLink}
                              >
                                  {`Open KD (${k.slug})`}
                              </a>
                          </TableCell>
                        )}

                        {/* Status anzeigen */}
                        <TableCell align="center">
                          <span
                            className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                              k.status === 'active'
                                ? 'bg-green-700 text-white'
                                : 'bg-red-700 text-white'
                            }`}
                          >
                            {k.status.toUpperCase()}
                          </span>
                        </TableCell>

                        {/* Actions */}
                        <TableCell align="center" className="space-x-2 whitespace-nowrap">
                          {canManageKingdoms && k.id !== 'kdm-default' && (
                            <>
                              {isEditing ? (
                                  // SAVE / CANCEL Buttons
                                  <>
                                      <button
                                          onClick={() => handleUpdateKingdomDetails(k.id)}
                                          className="px-3 py-1 text-xs font-semibold rounded bg-green-600 hover:bg-green-700 text-white transition-colors"
                                      >
                                          Save
                                      </button>
                                      <button
                                          onClick={cancelEditing}
                                          className="px-3 py-1 text-xs font-semibold rounded bg-gray-600 hover:bg-gray-500 text-white transition-colors"
                                      >
                                          Cancel
                                      </button>
                                  </>
                              ) : (
                                  // EDIT / STATUS / DELETE Buttons
                                  <>
                                      <button
                                          onClick={() => startEditing(k)}
                                          className="px-3 py-1 text-xs font-semibold rounded bg-blue-600 hover:bg-blue-700 text-white transition-colors"
                                      >
                                          Edit
                                      </button>
                                      <button
                                          onClick={() => handleUpdateKingdomStatus(k.id, k.status)}
                                          className={`px-3 py-1 text-xs font-semibold rounded transition-colors ${
                                              k.status === 'active'
                                                ? 'bg-red-600 hover:bg-red-700 text-white'
                                                : 'bg-green-600 hover:bg-green-700 text-white'
                                          }`}
                                          title={k.status === 'active' ? 'Set Kingdom to Inactive' : 'Set Kingdom to Active (re-enable access)'}
                                      >
                                          {k.status === 'active' ? 'Set Inactive' : 'Set Active'}
                                      </button>
                                      <button
                                          onClick={() => handleDeleteKingdom(k.id, k.displayName)}
                                          className="px-3 py-1 text-xs font-semibold rounded bg-gray-600 hover:bg-red-500 text-white transition-colors"
                                          title="Permanently delete kingdom, files, and reset users"
                                      >
                                          Delete
                                      </button>
                                  </>
                              )}
                            </>
                          )}
                          {k.id === 'kdm-default' && (
                            <span className='text-gray-500 text-xs'>System Default</span>
                          )}
                        </TableCell>
                      </TableRow>
                      );
                    })}
                  </tbody>
                </Table>
              )}

              {/* Create Kingdom Form (Admin Only) */}
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
        </>
      )}
    </div>
  );
};

export default AdminUserManagement;