import React, { useState, useEffect, useMemo } from 'react';
import { KvkEvent, UploadedFile, HonorPlayerInfo, PlayerHonorHistory } from '../types';
import { fetchPublicKvkEvents, API_BASE_URL } from '../api'; 
import { findColumnIndex, formatNumber, parseGermanNumber } from '../utils';
import HonorOverviewTable from './HonorOverviewTable'; 
import HonorHistoryChart from './HonorHistoryChart';
import HonorPlayerSearch from './HonorPlayerSearch';
import { useAuth } from './AuthContext';

// Typ für die aggregierten Stats (Erweitert)
type StatProgressRow = {
  id: string;
  name: string;
  alliance: string;
  basePower: number;    // Startkraft (beim ersten Auftreten)
  powerDiff: number;    // Summe aller Differenzen aus den Kämpfen
  t4KillsDiff: number;
  t5KillsDiff: number;
  t4t5KillsDiff: number; // Summe T4 + T5
  deadDiff: number;
  killPointsDiff: number;
  fightsParticipated?: number;
  dkpScore?: number;
  dkpGoal?: number;
  dkpPercent?: number;
  deadGoal?: number;
  deadPercent?: number;
};

type SortKey =
  | 'id'
  | 'name'
  | 'alliance'
  | 'dkpPercent'
  | 'deadPercent'
  | 'powerDiff'
  | 'killPointsDiff'
  | 't4KillsDiff'
  | 't5KillsDiff'
  | 't4t5KillsDiff';

// Typ für die aggregierte Gesamtehre im Verlauf
export type TotalHonorPointData = {
  fileName: string;
  fileId: string;
  totalHonor: number;
};
export type TotalHonorHistory = TotalHonorPointData[];

interface PublicKvKViewProps {
  kingdomSlug: string;
}

