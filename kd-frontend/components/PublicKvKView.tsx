import React, { useState, useEffect, useMemo } from 'react';
import { KvkEvent, UploadedFile, HonorPlayerInfo, PlayerHonorHistory } from '../types';
import { fetchPublicKvkEvents, API_BASE_URL } from '../api'; 
import { findColumnIndex, formatNumber, parseGermanNumber } from '../utils';
import HonorOverviewTable from './HonorOverviewTable'; 
import HonorHistoryChart from './HonorHistoryChart';
import HonorPlayerSearch from './HonorPlayerSearch';

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
  fightsParticipated?: number;
};

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

  const [events, setEvents] = useState<KvkEvent[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string>('');
  
  // Rohdaten
  const [overviewFiles, setOverviewFiles] = useState<UploadedFile[]>([]);
  const [allHonorFiles, setAllHonorFiles] = useState<UploadedFile[]>([]);
  
  // Berechnete Daten
  const [statsData, setStatsData] = useState<StatProgressRow[]>([]);
  const [honorHistory, setHonorHistory] = useState<PlayerHonorHistory[]>([]);
  const [activeHonorFiles, setActiveHonorFiles] = useState<UploadedFile[]>([]); 
  const [totalHonorHistory, setTotalHonorHistory] = useState<TotalHonorHistory>([]); 
  
  // UI State
  const [viewMode, setViewMode] = useState<'stats' | 'honor'>('stats');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Suche & Filter
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<HonorPlayerInfo[] | 'not_found' | null>(null);

  useEffect(() => { if (slug) loadEvents(); }, [slug]);
  useEffect(() => { if (slug && selectedEventId) loadFilesAndCalculate(); }, [slug, selectedEventId]);

  const loadEvents = async () => {
    try {
      const evs = await fetchPublicKvkEvents(slug!);
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

      // --- A. FIGHT STATS CALCULATION ---
      if (event.fights && event.fights.length > 0) {
          const calculatedStats = calculateCumulativeStats(event.fights, loadedOverview);
          setStatsData(calculatedStats);
      }

      // --- B. HONOR RANGE LOGIC ---
      if (event.honorStartFileId && event.honorEndFileId) {
          const startIndex = loadedHonor.findIndex(f => f.id === event.honorStartFileId);
          const endIndex = loadedHonor.findIndex(f => f.id === event.honorEndFileId);

          if (startIndex !== -1 && endIndex !== -1) {
              const first = Math.min(startIndex, endIndex);
              const last = Math.max(startIndex, endIndex);
              const rangeFiles = loadedHonor.slice(first, last + 1);

              if (rangeFiles.length > 0) {
                  setActiveHonorFiles(rangeFiles);
                  const { history, totalHistory } = processHonorData(rangeFiles);
                  setHonorHistory(history);
                  setTotalHonorHistory(totalHistory);
              }
          } else {
             console.warn("Honor Start or End file not found in loaded list.");
          }
      }

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

      const map = new Map<string, {
          name: string;
          alliance: string;
          power: number;
          t4: number;
          t5: number;
          dead: number;
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
              dead: parseAnyNumber(row[deadIdx])
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

  // --- MAIN LOGIC: Cumulative Fights (UPDATED) ---
  const calculateCumulativeStats = (fights: { startFileId: string, endFileId: string }[], files: UploadedFile[]): StatProgressRow[] => {
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

            const deltaT4 = Math.max(0, curr.t4 - prevT4);
            const deltaT5 = Math.max(0, curr.t5 - prevT5);
            const deltaDead = Math.max(0, curr.dead - prevDead);
            
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
                    fightsParticipated: 0
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
            
            total.fightsParticipated = (total.fightsParticipated || 0) + 1;
        });
    });

    // Sortierung nach T4 + T5 Kills (Total Kills Δ)
    return Array.from(grandTotals.values()).sort((a, b) => b.t4t5KillsDiff - a.t4t5KillsDiff);
  };

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

  const activeEvent = events.find(e => e.id === selectedEventId);

  // --- RENDER ---
  if (events.length === 0 && !loading) {
    return (
        <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
            <div className="bg-gray-800 p-8 rounded-lg shadow-lg text-center max-w-md border border-gray-700">
                <h2 className="text-2xl font-bold text-yellow-500 mb-4">No Public Events</h2>
                <p className="text-gray-400">There are currently no public KvK statistics available for this kingdom.</p>
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
                <div className="p-4 bg-gray-800 border-b border-gray-700 flex flex-col md:flex-row justify-between items-start md:items-center gap-2">
                  <div>
                      <h2 className="text-lg font-semibold text-blue-200">Total War Ranking</h2>
                      <p className="text-xs text-gray-400">
                          Aggregated Stats from all battle phases.
                      </p>
                  </div>
                  <div className="text-xs text-gray-500 italic">
                      Top {statsData.length} Players
                  </div>
                </div>
                
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-gray-900 text-gray-400 text-xs uppercase tracking-wider">
                        <th className="p-3 text-center w-10">#</th>
                        <th className="p-3">Gov ID</th>
                        <th className="p-3">Name</th>
                        <th className="p-3">Alliance</th>
                        
                        <th className="p-3 text-right text-yellow-500">Power Details</th>
                        
                        <th className="p-3 text-right text-red-300">T4 Kills Δ</th>
                        <th className="p-3 text-right text-red-400">T5 Kills Δ</th>
                        <th className="p-3 text-right text-red-500 font-bold bg-gray-800/50">T4+T5 Kills Δ</th>
                        <th className="p-3 text-right text-gray-400">Dead Δ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-700 text-sm">
                      {statsData.map((row, idx) => (
                        <tr key={row.id} className="hover:bg-gray-750 transition-colors">
                          <td className="p-3 text-gray-500 font-mono text-center">{idx + 1}</td>
                          <td className="p-3 text-gray-400 font-mono text-xs">{row.id}</td>
                          <td className="p-3 font-medium text-white truncate max-w-[150px]">{row.name}</td>
                          <td className="p-3 text-gray-300">[{row.alliance}]</td>
                          
                          {/* Power Column: Base + Diff */}
                          <td className="p-3 text-right">
                              <div className="flex flex-col items-end">
                                  <span className={`font-mono font-bold ${row.powerDiff >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                      {row.powerDiff > 0 ? '+' : ''}{formatNumber(row.powerDiff)}
                                  </span>
                                  <span className="text-xs text-gray-500">Base: {formatNumber(row.basePower)}</span>
                              </div>
                          </td>
                          
                          <td className="p-3 text-right font-mono text-gray-300">+{formatNumber(row.t4KillsDiff)}</td>
                          <td className="p-3 text-right font-mono text-gray-300">+{formatNumber(row.t5KillsDiff)}</td>
                          
                          <td className="p-3 text-right font-mono font-bold text-yellow-400 bg-yellow-900/10 border-l border-r border-gray-700">
                              +{formatNumber(row.t4t5KillsDiff)}
                          </td>
                          
                          <td className="p-3 text-right font-mono text-gray-400">+{formatNumber(row.deadDiff)}</td>
                        </tr>
                      ))}
                      {statsData.length === 0 && (
                        <tr><td colSpan={9} className="p-12 text-center text-gray-500 italic">
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
                                ) : "Select a range in Admin Manager to see progress."}
                            </p>
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