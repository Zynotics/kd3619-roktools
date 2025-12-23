import React, { useEffect, useMemo, useState } from 'react';
import { API_BASE_URL, fetchMyR5Codes, activateSelfR5Code } from '../api';
import { R5Code } from '../types';
import { Card } from './Card';
import { useAuth } from './AuthContext';

const durationLabel = (days: number | undefined) => {
  if (days === 0) return 'Lifetime';
  if (!days) return 'Unknown duration';
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

const statusTag = (code: R5Code) => {
  if (!code.isActive) return { label: 'Unused', color: 'bg-gray-700 text-gray-100' };
  if (code.expiresAt && new Date(code.expiresAt) < new Date()) {
    return { label: 'Expired', color: 'bg-red-800 text-red-100' };
  }
  return { label: 'Active', color: 'bg-green-800 text-green-100' };
};

const R5CustomerAccess: React.FC = () => {
  const { user, refreshUser } = useAuth();
  const [codes, setCodes] = useState<R5Code[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [codeInput, setCodeInput] = useState('');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isActivating, setIsActivating] = useState(false);
  const [kingdomSlug, setKingdomSlug] = useState<string | null>(null);

  const activeStatus = useMemo(() => {
    if (!user) return null;
    if (user.role !== 'r5') return 'no-r5';
    if (user.r5AccessValid) return 'active';
    return 'expired';
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const loadKingdomSlug = async () => {
      try {
        const token = localStorage.getItem('authToken');
        if (!token || !user.kingdomId) return;
        const res = await fetch(`${API_BASE_URL}/api/admin/kingdoms`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        const data = await res.json();
        const current = Array.isArray(data) ? data.find((k: any) => k.id === user.kingdomId) : null;
        if (current && current.slug) {
          setKingdomSlug(current.slug);
        }
      } catch {
        /* ignore slug load errors */
      }
    };
    loadKingdomSlug();

    const load = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const data = await fetchMyR5Codes();
        setCodes(data);
      } catch (err: any) {
        setError(err.message || 'Failed to load codes.');
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [user]);

  if (!user) {
    return (
      <div className="text-center p-8 bg-gray-800 rounded-xl text-red-200">
        Please log in to manage codes.
      </div>
    );
  }

  const canActivate = !!user.kingdomId;

  const handleActivate = async (code: string) => {
    if (!canActivate) {
      setError('No kingdom linked to your account. Please contact the superadmin.');
      return;
    }
    setIsActivating(true);
    setError(null);
    try {
      await activateSelfR5Code(code, user.kingdomId || undefined);
      setSuccessMessage('Code activated successfully. Your role will update shortly.');
      await refreshUser();
      const updated = await fetchMyR5Codes();
      setCodes(updated);
    } catch (err: any) {
      setError(err.message || 'Activation failed.');
    } finally {
      setIsActivating(false);
      setTimeout(() => setSuccessMessage(null), 3000);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm text-gray-400">Current status</p>
              <h2 className="text-2xl font-bold text-white">R5 Access</h2>
            </div>
            <span
              className={`px-3 py-1 rounded-full text-xs font-semibold ${
                activeStatus === 'active'
                  ? 'bg-green-700 text-green-100'
                  : activeStatus === 'expired'
                  ? 'bg-red-700 text-red-100'
                  : 'bg-gray-700 text-gray-200'
              }`}
            >
              {activeStatus === 'active'
                ? 'Active'
                : activeStatus === 'expired'
                ? 'Expired'
                : 'No R5 role'}
            </span>
          </div>
          <div className="space-y-2 text-sm text-gray-300">
            <div className="flex items-center justify-between">
              <span>Kingdom</span>
              <span className="font-semibold">{kingdomSlug || user.kingdomId || 'Not set'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Role</span>
              <span className="font-semibold uppercase">{user.role}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Valid until</span>
              <span className="font-semibold">
                {user.r5AccessExpiresAt
                  ? formatDate(user.r5AccessExpiresAt)
                  : user.r5AccessValid
                  ? 'Lifetime'
                  : '-'}
              </span>
            </div>
          </div>
          {!user.isApproved && (
            <p className="mt-4 text-xs text-yellow-300">
              Your account is not approved yet. An active R5 code will approve you automatically.
            </p>
          )}
          <p className="mt-3 text-xs text-gray-400">
            Multiple codes stack: activating another code adds its duration to your current expiry.
          </p>
        </Card>

        <Card className="border-gray-700">
          <h3 className="text-lg font-semibold text-white mb-3">My codes</h3>
          <p className="text-sm text-gray-400 mb-4">
            Codes assigned to your account. Activate them to extend your R5 access; durations stack.
          </p>
          {error && (
            <div className="mb-3 text-sm text-red-400 bg-red-900/30 border border-red-700 px-3 py-2 rounded">
              {error}
            </div>
          )}
          {successMessage && (
            <div className="mb-3 text-sm text-green-400 bg-green-900/20 border border-green-700 px-3 py-2 rounded">
              {successMessage}
            </div>
          )}
          {isLoading ? (
            <p className="text-gray-400 text-sm">Loading...</p>
          ) : codes.length === 0 ? (
            <p className="text-gray-400 text-sm">No codes redeemed yet.</p>
          ) : (
            <div className="space-y-3">
              {codes.map((code) => {
                const tag = statusTag(code);
                const canRedeem = !code.isActive;
                return (
                  <div
                    key={code.code}
                    className="p-4 rounded-lg border border-gray-700 bg-gray-900/60 flex flex-col md:flex-row md:items-center md:justify-between gap-3"
                  >
                    <div>
                      <p className="text-sm font-semibold text-white tracking-wide">{code.code}</p>
                      <p className="text-xs text-gray-400">
                      Duration: {durationLabel(code.durationDays)}  Created {formatDate(code.createdAt)}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 text-xs">
                      <span className={`px-2 py-1 rounded-full font-semibold ${tag.color}`}>{tag.label}</span>
                      <div className="flex flex-col text-right text-gray-300">
                        <span className="text-[11px] text-gray-400">Activated</span>
                        <span className="font-semibold">{formatDate(code.activatedAt)}</span>
                      </div>
                      <div className="flex flex-col text-right text-gray-300">
                        <span className="text-[11px] text-gray-400">Expires</span>
                        <span className="font-semibold">
                          {code.durationDays === 0 && code.isActive ? 'Lifetime' : formatDate(code.expiresAt)}
                        </span>
                      </div>
                      {canRedeem && (
                        <button
                          onClick={() => handleActivate(code.code)}
                          disabled={isActivating || !canActivate}
                          className={`px-3 py-1 rounded text-xs font-semibold ${
                            isActivating || !canActivate
                              ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                              : 'bg-blue-600 text-white hover:bg-blue-700'
                          }`}
                        >
                          {isActivating ? 'Activating...' : 'Activate'}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

export default R5CustomerAccess;
