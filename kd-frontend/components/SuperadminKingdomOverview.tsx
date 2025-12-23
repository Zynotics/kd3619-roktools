import React, { useEffect, useMemo, useState } from 'react';
import { Card } from './Card';
import { Kingdom } from '../types';
import { useAuth } from './AuthContext';

const BACKEND_URL =
  process.env.NODE_ENV === 'production'
    ? 'https://api.rise-of-stats.com'
    : 'http://localhost:4000';

const FRONTEND_URL =
  process.env.NODE_ENV === 'production'
    ? 'https://www.rise-of-stats.com'
    : 'http://localhost:5173';

const SuperadminKingdomOverview: React.FC = () => {
  const { user } = useAuth();
  const [kingdoms, setKingdoms] = useState<Kingdom[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const sortedKingdoms = useMemo(
    () => [...kingdoms].sort((a, b) => a.displayName.localeCompare(b.displayName)),
    [kingdoms]
  );

  useEffect(() => {
    const fetchKingdoms = async () => {
      if (!user || user.role !== 'admin') {
        setIsLoading(false);
        return;
      }

      setError(null);
      setIsLoading(true);
      try {
        const token = localStorage.getItem('authToken');
        if (!token) {
          throw new Error('Not signed in');
        }
        const res = await fetch(`${BACKEND_URL}/api/admin/kingdoms`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!res.ok) {
          const text = await res.text();
          console.error('Failed to load kingdoms:', text);
          setError('Could not load kingdoms.');
          return;
        }

        const data: Kingdom[] = await res.json();
        setKingdoms(data);
      } catch (e) {
        console.error('Error loading kingdoms', e);
        setError('Could not load kingdoms.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchKingdoms();
  }, [user]);

  const buildPublicLink = (slug: string) => `${FRONTEND_URL}/?slug=${slug}`;
  const buildRegistrationLink = (slug: string) => `${FRONTEND_URL}/?slug=${slug}&register=true`;

  const handleCopy = async (slug: string, type: 'public' | 'registration') => {
    const value = type === 'public' ? buildPublicLink(slug) : buildRegistrationLink(slug);
    try {
      await navigator.clipboard.writeText(value);
      setCopiedKey(`${slug}-${type}`);
      setTimeout(() => setCopiedKey(null), 1500);
    } catch (e) {
      console.error('Clipboard copy failed', e);
      setError('Copy to clipboard failed.');
    }
  };

  if (!user || user.role !== 'admin') {
    return (
      <div className="text-gray-300 bg-gray-800 border border-gray-700 p-4 rounded-lg">
        Only superadmins can view this overview.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold text-white">Kingdom overview</h1>
        <p className="text-sm text-gray-400">
          Quick access to all kingdoms including public and registration links.
        </p>
      </div>

      {error && (
        <div className="bg-red-900/40 border border-red-700 text-red-200 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      {isLoading ? (
        <Card className="text-gray-300 text-sm">Loading kingdoms...</Card>
      ) : sortedKingdoms.length === 0 ? (
        <Card className="text-gray-300 text-sm">No kingdoms available.</Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {sortedKingdoms.map((kingdom) => {
            const publicLink = buildPublicLink(kingdom.slug);
            const registrationLink = buildRegistrationLink(kingdom.slug);
            const copySuccess = copiedKey?.startsWith(`${kingdom.slug}-`);

            return (
              <Card key={kingdom.id} className="relative h-full flex flex-col gap-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-gray-500">Kingdom</p>
                    <h2 className="text-lg font-semibold text-white leading-tight">
                      {kingdom.displayName || kingdom.slug.toUpperCase()}
                    </h2>
                    <p className="text-xs font-mono text-blue-300 mt-1">{kingdom.slug}</p>
                    {kingdom.ownerUsername && (
                      <p className="text-xs text-gray-400 mt-2">
                        R5: <span className="text-gray-200">{kingdom.ownerUsername}</span>
                      </p>
                    )}
                  </div>
                  <span
                    className={`px-2 py-1 rounded-full text-[10px] font-semibold ${
                      kingdom.status === 'active'
                        ? 'bg-green-800 text-green-100'
                        : 'bg-yellow-800 text-yellow-100'
                    }`}
                  >
                    {kingdom.status?.toUpperCase() || 'UNKNOWN'}
                  </span>
                </div>

                <div className="flex flex-col gap-2 mt-2">
                  <div className="text-xs text-gray-400">Public Link</div>
                  <div className="flex items-center gap-2">
                    <a
                      href={publicLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-400 hover:text-blue-300 text-sm underline truncate"
                      title={publicLink}
                    >
                      {publicLink}
                    </a>
                    <button
                      onClick={() => handleCopy(kingdom.slug, 'public')}
                      className="text-[11px] px-2 py-1 rounded bg-gray-700 hover:bg-gray-600 text-gray-100"
                    >
                      Copy
                    </button>
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <div className="text-xs text-gray-400">Registration link</div>
                  <div className="flex items-center gap-2">
                    <a
                      href={registrationLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-400 hover:text-blue-300 text-sm underline truncate"
                      title={registrationLink}
                    >
                      {registrationLink}
                    </a>
                    <button
                      onClick={() => handleCopy(kingdom.slug, 'registration')}
                      className="text-[11px] px-2 py-1 rounded bg-gray-700 hover:bg-gray-600 text-gray-100"
                    >
                      Copy
                    </button>
                  </div>
                </div>

                {copySuccess && (
                  <div className="absolute top-3 right-3 text-[10px] bg-green-700 text-white px-2 py-1 rounded">
                    Copied
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default SuperadminKingdomOverview;