const PublicKvKView: React.FC<PublicKvKViewProps> = ({ kingdomSlug }) => {
  const slug = kingdomSlug;
  const { token } = useAuth();

  const [events, setEvents] = useState<KvkEvent[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string>('');
  const [selectedFightId, setSelectedFightId] = useState<string>('all');
  
  // Rohdaten
  const [overviewFiles, setOverviewFiles] = useState<UploadedFile[]>([]);
  const [allHonorFiles, setAllHonorFiles] = useState<UploadedFile[]>([]);
  
  // Berechnete Daten
  const [statsData, setStatsData] = useState<StatProgressRow[]>([]);
  const [honorHistory, setHonorHistory] = useState<PlayerHonorHistory[]>([]);
  const [activeHonorFiles, setActiveHonorFiles] = useState<UploadedFile[]>([]);
  const [totalHonorHistory, setTotalHonorHistory] = useState<TotalHonorHistory>([]);
  const [honorStartSelection, setHonorStartSelection] = useState<string>('');
  const [honorEndSelection, setHonorEndSelection] = useState<string>('');
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: 'asc' | 'desc' }>({
    key: 't4t5KillsDiff',
    direction: 'desc',
  });
  
  // UI State
  const [viewMode, setViewMode] = useState<'stats' | 'honor'>('stats');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Suche & Filter
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<HonorPlayerInfo[] | 'not_found' | null>(null);

  const activeEvent = useMemo(() => events.find(e => e.id === selectedEventId), [events, selectedEventId]);

  useEffect(() => { if (slug) loadEvents(); }, [slug, token]);
  useEffect(() => { if (slug && selectedEventId) loadFilesAndCalculate(); }, [slug, selectedEventId]);
  useEffect(() => {
    const evt = events.find(e => e.id === selectedEventId);
    if (evt) {
      setSelectedFightId('all');
      setHonorStartSelection(evt.honorStartFileId || '');
      setHonorEndSelection(evt.honorEndFileId || '');
    }
  }, [events, selectedEventId]);

  const loadEvents = async () => {
    try {
      const evs = await fetchPublicKvkEvents(slug!, token || undefined);
      setEvents(evs);
      if (evs.length > 0) setSelectedEventId(evs[0].id);
    } catch (e) {
      console.error(e);
      setError('Could not load events.');
    }
  };

  const loadFilesAndCalculate = async () => {
    setLoading(true);
    setError('');
    setStatsData([]);
    setHonorHistory([]);
    setSelectedPlayerIds([]);
    setSearchResults(null);
    setSearchQuery('');
    setActiveHonorFiles([]);
    setTotalHonorHistory([]);
    setHonorStartSelection('');
    setHonorEndSelection('');

    try {
      const event = events.find(e => e.id === selectedEventId);
      if (!event) return;

      // 1. Alle Dateien laden (Overview & Honor)
      const [ovRes, honRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/public/kingdom/${slug}/overview-files`),
        fetch(`${API_BASE_URL}/api/public/kingdom/${slug}/honor-files`)
      ]);

      if (!ovRes.ok || !honRes.ok) throw new Error('Error loading data');

      const loadedOverview: UploadedFile[] = await ovRes.json();
      const loadedHonor: UploadedFile[] = await honRes.json();

      setOverviewFiles(loadedOverview);
      setAllHonorFiles(loadedHonor);

      const defaultHonorStart = event.honorStartFileId || loadedHonor[0]?.id || '';
      const defaultHonorEnd = event.honorEndFileId || loadedHonor[loadedHonor.length - 1]?.id || '';

      setHonorStartSelection(defaultHonorStart);
      setHonorEndSelection(defaultHonorEnd);

    } catch (err) {
      console.error(err);
      setError('Error processing data.');
    } finally {
      setLoading(false);
    }
  };

  // --- Handlers ---
  const handleSearch = () => {
    if (!searchQuery.trim()) return;
    const lowerQ = searchQuery.toLowerCase();
    
    const results = honorHistory
        .filter(p => p.name.toLowerCase().includes(lowerQ) || p.id.toLowerCase().includes(lowerQ))
        .map(p => {
            const lastEntry = p.history[p.history.length - 1];
            return {
                governorId: p.id,
                name: p.name,
                honorPoint: lastEntry ? lastEntry.honorPoint : 0
            };
        });
    setSearchResults(results.length > 0 ? results : 'not_found');
  };

  const handleSelectPlayer = (player: HonorPlayerInfo) => {
      setSelectedPlayerIds(prev => prev.includes(player.governorId) ? prev.filter(id => id !== player.governorId) : [...prev, player.governorId]);
  };

  const handleClearSearch = () => { setSearchQuery(''); setSearchResults(null); };

  const toggleSort = (key: SortKey) => {
    setSortConfig(prev => {
      if (prev.key === key) {
        return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
      }
      const defaultDirection: 'asc' | 'desc' = ['id', 'name', 'alliance'].includes(key) ? 'asc' : 'desc';
      return { key, direction: defaultDirection };
    });
  };

  const renderSortIndicator = (key: SortKey) => {
    if (sortConfig.key !== key) return null;
    return <span className="text-[10px]">{sortConfig.direction === 'asc' ? '▲' : '▼'}</span>;
  };

  const parseAnyNumber = (val: any): number => parseGermanNumber(val);

  // --- Helper: Parse Overview Data ---
  const getSnapshotData = (file: UploadedFile) => {
      const getIdx = (keys: string[]) => findColumnIndex(file.headers, keys);
      const idIdx = getIdx(['id', 'governor id', 'user id']);
      const nameIdx = getIdx(['name', 'display name', 'spieler']); 
      const allyIdx = getIdx(['alliance', 'allianz', 'tag']);
      const powerIdx = getIdx(['power', 'kraft']);
      const t4Idx = getIdx(['t4 kills', 'tier 4 kills', 'kills t4']);
      const t5Idx = getIdx(['t5 kills', 'tier 5 kills', 'kills t5']);
      const deadIdx = getIdx(['dead', 'deaths', 'tote', 'dead troops']);
      const killPointsIdx = getIdx(['total kill points', 'kill points', 'kp']);

      const map = new Map<string, {
          name: string;
          alliance: string;
          power: number;
          t4: number;
          t5: number;
          dead: number;
          killPoints: number;
      }>();

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

  // --- Helper: Parse Honor Data ---
  const parseHonorFile = (file: UploadedFile): HonorPlayerInfo[] => {
    const govIdIdx = findColumnIndex(file.headers, ['governor id', 'id', 'user id']);
    const nameIdx = findColumnIndex(file.headers, ['name', 'display name', 'spieler']);
    const honorIdx = findColumnIndex(file.headers, ['honor', 'points', 'score', 'ehre']);

    if (govIdIdx === undefined || honorIdx === undefined) return [];

    return file.data.map(row => {
        const val = row[honorIdx];
        const points = parseAnyNumber(val);
        let pName = 'Unknown';
        if (nameIdx !== undefined && row[nameIdx]) pName = String(row[nameIdx]);
        return { governorId: String(row[govIdIdx]), name: pName, honorPoint: points };
    }).filter(p => p.honorPoint > 0);
  };

  const processHonorData = (files: UploadedFile[]): {
      history: PlayerHonorHistory[];
      totalHistory: TotalHonorHistory;
  } => {
    const playerMap = new Map<string, PlayerHonorHistory>();
    const totalHistory: TotalHonorHistory = []; 

    files.forEach(file => {
      const parsedRows = parseHonorFile(file);
      let fileTotalHonor = 0; 
      
      let label = file.name.replace("HONOR_", "").replace(".xlsx", "").replace(".csv", "");

      parsedRows.forEach(row => {
        if (!playerMap.has(row.governorId)) {
          playerMap.set(row.governorId, { id: row.governorId, name: row.name, history: [] });
        }
        const entry = playerMap.get(row.governorId)!;
        entry.name = row.name; 
        entry.history.push({ fileName: label, fileId: file.id, honorPoint: row.honorPoint });
        
        fileTotalHonor += row.honorPoint;
      });
      
      totalHistory.push({
          fileName: label,
          fileId: file.id,
          totalHonor: fileTotalHonor
      });
    });
    
    return {
      history: Array.from(playerMap.values()),
      totalHistory: totalHistory
    };
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

  // --- MAIN LOGIC: Cumulative Fights (UPDATED) ---
  const calculateCumulativeStats = (
    fights: { startFileId: string, endFileId: string }[],
    files: UploadedFile[],
    dkpFormula?: KvkEvent['dkpFormula'],
    goalsFormula?: KvkEvent['goalsFormula']
  ): StatProgressRow[] => {
    const grandTotals = new Map<string, StatProgressRow>();

    fights.forEach(fight => {
        const startFile = files.find(f => f.id === fight.startFileId);
        const endFile = files.find(f => f.id === fight.endFileId);
        
        if (!startFile || !endFile) return;

        const startData = getSnapshotData(startFile);
        const endData = getSnapshotData(endFile);

        // Wir iterieren über endData, da dies die aktiven Spieler am Ende der Phase repräsentiert
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
                // Initialize player
                grandTotals.set(playerId, {
                    id: playerId,
                    name: curr.name,
                    alliance: curr.alliance,
                    basePower: prev ? prev.power : curr.power, // Wenn kein Prev, nehmen wir Curr als Basis
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

            // Accumulate Differences
            total.powerDiff += deltaPower;
            total.t4KillsDiff += deltaT4;
            total.t5KillsDiff += deltaT5;
            total.t4t5KillsDiff += (deltaT4 + deltaT5);
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

    // Sortierung nach T4 + T5 Kills (Total Kills Δ)
    return Array.from(grandTotals.values()).sort((a, b) => b.t4t5KillsDiff - a.t4t5KillsDiff);
  };

  // Recalculate fight stats when selection changes
  useEffect(() => {
      if (!activeEvent || !activeEvent.fights || activeEvent.fights.length === 0 || overviewFiles.length === 0) {
          setStatsData([]);
          return;
      }

      const fightsToUse = selectedFightId === 'all'
        ? activeEvent.fights
        : activeEvent.fights.filter(f => f.id === selectedFightId);

      if (!fightsToUse || fightsToUse.length === 0) {
          setStatsData([]);
          return;
      }

      const calculatedStats = calculateCumulativeStats(
        fightsToUse,
        overviewFiles,
        activeEvent.dkpFormula,
        activeEvent.goalsFormula
      );
      setStatsData(calculatedStats);
  }, [activeEvent, overviewFiles, selectedFightId]);

  // Recalculate honor range when selection changes
  useEffect(() => {
      if (!activeEvent || allHonorFiles.length === 0 || !honorStartSelection || !honorEndSelection) {
          setActiveHonorFiles([]);
          setHonorHistory([]);
          setTotalHonorHistory([]);
          return;
      }

      const startIndex = allHonorFiles.findIndex(f => f.id === honorStartSelection);
      const endIndex = allHonorFiles.findIndex(f => f.id === honorEndSelection);

      if (startIndex === -1 || endIndex === -1) {
          setActiveHonorFiles([]);
          setHonorHistory([]);
          setTotalHonorHistory([]);
          return;
      }

      const first = Math.min(startIndex, endIndex);
      const last = Math.max(startIndex, endIndex);
      const rangeFiles = allHonorFiles.slice(first, last + 1);

      if (rangeFiles.length === 0) {
          setActiveHonorFiles([]);
          setHonorHistory([]);
          setTotalHonorHistory([]);
          return;
      }

      setActiveHonorFiles(rangeFiles);
      const { history, totalHistory } = processHonorData(rangeFiles);
      setHonorHistory(history);
      setTotalHonorHistory(totalHistory);
  }, [activeEvent, allHonorFiles, honorStartSelection, honorEndSelection]);

  const comparisonHonorTableData = useMemo(() => {
      if (honorHistory.length === 0 || activeHonorFiles.length < 2) return [];
      
      const startFileId = activeHonorFiles[0].id;
      const endFileId = activeHonorFiles[activeHonorFiles.length - 1].id;

      return honorHistory.map(h => {
        const startEntry = h.history.find(entry => entry.fileId === startFileId);
        const endEntry = h.history.find(entry => entry.fileId === endFileId);

        const startVal = startEntry ? startEntry.honorPoint : 0;
        const endVal = endEntry ? endEntry.honorPoint : 0;
        let diff = endVal - startVal;
        
        return {
            governorId: h.id,
            name: h.name,
            oldHonor: startVal,
            newHonor: endVal,
            diffHonor: diff
        };
      })
      .filter(p => p.newHonor > 0 || p.diffHonor !== 0)
      .sort((a, b) => b.diffHonor - a.diffHonor);
  }, [honorHistory, activeHonorFiles]);

  const sortedStats = useMemo(() => {
    const getValue = (row: StatProgressRow): string | number => {
      switch (sortConfig.key) {
        case 'id':
          return row.id;
        case 'name':
          return row.name;
        case 'alliance':
          return row.alliance;
        case 'dkpPercent':
          return row.dkpPercent ?? NaN;
        case 'deadPercent':
          return row.deadPercent ?? NaN;
        case 'powerDiff':
          return row.powerDiff;
        case 'killPointsDiff':
          return row.killPointsDiff;
        case 't4KillsDiff':
          return row.t4KillsDiff;
        case 't5KillsDiff':
          return row.t5KillsDiff;
        case 't4t5KillsDiff':
        default:
          return row.t4t5KillsDiff;
      }
    };

    const fallback = sortConfig.direction === 'asc' ? Infinity : -Infinity;

    return [...statsData].sort((a, b) => {
      const valA = getValue(a);
      const valB = getValue(b);

      if (typeof valA === 'string' && typeof valB === 'string') {
        const cmp = valA.localeCompare(valB, 'de', { sensitivity: 'base' });
        return sortConfig.direction === 'asc' ? cmp : -cmp;
      }

      const numA = typeof valA === 'number' && !Number.isNaN(valA) ? valA : fallback;
      const numB = typeof valB === 'number' && !Number.isNaN(valB) ? valB : fallback;

      return sortConfig.direction === 'asc' ? numA - numB : numB - numA;
    });
  }, [statsData, sortConfig]);

  // --- RENDER ---
  if (events.length === 0 && !loading) {
    return (
        <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
            <div className="bg-gray-800 p-8 rounded-lg shadow-lg text-center max-w-md border border-gray-700">
                <h2 className="text-2xl font-bold text-yellow-500 mb-4">Keine sichtbaren Events</h2>
                <p className="text-gray-400">Es gibt aktuell keine oeffentlichen KvK-Statistiken. Private Events sind nur fuer R4/R5 nach Login sichtbar.</p>
            </div>
        </div>
    );
  }

  return (
    <div className="bg-gray-900 min-h-screen text-gray-100 font-sans pb-20">
      
      <div className="bg-gradient-to-r from-blue-900 to-gray-900 p-6 shadow-lg border-b border-gray-700 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-white tracking-wider flex items-center">
              <span className="text-3xl md:text-4xl mr-3">⚔️</span> 
              {activeEvent ? activeEvent.name : 'KvK Tracker'}
            </h1>
            {activeEvent && (
              <div className="flex items-center gap-2 mt-2">
                <span className={`px-2 py-1 rounded text-xs font-semibold border ${
                  activeEvent.isPublic
                    ? 'bg-green-900/70 text-green-200 border-green-700'
                    : 'bg-gray-800 text-gray-200 border-gray-600'
                }`}>
                  {activeEvent.isPublic ? 'Public' : 'Private'}
                </span>
                {!activeEvent.isPublic && (
                  <span className="text-[11px] text-gray-400">Nur für R4/R5 sichtbar, bis es veröffentlicht wird.</span>
                )}
              </div>
            )}
            {activeEvent?.fights && activeEvent.fights.length > 0 && (
                <p className="text-xs text-blue-300 mt-1 ml-12">
                   {activeEvent.fights.length} Battle Phases Tracked
                </p>
            )}
          </div>
          
          {events.length > 1 && (
            <select 
              className="bg-gray-800 border border-gray-600 text-white p-2 rounded focus:ring-2 focus:ring-blue-500 outline-none w-full md:w-auto"
              value={selectedEventId}
              onChange={e => setSelectedEventId(e.target.value)}
            >
              {events.map(ev => <option key={ev.id} value={ev.id}>{ev.name}</option>)}
            </select>
          )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-4 md:p-6">
        
        <div className="flex justify-center mb-8">
          <div className="bg-gray-800 p-1 rounded-lg inline-flex shadow-md border border-gray-700">
            <button
              onClick={() => setViewMode('stats')}
              className={`px-4 md:px-6 py-2 rounded-md font-bold text-sm md:text-base transition-all duration-200 ${
                viewMode === 'stats' 
                  ? 'bg-blue-600 text-white shadow' 
                  : 'text-gray-400 hover:text-white hover:bg-gray-700'
              }`}
            >
              Total Ranking
            </button>
            <button
              onClick={() => setViewMode('honor')}
              className={`px-4 md:px-6 py-2 rounded-md font-bold text-sm md:text-base transition-all duration-200 ${
                viewMode === 'honor' 
                  ? 'bg-purple-600 text-white shadow' 
                  : 'text-gray-400 hover:text-white hover:bg-gray-700'
              }`}
            >
              Honor Dashboard
            </button>
          </div>
        </div>

        {error && <div className="bg-red-900/50 border border-red-500 text-red-200 p-4 rounded mb-6 text-center">{error}</div>}
        {loading && <div className="text-center py-12 text-blue-400 animate-pulse text-xl">Loading & Calculating Data...</div>}

        {!loading && !error && activeEvent && (
          <div className="animate-fade-in-up">
            
            {viewMode === 'stats' && (
              <div className="bg-gray-800 rounded-xl shadow-xl overflow-hidden border border-gray-700">
                <div className="p-4 bg-gray-800 border-b border-gray-700 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h2 className="text-lg font-semibold text-blue-200">Total War Ranking</h2>
                        <span className="px-2 py-1 text-[11px] uppercase tracking-wide bg-blue-900 text-blue-200 rounded border border-blue-700">DKP Focus</span>
                      </div>
                      <p className="text-xs text-gray-400">
                          Aggregated stats based on the selected battle phase with a clear view on DKP progress.
                      </p>
                      <div className="flex flex-wrap items-center gap-2 text-[11px] text-gray-400">
                          <span className="flex items-center gap-1">
                              <span className="w-3 h-3 rounded-full bg-emerald-500/50 border border-emerald-400" />
                              DKP goal reached
                          </span>
                          <span className="flex items-center gap-1">
                              <span className="w-3 h-3 rounded-full bg-amber-400/40 border border-amber-300" />
                              In progress
                          </span>
                      </div>
                  </div>
                  {activeEvent?.fights?.length ? (
                    <div className="flex flex-col items-start text-xs text-gray-300 gap-1">
                      <span className="uppercase tracking-wide text-gray-400 text-[10px]">Fight Selection</span>
                      <select
                        className="bg-gray-900 border border-gray-700 rounded px-3 py-1 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        value={selectedFightId}
                        onChange={e => setSelectedFightId(e.target.value)}
                      >
                        <option value="all">All Fights (Cumulative)</option>
                        {activeEvent.fights.map(f => (
                          <option key={f.id} value={f.id}>{f.name}</option>
                        ))}
                      </select>
                    </div>
                  ) : null}
                  <div className="text-xs text-gray-500 italic">
                      Top {statsData.length} Players
                  </div>
                </div>
                
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-gray-900 text-gray-400 text-xs uppercase tracking-wider">
                        <th className="p-3 text-center w-10">#</th>
                        <th className="p-3">
                          <button type="button" className="flex items-center gap-1" onClick={() => toggleSort('id')}>
                            Gov ID {renderSortIndicator('id')}
                          </button>
                        </th>
                        <th className="p-3">
                          <button type="button" className="flex items-center gap-1" onClick={() => toggleSort('name')}>
                            Name {renderSortIndicator('name')}
                          </button>
                        </th>
                        <th className="p-3">
                          <button type="button" className="flex items-center gap-1" onClick={() => toggleSort('alliance')}>
                            Alliance {renderSortIndicator('alliance')}
                          </button>
                        </th>

                        <th className="p-3 text-right text-amber-300">
                          <button
                            type="button"
                            className="flex items-center gap-1 justify-end w-full"
                            onClick={() => toggleSort('dkpPercent')}
                          >
                            DKP Progress {renderSortIndicator('dkpPercent')}
                          </button>
                        </th>
                        <th className="p-3 text-right text-red-200">
                          <button
                            type="button"
                            className="flex items-center gap-1 justify-end w-full"
                            onClick={() => toggleSort('deadPercent')}
                          >
                            Dead Goal {renderSortIndicator('deadPercent')}
                          </button>
                        </th>

                        <th className="p-3 text-right text-yellow-500">
                          <button
                            type="button"
                            className="flex items-center gap-1 justify-end w-full"
                            onClick={() => toggleSort('powerDiff')}
                          >
                            Power Details {renderSortIndicator('powerDiff')}
                          </button>
                        </th>
                        <th className="p-3 text-right text-orange-300">
                          <button
                            type="button"
                            className="flex items-center gap-1 justify-end w-full"
                            onClick={() => toggleSort('killPointsDiff')}
                          >
                            Kill Points Δ {renderSortIndicator('killPointsDiff')}
                          </button>
                        </th>
                        <th className="p-3 text-right text-red-300">
                          <button
                            type="button"
                            className="flex items-center gap-1 justify-end w-full"
                            onClick={() => toggleSort('t4KillsDiff')}
                          >
                            T4 Kills Δ {renderSortIndicator('t4KillsDiff')}
                          </button>
                        </th>
                        <th className="p-3 text-right text-red-400">
                          <button
                            type="button"
                            className="flex items-center gap-1 justify-end w-full"
                            onClick={() => toggleSort('t5KillsDiff')}
                          >
                            T5 Kills Δ {renderSortIndicator('t5KillsDiff')}
                          </button>
                        </th>
                        <th className="p-3 text-right text-red-500 font-bold bg-gray-800/50">
                          <button
                            type="button"
                            className="flex items-center gap-1 justify-end w-full"
                            onClick={() => toggleSort('t4t5KillsDiff')}
                          >
                            T4+T5 Kills Δ {renderSortIndicator('t4t5KillsDiff')}
                          </button>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-700 text-sm">
                      {sortedStats.map((row, idx) => (
                        <tr
                          key={row.id}
                          className={`hover:bg-gray-750 transition-colors ${
                            idx === 0
                              ? 'bg-blue-900/20'
                              : idx === 1
                                ? 'bg-blue-900/10'
                                : idx === 2
                                  ? 'bg-blue-900/5'
                                  : ''
                          }`}
                        >
                          <td className="p-3 text-gray-500 font-mono text-center">{idx + 1}</td>
                          <td className="p-3 text-gray-400 font-mono text-xs">{row.id}</td>
                          <td className="p-3 font-medium text-white truncate max-w-[150px]">{row.name}</td>
                          <td className="p-3 text-gray-300">[{row.alliance}]</td>

                          <td className="p-3 text-right">
                              {row.dkpPercent !== undefined ? (
                                  <div className="flex flex-col items-end gap-1">
                                      <div className="flex items-center gap-2">
                                          <span className={`font-bold text-sm ${row.dkpPercent >= 100 ? 'text-green-400' : 'text-amber-200'}`}>
                                              {row.dkpPercent.toFixed(1)}%
                                          </span>
                                          <span className="text-[11px] text-gray-400 bg-gray-900 px-2 py-0.5 rounded border border-gray-700 font-mono">
                                              {formatNumber(row.dkpScore || 0)} / {formatNumber(row.dkpGoal || 0)}
                                          </span>
                                      </div>
                                      <div className="w-36 h-2 bg-gray-900 rounded-full overflow-hidden border border-gray-700">
                                          <div
                                              className={`${row.dkpPercent >= 100 ? 'bg-green-400/80' : 'bg-amber-300/80'} h-full transition-all duration-500`}
                                              style={{ width: `${Math.min(Math.max(row.dkpPercent, 0), 130)}%` }}
                                          />
                                      </div>
                                  </div>
                              ) : (
                                  <span className="text-gray-500 text-sm italic">N/A</span>
                              )}
                          </td>

                          <td className="p-3 text-right">
                              {row.deadPercent !== undefined ? (
                                  <div className="flex flex-col items-end">
                                      <span className={`font-bold ${row.deadPercent >= 100 ? 'text-green-400' : 'text-red-200'}`}>
                                          {row.deadPercent.toFixed(1)}%
                                      </span>
                                      <span className="text-[11px] text-gray-500">
                                          Dead: {formatNumber(row.deadDiff)} / {formatNumber(row.deadGoal || 0)}
                                      </span>
                                  </div>
                              ) : (
                                  <div className="flex flex-col items-end text-xs text-gray-500 italic">
                                      <span>No dead goal</span>
                                  </div>
                              )}
                          </td>

                          {/* Power Column: Base + Diff */}
                          <td className="p-3 text-right">
                              <div className="flex flex-col items-end">
                                  <span className={`font-mono font-bold ${row.powerDiff >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                      {row.powerDiff > 0 ? '+' : ''}{formatNumber(row.powerDiff)}
                                  </span>
                                  <span className="text-xs text-gray-500">Base: {formatNumber(row.basePower)}</span>
                              </div>
                          </td>

                          <td className="p-3 text-right font-mono text-orange-200">+{formatNumber(row.killPointsDiff)}</td>

                          <td className="p-3 text-right font-mono text-gray-300">+{formatNumber(row.t4KillsDiff)}</td>
                          <td className="p-3 text-right font-mono text-gray-300">+{formatNumber(row.t5KillsDiff)}</td>
                          
                          <td className="p-3 text-right font-mono font-bold text-yellow-400 bg-yellow-900/10 border-l border-r border-gray-700">
                              +{formatNumber(row.t4t5KillsDiff)}
                          </td>
                        </tr>
                      ))}
                      {statsData.length === 0 && (
                        <tr><td colSpan={11} className="p-12 text-center text-gray-500 italic">
                            No data available yet.
                        </td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* --- VIEW B: HONOR DASHBOARD --- */}
            {viewMode === 'honor' && (
              <div className="space-y-8">
                 
                 {/* Chart & Filter */}
                 <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-1 space-y-4">
                        <HonorPlayerSearch 
                            query={searchQuery}
                            setQuery={setSearchQuery}
                            onSearch={handleSearch}
                            onClear={handleClearSearch}
                            results={searchResults}
                            selectedPlayerHistory={null}
                            onSelectPlayer={handleSelectPlayer}
                            isDataLoaded={honorHistory.length > 0}
                        />
                         {selectedPlayerIds.length > 0 && (
                             <div className="p-4 bg-gray-800 rounded-lg border border-gray-700">
                                 <h4 className="text-sm font-semibold text-gray-300 mb-2">Selected Players:</h4>
                                 <div className="flex flex-wrap gap-2">
                                     {selectedPlayerIds.map(id => {
                                         const p = honorHistory.find(h => h.id === id);
                                         return (
                                             <span key={id} className="px-2 py-1 bg-blue-900 text-blue-200 text-xs rounded flex items-center gap-2">
                                                 {p?.name || id}
                                                 <button onClick={() => handleSelectPlayer({governorId: id} as any)} className="text-blue-400 hover:text-white">×</button>
                                             </span>
                                         )
                                     })}
                                 </div>
                             </div>
                         )}
                    </div>

                    <div className="lg:col-span-2">
                        {honorHistory.length > 0 ? (
                             <HonorHistoryChart 
                                data={honorHistory} 
                                totalData={totalHonorHistory}
                                selectedPlayerIds={selectedPlayerIds.length > 0 ? selectedPlayerIds : undefined} 
                             />
                        ) : (
                            <div className="h-64 bg-gray-800 rounded-xl flex items-center justify-center text-gray-500 border border-gray-700 flex-col gap-2">
                                <span className="text-xl">⚠️ No Data</span>
                                <span className="text-sm text-gray-400">No honor files found within the configured event range.</span>
                            </div>
                        )}
                    </div>
                 </div>

                {/* Comparison Table */}
                <div className="bg-gray-800 rounded-xl shadow-lg border border-gray-700 p-6">
                    <div className="flex flex-col md:flex-row justify-between items-end mb-6 gap-4 border-b border-gray-700 pb-4">
                        <div>
                            <h2 className="text-xl font-bold text-white">Honor Ranking</h2>
                            <p className="text-sm text-gray-400">
                                {activeHonorFiles.length > 1 ? (
                                    <>
                                        Progress from <span className="text-yellow-500 font-medium">{activeHonorFiles[0].name}</span> to <span className="text-yellow-500 font-medium">{activeHonorFiles[activeHonorFiles.length -1].name}</span>
                                    </>
                                ) : "Choose a start and end snapshot to see progress."}
                            </p>
                        </div>
                        <div className="flex flex-col md:flex-row gap-3 md:items-end w-full md:w-auto">
                          <div className="flex flex-col text-xs text-gray-300">
                            <span className="uppercase tracking-wide text-gray-400 text-[10px]">Start Snapshot</span>
                            <select
                              className="bg-gray-900 border border-gray-700 rounded px-3 py-1 text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                              value={honorStartSelection}
                              onChange={e => setHonorStartSelection(e.target.value)}
                            >
                              <option value="">Select start file</option>
                              {allHonorFiles.map(f => (
                                <option key={f.id} value={f.id}>{f.name}</option>
                              ))}
                            </select>
                          </div>
                          <div className="flex flex-col text-xs text-gray-300">
                            <span className="uppercase tracking-wide text-gray-400 text-[10px]">End Snapshot</span>
                            <select
                              className="bg-gray-900 border border-gray-700 rounded px-3 py-1 text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                              value={honorEndSelection}
                              onChange={e => setHonorEndSelection(e.target.value)}
                            >
                              <option value="">Select end file</option>
                              {allHonorFiles.map(f => (
                                <option key={f.id} value={f.id}>{f.name}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                    </div>

                    {comparisonHonorTableData.length > 0 ? (
                      <HonorOverviewTable 
                        stats={{ playerHonorChanges: comparisonHonorTableData }} 
                        startFileName={activeHonorFiles[0]?.name}
                        endFileName={activeHonorFiles[activeHonorFiles.length -1]?.name}
                      />
                    ) : (
                      <div className="p-8 text-center text-gray-500">Not enough data to calculate progress.</div>
                    )}
                </div>

              </div>
            )}
            
          </div>
        )}
      </div>
    </div>
  );
};

export default PublicKvKView;
