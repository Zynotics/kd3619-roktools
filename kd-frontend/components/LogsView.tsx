// components/LogsView.tsx – Activity Log Viewer (Superadmin only)

import React, { useState, useEffect, useCallback } from 'react';
import { fetchActivityLogs, ActivityLog } from '../api';

const ACTION_LABELS: Record<string, string> = {
  login: 'Login',
  user_approve: 'User Approved',
  user_reject: 'User Rejected',
  user_role_change: 'Role Changed',
  user_delete: 'User Deleted',
  user_remove_from_kingdom: 'Removed from Kingdom',
  user_access_files_update: 'File Access Updated',
  kvk_event_create: 'KvK Event Created',
  kvk_event_update: 'KvK Event Updated',
  kvk_event_delete: 'KvK Event Deleted',
  watchlist_save: 'Watchlist Saved',
};

const ACTION_COLORS: Record<string, string> = {
  login: 'text-blue-400',
  user_approve: 'text-emerald-400',
  user_reject: 'text-red-400',
  user_role_change: 'text-amber-400',
  user_delete: 'text-red-500',
  user_remove_from_kingdom: 'text-orange-400',
  user_access_files_update: 'text-purple-400',
  kvk_event_create: 'text-cyan-400',
  kvk_event_update: 'text-cyan-300',
  kvk_event_delete: 'text-red-400',
  watchlist_save: 'text-slate-400',
};

const ALL_ACTIONS = Object.keys(ACTION_LABELS);

export const LogsView: React.FC = () => {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [filterUsername, setFilterUsername] = useState('');
  const [filterAction, setFilterAction] = useState('');
  const [filterKingdomId, setFilterKingdomId] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');

  const limit = 50;

  const load = useCallback(async (p: number) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetchActivityLogs({
        username: filterUsername || undefined,
        action: filterAction || undefined,
        kingdomId: filterKingdomId || undefined,
        dateFrom: filterDateFrom ? `${filterDateFrom}T00:00:00Z` : undefined,
        dateTo: filterDateTo ? `${filterDateTo}T23:59:59Z` : undefined,
        page: p,
        limit,
      });
      setLogs(res.data);
      setTotal(res.total);
      setTotalPages(res.totalPages);
      setPage(res.page);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load logs');
    } finally {
      setIsLoading(false);
    }
  }, [filterUsername, filterAction, filterKingdomId, filterDateFrom, filterDateTo]);

  useEffect(() => {
    load(1);
  }, [load]);

  const handleFilterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    load(1);
  };

  const handleReset = () => {
    setFilterUsername('');
    setFilterAction('');
    setFilterKingdomId('');
    setFilterDateFrom('');
    setFilterDateTo('');
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white">Activity Logs</h2>
        <p className="text-slate-400 text-sm mt-1">All user actions across the platform</p>
      </div>

      {/* Filters */}
      <form onSubmit={handleFilterSubmit} className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Username</label>
            <input
              type="text"
              value={filterUsername}
              onChange={e => setFilterUsername(e.target.value)}
              placeholder="Search username..."
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Action</label>
            <select
              value={filterAction}
              onChange={e => setFilterAction(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
            >
              <option value="">All actions</option>
              {ALL_ACTIONS.map(a => (
                <option key={a} value={a}>{ACTION_LABELS[a] || a}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Kingdom ID</label>
            <input
              type="text"
              value={filterKingdomId}
              onChange={e => setFilterKingdomId(e.target.value)}
              placeholder="kingdom-..."
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">From date</label>
            <input
              type="date"
              value={filterDateFrom}
              onChange={e => setFilterDateFrom(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">To date</label>
            <input
              type="date"
              value={filterDateTo}
              onChange={e => setFilterDateTo(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>
        <div className="flex gap-2">
          <button
            type="submit"
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors"
          >
            Search
          </button>
          <button
            type="button"
            onClick={handleReset}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium rounded-lg transition-colors"
          >
            Reset
          </button>
        </div>
      </form>

      {/* Results */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
          <span className="text-sm text-slate-400">
            {isLoading ? 'Loading...' : `${total} entries`}
          </span>
          {totalPages > 1 && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => load(page - 1)}
                disabled={page <= 1 || isLoading}
                className="px-3 py-1 text-xs bg-slate-800 hover:bg-slate-700 disabled:opacity-40 rounded text-white transition-colors"
              >
                Prev
              </button>
              <span className="text-xs text-slate-400">{page} / {totalPages}</span>
              <button
                onClick={() => load(page + 1)}
                disabled={page >= totalPages || isLoading}
                className="px-3 py-1 text-xs bg-slate-800 hover:bg-slate-700 disabled:opacity-40 rounded text-white transition-colors"
              >
                Next
              </button>
            </div>
          )}
        </div>

        {error && (
          <div className="p-4 text-sm text-red-400">{error}</div>
        )}

        {!isLoading && !error && logs.length === 0 && (
          <div className="p-8 text-center text-slate-500 text-sm">No logs found.</div>
        )}

        {logs.length > 0 && (
          <div className="divide-y divide-slate-800">
            {logs.map(log => (
              <div key={log.id} className="px-4 py-3 hover:bg-slate-800/40 transition-colors">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-xs font-semibold ${ACTION_COLORS[log.action] || 'text-slate-300'}`}>
                        {ACTION_LABELS[log.action] || log.action}
                      </span>
                      {log.username && (
                        <span className="text-sm text-white font-medium">{log.username}</span>
                      )}
                      {log.role && (
                        <span className="text-xs text-slate-500 uppercase">{log.role}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1 flex-wrap">
                      {log.entity_type && (
                        <span className="text-xs text-slate-500">
                          {log.entity_type}{log.entity_id ? `: ${log.entity_id}` : ''}
                        </span>
                      )}
                      {log.kingdom_id && (
                        <span className="text-xs text-slate-600">{log.kingdom_id}</span>
                      )}
                      {log.details && Object.keys(log.details).length > 0 && (
                        <span className="text-xs text-slate-600 font-mono truncate max-w-xs">
                          {JSON.stringify(log.details)}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-xs text-slate-500">
                      {new Date(log.created_at).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                    </div>
                    <div className="text-xs text-slate-600">
                      {new Date(log.created_at).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default LogsView;
