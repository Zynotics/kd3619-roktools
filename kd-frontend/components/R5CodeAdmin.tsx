import React, { useEffect, useMemo, useState } from 'react';
import { Card } from './Card';
import { Kingdom, R5Code } from '../types';
import {
  API_BASE_URL,
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
  if (days === 1) return '1 Tag';
  if (days === 7) return '7 Tage';
  if (days === 14) return '14 Tage';
  if (days === 30) return '30 Tage';
  if (days === 60) return '60 Tage';
  if (days >= 365) return '1 Jahr';
  return `${days} Tage`;
};

const formatDate = (value?: string | null) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
};

const statusMeta = (code: R5Code) => {
  if (!code.isActive) return { label: 'Unbenutzt', color: 'bg-gray-800 text-gray-200' };
  if (code.expiresAt && new Date(code.expiresAt) < new Date()) {
    return { label: 'Abgelaufen', color: 'bg-red-800 text-red-100' };
  }
  return { label: 'Aktiv', color: 'bg-green-800 text-green-100' };
};

const R5CodeAdmin: React.FC = () => {
  const { user } = useAuth();
  const [codes, setCodes] = useState<R5Code[]>([]);
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [kingdoms, setKingdoms] = useState<Kingdom[]>([]);
  const [durationDays, setDurationDays] = useState(30);
  const [createError, setCreateError] = useState<string | null>(null);
  const [assignError, setAssignError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isAssigning, setIsAssigning] = useState(false);
  const [codeActionLoading, setCodeActionLoading] = useState<string | null>(null);
  const [activationForm, setActivationForm] = useState<{ code: string; userId: string; kingdomId: string }>({
    code: '',
    userId: '',
    kingdomId: '',
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
    if (!token) throw new Error('Nicht angemeldet.');
    return token;
  };

  const loadAll = async () => {
    setIsLoading(true);
    setCreateError(null);
    setAssignError(null);
    try {
      const [codeList] = await Promise.all([fetchAdminR5Codes(), loadUsers(), loadKingdoms()]);
      setCodes(codeList);
    } catch (err: any) {
      setCreateError(err.message || 'Fehler beim Laden der Codes.');
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
      if (!res.ok) throw new Error('Users konnten nicht geladen werden');
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
      setAssignError(err.message || 'Fehler beim Laden der Nutzer.');
      return [];
    }
  };

  const loadKingdoms = async () => {
    try {
      const token = getToken();
      const res = await fetch(`${API_BASE_URL}/api/admin/kingdoms`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Kingdoms konnten nicht geladen werden');
      const data: Kingdom[] = await res.json();
      data.sort((a, b) => a.displayName.localeCompare(b.displayName));
      setKingdoms(data);
      return data;
    } catch (err: any) {
      setAssignError(err.message || 'Fehler beim Laden der Knigreiche.');
      return [];
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);
    setIsCreating(true);
    try {
      const created = await createAdminR5Code(durationDays);
      setCodes((prev) => [created, ...prev]);
      setSuccessMessage(`Code ${created.code} erstellt.`);
    } catch (err: any) {
      setCreateError(err.message || 'Erstellung fehlgeschlagen.');
    } finally {
      setIsCreating(false);
      setTimeout(() => setSuccessMessage(null), 2500);
    }
  };

  const handleAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activationForm.code || !activationForm.userId || !activationForm.kingdomId) {
      setAssignError('Code, Benutzer und Knigreich sind erforderlich.');
      return;
    }
    setAssignError(null);
    setIsAssigning(true);
    try {
      await activateAdminR5Code({ ...activationForm, assignOnly: true });
      const updated = await fetchAdminR5Codes();
      setCodes(updated);
      setSuccessMessage('Code wurde zugewiesen (nicht aktiviert).');
      setActivationForm({ code: '', userId: '', kingdomId: '' });
    } catch (err: any) {
      setAssignError(err.message || 'Zuweisung fehlgeschlagen.');
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
      setSuccessMessage('Code gelscht.');
    } catch (err: any) {
      setAssignError(err.message || 'Lschen fehlgeschlagen.');
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
      setSuccessMessage('Code deaktiviert.');
    } catch (err: any) {
      setAssignError(err.message || 'Deaktivierung fehlgeschlagen.');
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
        Nur Superadmins knnen diese Ansicht nutzen.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="border-gray-700">
          <h3 className="text-lg font-semibold text-white mb-3">Neuen Code erstellen</h3>
          <form onSubmit={handleCreate} className="space-y-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Laufzeit</label>
              <select
                value={durationDays}
                onChange={(e) => setDurationDays(Number(e.target.value))}
                className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {[1, 7, 14, 30, 60, 365].map((d) => (
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
              {isCreating ? 'Erstelle...' : 'Code generieren'}
            </button>
            {createError && <p className="text-xs text-red-400">{createError}</p>}
          </form>
        </Card>

        <Card className="lg:col-span-2 border-gray-700">
          <h3 className="text-lg font-semibold text-white mb-3">Code zu Benutzer zuweisen</h3>
          <form onSubmit={handleAssign} className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="flex flex-col">
              <label className="text-xs text-gray-400 mb-1">Code</label>
              <input
                type="text"
                value={activationForm.code}
                onChange={(e) => setActivationForm((prev) => ({ ...prev, code: e.target.value.trim().toUpperCase() }))}
                className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="16-stelliger Code"
              />
            </div>
            <div className="flex flex-col">
              <label className="text-xs text-gray-400 mb-1">Benutzer</label>
              <select
                value={activationForm.userId}
                onChange={(e) => setActivationForm((prev) => ({ ...prev, userId: e.target.value }))}
                className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="">Auswaehlen...</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.username} ({u.role})
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col">
              <label className="text-xs text-gray-400 mb-1">Knigreich</label>
              <select
                value={activationForm.kingdomId}
                onChange={(e) => setActivationForm((prev) => ({ ...prev, kingdomId: e.target.value }))}
                className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="">Auswaehlen...</option>
                {kingdoms.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.displayName} ({k.slug})
                  </option>
                ))}
              </select>
            </div>
            <div className="md:col-span-3 flex items-center justify-between">
              <div className="text-xs text-gray-500">
                Nutzer: {users.length}  Kingdoms: {kingdoms.length}
              </div>
              <button
                type="submit"
                disabled={isAssigning}
                className={`px-4 py-2 rounded text-sm font-semibold ${
                  isAssigning ? 'bg-gray-700 text-gray-400 cursor-not-allowed' : 'bg-green-600 text-white hover:bg-green-700'
                }`}
              >
                {isAssigning ? 'Weise zu...' : 'Code zuweisen'}
              </button>
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
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 mb-4">
          <div>
            <h3 className="text-lg font-semibold text-white">Alle Codes</h3>
            <p className="text-sm text-gray-400">Verwalte generierte Codes, Status und Zuweisungen.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs text-gray-300">
            <span className="px-2 py-1 rounded bg-gray-800 border border-gray-700">Offen: {inactiveCodes.length}</span>
            <span className="px-2 py-1 rounded bg-red-900/50 border border-red-700">Abgelaufen: {expiredCodes.length}</span>
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
              <option value="all">Alle</option>
              <option value="unused">Unbenutzt</option>
              <option value="active">Aktiv</option>
              <option value="expired">Abgelaufen</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-gray-400">Sort:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-gray-900 border border-gray-700 rounded px-2 py-1 text-gray-100"
            >
              <option value="createdDesc">Erstellt (neu zuerst)</option>
              <option value="createdAsc">Erstellt (alt zuerst)</option>
              <option value="expiresDesc">Ablauf (spt zuerst)</option>
              <option value="expiresAsc">Ablauf (frh zuerst)</option>
              <option value="durationDesc">Laufzeit (lang zuerst)</option>
              <option value="durationAsc">Laufzeit (kurz zuerst)</option>
            </select>
          </div>
        </div>
        {isLoading ? (
          <p className="text-gray-400 text-sm">Lade Codes...</p>
        ) : filteredSortedCodes.length === 0 ? (
          <p className="text-gray-400 text-sm">Keine Codes vorhanden.</p>
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
                      Laufzeit: {durationLabel(code.durationDays)}  Erstellt {formatDate(code.createdAt)}
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
                      <span className="text-[11px] text-gray-400">Aktiviert</span>
                      <span className="font-semibold">{formatDate(code.activatedAt)}</span>
                    </div>
                    <div className="flex flex-col text-right text-gray-300">
                      <span className="text-[11px] text-gray-400">Laeuft ab</span>
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
                        {isActionLoading ? 'Wird bearbeitet...' : 'Deaktivieren'}
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
                      {isActionLoading ? 'Bitte warten...' : 'Lschen'}
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

