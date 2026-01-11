import React, { useEffect, useMemo, useState } from 'react';
import { KvkEvent, UploadedFile } from '../types';
import { API_BASE_URL, fetchPublicKvkEvents } from '../api';
import { findColumnIndex, formatNumber, parseGermanNumber } from '../utils';
import { Card } from './Card';
import { Table, TableHeader, TableRow, TableCell } from './Table';
import { useAuth } from './AuthContext';

type SnapshotEntry = {
  name: string;
  alliance: string;
  power: number;
  t4: number;
  t5: number;
  dead: number;
  killPoints: number;
};

type SnapshotDataMap = Map<string, SnapshotEntry>;

type StatProgressRow = {
  id: string;
  name: string;
  alliance: string;
  basePower: number;
  powerDiff: number;
  t4KillsDiff: number;
  t5KillsDiff: number;
  t4t5KillsDiff: number;
  deadDiff: number;
  killPointsDiff: number;
  fightsParticipated?: number;
  dkpScore?: number;
  dkpGoal?: number;
  dkpPercent?: number;
  deadGoal?: number;
  deadPercent?: number;
};

type MigrationMeta = {
  reason: 'dkp-deads' | 'rule-breaker' | 'other';
  contacted: 'yes' | 'no';
  info: string;
};

interface MigrationListProps {
  kingdomSlug: string | null;
}

const parseAnyNumber = (val: any): number => parseGermanNumber(val);

const getSnapshotData = (file: UploadedFile): SnapshotDataMap => {
  const getIdx = (keys: string[]) => findColumnIndex(file.headers, keys);
  const idIdx = getIdx(['id', 'governor id', 'user id']);
  const nameIdx = getIdx(['name', 'display name', 'spieler']);
  const allyIdx = getIdx(['alliance', 'allianz', 'tag']);
  const powerIdx = getIdx(['power', 'kraft']);
  const t4Idx = getIdx(['t4 kills', 'tier 4 kills', 'kills t4']);
  const t5Idx = getIdx(['t5 kills', 'tier 5 kills', 'kills t5']);
  const deadIdx = getIdx(['dead', 'deaths', 'tote', 'dead troops']);
  const killPointsIdx = getIdx(['total kill points', 'kill points', 'kp']);

  const map = new Map<string, SnapshotEntry>();

  if (idIdx === undefined) return map;

  file.data.forEach(row => {
    const id = String(row[idIdx]);
    if (!id || id === 'undefined') return;

    map.set(id, {
      name: nameIdx !== undefined ? String(row[nameIdx]) : 'Unknown',
      alliance: allyIdx !== undefined ? String(row[allyIdx]) : '',
      power: parseAnyNumber(row[powerIdx]),
      t4: parseAnyNumber(row[t4Idx]),
      t5: parseAnyNumber(row[t5Idx]),
      dead: parseAnyNumber(row[deadIdx]),
      killPoints: parseAnyNumber(row[killPointsIdx])
    });
  });
  return map;
};

const resolveGoalPercents = (basePower: number, goalsFormula?: KvkEvent['goalsFormula']) => {
  const brackets = goalsFormula?.powerBrackets || [];
  let dkpPercent = goalsFormula?.basePowerToDkpPercent || 0;
  let deadPercent = goalsFormula?.basePowerToDeadTroopsPercent || 0;

  if (brackets.length > 0) {
    const sorted = [...brackets].sort((a, b) => (a.minPower || 0) - (b.minPower || 0));
    const matchingRange = sorted.find(range => {
      const min = range.minPower ?? 0;
      const max = range.maxPower ?? Number.POSITIVE_INFINITY;
      return basePower >= min && basePower < max;
    });

    if (matchingRange) {
      dkpPercent = matchingRange.dkpPercent ?? dkpPercent;
      deadPercent = matchingRange.deadPercent ?? deadPercent;
    }
  }

  return { dkpPercent, deadPercent };
};

