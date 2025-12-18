import React, { useEffect, useMemo, useState } from 'react';
import { Card } from './Card';
import { Kingdom, R5Code } from '../types';
import { API_BASE_URL, activateAdminR5Code, createAdminR5Code, fetchAdminR5Codes } from '../api';
import { useAuth } from './AuthContext';

type UserSummary = {
  id: string;
  username: string;
  role: string;
  email?: string;
  kingdomId?: string | null;
};

const durationLabel = (days: number) => {
  if (days === 30) return '30 Tage';
  if (days === 60) return '60 Tage';
  if (days >= 365) return '1 Jahr';
  return `${days} Tage`;
};

const formatDate = (value?: string | null) => {
  if (!value) return '—';
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
  const [activateError, setActivateError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isActivating, setIsActivating] = useState(false);
  const [activationForm, setActivationForm] = useState<{ code: string; userId: string; kingdomId: string }>({
    code: '',
    userId: '',
    kingdomId: '',
  });

  const inactiveCodes = useMemo(() => codes.filter((c) => !c.isActive), [codes]);
  const expiredCodes = useMemo(() => codes.filter((c) => c.expiresAt && new Date(c.expiresAt) < new Date()), [codes]);

  useEffect(() => {
    loadAll();
  }, []);

  const getToken = () => {
    const token = localStorage.getItem('authToken');
    if (!token) throw new Error('Nicht angemeldet.');
    return token;
  };

  const loadAll = async () => {
    setIsLoading(true);
    setCreateError(null);
    setActivateError(null);
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
      setActivateError(err.message || 'Fehler beim Laden der Nutzer.');
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
      setActivateError(err.message || 'Fehler beim Laden der K\u00f6nigreiche.');
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

  const handleActivate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activationForm.code || !activationForm.userId || !activationForm.kingdomId) {
      setActivateError('Code, Benutzer und K\u00f6nigreich sind erforderlich.');
      return;
    }
    setActivateError(null);
    setIsActivating(true);
    try {
      await activateAdminR5Code(activationForm);
      const updated = await fetchAdminR5Codes();
      setCodes(updated);
      setSuccessMessage('Code wurde aktiviert und R5 vergeben.');
      setActivationForm({ code: '', userId: '', kingdomId: '' });
    } catch (err: any) {
      setActivateError(err.message || 'Aktivierung fehlgeschlagen.');
    } finally {
      setIsActivating(false);
      setTimeout(() => setSuccessMessage(null), 2500);
    }
  };

  const getUserLabel = (id?: string | null) => {
    if (!id) return '—';
    const entry = users.find((u) => u.id === id);
    return entry ? `${entry.username} (${entry.role})` : id;
  };

  const getKingdomLabel = (id?: string | null) => {
    if (!id) return '—';
    const entry = kingdoms.find((k) => k.id === id);
    return entry ? `${entry.displayName} (${entry.slug})` : id;
  };

  if (!user || user.role !== 'admin') {
    return (
      <div className="text-center p-8 bg-gray-800 rounded-xl text-red-200">
        Nur Superadmins k\u00f6nnen diese Ansicht nutzen.
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
                {[30, 60, 365].map((d) => (
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
          <form onSubmit={handleActivate} className="grid grid-cols-1 md:grid-cols-3 gap-3">
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
                <option value="">Ausw\u00e4hlen...</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.username} ({u.role})
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col">
              <label className="text-xs text-gray-400 mb-1">K\u00f6nigreich</label>
              <select
                value={activationForm.kingdomId}
                onChange={(e) => setActivationForm((prev) => ({ ...prev, kingdomId: e.target.value }))}
                className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="">Ausw\u00e4hlen...</option>
                {kingdoms.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.displayName} ({k.slug})
                  </option>
                ))}
              </select>
            </div>
            <div className="md:col-span-3 flex items-center justify-between">
              <div className="text-xs text-gray-500">
                Nutzer: {users.length} · Kingdoms: {kingdoms.length}
              </div>
              <button
                type="submit"
                disabled={isActivating}
                className={`px-4 py-2 rounded text-sm font-semibold ${
                  isActivating ? 'bg-gray-700 text-gray-400 cursor-not-allowed' : 'bg-green-600 text-white hover:bg-green-700'
                }`}
              >
                {isActivating ? 'Aktiviere...' : 'Code aktivieren'}
              </button>
            </div>
            {activateError && (
              <div className="md:col-span-3 text-xs text-red-400">
                {activateError}
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
          <div className="flex gap-3 text-xs text-gray-300">
            <span className="px-2 py-1 rounded bg-gray-800 border border-gray-700">Offen: {inactiveCodes.length}</span>
            <span className="px-2 py-1 rounded bg-red-900/50 border border-red-700">Abgelaufen: {expiredCodes.length}</span>
          </div>
        </div>
        {isLoading ? (
          <p className="text-gray-400 text-sm">Lade Codes...</p>
        ) : codes.length === 0 ? (
          <p className="text-gray-400 text-sm">Keine Codes vorhanden.</p>
        ) : (
          <div className="space-y-3">
            {codes.map((code) => {
              const meta = statusMeta(code);
              return (
                <div
                  key={code.code}
                  className="p-4 rounded-lg border border-gray-700 bg-gray-900/60 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3"
                >
                  <div>
                    <p className="text-sm font-semibold text-white tracking-wide">{code.code}</p>
                    <p className="text-xs text-gray-400">
                      Laufzeit: {durationLabel(code.durationDays)} · Erstellt {formatDate(code.createdAt)}
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
                      <span className="text-[11px] text-gray-400">L\u00e4uft ab</span>
                      <span className="font-semibold">{formatDate(code.expiresAt)}</span>
                    </div>
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
