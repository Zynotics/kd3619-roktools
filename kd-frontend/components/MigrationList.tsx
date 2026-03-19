import React, { useEffect, useMemo, useRef, useState } from 'react';
import { KvkEvent, UploadedFile } from '../types';
import { API_BASE_URL, fetchMigrationList, fetchPublicKvkEvents, saveMigrationList } from '../api';
import { findColumnIndex, formatNumber, parseGermanNumber } from '../utils';
import { Card } from './Card';
import { Table, TableHeader, TableRow, TableCell } from './Table';
import { useAuth } from './AuthContext';
import ConfirmDialog from './ConfirmDialog';

type SnapshotEntry = {
  name: string;
  alliance: string;
  power: number;
  t4: number;
  t5: number;
  dead: number;
  killPoints: number;
  troopsPower?: number;
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
  zeroed?: boolean;
  zeroedAt?: string; // ISO UTC timestamp
};

interface MigrationListProps {
  kingdomSlug: string | null;
  watchlistedIds: string[];
  watchlistLocations?: Record<string, string>;
  onAddToWatchlist: (id: string) => void;
  onRemoveFromWatchlist: (id: string) => void;
  onUpdateWatchlistLocation?: (id: string, location: string) => void;
  onMigrationPlayerIdsChange?: (ids: Set<string>) => void;
  overviewFileVersion?: number;
  triggerSaveRef?: React.MutableRefObject<(() => void) | null>;
}

const parseAnyNumber = (val: any): number => parseGermanNumber(val);
const defaultMigrationMeta: MigrationMeta = {
  reason: 'dkp-deads',
  contacted: 'no',
  info: ''
};

type SortKey =
  | 'govId'
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
  const troopsPowerIdx = getIdx(['troops power', 'troop power', 'troopspower']);

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
      killPoints: parseAnyNumber(row[killPointsIdx]),
      troopsPower: troopsPowerIdx !== undefined ? parseAnyNumber(row[troopsPowerIdx]) : undefined,
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
      if (baseSnapshotData && !baseSnapshotData.has(playerId)) return;
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

  const dkpMissed = hasDkpGoal ? parseFloat((player.dkpPercent ?? 0).toFixed(1)) < 100 : false;
  const deadMissed = hasDeadGoal ? parseFloat((player.deadPercent ?? 0).toFixed(1)) < 100 : false;

  return dkpMissed || deadMissed;
};

