import React, { useEffect, useMemo, useRef, useState } from 'react';
import { KvkEvent, UploadedFile } from '../types';
import { API_BASE_URL, fetchMigrationList, fetchPublicKvkEvents, saveMigrationList } from '../api';
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

type SortKey =
  | 'name'
  | 'alliance'
  | 'basePower'
  | 'dkpPercent'
  | 'deadPercent'
  | 'reason'
  | 'contacted'
  | 'migrated';
type SortDirection = 'asc' | 'desc';

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
  const { token, user } = useAuth();
  const [events, setEvents] = useState<KvkEvent[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string>('');
  const [overviewFiles, setOverviewFiles] = useState<UploadedFile[]>([]);
  const [eventStartSelection, setEventStartSelection] = useState<string>('');
  const [statsData, setStatsData] = useState<StatProgressRow[]>([]);
  const [manualIds, setManualIds] = useState<string[]>([]);
  const [excludedIds, setExcludedIds] = useState<string[]>([]);
  const [manualMigratedIds, setManualMigratedIds] = useState<string[]>([]);
  const [manualUnmigratedIds, setManualUnmigratedIds] = useState<string[]>([]);
  const [detailsById, setDetailsById] = useState<Record<string, MigrationMeta>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [allianceFilter, setAllianceFilter] = useState('all');
  const [reasonFilter, setReasonFilter] = useState('all');
  const [contactedFilter, setContactedFilter] = useState('all');
  const [migratedFilter, setMigratedFilter] = useState('all');
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: SortDirection } | null>(null);
  const [isPersistLoaded, setIsPersistLoaded] = useState(false);
  const [persistLoadError, setPersistLoadError] = useState<string | null>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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
      setAllianceFilter('all');
      setReasonFilter('all');
      setContactedFilter('all');
      setMigratedFilter('all');
      setSortConfig(null);
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

  const apiSlug = user?.role === 'admin' ? kingdomSlug || undefined : undefined;

  useEffect(() => {
    if (!token) return;
    let isMounted = true;
    const loadPersisted = async () => {
      try {
        setPersistLoadError(null);
        const entries = await fetchMigrationList(apiSlug);
        if (!isMounted) return;
        const details: Record<string, MigrationMeta> = {};
        const manualIdsNext: string[] = [];
        const excludedIdsNext: string[] = [];
        const manualMigratedNext: string[] = [];
        const manualUnmigratedNext: string[] = [];

        entries.forEach(entry => {
          const id = String(entry.playerId);
          details[id] = {
            reason: (entry.reason as MigrationMeta['reason']) || 'dkp-deads',
            contacted: (entry.contacted as MigrationMeta['contacted']) || 'no',
            info: entry.info || ''
          };
          if (entry.manuallyAdded) manualIdsNext.push(id);
          if (entry.excluded) excludedIdsNext.push(id);
          if (entry.migratedOverride === true) manualMigratedNext.push(id);
          if (entry.migratedOverride === false) manualUnmigratedNext.push(id);
        });

        setDetailsById(details);
        setManualIds(manualIdsNext);
        setExcludedIds(excludedIdsNext);
        setManualMigratedIds(manualMigratedNext);
        setManualUnmigratedIds(manualUnmigratedNext);
        if (isMounted) setIsPersistLoaded(true);
      } catch (err: any) {
        console.error(err);
        if (isMounted) {
          setPersistLoadError(err?.message || 'Failed to load migration list.');
        }
      }
    };
    loadPersisted();
    return () => {
      isMounted = false;
    };
  }, [token, apiSlug]);

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

  const autoMigratedIds = useMemo(() => {
    if (!activeEvent || overviewFiles.length === 0) return new Set<string>();

    const eventFileIds = new Set<string>();
    activeEvent.fights?.forEach(fight => {
      if (fight.startFileId) eventFileIds.add(fight.startFileId);
      if (fight.endFileId) eventFileIds.add(fight.endFileId);
    });
    if (activeEvent.eventStartFileId) eventFileIds.add(activeEvent.eventStartFileId);
    if (eventFileIds.size === 0) return new Set<string>();

    let lastEventIndex = -1;
    let lastEventFile: UploadedFile | undefined;
    overviewFiles.forEach((file, index) => {
      if (eventFileIds.has(file.id) && index > lastEventIndex) {
        lastEventIndex = index;
        lastEventFile = file;
      }
    });
    if (!lastEventFile || lastEventIndex < 0) return new Set<string>();

    const baseIds = new Set<string>(Array.from(getSnapshotData(lastEventFile).keys()));
    if (baseIds.size === 0) return new Set<string>();

    const migratedIds = new Set<string>();
    overviewFiles.slice(lastEventIndex + 1).forEach(file => {
      const currentIds = new Set<string>(Array.from(getSnapshotData(file).keys()));
      baseIds.forEach(id => {
        if (!currentIds.has(id)) migratedIds.add(id);
      });
    });

    return migratedIds;
  }, [activeEvent, overviewFiles]);

  const autoMigratedPlayers = useMemo(
    () => statsData.filter(player => autoMigratedIds.has(player.id)),
    [statsData, autoMigratedIds]
  );

  const manualMigrationPlayers = useMemo(
    () => manualIds.map(id => statsData.find(player => player.id === id)).filter(Boolean) as StatProgressRow[],
    [manualIds, statsData]
  );

  const migrationPlayers = useMemo(() => {
    const blocked = new Set(excludedIds);
    const manualOrdered = manualMigrationPlayers.filter(player => !blocked.has(player.id));
    const seen = new Set(manualOrdered.map(player => player.id));
    const rest: StatProgressRow[] = [];

    const appendUnique = (players: StatProgressRow[]) => {
      players.forEach(player => {
        if (blocked.has(player.id) || seen.has(player.id)) return;
        seen.add(player.id);
        rest.push(player);
      });
    };

    appendUnique(autoMigrationPlayers);
    appendUnique(autoMigratedPlayers);

    return [...manualOrdered, ...rest];
  }, [manualMigrationPlayers, autoMigrationPlayers, autoMigratedPlayers, excludedIds]);

  const allianceOptions = useMemo(() => {
    const alliances = new Set<string>();
    migrationPlayers.forEach(player => {
      alliances.add(player.alliance || '');
    });
    return Array.from(alliances).sort();
  }, [migrationPlayers]);

  const filteredPlayers = useMemo(() => {
    return migrationPlayers.filter(player => {
      const details = detailsById[player.id];
      const isAutoMigrated = autoMigratedIds.has(player.id);
      const isManuallyMigrated = manualMigratedIds.includes(player.id);
      const isManuallyUnmigrated = manualUnmigratedIds.includes(player.id);
      const isMigrated = isManuallyMigrated ? true : isManuallyUnmigrated ? false : isAutoMigrated;

      if (allianceFilter !== 'all' && (player.alliance || '') !== allianceFilter) return false;
      if (reasonFilter !== 'all' && details?.reason !== reasonFilter) return false;
      if (contactedFilter !== 'all' && details?.contacted !== contactedFilter) return false;
      if (migratedFilter !== 'all' && (migratedFilter === 'yes') !== isMigrated) return false;
      return true;
    });
  }, [
    migrationPlayers,
    detailsById,
    allianceFilter,
    reasonFilter,
    contactedFilter,
    migratedFilter,
    autoMigratedIds,
    manualMigratedIds,
    manualUnmigratedIds
  ]);

  const sortedPlayers = useMemo(() => {
    if (!sortConfig) return filteredPlayers;
    const { key, direction } = sortConfig;
    const dir = direction === 'asc' ? 1 : -1;
    const sorted = [...filteredPlayers];

    const getString = (val?: string) => (val || '').toLowerCase();
    const getNumber = (val?: number) => (val ?? -1);

    sorted.sort((a, b) => {
      const detailsA = detailsById[a.id];
      const detailsB = detailsById[b.id];
      const migratedA =
        manualMigratedIds.includes(a.id) ? true :
        manualUnmigratedIds.includes(a.id) ? false :
        autoMigratedIds.has(a.id);
      const migratedB =
        manualMigratedIds.includes(b.id) ? true :
        manualUnmigratedIds.includes(b.id) ? false :
        autoMigratedIds.has(b.id);

      switch (key) {
        case 'name':
          return getString(a.name).localeCompare(getString(b.name)) * dir;
        case 'alliance':
          return getString(a.alliance).localeCompare(getString(b.alliance)) * dir;
        case 'basePower':
          return (getNumber(a.basePower) - getNumber(b.basePower)) * dir;
        case 'dkpPercent':
          return (getNumber(a.dkpPercent) - getNumber(b.dkpPercent)) * dir;
        case 'deadPercent':
          return (getNumber(a.deadPercent) - getNumber(b.deadPercent)) * dir;
        case 'reason':
          return getString(detailsA?.reason).localeCompare(getString(detailsB?.reason)) * dir;
        case 'contacted':
          return getString(detailsA?.contacted).localeCompare(getString(detailsB?.contacted)) * dir;
        case 'migrated':
          return ((migratedA ? 1 : 0) - (migratedB ? 1 : 0)) * dir;
        default:
          return 0;
      }
    });

    return sorted;
  }, [
    filteredPlayers,
    sortConfig,
    detailsById,
    autoMigratedIds,
    manualMigratedIds,
    manualUnmigratedIds
  ]);

  const migrationEntries = useMemo(() => {
    const ids = new Set<string>();
    Object.keys(detailsById).forEach(id => ids.add(id));
    manualIds.forEach(id => ids.add(id));
    excludedIds.forEach(id => ids.add(id));
    manualMigratedIds.forEach(id => ids.add(id));
    manualUnmigratedIds.forEach(id => ids.add(id));

    return Array.from(ids).map(id => {
      const details = detailsById[id];
      return {
        playerId: id,
        reason: details?.reason || 'dkp-deads',
        contacted: details?.contacted || 'no',
        info: details?.info || '',
        manuallyAdded: manualIds.includes(id),
        excluded: excludedIds.includes(id),
        migratedOverride: manualMigratedIds.includes(id)
          ? true
          : manualUnmigratedIds.includes(id)
            ? false
            : null
      };
    });
  }, [
    detailsById,
    manualIds,
    excludedIds,
    manualMigratedIds,
    manualUnmigratedIds
  ]);

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

  const handleMigratedChange = (id: string, value: 'yes' | 'no') => {
    if (value === 'yes') {
      setManualMigratedIds(prev => (prev.includes(id) ? prev : [...prev, id]));
      setManualUnmigratedIds(prev => prev.filter(existing => existing !== id));
      return;
    }
    setManualUnmigratedIds(prev => (prev.includes(id) ? prev : [...prev, id]));
    setManualMigratedIds(prev => prev.filter(existing => existing !== id));
  };

  const requestSort = (key: SortKey) => {
    setSortConfig(prev => {
      if (!prev || prev.key !== key) return { key, direction: 'asc' };
      if (prev.direction === 'asc') return { key, direction: 'desc' };
      return null;
    });
  };

  const sortIndicator = (key: SortKey) => {
    if (!sortConfig || sortConfig.key !== key) return null;
    return sortConfig.direction === 'asc' ? ' ▲' : ' ▼';
  };

  useEffect(() => {
    if (!isPersistLoaded || !token || persistLoadError) return;
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      saveMigrationList(migrationEntries, apiSlug).catch(err => {
        console.error(err);
      });
    }, 300);

    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [isPersistLoaded, token, persistLoadError, apiSlug, migrationEntries]);

  useEffect(() => {
    if (!isPersistLoaded || !token || persistLoadError) return;
    const handleBeforeUnload = () => {
      const query = apiSlug ? `?slug=${encodeURIComponent(apiSlug)}` : '';
      const url = `${API_BASE_URL}/api/migration-list${query}`;
      fetch(url, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ entries: migrationEntries }),
        keepalive: true,
      }).catch(() => {});
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [isPersistLoaded, token, persistLoadError, apiSlug, migrationEntries]);

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
                  <span className="text-xs text-slate-500">{player.alliance || ''}</span>
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
          <>
            <div className="flex flex-wrap gap-3 mb-4">
              <div className="flex flex-col">
                <label className="text-xs text-slate-400">Alliance</label>
                <select
                  value={allianceFilter}
                  onChange={(event) => setAllianceFilter(event.target.value)}
                  className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white"
                >
                  <option value="all">All</option>
                  {allianceOptions.map(alliance => (
                    <option key={alliance || 'none'} value={alliance}>
                      {alliance || '(No Alliance)'}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col">
                <label className="text-xs text-slate-400">Reason</label>
                <select
                  value={reasonFilter}
                  onChange={(event) => setReasonFilter(event.target.value)}
                  className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white"
                >
                  <option value="all">All</option>
                  <option value="dkp-deads">DKP/Deads not reached</option>
                  <option value="rule-breaker">Rule breaker</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div className="flex flex-col">
                <label className="text-xs text-slate-400">Contacted</label>
                <select
                  value={contactedFilter}
                  onChange={(event) => setContactedFilter(event.target.value)}
                  className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white"
                >
                  <option value="all">All</option>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
              </div>
              <div className="flex flex-col">
                <label className="text-xs text-slate-400">Migrated</label>
                <select
                  value={migratedFilter}
                  onChange={(event) => setMigratedFilter(event.target.value)}
                  className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white"
                >
                  <option value="all">All</option>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
              </div>
            </div>
            <Table frame={false} className="table-fixed min-w-full [&_td]:px-2 [&_td]:py-2">
            <TableHeader>
              <tr>
                <TableCell header className="w-[90px]">Gov ID</TableCell>
                <TableCell header className="w-[150px] whitespace-normal cursor-pointer select-none" onClick={() => requestSort('name')}>
                  Name{sortIndicator('name')}
                </TableCell>
                <TableCell header className="w-[100px] whitespace-normal cursor-pointer select-none" onClick={() => requestSort('alliance')}>
                  Alliance{sortIndicator('alliance')}
                </TableCell>
                <TableCell header className="w-[110px] cursor-pointer select-none" onClick={() => requestSort('basePower')}>
                  Base Power{sortIndicator('basePower')}
                </TableCell>
                <TableCell header className="w-[120px] cursor-pointer select-none" onClick={() => requestSort('dkpPercent')}>
                  DKP{sortIndicator('dkpPercent')}
                </TableCell>
                <TableCell header className="w-[120px] cursor-pointer select-none" onClick={() => requestSort('deadPercent')}>
                  Deads{sortIndicator('deadPercent')}
                </TableCell>
                <TableCell header className="w-[170px] whitespace-normal">Reason for migration</TableCell>
                <TableCell header className="w-[90px] cursor-pointer select-none" onClick={() => requestSort('contacted')}>
                  Contacted{sortIndicator('contacted')}
                </TableCell>
                <TableCell header className="w-[100px] cursor-pointer select-none" onClick={() => requestSort('migrated')}>
                  Migrated{sortIndicator('migrated')}
                </TableCell>
                <TableCell header className="w-[60px]">Actions</TableCell>
              </tr>
            </TableHeader>
            <tbody>
              {sortedPlayers.map(player => {
                const details = detailsById[player.id];
                const infoText = details?.info || '';
                const isAutoMigrated = autoMigratedIds.has(player.id);
                const isManuallyMigrated = manualMigratedIds.includes(player.id);
                const isManuallyUnmigrated = manualUnmigratedIds.includes(player.id);
                const isMigrated = isManuallyMigrated ? true : isManuallyUnmigrated ? false : isAutoMigrated;
                const migratedValue: 'yes' | 'no' = isMigrated ? 'yes' : 'no';
                return (
                  <TableRow
                    key={player.id}
                    className={isMigrated ? 'bg-slate-800/70' : ''}
                  >
                      <TableCell>{player.id}</TableCell>
                      <TableCell className="whitespace-normal">{player.name}</TableCell>
                      <TableCell className="whitespace-normal">{player.alliance || '-'}</TableCell>
                      <TableCell>{formatNumber(player.basePower || 0)}</TableCell>
                      <TableCell>
                        <div className={`font-semibold ${getPercentClass(player.dkpPercent)}`}>
                          {player.dkpPercent !== undefined ? `${player.dkpPercent.toFixed(1)}%` : 'N/A'}
                        </div>
                        <div className="text-xs text-slate-500 leading-tight">
                          <div>{formatNumber(player.dkpScore || 0)}</div>
                          <div>{formatNumber(player.dkpGoal || 0)}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className={`font-semibold ${getPercentClass(player.deadPercent)}`}>
                          {player.deadPercent !== undefined ? `${player.deadPercent.toFixed(1)}%` : 'N/A'}
                        </div>
                        <div className="text-xs text-slate-500 leading-tight">
                          <div>{formatNumber(player.deadDiff || 0)}</div>
                          <div>{formatNumber(player.deadGoal || 0)}</div>
                        </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-2">
                        <select
                          value={details?.reason || 'dkp-deads'}
                          onChange={(event) => updateDetails(player.id, { reason: event.target.value as MigrationMeta['reason'] })}
                          className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white"
                        >
                          <option value="dkp-deads">DKP/Deads not reached</option>
                          <option value="rule-breaker">Rule breaker</option>
                          <option value="other">Other</option>
                        </select>
                        <textarea
                          value={infoText}
                          onChange={(event) => updateDetails(player.id, { info: event.target.value })}
                          rows={2}
                          className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white resize-none"
                          placeholder="Notes"
                        />
                      </div>
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
                      <div className="flex items-center gap-2">
                        <select
                          value={migratedValue}
                          onChange={(event) => handleMigratedChange(player.id, event.target.value as 'yes' | 'no')}
                          className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white"
                        >
                          <option value="yes">Yes</option>
                          <option value="no">No</option>
                        </select>
                        {isMigrated && (
                          <svg
                            viewBox="0 0 24 24"
                            className="h-4 w-4 text-emerald-300"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                          >
                            <path d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                        {isAutoMigrated && !isManuallyMigrated && !isManuallyUnmigrated && (
                          <span className="text-[10px] uppercase tracking-wide text-emerald-300">Auto</span>
                        )}
                      </div>
                    </TableCell>
                      <TableCell>
                        <button
                          type="button"
                          onClick={() => handleRemovePlayer(player.id)}
                          aria-label="Remove from list"
                          title="Remove from list"
                          className="text-rose-200 hover:text-rose-100 bg-rose-500/20 hover:bg-rose-500/30 rounded px-2 py-1 inline-flex items-center justify-center"
                        >
                          <svg
                            viewBox="0 0 24 24"
                            className="h-4 w-4"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                          >
                            <path d="M3 6h18" />
                            <path d="M8 6v-2h8v2" />
                            <path d="M7 6l1 14h8l1-14" />
                            <path d="M10 11v6" />
                            <path d="M14 11v6" />
                          </svg>
                        </button>
                      </TableCell>
                    </TableRow>
                );
              })}
              {sortedPlayers.length === 0 && (
                <TableRow>
                  <td colSpan={11} className="px-4 py-3 text-center text-slate-400">
                    No players currently missing KvK goals.
                  </td>
                </TableRow>
              )}
            </tbody>
          </Table>
          </>
        )}
      </Card>
    </div>
  );
};

export default MigrationList;