const calculateCumulativeStats = (
  fights: { startFileId: string; endFileId: string }[],
  files: UploadedFile[],
  dkpFormula?: KvkEvent['dkpFormula'],
  goalsFormula?: KvkEvent['goalsFormula'],
  baseSnapshotData?: SnapshotDataMap
): StatProgressRow[] => {
  const grandTotals = new Map<string, StatProgressRow>();

  fights.forEach(fight => {
    const startFile = files.find(f => f.id === fight.startFileId);
    const endFile = files.find(f => f.id === fight.endFileId);

    if (!startFile || !endFile) return;

    const startData = getSnapshotData(startFile);
    const endData = getSnapshotData(endFile);

    endData.forEach((curr, playerId) => {
      const prev = startData.get(playerId);
      const prevPower = prev ? prev.power : 0;
      const prevT4 = prev ? prev.t4 : 0;
      const prevT5 = prev ? prev.t5 : 0;
      const prevDead = prev ? prev.dead : 0;
      const prevKillPoints = prev ? prev.killPoints : 0;

      const deltaT4 = Math.max(0, curr.t4 - prevT4);
      const deltaT5 = Math.max(0, curr.t5 - prevT5);
      const deltaDead = Math.max(0, curr.dead - prevDead);
      const deltaKillPoints = Math.max(0, curr.killPoints - prevKillPoints);

      let deltaPower = 0;
      if (prev) {
        deltaPower = curr.power - prevPower;
      }

      if (!grandTotals.has(playerId)) {
        grandTotals.set(playerId, {
          id: playerId,
          name: curr.name,
          alliance: curr.alliance,
          basePower: baseSnapshotData?.get(playerId)?.power ?? (prev ? prev.power : curr.power),
          powerDiff: 0,
          t4KillsDiff: 0,
          t5KillsDiff: 0,
          t4t5KillsDiff: 0,
          deadDiff: 0,
          killPointsDiff: 0,
          fightsParticipated: 0,
          dkpScore: 0
        });
      }

      const total = grandTotals.get(playerId)!;
      total.name = curr.name;
      total.alliance = curr.alliance;

      total.powerDiff += deltaPower;
      total.t4KillsDiff += deltaT4;
      total.t5KillsDiff += deltaT5;
      total.t4t5KillsDiff += deltaT4 + deltaT5;
      total.deadDiff += deltaDead;
      total.killPointsDiff += deltaKillPoints;

      const dkpEntries = dkpFormula || null;
      if (dkpEntries) {
        const t4Points = dkpEntries.t4?.enabled ? (dkpEntries.t4.points || 0) * deltaT4 : 0;
        const t5Points = dkpEntries.t5?.enabled ? (dkpEntries.t5.points || 0) * deltaT5 : 0;
        const deadPoints = dkpEntries.deadTroops?.enabled ? (dkpEntries.deadTroops.points || 0) * deltaDead : 0;
        total.dkpScore = (total.dkpScore || 0) + t4Points + t5Points + deadPoints;
      }

      total.fightsParticipated = (total.fightsParticipated || 0) + 1;
    });
  });

  grandTotals.forEach(player => {
    const { dkpPercent, deadPercent } = resolveGoalPercents(player.basePower, goalsFormula);
    const dkpGoalFactor = dkpPercent / 100;
    const deadGoalFactor = deadPercent / 100;

    if (dkpGoalFactor > 0) {
      player.dkpGoal = player.basePower * dkpGoalFactor;
      if (player.dkpScore !== undefined) {
        player.dkpPercent = player.dkpGoal > 0 ? (player.dkpScore / player.dkpGoal) * 100 : undefined;
      }
    }

    if (deadGoalFactor > 0) {
      player.deadGoal = player.basePower * deadGoalFactor;
      player.deadPercent = player.deadGoal > 0 ? (player.deadDiff / player.deadGoal) * 100 : undefined;
    }
  });

  return Array.from(grandTotals.values()).sort((a, b) => b.t4t5KillsDiff - a.t4t5KillsDiff);
};

