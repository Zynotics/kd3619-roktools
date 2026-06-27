import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { KvkEvent, UploadedFile } from '../types';
import {
  API_BASE_URL,
  fetchMigrationList,
  fetchPublicKvkEvents,
  saveMigrationList,
  fetchCreatedMigrationListEvents,
  createMigrationList,
  deleteMigrationList,
  fetchTop1000,
  uploadTop1000,
  deleteTop1000,
  fetchCh25Watchlist,
  addCh25WatchlistPlayer,
  removeCh25WatchlistPlayer,
  Top1000Payload,
  Ch25WatchlistEntry,
} from '../api';
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
  inactive?: boolean;
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
  kvkEventVersion?: number;
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
  | 'migrated'
  | 'inactive';
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

const MigrationList: React.FC<MigrationListProps> = ({ kingdomSlug, watchlistedIds, watchlistLocations = {}, onAddToWatchlist, onRemoveFromWatchlist, onUpdateWatchlistLocation, onMigrationPlayerIdsChange, triggerSaveRef, overviewFileVersion, kvkEventVersion }) => {
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
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [pendingBulkRemove, setPendingBulkRemove] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [watchlistSearchQuery, setWatchlistSearchQuery] = useState('');
  const [allianceFilter, setAllianceFilter] = useState('all');
  const [reasonFilter, setReasonFilter] = useState('all');
  const [contactedFilter, setContactedFilter] = useState('all');
  const [migratedFilter, setMigratedFilter] = useState('all');
  const [inactiveFilter, setInactiveFilter] = useState('all');
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
  const [activeTab, setActiveTab] = useState<'list' | 'top1000' | 'watchlist'>('list');
  const [top1000, setTop1000] = useState<Top1000Payload | null>(null);
  const [top1000Loading, setTop1000Loading] = useState(false);
  const [top1000UploadBusy, setTop1000UploadBusy] = useState(false);
  const [top1000Error, setTop1000Error] = useState<string | null>(null);
  const [top1000Search, setTop1000Search] = useState('');
  const [top1000ChFilter, setTop1000ChFilter] = useState<'all' | 'below25' | 'at25'>('all');
  const [top1000AllianceSelection, setTop1000AllianceSelection] = useState<Set<string>>(new Set());
  const [top1000AllianceMenuOpen, setTop1000AllianceMenuOpen] = useState(false);
  const top1000AllianceMenuRef = useRef<HTMLDivElement | null>(null);
  const [top1000Sort, setTop1000Sort] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
  const [ch25List, setCh25List] = useState<Ch25WatchlistEntry[]>([]);
  const [ch25Busy, setCh25Busy] = useState<Set<string>>(new Set());
  const top1000InputRef = useRef<HTMLInputElement | null>(null);
  const [pendingTop1000Delete, setPendingTop1000Delete] = useState(false);
  const [watchlistFilter, setWatchlistFilter] = useState<'all' | 'disappeared' | 'power-up' | 'zeroed'>('all');
  const [pendingWatchlistToggle, setPendingWatchlistToggle] = useState<{ id: string; name: string; action: 'add' | 'remove' } | null>(null);
  const [createdEventIds, setCreatedEventIds] = useState<Set<string>>(new Set());
  const [createdEventsLoaded, setCreatedEventsLoaded] = useState(false);
  const [isCreatingList, setIsCreatingList] = useState(false);
  const [pendingDeleteList, setPendingDeleteList] = useState(false);
  const [isDeletingList, setIsDeletingList] = useState(false);

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
        // Only auto-pick when no event has been chosen yet — otherwise the
        // user's current selection is preserved across refetches (e.g.
        // triggered by a KvK event being added in the KvK manager).
        if (evs.length > 0 && !selectedEventId) {
          setSelectedEventId(evs[0].id);
        }
      } catch (err) {
        console.error(err);
        setError('Could not load KvK events.');
      }
    };
    loadEvents();
    // kvkEventVersion is intentionally a dependency so that creating /
    // editing / deleting an event in the KvK manager forces a refetch here.
  }, [kingdomSlug, token, kvkEventVersion]);  // eslint-disable-line react-hooks/exhaustive-deps

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
  const isListCreatedForCurrentEvent = !!selectedEventId && createdEventIds.has(selectedEventId);

  // Load the set of events that already have an active migration list.
  useEffect(() => {
    if (!token) return;
    let isMounted = true;
    setCreatedEventsLoaded(false);
    fetchCreatedMigrationListEvents(apiSlug)
      .then(eventIds => {
        if (!isMounted) return;
        setCreatedEventIds(new Set(eventIds));
        setCreatedEventsLoaded(true);
      })
      .catch(err => {
        console.error(err);
        if (isMounted) {
          setCreatedEventIds(new Set());
          setCreatedEventsLoaded(true);
        }
      });
    return () => { isMounted = false; };
  }, [token, apiSlug, kvkEventVersion]);

  useEffect(() => {
    if (!token || !selectedEventId) {
      setDetailsById({});
      setManualIds([]);
      setExcludedIds([]);
      setManualMigratedIds([]);
      setManualUnmigratedIds([]);
      setIsPersistLoaded(false);
      return;
    }
    // Skip loading entries while we don't yet know if a list exists, or for
    // events without one — entries are gated behind the "Create" button.
    if (!createdEventsLoaded || !isListCreatedForCurrentEvent) {
      setDetailsById({});
      setManualIds([]);
      setExcludedIds([]);
      setManualMigratedIds([]);
      setManualUnmigratedIds([]);
      setIsPersistLoaded(false);
      return;
    }

    let isMounted = true;
    const loadPersisted = async () => {
      try {
        setPersistLoadError(null);
        setIsPersistLoaded(false);
        const entries = await fetchMigrationList(selectedEventId, apiSlug);
        if (!isMounted) return;
        const details: Record<string, MigrationMeta> = {};
        const manualIdsNext: string[] = [];
        const manualMigratedNext: string[] = [];
        const manualUnmigratedNext: string[] = [];

        entries.forEach(entry => {
          const id = String(entry.playerId);
          const reason = (entry.reason as MigrationMeta['reason']) || 'dkp-deads';
          const contacted = (entry.contacted as MigrationMeta['contacted']) || 'no';
          const info = entry.info || '';
          const zeroed = entry.zeroed === true;
          const zeroedAt = entry.zeroedAt || undefined;
          const inactive = (entry as any).inactive === true;
          if (reason !== defaultMigrationMeta.reason || contacted !== defaultMigrationMeta.contacted || info || zeroed || inactive) {
            details[id] = { reason, contacted, info, zeroed, zeroedAt, inactive };
          }
          if (entry.manuallyAdded) manualIdsNext.push(id);
          // `excluded` is intentionally NOT restored — session-only hide.
          if (entry.migratedOverride === true) manualMigratedNext.push(id);
          if (entry.migratedOverride === false) manualUnmigratedNext.push(id);
        });

        setDetailsById(details);
        setManualIds(manualIdsNext);
        setExcludedIds([]);
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
  }, [token, apiSlug, selectedEventId, createdEventsLoaded, isListCreatedForCurrentEvent]);

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

  // All players from all overview files (for search / manual add)
  const allSnapshotPlayers = useMemo(() => {
    const merged = new Map<string, SnapshotEntry>();
    // Iterate oldest-first so newest data wins on conflicts
    for (let i = overviewFiles.length - 1; i >= 0; i--) {
      const snap = getSnapshotData(overviewFiles[i]);
      snap.forEach((entry, id) => merged.set(id, entry));
    }
    return merged;
  }, [overviewFiles]);

  const manualMigrationPlayers = useMemo(
    () => manualIds.map(id => {
      const fromStats = statsData.find(player => player.id === id);
      if (fromStats) return fromStats;
      // Player not in statsData — build row from snapshot data.
      // Also derive dkpGoal / deadGoal from the configured KvK event so the
      // UI shows "0 / 10M (0%)" instead of "N/A" for players who disappeared
      // mid-event. They contributed nothing → goal definitely missed.
      const snap = allSnapshotPlayers.get(id);
      if (!snap) return null;
      const goalsFormula = activeEvent?.goalsFormula;
      const { dkpPercent: dkpPct, deadPercent: deadPct } = resolveGoalPercents(snap.power, goalsFormula);
      const dkpGoalFactor = dkpPct / 100;
      const deadGoalFactor = deadPct / 100;
      const dkpGoal = dkpGoalFactor > 0 ? snap.power * dkpGoalFactor : undefined;
      const deadGoal = deadGoalFactor > 0 ? snap.power * deadGoalFactor : undefined;
      return {
        id,
        name: snap.name,
        alliance: snap.alliance,
        basePower: snap.power,
        powerDiff: 0,
        t4KillsDiff: 0,
        t5KillsDiff: 0,
        t4t5KillsDiff: 0,
        deadDiff: 0,
        killPointsDiff: 0,
        dkpScore: 0,
        dkpGoal,
        dkpPercent: dkpGoal !== undefined && dkpGoal > 0 ? 0 : undefined,
        deadGoal,
        deadPercent: deadGoal !== undefined && deadGoal > 0 ? 0 : undefined,
      } as StatProgressRow;
    }).filter(Boolean) as StatProgressRow[],
    [manualIds, statsData, allSnapshotPlayers, activeEvent]
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
      const isInactive = !!details.inactive;
      if (inactiveFilter !== 'all' && (inactiveFilter === 'yes') !== isInactive) return false;
      return true;
    });
  }, [
    migrationPlayers,
    allianceFilter,
    reasonFilter,
    contactedFilter,
    migratedFilter,
    inactiveFilter,
    manualMigratedIds,
    detailsById,
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
          // Sort by absolute DKP score, not percentage.
          return (getNumber(a.dkpScore) - getNumber(b.dkpScore)) * dir;
        case 'deadPercent':
          return (getNumber(a.deadPercent) - getNumber(b.deadPercent)) * dir;
        case 'reason':
          return getString(detailsA.reason).localeCompare(getString(detailsB.reason)) * dir;
        case 'contacted':
          return getString(detailsA.contacted).localeCompare(getString(detailsB.contacted)) * dir;
        case 'migrated':
          return ((migratedA ? 1 : 0) - (migratedB ? 1 : 0)) * dir;
        case 'inactive':
          return ((detailsA.inactive ? 1 : 0) - (detailsB.inactive ? 1 : 0)) * dir;
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
    // excludedIds intentionally NOT included — removes are session-only,
    // not persisted across reloads.
    manualMigratedIds.forEach(id => ids.add(id));
    manualUnmigratedIds.forEach(id => ids.add(id));

    return Array.from(ids).reduce((acc, id) => {
      const details = getDetailsForPlayer(id);
      const isDefault =
        details.reason === defaultMigrationMeta.reason &&
        details.contacted === defaultMigrationMeta.contacted &&
        details.info === defaultMigrationMeta.info &&
        !details.zeroed &&
        !details.inactive;
      const manuallyAdded = manualIds.includes(id);
      const migratedOverride = manualMigratedIds.includes(id)
        ? true
        : manualUnmigratedIds.includes(id)
          ? false
          : null;

      if (!isDefault || manuallyAdded || migratedOverride !== null) {
        acc.push({
          playerId: id,
          reason: details.reason,
          contacted: details.contacted,
          info: details.info,
          zeroed: details.zeroed || false,
          zeroedAt: details.zeroedAt || null,
          inactive: details.inactive || false,
          manuallyAdded,
          excluded: false,  // never persist excluded — session-only
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
      inactive: boolean;
      manuallyAdded: boolean;
      excluded: boolean;
      migratedOverride: boolean | null;
    }[]);
  }, [
    detailsById,
    manualIds,
    manualMigratedIds,
    manualUnmigratedIds
  ]);

  useEffect(() => {
    latestEntriesRef.current = migrationEntries;
  }, [migrationEntries]);

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const query = searchQuery.toLowerCase();
    const results: StatProgressRow[] = [];
    const seen = new Set<string>();
    // Search statsData first (has full KvK stats)
    for (const player of statsData) {
      if (player.name.toLowerCase().includes(query) || player.id.toLowerCase().includes(query) || player.alliance.toLowerCase().includes(query)) {
        results.push(player);
        seen.add(player.id);
      }
      if (results.length >= 10) break;
    }
    // Then search all snapshot players for those not already found
    if (results.length < 10) {
      allSnapshotPlayers.forEach((snap, id) => {
        if (seen.has(id) || results.length >= 10) return;
        if (snap.name.toLowerCase().includes(query) || id.toLowerCase().includes(query) || snap.alliance.toLowerCase().includes(query)) {
          results.push({
            id,
            name: snap.name,
            alliance: snap.alliance,
            basePower: snap.power,
            powerDiff: 0,
            t4KillsDiff: 0,
            t5KillsDiff: 0,
            t4t5KillsDiff: 0,
            deadDiff: 0,
            killPointsDiff: 0,
          });
          seen.add(id);
        }
      });
    }
    return results;
  }, [searchQuery, statsData, allSnapshotPlayers]);

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

  const handleBulkRemove = () => {
    const ids = Array.from(selectedIds);
    if (!ids.length) return;
    setManualIds(prev => prev.filter(existing => !selectedIds.has(existing)));
    setExcludedIds(prev => {
      const next = new Set(prev);
      ids.forEach(id => next.add(id));
      return Array.from(next);
    });
    setSelectedIds(new Set());
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
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
    if (!selectedEventId) return;
    if (saveInFlightRef.current) {
      saveQueuedRef.current = true;
      return;
    }
    const entries = latestEntriesRef.current;
    if (!entries) return;
    saveInFlightRef.current = true;
    setSaveStatus('saving');
    saveMigrationList(selectedEventId, entries, apiSlug)
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
    if (!isPersistLoaded || !token || persistLoadError || !selectedEventId) return;
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      triggerSave();
    }, 400);

    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [isPersistLoaded, token, persistLoadError, apiSlug, selectedEventId, migrationEntries]);

  useEffect(() => {
    if (!isPersistLoaded || !token || persistLoadError || !selectedEventId) return;
    const handleBeforeUnload = () => {
      const params = new URLSearchParams();
      params.set('eventId', selectedEventId);
      if (apiSlug) params.set('slug', apiSlug);
      const url = `${API_BASE_URL}/api/migration-list?${params.toString()}`;
      fetch(url, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ entries: migrationEntries, eventId: selectedEventId }),
        keepalive: true,
      }).catch(() => {});
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [isPersistLoaded, token, persistLoadError, apiSlug, selectedEventId, migrationEntries]);

  const handleCreateMigrationList = async () => {
    if (!selectedEventId || isCreatingList) return;
    setIsCreatingList(true);
    try {
      await createMigrationList(selectedEventId, apiSlug);
      setCreatedEventIds(prev => {
        const next = new Set(prev);
        next.add(selectedEventId);
        return next;
      });
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'Failed to create migration list.');
    } finally {
      setIsCreatingList(false);
    }
  };

  // ===== Top 1000 + <CH25 Watchlist =====

  useEffect(() => {
    if (!token) return;
    let isMounted = true;
    setTop1000Loading(true);
    setTop1000Error(null);
    fetchTop1000(apiSlug)
      .then(payload => { if (isMounted) setTop1000(payload); })
      .catch(err => {
        console.error(err);
        if (isMounted) setTop1000Error(err?.message || 'Failed to load Top 1000.');
      })
      .finally(() => { if (isMounted) setTop1000Loading(false); });
    fetchCh25Watchlist(apiSlug)
      .then(entries => { if (isMounted) setCh25List(entries); })
      .catch(err => console.error(err));
    return () => { isMounted = false; };
  }, [token, apiSlug]);

  // Resolve which column index in top1000.headers holds which field.
  const top1000Cols = useMemo(() => {
    if (!top1000) return null;
    const headers = top1000.headers || [];
    return {
      id: findColumnIndex(headers, ['id', 'governor id', 'gov id', 'user id']),
      name: findColumnIndex(headers, ['name', 'display name', 'spieler']),
      alliance: findColumnIndex(headers, ['alliance', 'allianz', 'tag']),
      power: findColumnIndex(headers, ['power', 'kraft']),
      ch: findColumnIndex(headers, ['city hall', 'ch', 'ch level', 'cityhall', 'city hall level']),
      kp: findColumnIndex(headers, ['kill points', 'total kill points', 'kp']),
      dead: findColumnIndex(headers, ['dead', 'deaths', 'tote', 'dead troops']),
      troopsPower: findColumnIndex(headers, ['troops power', 'troop power', 'troopspower', 'truppen kraft', 'truppenkraft']),
    };
  }, [top1000]);

  type Top1000Row = {
    id: string;
    name: string;
    alliance: string;
    power: number;
    ch?: number;
    kp?: number;
    dead?: number;
    troopsPower?: number;
  };

  const top1000Rows = useMemo<Top1000Row[]>(() => {
    if (!top1000 || !top1000Cols) return [];
    const cols = top1000Cols;
    return (top1000.data || [])
      .map((row): Top1000Row | null => {
        const id = cols.id !== undefined ? String(row[cols.id] ?? '').trim() : '';
        if (!id || id === 'undefined') return null;
        const numOrUndef = (i?: number) => (i !== undefined ? parseAnyNumber(row[i]) : undefined);
        return {
          id,
          name: cols.name !== undefined ? String(row[cols.name] ?? '') : '',
          alliance: cols.alliance !== undefined ? String(row[cols.alliance] ?? '') : '',
          power: cols.power !== undefined ? parseAnyNumber(row[cols.power]) : 0,
          ch: numOrUndef(cols.ch),
          kp: numOrUndef(cols.kp),
          dead: numOrUndef(cols.dead),
          troopsPower: numOrUndef(cols.troopsPower),
        };
      })
      .filter((r): r is Top1000Row => r !== null);
  }, [top1000, top1000Cols]);

  const ch25IdSet = useMemo(() => new Set(ch25List.map(e => e.playerId)), [ch25List]);

  const top1000AllianceOptions = useMemo(() => {
    const alliances = new Set<string>();
    top1000Rows.forEach(row => alliances.add(row.alliance || ''));
    return Array.from(alliances).sort();
  }, [top1000Rows]);

  const filteredTop1000 = useMemo(() => {
    const q = top1000Search.trim().toLowerCase();
    return top1000Rows.filter(row => {
      if (top1000ChFilter !== 'all') {
        if (row.ch === undefined) return false;
        if (top1000ChFilter === 'below25' && !(row.ch < 25)) return false;
        if (top1000ChFilter === 'at25' && row.ch !== 25) return false;
      }
      if (top1000AllianceSelection.size > 0 && !top1000AllianceSelection.has(row.alliance || '')) {
        return false;
      }
      if (q) {
        return (
          row.name.toLowerCase().includes(q) ||
          row.id.toLowerCase().includes(q) ||
          (row.alliance || '').toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [top1000Rows, top1000Search, top1000ChFilter, top1000AllianceSelection]);

  // Close alliance popover when clicking outside.
  useEffect(() => {
    if (!top1000AllianceMenuOpen) return;
    const onDocClick = (e: MouseEvent) => {
      if (top1000AllianceMenuRef.current && !top1000AllianceMenuRef.current.contains(e.target as Node)) {
        setTop1000AllianceMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [top1000AllianceMenuOpen]);

  const toggleTop1000Alliance = (alliance: string) => {
    setTop1000AllianceSelection(prev => {
      const next = new Set(prev);
      if (next.has(alliance)) next.delete(alliance);
      else next.add(alliance);
      return next;
    });
  };

  const sortedTop1000 = useMemo(() => {
    if (!top1000Sort) return filteredTop1000;
    const { key, direction } = top1000Sort;
    const dir = direction === 'asc' ? 1 : -1;
    const getString = (v?: string) => (v || '').toLowerCase();
    const getNumber = (v?: number) => (v === undefined ? -1 : v);
    return [...filteredTop1000].sort((a, b) => {
      switch (key) {
        case 'id': return getString(a.id).localeCompare(getString(b.id), undefined, { numeric: true }) * dir;
        case 'name': return getString(a.name).localeCompare(getString(b.name)) * dir;
        case 'alliance': return getString(a.alliance).localeCompare(getString(b.alliance)) * dir;
        case 'power': return (getNumber(a.power) - getNumber(b.power)) * dir;
        case 'troopsPower': return (getNumber(a.troopsPower) - getNumber(b.troopsPower)) * dir;
        case 'ch': return (getNumber(a.ch) - getNumber(b.ch)) * dir;
        case 'kp': return (getNumber(a.kp) - getNumber(b.kp)) * dir;
        case 'dead': return (getNumber(a.dead) - getNumber(b.dead)) * dir;
        default: return 0;
      }
    });
  }, [filteredTop1000, top1000Sort]);

  const requestTop1000Sort = (key: string) => {
    setTop1000Sort(prev => {
      if (!prev || prev.key !== key) return { key, direction: 'asc' };
      if (prev.direction === 'asc') return { key, direction: 'desc' };
      return null;
    });
  };
  const top1000SortIndicator = (key: string) => {
    if (!top1000Sort || top1000Sort.key !== key) return null;
    return top1000Sort.direction === 'asc' ? ' ▲' : ' ▼';
  };

  const handleTop1000FileSelected = async (file: File | null) => {
    if (!file) return;
    setTop1000UploadBusy(true);
    setTop1000Error(null);
    try {
      await uploadTop1000(file, apiSlug);
      const payload = await fetchTop1000(apiSlug);
      setTop1000(payload);
    } catch (err: any) {
      console.error(err);
      setTop1000Error(err?.message || 'Upload failed.');
    } finally {
      setTop1000UploadBusy(false);
      if (top1000InputRef.current) top1000InputRef.current.value = '';
    }
  };

  const handleTop1000Delete = async () => {
    setTop1000UploadBusy(true);
    setTop1000Error(null);
    try {
      await deleteTop1000(apiSlug);
      setTop1000(null);
    } catch (err: any) {
      console.error(err);
      setTop1000Error(err?.message || 'Delete failed.');
    } finally {
      setTop1000UploadBusy(false);
      setPendingTop1000Delete(false);
    }
  };

  const handleAddCh25 = async (playerId: string) => {
    if (ch25IdSet.has(playerId) || ch25Busy.has(playerId)) return;
    setCh25Busy(prev => { const n = new Set(prev); n.add(playerId); return n; });
    try {
      await addCh25WatchlistPlayer(playerId, undefined, apiSlug);
      setCh25List(prev => [
        { playerId, notes: '', addedAt: new Date().toISOString() },
        ...prev,
      ]);
    } catch (err) {
      console.error(err);
    } finally {
      setCh25Busy(prev => { const n = new Set(prev); n.delete(playerId); return n; });
    }
  };

  const handleRemoveCh25 = async (playerId: string) => {
    if (ch25Busy.has(playerId)) return;
    setCh25Busy(prev => { const n = new Set(prev); n.add(playerId); return n; });
    try {
      await removeCh25WatchlistPlayer(playerId, apiSlug);
      setCh25List(prev => prev.filter(e => e.playerId !== playerId));
    } catch (err) {
      console.error(err);
    } finally {
      setCh25Busy(prev => { const n = new Set(prev); n.delete(playerId); return n; });
    }
  };

  // Look up a row from the loaded Top 1000 by player id (for the watchlist sub-section).
  const top1000ById = useMemo(() => {
    const map = new Map<string, Top1000Row>();
    top1000Rows.forEach(row => map.set(row.id, row));
    return map;
  }, [top1000Rows]);

  // <CH25 watchlist always sorted by troop power desc (players not in the
  // current upload sink to the bottom).
  const sortedCh25List = useMemo(() => {
    return [...ch25List].sort((a, b) => {
      const ta = top1000ById.get(a.playerId)?.troopsPower;
      const tb = top1000ById.get(b.playerId)?.troopsPower;
      const va = ta === undefined ? -1 : ta;
      const vb = tb === undefined ? -1 : tb;
      return vb - va;
    });
  }, [ch25List, top1000ById]);

  const handleExportXlsx = () => {
    if (sortedPlayers.length === 0) return;

    const round = (val: number | undefined, digits = 1): number | string => {
      if (val === undefined || val === null || Number.isNaN(val)) return '';
      const factor = Math.pow(10, digits);
      return Math.round(val * factor) / factor;
    };

    const reasonLabel = (r: MigrationMeta['reason']) =>
      r === 'dkp-deads' ? 'DKP/Deads not reached' : r === 'rule-breaker' ? 'Rule breaker' : 'Other';

    const rows = sortedPlayers.map(player => {
      const details = getDetailsForPlayer(player.id);
      const isMigrated = manualMigratedIds.includes(player.id);
      return {
        'Gov ID': player.id,
        'Name': player.name,
        'Alliance': player.alliance || '',
        'Base Power': Math.round(player.basePower || 0),
        'DKP Score': Math.round(player.dkpScore || 0),
        'DKP Goal': Math.round(player.dkpGoal || 0),
        'DKP %': round(player.dkpPercent),
        'Deads': Math.round(player.deadDiff || 0),
        'Dead Goal': Math.round(player.deadGoal || 0),
        'Deads %': round(player.deadPercent),
        'Reason': reasonLabel(details.reason),
        'Notes': details.info || '',
        'Contacted': details.contacted === 'yes' ? 'Yes' : 'No',
        'Migrated': isMigrated ? 'Yes' : 'No',
        'Inactive': details.inactive ? 'Yes' : 'No',
        'Zeroed': details.zeroed ? 'Yes' : 'No',
        'Zeroed At (UTC)': details.zeroedAt ? new Date(details.zeroedAt).toISOString() : '',
      };
    });

    const sheet = XLSX.utils.json_to_sheet(rows);
    // Auto column widths
    const colKeys = Object.keys(rows[0]);
    sheet['!cols'] = colKeys.map(key => {
      const max = Math.max(
        key.length,
        ...rows.map(r => String((r as any)[key] ?? '').length)
      );
      return { wch: Math.min(Math.max(max + 2, 8), 40) };
    });

    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, 'Migration List');

    const safeEventName = (activeEvent?.name || 'Event').replace(/[\\/:*?"<>|]/g, '_');
    const dateStamp = new Date().toISOString().slice(0, 10);
    const filename = `MigrationList_${safeEventName}_${dateStamp}.xlsx`;
    XLSX.writeFile(book, filename);
  };

  const handleExportWatchlistXlsx = () => {
    if (filteredWatchlistEntries.length === 0) return;

    const rows = filteredWatchlistEntries.map(entry => {
      const details = getDetailsForPlayer(entry.id);
      const isOnMigrationList = migrationPlayerIds.has(entry.id);
      const status: string[] = [];
      if (entry.disappeared) status.push('Disappeared');
      if (!entry.disappeared && (entry.powerDelta ?? 0) > 0) status.push('Power Up');
      if (details.zeroed) status.push('Zeroed');
      if (isOnMigrationList) status.push('On Migration List');

      return {
        'Gov ID': entry.id,
        'Name': entry.name,
        'Alliance': entry.alliance || '',
        'Base Power': Math.round(entry.basePower || 0),
        'Current Power': entry.currentPower !== null ? Math.round(entry.currentPower) : '',
        'Δ Power': entry.powerDelta !== null ? Math.round(entry.powerDelta) : '',
        'Troop Power': entry.currentTroopsPower !== null && entry.currentTroopsPower !== undefined
          ? Math.round(entry.currentTroopsPower)
          : '',
        'Zeroed': details.zeroed ? 'Yes' : 'No',
        'Zeroed At (UTC)': details.zeroedAt ? new Date(details.zeroedAt).toISOString() : '',
        'Location': watchlistLocations[entry.id] || '',
        'Status': status.join(', '),
      };
    });

    const sheet = XLSX.utils.json_to_sheet(rows);
    const colKeys = Object.keys(rows[0]);
    sheet['!cols'] = colKeys.map(key => {
      const max = Math.max(
        key.length,
        ...rows.map(r => String((r as any)[key] ?? '').length)
      );
      return { wch: Math.min(Math.max(max + 2, 8), 40) };
    });

    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, 'Watchlist');

    const safeSlug = (kingdomSlug || 'kingdom').replace(/[\\/:*?"<>|]/g, '_');
    const dateStamp = new Date().toISOString().slice(0, 10);
    const filename = `Watchlist_${safeSlug}_${dateStamp}.xlsx`;
    XLSX.writeFile(book, filename);
  };

  const handleDeleteMigrationList = async () => {
    if (!selectedEventId || isDeletingList) return;
    setIsDeletingList(true);
    try {
      await deleteMigrationList(selectedEventId, apiSlug);
      setCreatedEventIds(prev => {
        const next = new Set(prev);
        next.delete(selectedEventId);
        return next;
      });
      setDetailsById({});
      setManualIds([]);
      setExcludedIds([]);
      setManualMigratedIds([]);
      setManualUnmigratedIds([]);
      setIsPersistLoaded(false);
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'Failed to delete migration list.');
    } finally {
      setIsDeletingList(false);
      setPendingDeleteList(false);
    }
  };

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
          onClick={() => setActiveTab('top1000')}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${
            activeTab === 'top1000' ? 'bg-sky-500/20 text-sky-300 shadow-sm' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Top 1000
          <span className={`text-xs px-1.5 py-0.5 rounded-full ${
            activeTab === 'top1000' ? 'bg-sky-500/20 text-sky-300' : 'bg-slate-700 text-slate-400'
          }`}>{top1000Rows.length}</span>
          {ch25List.length > 0 && (
            <span
              className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40"
              title={`${ch25List.length} player${ch25List.length === 1 ? '' : 's'} on <CH25 watchlist`}
            >
              {`<CH25 ${ch25List.length}`}
            </span>
          )}
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

      {activeTab === 'list' && !isListCreatedForCurrentEvent && createdEventsLoaded && selectedEventId && (
        <Card className="p-8">
          <div className="flex flex-col items-center text-center gap-4">
            <svg viewBox="0 0 24 24" className="h-12 w-12 text-slate-500" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="12" y1="18" x2="12" y2="12" />
              <line x1="9" y1="15" x2="15" y2="15" />
            </svg>
            <div>
              <h3 className="text-lg font-bold text-white">
                No migration list for {activeEvent?.name || 'this event'} yet
              </h3>
              <p className="text-sm text-slate-400 mt-1 max-w-md">
                Each KvK event gets its own independent migration list. Create one to start tracking players who miss goals, manual additions, contacted state, etc.
              </p>
            </div>
            <button
              type="button"
              onClick={handleCreateMigrationList}
              disabled={isCreatingList}
              className="px-4 py-2 rounded bg-sky-500 hover:bg-sky-400 text-white font-medium text-sm transition disabled:opacity-60"
            >
              {isCreatingList ? 'Creating…' : `Create Migration List for ${activeEvent?.name || 'this event'}`}
            </button>
          </div>
        </Card>
      )}

      {activeTab === 'list' && !selectedEventId && createdEventsLoaded && (
        <Card className="p-6">
          <p className="text-slate-400 text-sm">Select a KvK event above to manage its migration list.</p>
        </Card>
      )}

      {activeTab === 'list' && isListCreatedForCurrentEvent && <>
      <Card className="p-6">
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <label className="text-xs text-slate-400">Add player manually</label>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleExportXlsx}
                disabled={sortedPlayers.length === 0}
                className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded bg-emerald-600/20 text-emerald-300 border border-emerald-600/40 hover:bg-emerald-600/30 disabled:opacity-40 disabled:cursor-not-allowed transition"
                title={sortedPlayers.length === 0 ? 'Nothing to export' : 'Export currently visible rows as XLSX'}
              >
                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                Export XLSX
              </button>
              <button
                type="button"
                onClick={() => setPendingDeleteList(true)}
                className="text-xs text-rose-300 hover:text-rose-200 underline decoration-dotted"
                title="Delete this event's migration list"
              >
                Delete migration list
              </button>
            </div>
          </div>
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
        {loading && (
          <div className="flex flex-col items-center justify-center py-16 gap-4">
            <div className="relative h-12 w-12">
              <div className="absolute inset-0 rounded-full border-4 border-slate-700"></div>
              <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-sky-400 animate-spin"></div>
            </div>
            <p className="text-slate-400 text-sm font-medium animate-pulse">Loading Migration List...</p>
          </div>
        )}
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
              <div className="flex flex-col gap-1">
                <label className="text-xs text-slate-400">Inactive</label>
                <div className="flex rounded overflow-hidden border border-slate-700">
                  {(['all', 'yes', 'no'] as const).map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setInactiveFilter(v)}
                      className={`px-2 py-1 text-xs font-medium transition-colors ${
                        inactiveFilter === v
                          ? 'bg-orange-500 text-white'
                          : 'bg-slate-900 text-slate-400 hover:bg-slate-700 hover:text-white'
                      }`}
                    >
                      {v === 'all' ? 'All' : v === 'yes' ? 'Yes' : 'No'}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            {selectedIds.size > 0 && (
              <div className="mb-3 flex items-center justify-between gap-3 bg-slate-900/80 border border-rose-500/40 rounded-md px-3 py-2">
                <span className="text-sm text-slate-200">
                  <span className="font-bold text-rose-300">{selectedIds.size}</span>{' '}
                  player{selectedIds.size === 1 ? '' : 's'} selected
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedIds(new Set())}
                    className="text-xs px-3 py-1.5 rounded bg-slate-700 text-slate-200 hover:bg-slate-600"
                  >
                    Clear
                  </button>
                  <button
                    type="button"
                    onClick={() => setPendingBulkRemove(true)}
                    className="text-xs px-3 py-1.5 rounded bg-rose-600 text-white hover:bg-rose-500 font-medium"
                  >
                    Remove selected
                  </button>
                </div>
              </div>
            )}
            <Table frame={false} className="table-fixed min-w-full [&_td]:px-2 [&_td]:py-2">
            <TableHeader>
              <tr>
                <TableCell header className="w-[34px] text-center">
                  <input
                    type="checkbox"
                    checked={sortedPlayers.length > 0 && sortedPlayers.every(p => selectedIds.has(p.id))}
                    ref={el => {
                      if (!el) return;
                      const selectedVisible = sortedPlayers.filter(p => selectedIds.has(p.id)).length;
                      el.indeterminate = selectedVisible > 0 && selectedVisible < sortedPlayers.length;
                    }}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedIds(new Set(sortedPlayers.map(p => p.id)));
                      } else {
                        setSelectedIds(new Set());
                      }
                    }}
                    className="h-4 w-4 cursor-pointer accent-rose-500"
                    aria-label="Select all visible players"
                  />
                </TableCell>
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
                <TableCell header className="w-[90px] cursor-pointer select-none" onClick={() => requestSort('inactive')}>
                  Inactive{sortIndicator('inactive')}
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
                    className={`${rowIdx % 2 === 0 ? 'bg-slate-900/70' : 'bg-slate-800/40'} ${isMigrated ? 'opacity-60' : ''} ${selectedIds.has(player.id) ? 'ring-1 ring-rose-500/40' : ''}`}
                  >
                      <TableCell className="text-center">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(player.id)}
                          onChange={() => toggleSelect(player.id)}
                          className="h-4 w-4 cursor-pointer accent-rose-500"
                          aria-label={`Select ${player.name}`}
                        />
                      </TableCell>
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
                          {details.inactive && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide bg-orange-500/20 text-orange-300 border border-orange-500/40">
                              <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" />
                              </svg>
                              Inactive
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
                      <button
                        type="button"
                        onClick={() => updateDetails(player.id, { inactive: !details.inactive })}
                        aria-label={details.inactive ? 'Mark as active' : 'Mark as inactive'}
                        className={`w-8 h-4 rounded-full transition-colors duration-200 relative flex-shrink-0 ${
                          details.inactive ? 'bg-orange-500' : 'bg-slate-700'
                        }`}
                      >
                        <span className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-all duration-200 ${
                          details.inactive ? 'left-[18px]' : 'left-0.5'
                        }`} />
                      </button>
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
                  <td colSpan={12} className="px-4 py-3 text-center text-slate-400">
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

      {activeTab === 'top1000' && (
        <div className="space-y-6">
          <Card className="p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h3 className="text-base font-semibold text-sky-300 mb-1">Top 1000 Power Ranking</h3>
                {top1000 ? (
                  <p className="text-sm text-slate-400">
                    File: <span className="text-white font-medium">{top1000.filename}</span>
                    {top1000.uploadedAt && (
                      <> · uploaded {new Date(top1000.uploadedAt).toLocaleString()}</>
                    )}
                    {' · '}{top1000Rows.length} players
                  </p>
                ) : (
                  <p className="text-sm text-slate-400">
                    Upload the Top 1000 xlsx export from your kingdom power ranking scan.
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <input
                  ref={top1000InputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  onChange={(e) => handleTop1000FileSelected(e.target.files?.[0] || null)}
                />
                <button
                  type="button"
                  onClick={() => top1000InputRef.current?.click()}
                  disabled={top1000UploadBusy}
                  className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded bg-sky-500 hover:bg-sky-400 text-white font-medium disabled:opacity-60"
                >
                  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                  {top1000UploadBusy ? 'Working…' : (top1000 ? 'Replace upload' : 'Upload XLSX')}
                </button>
                {top1000 && !top1000UploadBusy && (
                  <button
                    type="button"
                    onClick={() => setPendingTop1000Delete(true)}
                    className="text-xs text-rose-300 hover:text-rose-200 underline decoration-dotted"
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>
            {top1000Error && (
              <p className="text-sm text-rose-300 mt-3">{top1000Error}</p>
            )}
            {top1000Loading && (
              <p className="text-sm text-slate-400 mt-3">Loading…</p>
            )}
            {top1000 && top1000Cols && (top1000Cols.id === undefined || top1000Cols.name === undefined) && (
              <p className="text-xs text-amber-300 mt-3">
                Could not detect required columns. Expected at least “ID” and “Name”. Found headers: {top1000.headers.join(', ')}
              </p>
            )}
          </Card>

          {ch25List.length > 0 && (
            <Card className="p-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-base font-semibold text-amber-300">{`<CH25 Watchlist (${ch25List.length})`}</h3>
                <p className="text-xs text-slate-500">Persistent — survives re-uploads</p>
              </div>
              <Table frame={false} className="table-fixed min-w-full [&_td]:px-2 [&_td]:py-2">
                <TableHeader>
                  <tr>
                    <TableCell header className="w-[110px]">Gov ID</TableCell>
                    <TableCell header className="w-[180px] whitespace-normal">Name</TableCell>
                    <TableCell header className="w-[120px]">Alliance</TableCell>
                    <TableCell header className="w-[60px]">CH</TableCell>
                    <TableCell header className="w-[110px]">Power</TableCell>
                    {top1000Cols?.troopsPower !== undefined && (
                      <TableCell header className="w-[110px]">Troop Power</TableCell>
                    )}
                    {top1000Cols?.kp !== undefined && (
                      <TableCell header className="w-[110px]">Kill Points</TableCell>
                    )}
                    {top1000Cols?.dead !== undefined && (
                      <TableCell header className="w-[100px]">Deads</TableCell>
                    )}
                    <TableCell header className="w-[110px]">Added</TableCell>
                    <TableCell header className="w-[70px]">Actions</TableCell>
                  </tr>
                </TableHeader>
                <tbody>
                  {sortedCh25List.map((entry, idx) => {
                    const row = top1000ById.get(entry.playerId);
                    return (
                      <TableRow key={entry.playerId} className={idx % 2 === 0 ? 'bg-slate-900/70' : 'bg-slate-800/40'}>
                        <TableCell>{entry.playerId}</TableCell>
                        <TableCell className="whitespace-normal">
                          {row?.name || <span className="text-slate-500 italic">not in current upload</span>}
                        </TableCell>
                        <TableCell>{row?.alliance || '-'}</TableCell>
                        <TableCell>
                          {row?.ch !== undefined ? (
                            <span className={row.ch < 25 ? 'text-amber-300 font-semibold' : 'text-slate-300'}>{row.ch}</span>
                          ) : '-'}
                        </TableCell>
                        <TableCell>{row?.power !== undefined ? formatNumber(row.power) : '-'}</TableCell>
                        {top1000Cols?.troopsPower !== undefined && (
                          <TableCell>{row?.troopsPower !== undefined ? formatNumber(row.troopsPower) : '-'}</TableCell>
                        )}
                        {top1000Cols?.kp !== undefined && (
                          <TableCell>{row?.kp !== undefined ? formatNumber(row.kp) : '-'}</TableCell>
                        )}
                        {top1000Cols?.dead !== undefined && (
                          <TableCell>{row?.dead !== undefined ? formatNumber(row.dead) : '-'}</TableCell>
                        )}
                        <TableCell className="text-xs text-slate-400">
                          {entry.addedAt ? new Date(entry.addedAt).toLocaleDateString() : '-'}
                        </TableCell>
                        <TableCell>
                          <button
                            type="button"
                            onClick={() => handleRemoveCh25(entry.playerId)}
                            disabled={ch25Busy.has(entry.playerId)}
                            className="text-rose-200 hover:text-rose-100 bg-rose-500/20 hover:bg-rose-500/30 rounded px-2 py-1 disabled:opacity-40"
                            title="Remove from <CH25 watchlist"
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
            </Card>
          )}

          {top1000 && top1000Rows.length > 0 && (
            <Card className="p-6">
              <div className="flex flex-wrap items-end gap-3 mb-4">
                <div className="flex flex-col flex-1 min-w-[200px]">
                  <label className="text-xs text-slate-400">Search</label>
                  <input
                    type="text"
                    value={top1000Search}
                    onChange={(e) => setTop1000Search(e.target.value)}
                    placeholder="Name, GOV ID, or alliance"
                    className="bg-slate-900 border border-slate-700 rounded px-3 py-1.5 text-sm text-white"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-slate-400">City Hall</label>
                  <div className="flex rounded overflow-hidden border border-slate-700">
                    {([
                      { key: 'all', label: 'All' },
                      { key: 'below25', label: '<25' },
                      { key: 'at25', label: '=25' },
                    ] as const).map(opt => (
                      <button
                        key={opt.key}
                        type="button"
                        onClick={() => setTop1000ChFilter(opt.key)}
                        className={`px-2.5 py-1.5 text-xs font-medium transition-colors ${
                          top1000ChFilter === opt.key
                            ? 'bg-sky-500 text-white'
                            : 'bg-slate-900 text-slate-400 hover:bg-slate-700 hover:text-white'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex flex-col" ref={top1000AllianceMenuRef}>
                  <label className="text-xs text-slate-400">Alliances</label>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setTop1000AllianceMenuOpen(open => !open)}
                      className="bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-xs text-white min-w-[160px] flex items-center justify-between gap-2 hover:border-slate-500"
                    >
                      <span>
                        {top1000AllianceSelection.size === 0
                          ? 'All'
                          : `${top1000AllianceSelection.size} selected`}
                      </span>
                      <svg viewBox="0 0 24 24" className="h-3 w-3 opacity-70" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <polyline points="6 9 12 15 18 9"/>
                      </svg>
                    </button>
                    {top1000AllianceMenuOpen && (
                      <div className="absolute z-20 top-full mt-1 right-0 min-w-[200px] max-h-[280px] overflow-auto bg-slate-900 border border-slate-700 rounded shadow-lg">
                        <div className="flex items-center justify-between px-3 py-1.5 border-b border-slate-800 sticky top-0 bg-slate-900">
                          <button
                            type="button"
                            onClick={() => setTop1000AllianceSelection(new Set(top1000AllianceOptions))}
                            className="text-[10px] text-sky-300 hover:text-sky-200 uppercase tracking-wide"
                          >
                            Select all
                          </button>
                          <button
                            type="button"
                            onClick={() => setTop1000AllianceSelection(new Set())}
                            className="text-[10px] text-slate-400 hover:text-slate-200 uppercase tracking-wide"
                          >
                            Clear
                          </button>
                        </div>
                        {top1000AllianceOptions.map(alliance => {
                          const checked = top1000AllianceSelection.has(alliance);
                          return (
                            <label
                              key={alliance || 'none'}
                              className="flex items-center gap-2 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-800 cursor-pointer"
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleTop1000Alliance(alliance)}
                                className="h-3.5 w-3.5 accent-sky-500"
                              />
                              <span className={alliance ? '' : 'italic text-slate-500'}>
                                {alliance || '(No Alliance)'}
                              </span>
                            </label>
                          );
                        })}
                        {top1000AllianceOptions.length === 0 && (
                          <p className="text-xs text-slate-500 px-3 py-3">No alliances in upload.</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                <p className="text-xs text-slate-500 ml-auto">
                  Showing {sortedTop1000.length} of {top1000Rows.length}
                </p>
              </div>
              <div className="max-h-[640px] overflow-auto">
                <Table frame={false} className="table-fixed min-w-full [&_td]:px-2 [&_td]:py-2">
                  <TableHeader>
                    <tr>
                      <TableCell header className="w-[100px] cursor-pointer select-none" onClick={() => requestTop1000Sort('id')}>Gov ID{top1000SortIndicator('id')}</TableCell>
                      <TableCell header className="w-[160px] whitespace-normal cursor-pointer select-none" onClick={() => requestTop1000Sort('name')}>Name{top1000SortIndicator('name')}</TableCell>
                      <TableCell header className="w-[110px] cursor-pointer select-none" onClick={() => requestTop1000Sort('alliance')}>Alliance{top1000SortIndicator('alliance')}</TableCell>
                      {top1000Cols?.ch !== undefined && (
                        <TableCell header className="w-[60px] cursor-pointer select-none" onClick={() => requestTop1000Sort('ch')}>CH{top1000SortIndicator('ch')}</TableCell>
                      )}
                      <TableCell header className="w-[120px] cursor-pointer select-none" onClick={() => requestTop1000Sort('power')}>Power{top1000SortIndicator('power')}</TableCell>
                      {top1000Cols?.troopsPower !== undefined && (
                        <TableCell header className="w-[120px] cursor-pointer select-none" onClick={() => requestTop1000Sort('troopsPower')}>Troop Power{top1000SortIndicator('troopsPower')}</TableCell>
                      )}
                      {top1000Cols?.kp !== undefined && (
                        <TableCell header className="w-[120px] cursor-pointer select-none" onClick={() => requestTop1000Sort('kp')}>Kill Points{top1000SortIndicator('kp')}</TableCell>
                      )}
                      {top1000Cols?.dead !== undefined && (
                        <TableCell header className="w-[110px] cursor-pointer select-none" onClick={() => requestTop1000Sort('dead')}>Deads{top1000SortIndicator('dead')}</TableCell>
                      )}
                      <TableCell header className="w-[120px]">Actions</TableCell>
                    </tr>
                  </TableHeader>
                  <tbody>
                    {sortedTop1000.map((row, idx) => {
                      const onCh25 = ch25IdSet.has(row.id);
                      const busy = ch25Busy.has(row.id);
                      return (
                        <TableRow
                          key={row.id}
                          className={`${idx % 2 === 0 ? 'bg-slate-900/70' : 'bg-slate-800/40'} ${row.ch !== undefined && row.ch < 25 ? 'border-l-2 border-amber-400/60' : ''}`}
                        >
                          <TableCell>{row.id}</TableCell>
                          <TableCell className="whitespace-normal">{row.name}</TableCell>
                          <TableCell>{row.alliance || '-'}</TableCell>
                          {top1000Cols?.ch !== undefined && (
                            <TableCell>
                              {row.ch !== undefined ? (
                                <span className={row.ch < 25 ? 'text-amber-300 font-semibold' : 'text-slate-300'}>{row.ch}</span>
                              ) : '-'}
                            </TableCell>
                          )}
                          <TableCell>{formatNumber(row.power || 0)}</TableCell>
                          {top1000Cols?.troopsPower !== undefined && (
                            <TableCell>{row.troopsPower !== undefined ? formatNumber(row.troopsPower) : '-'}</TableCell>
                          )}
                          {top1000Cols?.kp !== undefined && (
                            <TableCell>{row.kp !== undefined ? formatNumber(row.kp) : '-'}</TableCell>
                          )}
                          {top1000Cols?.dead !== undefined && (
                            <TableCell>{row.dead !== undefined ? formatNumber(row.dead) : '-'}</TableCell>
                          )}
                          <TableCell>
                            {onCh25 ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">
                                On &lt;CH25
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleAddCh25(row.id)}
                                disabled={busy}
                                className="text-xs px-2 py-1 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30 disabled:opacity-40"
                                title="Add to <CH25 watchlist"
                              >
                                + &lt;CH25
                              </button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {sortedTop1000.length === 0 && (
                      <TableRow>
                        <td colSpan={10} className="px-4 py-6 text-center text-slate-400">No players match the filter.</td>
                      </TableRow>
                    )}
                  </tbody>
                </Table>
              </div>
            </Card>
          )}

          {!top1000 && !top1000Loading && (
            <Card className="p-8">
              <div className="flex flex-col items-center text-center gap-3">
                <svg viewBox="0 0 24 24" className="h-10 w-10 text-slate-500" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="12" y1="18" x2="12" y2="12" />
                  <line x1="9" y1="15" x2="15" y2="15" />
                </svg>
                <p className="text-sm text-slate-400">No Top 1000 file uploaded yet.</p>
              </div>
            </Card>
          )}
        </div>
      )}

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
                <button
                  type="button"
                  onClick={handleExportWatchlistXlsx}
                  disabled={filteredWatchlistEntries.length === 0}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-emerald-600/20 text-emerald-300 border border-emerald-600/40 hover:bg-emerald-600/30 disabled:opacity-40 disabled:cursor-not-allowed transition"
                  title={filteredWatchlistEntries.length === 0 ? 'Nothing to export' : 'Export currently visible rows as XLSX'}
                >
                  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  Export XLSX
                </button>
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

      <ConfirmDialog
        open={pendingBulkRemove}
        title={`Remove ${selectedIds.size} player${selectedIds.size === 1 ? '' : 's'}?`}
        message={`The selected players will be removed from the migration list and excluded from automatic re-addition. This cannot be undone.`}
        confirmLabel={`Remove ${selectedIds.size}`}
        danger={true}
        onConfirm={() => {
          handleBulkRemove();
          setPendingBulkRemove(false);
        }}
        onCancel={() => setPendingBulkRemove(false)}
      />

      <ConfirmDialog
        open={pendingTop1000Delete}
        title="Delete Top 1000 upload?"
        message="The current Top 1000 file and its parsed data will be removed. The <CH25 watchlist entries are kept."
        confirmLabel={top1000UploadBusy ? 'Deleting…' : 'Delete'}
        danger={true}
        onConfirm={handleTop1000Delete}
        onCancel={() => setPendingTop1000Delete(false)}
      />

      <ConfirmDialog
        open={pendingDeleteList}
        title={`Delete migration list for ${activeEvent?.name || 'this event'}?`}
        message={`This permanently deletes the migration list and all entries (contacted state, notes, manual additions, etc.) for "${activeEvent?.name || 'this event'}". This cannot be undone.`}
        confirmLabel={isDeletingList ? 'Deleting…' : 'Delete'}
        danger={true}
        onConfirm={handleDeleteMigrationList}
        onCancel={() => setPendingDeleteList(false)}
      />

    </div>
  );
};

export default MigrationList;