const MigrationList: React.FC<MigrationListProps> = ({ kingdomSlug, watchlistedIds, watchlistLocations = {}, onAddToWatchlist, onRemoveFromWatchlist, onUpdateWatchlistLocation, onMigrationPlayerIdsChange, triggerSaveRef, overviewFileVersion }) => {
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
  const [watchlistSearchQuery, setWatchlistSearchQuery] = useState('');
  const [allianceFilter, setAllianceFilter] = useState('all');
  const [reasonFilter, setReasonFilter] = useState('all');
  const [contactedFilter, setContactedFilter] = useState('all');
  const [migratedFilter, setMigratedFilter] = useState('all');
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: SortDirection } | null>(null);
  const [isPersistLoaded, setIsPersistLoaded] = useState(false);
  const [persistLoadError, setPersistLoadError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveInFlightRef = useRef(false);
  const saveQueuedRef = useRef(false);
  const latestEntriesRef = useRef<typeof migrationEntries | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [pendingAddPlayer, setPendingAddPlayer] = useState<StatProgressRow | null>(null);
  const [pendingRemoveId, setPendingRemoveId] = useState<string | null>(null);
  const [expandedNotesId, setExpandedNotesId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'list' | 'watchlist'>('list');
  const [watchlistFilter, setWatchlistFilter] = useState<'all' | 'disappeared' | 'power-up' | 'zeroed'>('all');
  const [pendingWatchlistToggle, setPendingWatchlistToggle] = useState<{ id: string; name: string; action: 'add' | 'remove' } | null>(null);

  const getDetailsForPlayer = (id: string): MigrationMeta => {
    return detailsById[id] || defaultMigrationMeta;
  };

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
  }, [kingdomSlug, selectedEventId, events, overviewFileVersion]);

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
          const reason = (entry.reason as MigrationMeta['reason']) || 'dkp-deads';
          const contacted = (entry.contacted as MigrationMeta['contacted']) || 'no';
          const info = entry.info || '';
          const zeroed = entry.zeroed === true;
          const zeroedAt = entry.zeroedAt || undefined;
          if (reason !== defaultMigrationMeta.reason || contacted !== defaultMigrationMeta.contacted || info || zeroed) {
            details[id] = { reason, contacted, info, zeroed, zeroedAt };
          }
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

    return [...manualOrdered, ...rest];
  }, [manualMigrationPlayers, autoMigrationPlayers, excludedIds]);

  const migrationPlayerIds = useMemo(() => new Set(migrationPlayers.map(p => p.id)), [migrationPlayers]);

  useEffect(() => {
    onMigrationPlayerIdsChange?.(migrationPlayerIds);
  }, [migrationPlayerIds, onMigrationPlayerIdsChange]);

  const watchlistIdSet = useMemo(() => new Set(watchlistedIds), [watchlistedIds]);

  const latestSnapshotData = useMemo(() => {
    if (overviewFiles.length === 0) return new Map<string, SnapshotEntry>();
    return getSnapshotData(overviewFiles[0]);
  }, [overviewFiles]);

  const prevSnapshotData = useMemo(() => {
    if (overviewFiles.length < 2) return new Map<string, SnapshotEntry>();
    return getSnapshotData(overviewFiles[1]);
  }, [overviewFiles]);

  const watchlistEntries = useMemo(() => {
    return watchlistedIds
      .map(id => {
        const latestEntry = latestSnapshotData.get(id);
        const prevEntry = prevSnapshotData.get(id);
        const name = latestEntry?.name ?? prevEntry?.name ?? id;
        const alliance = latestEntry?.alliance ?? prevEntry?.alliance ?? '';
        const basePower = prevEntry?.power ?? null;
        const currentPower = latestEntry?.power ?? null;
        const powerDelta = currentPower !== null && basePower !== null ? currentPower - basePower : null;
        const currentTroopsPower = latestEntry?.troopsPower ?? null;
        return { id, name, alliance, basePower: basePower ?? currentPower ?? 0, currentPower, powerDelta, currentTroopsPower, disappeared: currentPower === null };
      })
      .sort((a, b) => {
        if (a.disappeared && !b.disappeared) return -1;
        if (!a.disappeared && b.disappeared) return 1;
        const aUp = (a.powerDelta ?? 0) > 0;
        const bUp = (b.powerDelta ?? 0) > 0;
        if (aUp && !bUp) return -1;
        if (!aUp && bUp) return 1;
        return (b.currentPower ?? b.basePower) - (a.currentPower ?? a.basePower);
      });
  }, [watchlistedIds, latestSnapshotData, prevSnapshotData]);

  const filteredWatchlistEntries = useMemo(() => {
    switch (watchlistFilter) {
      case 'disappeared': return watchlistEntries.filter(e => e.disappeared);
      case 'power-up': return watchlistEntries.filter(e => !e.disappeared && (e.powerDelta ?? 0) > 0);
      case 'zeroed': return watchlistEntries.filter(e => getDetailsForPlayer(e.id).zeroed);
      default: return watchlistEntries;
    }
  }, [watchlistEntries, watchlistFilter, detailsById]);

  const allianceOptions = useMemo(() => {
    const alliances = new Set<string>();
    migrationPlayers.forEach(player => {
      alliances.add(player.alliance || '');
    });
    return Array.from(alliances).sort();
  }, [migrationPlayers]);

  const filteredPlayers = useMemo(() => {
    return migrationPlayers.filter(player => {
      const details = getDetailsForPlayer(player.id);
      const isMigrated = manualMigratedIds.includes(player.id);

      if (allianceFilter !== 'all' && (player.alliance || '') !== allianceFilter) return false;
      if (reasonFilter !== 'all' && details.reason !== reasonFilter) return false;
      if (contactedFilter !== 'all' && details.contacted !== contactedFilter) return false;
      if (migratedFilter !== 'all' && (migratedFilter === 'yes') !== isMigrated) return false;
      return true;
    });
  }, [
    migrationPlayers,
    allianceFilter,
    reasonFilter,
    contactedFilter,
    migratedFilter,
    manualMigratedIds,
  ]);

  const sortedPlayers = useMemo(() => {
    if (!sortConfig) return filteredPlayers;
    const { key, direction } = sortConfig;
    const dir = direction === 'asc' ? 1 : -1;
    const sorted = [...filteredPlayers];

    const getString = (val?: string) => (val || '').toLowerCase();
    const getNumber = (val?: number) => (val ?? -1);

    sorted.sort((a, b) => {
      const detailsA = getDetailsForPlayer(a.id);
      const detailsB = getDetailsForPlayer(b.id);
      const migratedA = manualMigratedIds.includes(a.id);
      const migratedB = manualMigratedIds.includes(b.id);

      switch (key) {
        case 'govId':
          return getString(a.id).localeCompare(getString(b.id), undefined, { numeric: true }) * dir;
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
          return getString(detailsA.reason).localeCompare(getString(detailsB.reason)) * dir;
        case 'contacted':
          return getString(detailsA.contacted).localeCompare(getString(detailsB.contacted)) * dir;
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
    manualMigratedIds,
  ]);

  const migrationEntries = useMemo(() => {
    const ids = new Set<string>();
    Object.keys(detailsById).forEach(id => ids.add(id));
    manualIds.forEach(id => ids.add(id));
    excludedIds.forEach(id => ids.add(id));
    manualMigratedIds.forEach(id => ids.add(id));
    manualUnmigratedIds.forEach(id => ids.add(id));

    return Array.from(ids).reduce((acc, id) => {
      const details = getDetailsForPlayer(id);
      const isDefault =
        details.reason === defaultMigrationMeta.reason &&
        details.contacted === defaultMigrationMeta.contacted &&
        details.info === defaultMigrationMeta.info &&
        !details.zeroed;
      const manuallyAdded = manualIds.includes(id);
      const excluded = excludedIds.includes(id);
      const migratedOverride = manualMigratedIds.includes(id)
        ? true
        : manualUnmigratedIds.includes(id)
          ? false
          : null;

      if (!isDefault || manuallyAdded || excluded || migratedOverride !== null) {
        acc.push({
          playerId: id,
          reason: details.reason,
          contacted: details.contacted,
          info: details.info,
          zeroed: details.zeroed || false,
          zeroedAt: details.zeroedAt || null,
          manuallyAdded,
          excluded,
          migratedOverride
        });
      }
      return acc;
    }, [] as {
      playerId: string;
      reason: string;
      contacted: string;
      info: string;
      zeroed: boolean;
      zeroedAt: string | null;
      manuallyAdded: boolean;
      excluded: boolean;
      migratedOverride: boolean | null;
    }[]);
  }, [
    detailsById,
    manualIds,
    excludedIds,
    manualMigratedIds,
    manualUnmigratedIds
  ]);

  useEffect(() => {
    latestEntriesRef.current = migrationEntries;
  }, [migrationEntries]);

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

  const watchlistSearchResults = useMemo(() => {
    if (!watchlistSearchQuery.trim()) return [];
    const query = watchlistSearchQuery.toLowerCase();
    return statsData.filter(player =>
      player.name.toLowerCase().includes(query) ||
      player.id.toLowerCase().includes(query) ||
      player.alliance.toLowerCase().includes(query)
    ).slice(0, 6);
  }, [watchlistSearchQuery, statsData]);

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

  const triggerSave = () => {
    if (saveInFlightRef.current) {
      saveQueuedRef.current = true;
      return;
    }
    const entries = latestEntriesRef.current;
    if (!entries) return;
    saveInFlightRef.current = true;
    setSaveStatus('saving');
    saveMigrationList(entries, apiSlug)
      .then(() => {
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 2000);
      })
      .catch(err => {
        console.error('Migration list save failed:', err);
        setSaveStatus('error');
      })
      .finally(() => {
        saveInFlightRef.current = false;
        if (saveQueuedRef.current) {
          saveQueuedRef.current = false;
          triggerSave();
        }
      });
  };

  useEffect(() => {
    if (triggerSaveRef) triggerSaveRef.current = triggerSave;
  });

  useEffect(() => {
    if (!isPersistLoaded || !token || persistLoadError) return;
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      triggerSave();
    }, 400);

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
      [id]: { ...(prev[id] ?? defaultMigrationMeta), ...updates }
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

      {/* Tab switcher */}
      <div className="flex items-center justify-between">
      <div className="flex items-center gap-1 bg-slate-800/60 border border-slate-700/50 rounded-lg p-1 w-fit">
        <button
          onClick={() => setActiveTab('list')}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
            activeTab === 'list' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Migration List
          <span className={`ml-2 text-xs px-1.5 py-0.5 rounded-full ${
            activeTab === 'list' ? 'bg-slate-600 text-slate-200' : 'bg-slate-700 text-slate-400'
          }`}>{sortedPlayers.length}</span>
        </button>
        <button
          onClick={() => setActiveTab('watchlist')}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${
            activeTab === 'watchlist' ? 'bg-amber-500/20 text-amber-300 shadow-sm' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
          </svg>
          Watchlist
          <span className={`text-xs px-1.5 py-0.5 rounded-full ${
            watchlistIdSet.size > 0
              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
              : activeTab === 'watchlist' ? 'bg-amber-500/10 text-amber-400' : 'bg-slate-700 text-slate-400'
          }`}>{watchlistIdSet.size}</span>
          {(watchlistEntries.some(e => e.disappeared) || watchlistEntries.some(e => !e.disappeared && (e.powerDelta ?? 0) > 0)) && (
            <span className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0 animate-pulse" />
          )}
        </button>
      </div>
      {saveStatus === 'saving' && (
        <span className="text-xs text-slate-400 flex items-center gap-1">
          <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
          Saving…
        </span>
      )}
      {saveStatus === 'saved' && (
        <span className="text-xs text-emerald-400 flex items-center gap-1">
          <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
          Saved
        </span>
      )}
      {saveStatus === 'error' && (
        <span className="text-xs text-red-400 flex items-center gap-1" title="Check browser console for details">
          <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          Save failed
        </span>
      )}
      </div>

      {activeTab === 'list' && <>
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
                  onClick={() => setPendingAddPlayer(player)}
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
              <div className="flex flex-col gap-1">
                <label className="text-xs text-slate-400">Contacted</label>
                <div className="flex rounded overflow-hidden border border-slate-700">
                  {(['all', 'yes', 'no'] as const).map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setContactedFilter(v)}
                      className={`px-2 py-1 text-xs font-medium transition-colors ${
                        contactedFilter === v
                          ? 'bg-blue-500 text-white'
                          : 'bg-slate-900 text-slate-400 hover:bg-slate-700 hover:text-white'
                      }`}
                    >
                      {v === 'all' ? 'All' : v === 'yes' ? 'Yes' : 'No'}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-slate-400">Migrated</label>
                <div className="flex rounded overflow-hidden border border-slate-700">
                  {(['all', 'yes', 'no'] as const).map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setMigratedFilter(v)}
                      className={`px-2 py-1 text-xs font-medium transition-colors ${
                        migratedFilter === v
                          ? 'bg-emerald-500 text-white'
                          : 'bg-slate-900 text-slate-400 hover:bg-slate-700 hover:text-white'
                      }`}
                    >
                      {v === 'all' ? 'All' : v === 'yes' ? 'Yes' : 'No'}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <Table frame={false} className="table-fixed min-w-full [&_td]:px-2 [&_td]:py-2">
            <TableHeader>
              <tr>
                <TableCell header className="w-[90px] cursor-pointer select-none" onClick={() => requestSort('govId')}>Gov ID{sortIndicator('govId')}</TableCell>
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
                <TableCell header className="w-[120px] whitespace-normal">Reason</TableCell>
                <TableCell header className="w-[90px] cursor-pointer select-none" onClick={() => requestSort('contacted')}>
                  Contacted{sortIndicator('contacted')}
                </TableCell>
                <TableCell header className="w-[100px] cursor-pointer select-none" onClick={() => requestSort('migrated')}>
                  Migrated{sortIndicator('migrated')}
                </TableCell>
                <TableCell header className="w-[110px]">Actions</TableCell>
              </tr>
            </TableHeader>
            <tbody>
              {sortedPlayers.map((player, rowIdx) => {
                const details = getDetailsForPlayer(player.id);
                const infoText = details.info || '';
                const isMigrated = manualMigratedIds.includes(player.id);
                const migratedValue: 'yes' | 'no' = isMigrated ? 'yes' : 'no';
                return (
                  <TableRow
                    key={player.id}
                    className={`${rowIdx % 2 === 0 ? 'bg-slate-900/70' : 'bg-slate-800/40'} ${isMigrated ? 'opacity-60' : ''}`}
                  >
                      <TableCell>{player.id}</TableCell>
                      <TableCell className="whitespace-normal">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span>{player.name}</span>
                          {details.contacted === 'yes' && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide bg-blue-500/20 text-blue-300 border border-blue-500/40">
                              <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" />
                              </svg>
                              Contacted
                            </span>
                          )}
                          {details.zeroed && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide bg-red-600/20 text-red-300 border border-red-500/40">
                              <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <circle cx="12" cy="12" r="10" /><line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
                              </svg>
                              Zeroed
                            </span>
                          )}
                          {isMigrated && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide bg-emerald-500/20 text-emerald-300">
                              <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <path d="M5 13l4 4L19 7" />
                              </svg>
                              Migrated
                            </span>
                          )}
                        </div>
                      </TableCell>
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
                      {expandedNotesId === player.id ? (
                        <div className="flex flex-col gap-2">
                          <select
                            value={details.reason}
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
                            rows={4}
                            autoFocus
                            className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white resize-y min-h-[60px]"
                            placeholder="Notes"
                          />
                          <button
                            type="button"
                            onClick={() => setExpandedNotesId(null)}
                            className="text-[10px] text-slate-500 hover:text-slate-300 text-left"
                          >
                            Close ✕
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setExpandedNotesId(player.id)}
                          className="flex flex-col gap-0.5 text-left group w-full"
                        >
                          <span className={`text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded ${
                            details.reason === 'rule-breaker' ? 'bg-rose-500/20 text-rose-300' :
                            details.reason === 'other' ? 'bg-slate-500/20 text-slate-300' :
                            'bg-amber-500/20 text-amber-300'
                          }`}>
                            {details.reason === 'dkp-deads' ? 'DKP/Deads' : details.reason === 'rule-breaker' ? 'Rule breaker' : 'Other'}
                          </span>
                          {infoText && (
                            <span className="text-xs text-slate-300 whitespace-pre-wrap break-words max-w-[180px] leading-snug">{infoText}</span>
                          )}
                          {!infoText && (
                            <span className="text-[10px] text-slate-600 group-hover:text-slate-400">+ add note</span>
                          )}
                        </button>
                      )}
                    </TableCell>
                    <TableCell>
                      <button
                        type="button"
                        onClick={() => updateDetails(player.id, { contacted: details.contacted === 'yes' ? 'no' : 'yes' })}
                        aria-label={details.contacted === 'yes' ? 'Mark as not contacted' : 'Mark as contacted'}
                        className={`w-8 h-4 rounded-full transition-colors duration-200 relative flex-shrink-0 ${
                          details.contacted === 'yes' ? 'bg-blue-500' : 'bg-slate-700'
                        }`}
                      >
                        <span className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-all duration-200 ${
                          details.contacted === 'yes' ? 'left-[18px]' : 'left-0.5'
                        }`} />
                      </button>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleMigratedChange(player.id, migratedValue === 'yes' ? 'no' : 'yes')}
                          aria-label={migratedValue === 'yes' ? 'Mark as not migrated' : 'Mark as migrated'}
                          className={`w-8 h-4 rounded-full transition-colors duration-200 relative flex-shrink-0 ${
                            migratedValue === 'yes' ? 'bg-emerald-500' : 'bg-slate-700'
                          }`}
                        >
                          <span className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-all duration-200 ${
                            migratedValue === 'yes' ? 'left-[18px]' : 'left-0.5'
                          }`} />
                        </button>
                      </div>
                    </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => updateDetails(player.id, { zeroed: !details.zeroed })}
                          aria-label={details.zeroed ? 'Mark as not zeroed' : 'Mark as zeroed'}
                          title={details.zeroed ? 'Remove zeroed mark' : 'Mark as zeroed'}
                          className={`rounded px-2 py-1 inline-flex items-center justify-center text-xs font-bold transition-colors ${
                            details.zeroed
                              ? 'bg-red-600 text-white hover:bg-red-500'
                              : 'bg-slate-700 text-slate-400 hover:bg-red-500/30 hover:text-red-300'
                          }`}
                        >
                          0
                        </button>
                        <button
                          type="button"
                          onClick={() => setPendingWatchlistToggle({ id: player.id, name: player.name, action: watchlistIdSet.has(player.id) ? 'remove' : 'add' })}
                          aria-label={watchlistIdSet.has(player.id) ? 'Remove from watchlist' : 'Add to watchlist'}
                          title={watchlistIdSet.has(player.id) ? 'Remove from watchlist' : 'Add to watchlist'}
                          className={`rounded px-2 py-1 inline-flex items-center justify-center transition-colors ${
                            watchlistIdSet.has(player.id)
                              ? 'bg-amber-500/30 text-amber-300 hover:bg-amber-500/20'
                              : 'bg-slate-700 text-slate-400 hover:bg-amber-500/20 hover:text-amber-300'
                          }`}
                        >
                          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
                          </svg>
                        </button>
                        <button
                          type="button"
                          onClick={() => setPendingRemoveId(player.id)}
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
                        </div>
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
      </>}

      {activeTab === 'watchlist' && (
        <Card className="p-6">
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-amber-300 mb-1">Watch List</h3>
                {overviewFiles.length >= 2 && (
                  <p className="text-sm font-medium text-slate-300">
                    Changes since: <span className="text-white font-semibold">{overviewFiles[1].name.replace(/\.xlsx$/i, '')}</span>
                    <span className="text-slate-500 mx-1">→</span>
                    <span className="text-white font-semibold">{overviewFiles[0].name.replace(/\.xlsx$/i, '')}</span>
                  </p>
                )}
                {overviewFiles.length === 1 && (
                  <p className="text-sm font-medium text-slate-300">
                    Latest scan: <span className="text-white font-semibold">{overviewFiles[0].name.replace(/\.xlsx$/i, '')}</span>
                  </p>
                )}
              </div>
              <div className="flex flex-col sm:flex-row gap-3 sm:items-start">
                {/* Search to add players */}
                <div className="relative w-full sm:w-64">
                  <input
                    type="text"
                    value={watchlistSearchQuery}
                    onChange={(e) => setWatchlistSearchQuery(e.target.value)}
                    placeholder="Search player to add…"
                    className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-1.5 text-sm text-white placeholder-slate-500"
                  />
                  {watchlistSearchResults.length > 0 && (
                    <div className="absolute z-10 top-full mt-1 w-full bg-slate-900 border border-slate-800 rounded-md divide-y divide-slate-800 shadow-lg">
                      {watchlistSearchResults.map(player => (
                        <button
                          key={player.id}
                          type="button"
                          onClick={() => {
                            setPendingWatchlistToggle({ id: player.id, name: player.name, action: 'add' });
                            setWatchlistSearchQuery('');
                          }}
                          className="w-full text-left px-3 py-2 text-sm text-slate-200 hover:bg-slate-800 flex items-center justify-between"
                        >
                          <span>{player.name} <span className="text-slate-500">({player.id})</span></span>
                          <span className="text-xs text-slate-500">{player.alliance || ''}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              {/* Filter buttons */}
              <div className="flex flex-wrap gap-1.5">
                {([
                  { key: 'all', label: 'All', count: watchlistEntries.length, activeClass: 'bg-slate-600 text-white' },
                  { key: 'disappeared', label: 'Disappeared', count: watchlistEntries.filter(e => e.disappeared).length, activeClass: 'bg-amber-500/30 text-amber-300 border border-amber-500/40' },
                  { key: 'power-up', label: 'Power ↑', count: watchlistEntries.filter(e => !e.disappeared && (e.powerDelta ?? 0) > 0).length, activeClass: 'bg-red-500/30 text-red-300 border border-red-500/40' },
                  { key: 'zeroed', label: 'Zeroed', count: watchlistEntries.filter(e => getDetailsForPlayer(e.id).zeroed).length, activeClass: 'bg-red-900/40 text-red-400 border border-red-700/40' },
                ] as const).map(f => (
                  <button
                    key={f.key}
                    onClick={() => setWatchlistFilter(f.key)}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                      watchlistFilter === f.key ? f.activeClass : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {f.label}
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                      watchlistFilter === f.key ? 'bg-white/10' : 'bg-slate-700 text-slate-500'
                    }`}>{f.count}</span>
                  </button>
                ))}
              </div>
              </div>
            </div>

            {/* Alert banners */}
            {watchlistEntries.some(e => e.disappeared) && (
              <div className="flex items-start gap-3 px-4 py-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
                <svg viewBox="0 0 24 24" className="h-5 w-5 text-amber-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
                <div>
                  <p className="text-sm font-semibold text-amber-300">
                    {watchlistEntries.filter(e => e.disappeared).length} players not found in latest scan
                  </p>
                  <p className="text-xs text-amber-400/70 mt-0.5">These players may have migrated or got inactive.</p>
                </div>
              </div>
            )}
            {watchlistEntries.some(e => !e.disappeared && (e.powerDelta ?? 0) > 0) && (
              <div className="flex items-start gap-3 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/30">
                <svg viewBox="0 0 24 24" className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/>
                </svg>
                <div>
                  <p className="text-sm font-semibold text-red-300">
                    {watchlistEntries.filter(e => !e.disappeared && (e.powerDelta ?? 0) > 0).length} players have increased power
                  </p>
                  <p className="text-xs text-red-400/70 mt-0.5">Warning: Increased Troop Power negatively affects event matchmaking.</p>
                </div>
              </div>
            )}

            {watchlistEntries.length === 0 ? (
              <div className="flex flex-col items-center py-10 text-slate-500">
                <svg viewBox="0 0 24 24" className="h-10 w-10 mb-2 opacity-40" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
                </svg>
                <p className="text-sm">No players on the watchlist yet.</p>
                <p className="text-xs mt-1">Add players via the eye icon in the Migration List or Analytics Dashboard.</p>
              </div>
            ) : filteredWatchlistEntries.length === 0 ? (
              <div className="flex flex-col items-center py-8 text-slate-500">
                <p className="text-sm">No players match the filter.</p>
              </div>
            ) : (
              <Table frame={false} className="table-fixed min-w-full [&_td]:px-2 [&_td]:py-2">
                <TableHeader>
                  <tr>
                    <TableCell header className="w-[90px]">Gov ID</TableCell>
                    <TableCell header className="w-[160px] whitespace-normal">Name</TableCell>
                    <TableCell header className="w-[100px]">Alliance</TableCell>
                    <TableCell header className="w-[120px]">Base Power</TableCell>
                    <TableCell header className="w-[120px]">Current Power</TableCell>
                    <TableCell header className="w-[120px]">Δ Power</TableCell>
                    <TableCell header className="w-[120px]">Troop Power</TableCell>
                    <TableCell header className="w-[60px]">Zeroed</TableCell>
                    <TableCell header className="w-[150px]">Location</TableCell>
                    <TableCell header className="w-[60px]"></TableCell>
                  </tr>
                </TableHeader>
                <tbody>
                  {filteredWatchlistEntries.map((entry, rowIdx) => {
                    const details = getDetailsForPlayer(entry.id);
                    const isOnMigrationList = migrationPlayerIds.has(entry.id);
                    const rowBg = entry.disappeared
                      ? 'bg-amber-900/20'
                      : (entry.powerDelta ?? 0) > 0
                      ? 'bg-red-900/20'
                      : rowIdx % 2 === 0 ? 'bg-slate-900/70' : 'bg-slate-800/40';
                    return (
                      <TableRow key={entry.id} className={rowBg}>
                        <TableCell>{entry.id}</TableCell>
                        <TableCell className="whitespace-normal">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-white">{entry.name}</span>
                            {entry.disappeared && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide bg-amber-500/20 text-amber-300 border border-amber-500/40">
                                <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                  <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                                </svg>
                                Disappeared
                              </span>
                            )}
                            {isOnMigrationList && (
                              <span
                                className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide bg-rose-500/20 text-rose-300 border border-rose-500/40"
                                title="This player is on the Migration List"
                              >
                                ML
                              </span>
                            )}
                            {!entry.disappeared && (entry.powerDelta ?? 0) > 0 && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide bg-red-500/20 text-red-300 border border-red-500/40">
                                <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                  <line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/>
                                </svg>
                                Power ↑
                              </span>
                            )}
                            {details.zeroed && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide bg-red-600/20 text-red-300 border border-red-500/40">
                                Zeroed
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{entry.alliance || '-'}</TableCell>
                        <TableCell>{formatNumber(entry.basePower)}</TableCell>
                        <TableCell>
                          {entry.disappeared
                            ? <span className="text-slate-500">—</span>
                            : formatNumber(entry.currentPower ?? 0)
                          }
                        </TableCell>
                        <TableCell>
                          {entry.powerDelta !== null ? (
                            <span className={`font-semibold ${
                              entry.powerDelta > 0 ? 'text-red-400' : entry.powerDelta < 0 ? 'text-emerald-400' : 'text-slate-400'
                            }`}>
                              {entry.powerDelta > 0 ? '+' : ''}{formatNumber(entry.powerDelta)}
                            </span>
                          ) : (
                            <span className="text-slate-500">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {entry.disappeared || entry.currentTroopsPower === null
                            ? <span className="text-slate-500">—</span>
                            : <span className={entry.currentTroopsPower > 0 ? 'text-slate-200' : 'text-slate-500'}>
                                {formatNumber(entry.currentTroopsPower ?? 0)}
                              </span>
                          }
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col items-start gap-0.5">
                            <button
                              type="button"
                              onClick={() => updateDetails(entry.id, {
                                zeroed: !details.zeroed,
                                zeroedAt: !details.zeroed ? new Date().toISOString() : undefined,
                              })}
                              aria-label={details.zeroed ? 'Mark as not zeroed' : 'Mark as zeroed'}
                              title={details.zeroed ? 'Remove zeroed mark' : 'Mark as zeroed'}
                              className={`rounded px-2 py-1 inline-flex items-center justify-center text-xs font-bold transition-colors ${
                                details.zeroed
                                  ? 'bg-red-600 text-white hover:bg-red-500'
                                  : 'bg-slate-700 text-slate-400 hover:bg-red-500/30 hover:text-red-300'
                              }`}
                            >
                              0
                            </button>
                            {details.zeroed && details.zeroedAt && (
                              <span className="text-[10px] text-slate-500 leading-tight flex flex-col">
                                <span>{new Date(details.zeroedAt).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' })}</span>
                                <span>{new Date(details.zeroedAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' })} UTC</span>
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <input
                            type="text"
                            value={watchlistLocations[entry.id] || ''}
                            onChange={(e) => onUpdateWatchlistLocation?.(entry.id, e.target.value)}
                            placeholder=""
                            className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500/60"
                          />
                        </TableCell>
                        <TableCell>
                          <button
                            type="button"
                            onClick={() => setPendingWatchlistToggle({ id: entry.id, name: entry.name, action: 'remove' })}
                            aria-label="Remove from Watchlist"
                            title="Remove from Watchlist"
                            className="text-slate-500 hover:text-rose-300 hover:bg-rose-500/20 rounded p-1 inline-flex items-center justify-center transition-colors"
                          >
                            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                            </svg>
                          </button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </tbody>
              </Table>
            )}
          </div>
        </Card>
      )}

      <ConfirmDialog
        open={!!pendingWatchlistToggle}
        title={pendingWatchlistToggle?.action === 'add' ? 'Add to Watchlist?' : 'Remove from Watchlist?'}
        message={pendingWatchlistToggle?.action === 'add'
          ? `Add "${pendingWatchlistToggle?.name}" to the watchlist? The player will be monitored for power changes and disappearance.`
          : `Remove "${pendingWatchlistToggle?.name}" from the watchlist?`
        }
        confirmLabel={pendingWatchlistToggle?.action === 'add' ? 'Add' : 'Remove'}
        danger={pendingWatchlistToggle?.action === 'remove'}
        onConfirm={() => {
          if (!pendingWatchlistToggle) return;
          if (pendingWatchlistToggle.action === 'add') onAddToWatchlist(pendingWatchlistToggle.id);
          else onRemoveFromWatchlist(pendingWatchlistToggle.id);
          setPendingWatchlistToggle(null);
        }}
        onCancel={() => setPendingWatchlistToggle(null)}
      />

      <ConfirmDialog
        open={!!pendingAddPlayer}
        title="Add player manually?"
        message={pendingAddPlayer ? `Add "${pendingAddPlayer.name}" (${pendingAddPlayer.id}) to the migration list?` : ''}
        confirmLabel="Add"
        danger={false}
        onConfirm={() => {
          if (pendingAddPlayer) handleAddPlayer(pendingAddPlayer.id);
          setPendingAddPlayer(null);
        }}
        onCancel={() => setPendingAddPlayer(null)}
      />

      <ConfirmDialog
        open={!!pendingRemoveId}
        title="Remove player?"
        message={`Remove "${sortedPlayers.find(p => p.id === pendingRemoveId)?.name ?? pendingRemoveId}" from the migration list? They will be excluded from automatic re-addition.`}
        confirmLabel="Remove"
        danger={true}
        onConfirm={() => {
          if (pendingRemoveId) handleRemovePlayer(pendingRemoveId);
          setPendingRemoveId(null);
        }}
        onCancel={() => setPendingRemoveId(null)}
      />

    </div>
  );
};

export default MigrationList;