const getPercentClass = (percent?: number) => {
  if (percent === undefined) return 'text-slate-400';
  if (percent >= 100) return 'text-emerald-300';
  if (percent >= 60) return 'text-amber-300';
  return 'text-rose-300';
};

const isMissingGoal = (player: StatProgressRow) => {
  const hasDkpGoal = (player.dkpGoal ?? 0) > 0;
  const hasDeadGoal = (player.deadGoal ?? 0) > 0;
  if (!hasDkpGoal && !hasDeadGoal) return false;

  const dkpMissed = hasDkpGoal ? (player.dkpPercent ?? 0) < 100 : false;
  const deadMissed = hasDeadGoal ? (player.deadPercent ?? 0) < 100 : false;

  return dkpMissed || deadMissed;
};

const MigrationList: React.FC<MigrationListProps> = ({ kingdomSlug }) => {
  const { token } = useAuth();
  const [events, setEvents] = useState<KvkEvent[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string>('');
  const [overviewFiles, setOverviewFiles] = useState<UploadedFile[]>([]);
  const [eventStartSelection, setEventStartSelection] = useState<string>('');
  const [statsData, setStatsData] = useState<StatProgressRow[]>([]);
  const [manualIds, setManualIds] = useState<string[]>([]);
  const [excludedIds, setExcludedIds] = useState<string[]>([]);
  const [detailsById, setDetailsById] = useState<Record<string, MigrationMeta>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedInfoIds, setExpandedInfoIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const activeEvent = useMemo(
    () => events.find(event => event.id === selectedEventId),
    [events, selectedEventId]
  );

  useEffect(() => {
    if (!kingdomSlug) return;
    const loadEvents = async () => {
      try {
        const evs = await fetchPublicKvkEvents(kingdomSlug, token || undefined);
        setEvents(evs);
        if (evs.length > 0) {
          setSelectedEventId(evs[0].id);
        }
      } catch (err) {
        console.error(err);
        setError('Could not load KvK events.');
      }
    };
    loadEvents();
  }, [kingdomSlug, token]);

  useEffect(() => {
    if (!kingdomSlug || !selectedEventId) return;
    const loadOverviewFiles = async () => {
      setLoading(true);
      setError('');
      setManualIds([]);
      setExcludedIds([]);
      setDetailsById({});
      setExpandedInfoIds([]);
      try {
        const response = await fetch(`${API_BASE_URL}/api/public/kingdom/${kingdomSlug}/overview-files`);
        if (!response.ok) {
          throw new Error('Failed to load overview files');
        }
        const files: UploadedFile[] = await response.json();
        setOverviewFiles(files);
        const event = events.find(ev => ev.id === selectedEventId);
        setEventStartSelection(event?.eventStartFileId || files[0]?.id || '');
      } catch (err) {
        console.error(err);
        setError('Could not load overview data.');
      } finally {
        setLoading(false);
      }
    };
    loadOverviewFiles();
  }, [kingdomSlug, selectedEventId, events]);

  useEffect(() => {
    if (!activeEvent || !activeEvent.fights?.length || overviewFiles.length === 0) {
      setStatsData([]);
      return;
    }

    const baseStartFile = overviewFiles.find(f => f.id === eventStartSelection);
    const baseSnapshotData = baseStartFile ? getSnapshotData(baseStartFile) : undefined;

    const calculatedStats = calculateCumulativeStats(
      activeEvent.fights,
      overviewFiles,
      activeEvent.dkpFormula,
      activeEvent.goalsFormula,
      baseSnapshotData
    );
    setStatsData(calculatedStats);
  }, [activeEvent, overviewFiles, eventStartSelection]);

  const autoMigrationPlayers = useMemo(
    () => statsData.filter(player => isMissingGoal(player)),
    [statsData]
  );

  const manualMigrationPlayers = useMemo(
    () => manualIds.map(id => statsData.find(player => player.id === id)).filter(Boolean) as StatProgressRow[],
    [manualIds, statsData]
  );

  const migrationPlayers = useMemo(() => {
    const map = new Map<string, StatProgressRow>();
    autoMigrationPlayers.forEach(player => map.set(player.id, player));
    manualMigrationPlayers.forEach(player => map.set(player.id, player));
    const blocked = new Set(excludedIds);
    return Array.from(map.values()).filter(player => !blocked.has(player.id));
  }, [autoMigrationPlayers, manualMigrationPlayers, excludedIds]);

  useEffect(() => {
    if (migrationPlayers.length === 0) return;
    setDetailsById(prev => {
      const next = { ...prev };
      let changed = false;
      migrationPlayers.forEach(player => {
        if (!next[player.id]) {
          next[player.id] = {
            reason: 'dkp-deads',
            contacted: 'no',
            info: ''
          };
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [migrationPlayers]);

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const query = searchQuery.toLowerCase();
    return statsData.filter(player => {
      return (
        player.name.toLowerCase().includes(query) ||
        player.id.toLowerCase().includes(query) ||
        player.alliance.toLowerCase().includes(query)
      );
    }).slice(0, 6);
  }, [searchQuery, statsData]);

  const handleAddPlayer = (id: string) => {
    setExcludedIds(prev => prev.filter(existing => existing !== id));
    setManualIds(prev => (prev.includes(id) ? prev : [...prev, id]));
    setSearchQuery('');
  };

  const handleRemovePlayer = (id: string) => {
    setManualIds(prev => prev.filter(existing => existing !== id));
    setExcludedIds(prev => (prev.includes(id) ? prev : [...prev, id]));
  };

  const toggleInfoExpanded = (id: string) => {
    setExpandedInfoIds(prev => (
      prev.includes(id) ? prev.filter(existing => existing !== id) : [...prev, id]
    ));
  };

  const updateDetails = (id: string, updates: Partial<MigrationMeta>) => {
    setDetailsById(prev => ({
      ...prev,
      [id]: { ...prev[id], ...updates }
    }));
  };

  if (!kingdomSlug) {
    return (
      <Card className="p-6">
        <p className="text-slate-300">No kingdom selected. Add a slug to access migration data.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-white">Migration list</h2>
            <p className="text-sm text-slate-400">Players missing KvK goals (DKP & Deads) plus manual additions.</p>
          </div>
          <div className="w-full lg:w-72">
            <label className="text-xs text-slate-400">Event</label>
            <select
              value={selectedEventId}
              onChange={(event) => setSelectedEventId(event.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm text-white"
            >
              {events.length === 0 && <option value="">No events</option>}
              {events.map(event => (
                <option key={event.id} value={event.id}>{event.name}</option>
              ))}
            </select>
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <div className="flex flex-col gap-3">
          <label className="text-xs text-slate-400">Add player manually</label>
          <input
            type="text"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm text-white"
            placeholder="Search by GOV ID, name, or alliance"
          />
          {searchResults.length > 0 && (
            <div className="bg-slate-900 border border-slate-800 rounded-md divide-y divide-slate-800">
              {searchResults.map(player => (
                <button
                  key={player.id}
                  type="button"
                  onClick={() => handleAddPlayer(player.id)}
                  className="w-full text-left px-3 py-2 text-sm text-slate-200 hover:bg-slate-800 flex items-center justify-between"
                >
                  <span>{player.name} <span className="text-slate-500">({player.id})</span></span>
                  <span className="text-xs text-slate-500">{player.alliance || '—'}</span>
                </button>
              ))}
            </div>
          )}
          <div className="text-xs text-slate-500">{manualIds.length} manual additions</div>
        </div>
      </Card>

      <Card className="p-6">
        {loading && <p className="text-slate-400">Loading migration data...</p>}
        {error && <p className="text-rose-300">{error}</p>}
        {!loading && !error && (
          <Table>
            <TableHeader>
              <tr>
                <TableCell header>Gov ID</TableCell>
                <TableCell header>Name</TableCell>
                <TableCell header>Alliance</TableCell>
                <TableCell header>Base Power</TableCell>
                <TableCell header>DKP</TableCell>
                <TableCell header>Deads</TableCell>
                <TableCell header>Reason for migration</TableCell>
                <TableCell header>Contacted</TableCell>
                <TableCell header>Info</TableCell>
                <TableCell header>Actions</TableCell>
              </tr>
            </TableHeader>
            <tbody>
              {migrationPlayers.map(player => {
                const details = detailsById[player.id];
                const infoText = details?.info || '';
                const isExpanded = expandedInfoIds.includes(player.id);
                const showExpand = infoText.length > 80;
                return (
                  <TableRow key={player.id}>
                    <TableCell>{player.id}</TableCell>
                    <TableCell>{player.name}</TableCell>
                    <TableCell>{player.alliance || '—'}</TableCell>
                    <TableCell>{formatNumber(player.basePower || 0)}</TableCell>
                    <TableCell>
                      <div className={`font-semibold ${getPercentClass(player.dkpPercent)}`}>
                        {player.dkpPercent !== undefined ? `${player.dkpPercent.toFixed(1)}%` : 'N/A'}
                      </div>
                      <div className="text-xs text-slate-500">
                        {formatNumber(player.dkpScore || 0)} / {formatNumber(player.dkpGoal || 0)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className={`font-semibold ${getPercentClass(player.deadPercent)}`}>
                        {player.deadPercent !== undefined ? `${player.deadPercent.toFixed(1)}%` : 'N/A'}
                      </div>
                      <div className="text-xs text-slate-500">
                        {formatNumber(player.deadDiff || 0)} / {formatNumber(player.deadGoal || 0)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <select
                        value={details?.reason || 'dkp-deads'}
                        onChange={(event) => updateDetails(player.id, { reason: event.target.value as MigrationMeta['reason'] })}
                        className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white"
                      >
                        <option value="dkp-deads">DKP/Deads not reached</option>
                        <option value="rule-breaker">Rule breaker</option>
                        <option value="other">Other</option>
                      </select>
                    </TableCell>
                    <TableCell>
                      <select
                        value={details?.contacted || 'no'}
                        onChange={(event) => updateDetails(player.id, { contacted: event.target.value as MigrationMeta['contacted'] })}
                        className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white"
                      >
                        <option value="yes">Yes</option>
                        <option value="no">No</option>
                      </select>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-2">
                        <textarea
                          value={infoText}
                          onChange={(event) => updateDetails(player.id, { info: event.target.value })}
                          rows={isExpanded ? 4 : 2}
                          className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white resize-none"
                          placeholder="Notes"
                        />
                        {showExpand && (
                          <button
                            type="button"
                            onClick={() => toggleInfoExpanded(player.id)}
                            className="text-xs text-slate-400 hover:text-slate-200 w-fit"
                          >
                            {isExpanded ? 'Collapse' : 'Expand'}
                          </button>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <button
                        type="button"
                        onClick={() => handleRemovePlayer(player.id)}
                        className="text-xs text-rose-200 hover:text-rose-100 bg-rose-500/20 hover:bg-rose-500/30 rounded px-2 py-1"
                      >
                        Remove
                      </button>
                    </TableCell>
                  </TableRow>
                );
              })}
              {migrationPlayers.length === 0 && (
                <TableRow>
                  <td colSpan={10} className="px-4 py-3 text-center text-slate-400">
                    No players currently missing KvK goals.
                  </td>
                </TableRow>
              )}
            </tbody>
          </Table>
        )}
      </Card>
    </div>
  );
};

export default MigrationList;
