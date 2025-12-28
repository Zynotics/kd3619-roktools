import React, { useEffect, useMemo, useState } from 'react';
import { Card } from './Card';
import { Kingdom, R5Code } from '../types';
import {
  API_BASE_URL,
  fetchAdminR5ShopVisibility,
  updateAdminR5ShopVisibility,
  activateAdminR5Code,
  createAdminR5Code,
  fetchAdminR5Codes,
  deleteAdminR5Code,
  deactivateAdminR5Code,
} from '../api';
import { useAuth } from './AuthContext';

type UserSummary = {
  id: string;
  username: string;
  role: string;
  email?: string;
  kingdomId?: string | null;
};

const durationLabel = (days: number) => {
  if (days === 0) return 'Lifetime';
  if (days === 1) return '1 day';
  if (days === 7) return '7 days';
  if (days === 14) return '14 days';
  if (days === 30) return '30 days';
  if (days === 60) return '60 days';
  if (days >= 365) return '1 year';
  return `${days} days`;
};

const formatDate = (value?: string | null) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
};

const statusMeta = (code: R5Code) => {
  if (!code.isActive) return { label: 'Unused', color: 'bg-gray-800 text-gray-200' };
  if (code.expiresAt && new Date(code.expiresAt) < new Date()) {
    return { label: 'Expired', color: 'bg-red-800 text-red-100' };
  }
  return { label: 'Active', color: 'bg-green-800 text-green-100' };
};

const R5CodeAdmin: React.FC = () => {
  const { user } = useAuth();
  const [codes, setCodes] = useState<R5Code[]>([]);
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [kingdoms, setKingdoms] = useState<Kingdom[]>([]);
  const [durationDays, setDurationDays] = useState(30);
  const [r5ShopEnabled, setR5ShopEnabled] = useState(true);
  const [createError, setCreateError] = useState<string | null>(null);
  const [assignError, setAssignError] = useState<string | null>(null);
  const [shopSettingError, setShopSettingError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingShopSetting, setIsLoadingShopSetting] = useState(false);
  const [isSavingShopSetting, setIsSavingShopSetting] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isAssigning, setIsAssigning] = useState(false);
  const [codeActionLoading, setCodeActionLoading] = useState<string | null>(null);
  const [activateNow, setActivateNow] = useState(false);
  const [activationForm, setActivationForm] = useState<{ code: string; userId: string; kingdomId?: string | null }>({
    code: '',
    userId: '',
    kingdomId: null,
  });
  const [statusFilter, setStatusFilter] = useState<'all' | 'unused' | 'active' | 'expired'>('all');
  const [sortBy, setSortBy] = useState<'createdDesc' | 'createdAsc' | 'expiresDesc' | 'expiresAsc' | 'durationDesc' | 'durationAsc'>('createdDesc');

  const inactiveCodes = useMemo(() => codes.filter((c) => !c.isActive), [codes]);
  const expiredCodes = useMemo(() => codes.filter((c) => c.expiresAt && new Date(c.expiresAt) < new Date()), [codes]);

  const filteredSortedCodes = useMemo(() => {
    let list = [...codes];
    if (statusFilter === 'unused') list = list.filter((c) => !c.isActive);
    if (statusFilter === 'active') list = list.filter((c) => c.isActive);
    if (statusFilter === 'expired') list = list.filter((c) => c.expiresAt && new Date(c.expiresAt) < new Date());

    const sorter: Record<typeof sortBy, (a: R5Code, b: R5Code) => number> = {
      createdDesc: (a, b) => new Date(b.createdAt || '').getTime() - new Date(a.createdAt || '').getTime(),
      createdAsc: (a, b) => new Date(a.createdAt || '').getTime() - new Date(b.createdAt || '').getTime(),
      expiresDesc: (a, b) => new Date(b.expiresAt || '').getTime() - new Date(a.expiresAt || '').getTime(),
      expiresAsc: (a, b) => new Date(a.expiresAt || '').getTime() - new Date(b.expiresAt || '').getTime(),
      durationDesc: (a, b) => (b.durationDays || 0) - (a.durationDays || 0),
      durationAsc: (a, b) => (a.durationDays || 0) - (b.durationDays || 0),
    };
    list.sort(sorter[sortBy]);
    return list;
  }, [codes, statusFilter, sortBy]);

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const getToken = () => {
    const token = localStorage.getItem('authToken');
    if (!token) throw new Error('Not signed in.');
    return token;
  };

  const loadAll = async () => {
    setIsLoading(true);
    setCreateError(null);
    setAssignError(null);
    try {
      const [codeList] = await Promise.all([fetchAdminR5Codes(), loadUsers(), loadKingdoms(), loadShopSetting()]);
      setCodes(codeList);
    } catch (err: any) {
      setCreateError(err.message || 'Failed to load codes.');
    } finally {
      setIsLoading(false);
    }
  };

  const loadUsers = async () => {
    try {
      const token = getToken();
      const res = await fetch(`${API_BASE_URL}/api/admin/users`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Could not load users');
      const data: any[] = await res.json();
      const mapped = data.map((u) => ({
        id: u.id,
        username: u.username,
        role: u.role,
        email: u.email,
        kingdomId: u.kingdomId || u.kingdom_id || null,
      }));
      setUsers(mapped);
      return mapped;
    } catch (err: any) {
      setAssignError(err.message || 'Failed to load users.');
      return [];
    }
  };

  const loadKingdoms = async () => {
    try {
      const token = getToken();
      const res = await fetch(`${API_BASE_URL}/api/admin/kingdoms`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Could not load kingdoms');
      const data: Kingdom[] = await res.json();
      data.sort((a, b) => a.displayName.localeCompare(b.displayName));
      setKingdoms(data);
      return data;
    } catch (err: any) {
      setAssignError(err.message || 'Failed to load kingdoms.');
      return [];
    }
  };

  const loadShopSetting = async () => {
    setIsLoadingShopSetting(true);
    setShopSettingError(null);
    try {
      const data = await fetchAdminR5ShopVisibility();
      setR5ShopEnabled(!!data.enabled);
      return data;
    } catch (err: any) {
      setShopSettingError(err.message || 'Failed to load shop visibility.');
      return null;
    } finally {
      setIsLoadingShopSetting(false);
    }
  };

  const handleShopVisibilityChange = async (nextValue: boolean) => {
    const previous = r5ShopEnabled;
    setR5ShopEnabled(nextValue);
    setIsSavingShopSetting(true);
    setShopSettingError(null);
    try {
      const updated = await updateAdminR5ShopVisibility(nextValue);
      setR5ShopEnabled(!!updated.enabled);
      setSuccessMessage('Shop visibility saved.');
    } catch (err: any) {
      setR5ShopEnabled(previous);
      setShopSettingError(err.message || 'Could not save shop visibility.');
    } finally {
      setIsSavingShopSetting(false);
      setTimeout(() => setSuccessMessage(null), 2500);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);
    setIsCreating(true);
    try {
      const created = await createAdminR5Code(durationDays);
      setCodes((prev) => [created, ...prev]);
      setSuccessMessage(`Code ${created.code} created.`);
    } catch (err: any) {
      setCreateError(err.message || 'Creation failed.');
    } finally {
      setIsCreating(false);
      setTimeout(() => setSuccessMessage(null), 2500);
    }
  };

  const handleAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activationForm.code || !activationForm.userId) {
      setAssignError('Code and user are required.');
      return;
    }
    if (!activationForm.kingdomId) {
      setAssignError('Selected user has no kingdom.');
      return;
    }
    setAssignError(null);
    setIsAssigning(true);
    try {
      await activateAdminR5Code({ ...activationForm, assignOnly: !activateNow });
      const updated = await fetchAdminR5Codes();
      setCodes(updated);
      setSuccessMessage(activateNow ? 'Code assigned and activated.' : 'Code assigned (not activated).');
      setActivationForm({ code: '', userId: '', kingdomId: null });
      setActivateNow(false);
    } catch (err: any) {
      setAssignError(err.message || 'Assignment failed.');
    } finally {
      setIsAssigning(false);
      setTimeout(() => setSuccessMessage(null), 2500);
    }
  };

  const handleDelete = async (code: string) => {
    try {
      setCodeActionLoading(code);
      await deleteAdminR5Code(code);
      setCodes((prev) => prev.filter((c) => c.code !== code));
      setSuccessMessage('Code deleted.');
    } catch (err: any) {
      setAssignError(err.message || 'Deletion failed.');
    }
    setCodeActionLoading(null);
    setTimeout(() => setSuccessMessage(null), 2500);
  };

  const handleDeactivate = async (code: string) => {
    try {
      setCodeActionLoading(code);
      await deactivateAdminR5Code(code);
      const updated = await fetchAdminR5Codes();
      setCodes(updated);
      setSuccessMessage('Code deactivated.');
    } catch (err: any) {
      setAssignError(err.message || 'Deactivation failed.');
    }
    setCodeActionLoading(null);
    setTimeout(() => setSuccessMessage(null), 2500);
  };

  const getUserLabel = (id?: string | null) => {
    if (!id) return '-';
    const entry = users.find((u) => u.id === id);
    return entry ? `${entry.username} (${entry.role})` : id;
  };

  const getKingdomLabel = (id?: string | null) => {
    if (!id) return '-';
    const entry = kingdoms.find((k) => k.id === id);
    return entry ? `${entry.displayName} (${entry.slug})` : id;
  };

  if (!user || user.role !== 'admin') {
    return (
      <div className="text-center p-8 bg-gray-800 rounded-xl text-red-200">
        Only superadmins can use this view.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="border-gray-700">
          <h3 className="text-lg font-semibold text-white mb-3">Create new code</h3>
          <form onSubmit={handleCreate} className="space-y-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Duration</label>
              <select
                value={durationDays}
                onChange={(e) => setDurationDays(Number(e.target.value))}
                className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {[1, 7, 14, 30, 60, 365, 0].map((d) => (
                  <option key={d} value={d}>
                    {durationLabel(d)}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              disabled={isCreating}
              className={`w-full px-4 py-2 rounded text-sm font-semibold ${
                isCreating ? 'bg-gray-700 text-gray-400 cursor-not-allowed' : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              {isCreating ? 'Creating...' : 'Generate code'}
            </button>
            {createError && <p className="text-xs text-red-400">{createError}</p>}
          </form>
        </Card>

        <Card className="lg:col-span-2 border-gray-700">
          <h3 className="text-lg font-semibold text-white mb-3">Assign code to user</h3>
          <form onSubmit={handleAssign} className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="flex flex-col">
              <label className="text-xs text-gray-400 mb-1">Code</label>
              <input
                type="text"
                value={activationForm.code}
                onChange={(e) => setActivationForm((prev) => ({ ...prev, code: e.target.value.trim().toUpperCase() }))}
                className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="16-character code"
              />
            </div>
            <div className="flex flex-col">
              <label className="text-xs text-gray-400 mb-1">User</label>
              <select
                value={activationForm.userId}
                onChange={(e) => {
                  const nextUserId = e.target.value;
                  const selectedUser = users.find((entry) => entry.id === nextUserId);
                  setActivationForm((prev) => ({
                    ...prev,
                    userId: nextUserId,
                    kingdomId: selectedUser?.kingdomId || null,
                  }));
                }}
                className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="">Select...</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.username} ({u.role})
                  </option>
                ))}
              </select>
            </div>
            <div className="md:col-span-3 flex items-center justify-between">
              <div className="text-xs text-gray-500">
                Users: {users.length}  Kingdoms: {kingdoms.length}
              </div>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 text-xs text-gray-300">
                  <input
                    type="checkbox"
                    checked={activateNow}
                    onChange={(e) => setActivateNow(e.target.checked)}
                    disabled={isAssigning}
                    className="h-4 w-4 rounded border-gray-600 bg-gray-900 text-green-600 focus:ring-green-500"
                  />
                  Activate immediately
                </label>
                <button
                  type="submit"
                  disabled={isAssigning}
                  className={`px-4 py-2 rounded text-sm font-semibold ${
                    isAssigning ? 'bg-gray-700 text-gray-400 cursor-not-allowed' : 'bg-green-600 text-white hover:bg-green-700'
                  }`}
                >
                  {isAssigning ? 'Assigning...' : 'Assign code'}
                </button>
              </div>
            </div>
            {assignError && (
              <div className="md:col-span-3 text-xs text-red-400">
                {assignError}
              </div>
            )}
            {successMessage && (
              <div className="md:col-span-3 text-xs text-green-400">{successMessage}</div>
            )}
          </form>
        </Card>
      </div>

      <Card className="border-gray-700">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-white">R5 Shop Visibility</h3>
            <p className="text-sm text-gray-400">Controls whether the shop is visible for R5 users.</p>
          </div>
          <label className="flex items-center gap-3 text-sm text-gray-200">
            <input
              type="checkbox"
              checked={r5ShopEnabled}
              onChange={(e) => handleShopVisibilityChange(e.target.checked)}
              disabled={isLoadingShopSetting || isSavingShopSetting}
              className="h-4 w-4 rounded border-gray-600 bg-gray-900 text-blue-600 focus:ring-blue-500"
            />
            <span>{r5ShopEnabled ? 'Shop visible' : 'Shop hidden'}</span>
          </label>
        </div>
        {isLoadingShopSetting && (
          <p className="mt-3 text-xs text-gray-400">Loading shop visibility...</p>
        )}
        {shopSettingError && (
          <p className="mt-3 text-xs text-red-400">{shopSettingError}</p>
        )}
      </Card>

      <Card className="border-gray-700">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 mb-4">
          <div>
            <h3 className="text-lg font-semibold text-white">All codes</h3>
            <p className="text-sm text-gray-400">Manage generated codes, status, and assignments.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs text-gray-300">
            <span className="px-2 py-1 rounded bg-gray-800 border border-gray-700">Open: {inactiveCodes.length}</span>
            <span className="px-2 py-1 rounded bg-red-900/50 border border-red-700">Expired: {expiredCodes.length}</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-3 mb-4 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-gray-400">Filter:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="bg-gray-900 border border-gray-700 rounded px-2 py-1 text-gray-100"
            >
              <option value="all">All</option>
              <option value="unused">Unused</option>
              <option value="active">Active</option>
              <option value="expired">Expired</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-gray-400">Sort:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-gray-900 border border-gray-700 rounded px-2 py-1 text-gray-100"
            >
              <option value="createdDesc">Created (new first)</option>
              <option value="createdAsc">Created (old first)</option>
              <option value="expiresDesc">Expiry (late first)</option>
              <option value="expiresAsc">Expiry (early first)</option>
              <option value="durationDesc">Duration (long first)</option>
              <option value="durationAsc">Duration (short first)</option>
            </select>
          </div>
        </div>
        {isLoading ? (
          <p className="text-gray-400 text-sm">Loading codes...</p>
        ) : filteredSortedCodes.length === 0 ? (
          <p className="text-gray-400 text-sm">No codes available.</p>
        ) : (
          <div className="space-y-3">
            {filteredSortedCodes.map((code) => {
              const meta = statusMeta(code);
              const isActionLoading = codeActionLoading === code.code;
              return (
                <div
                  key={code.code}
                  className="p-4 rounded-lg border border-gray-700 bg-gray-900/60 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3"
                >
                  <div>
                    <p className="text-sm font-semibold text-white tracking-wide">{code.code}</p>
                    <p className="text-xs text-gray-400">
                      Duration: {durationLabel(code.durationDays)}  Created {formatDate(code.createdAt)}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-gray-300">
                    <span className={`px-2 py-1 rounded-full font-semibold ${meta.color}`}>{meta.label}</span>
                    <span className="px-2 py-1 rounded bg-gray-800 border border-gray-700">
                      User: {getUserLabel(code.usedByUserId)}
                    </span>
                    <span className="px-2 py-1 rounded bg-gray-800 border border-gray-700">
                      Kingdom: {getKingdomLabel(code.kingdomId)}
                    </span>
                    <div className="flex flex-col text-right text-gray-300">
                      <span className="text-[11px] text-gray-400">Activated</span>
                      <span className="font-semibold">{formatDate(code.activatedAt)}</span>
                    </div>
                    <div className="flex flex-col text-right text-gray-300">
                      <span className="text-[11px] text-gray-400">Expires</span>
                      <span className="font-semibold">{formatDate(code.expiresAt)}</span>
                    </div>
                    {(code.isActive || code.usedByUserId) && (
                      <button
                        onClick={() => handleDeactivate(code.code)}
                        disabled={isActionLoading}
                        className={`px-3 py-1 rounded text-xs font-semibold ${
                          isActionLoading
                            ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                            : 'bg-yellow-700 text-white hover:bg-yellow-800'
                        }`}
                      >
                        {isActionLoading ? 'Processing...' : 'Deactivate'}
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(code.code)}
                      disabled={isActionLoading}
                      className={`px-3 py-1 rounded text-xs font-semibold ${
                        isActionLoading
                          ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                          : 'bg-red-700 text-white hover:bg-red-800'
                      }`}
                    >
                      {isActionLoading ? 'Please wait...' : 'Delete'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
};

export default R5CodeAdmin;
