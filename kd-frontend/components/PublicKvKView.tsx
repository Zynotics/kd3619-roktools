import React, { useState, useEffect, useMemo } from 'react';
import { KvkEvent, UploadedFile, HonorPlayerInfo, PlayerHonorHistory } from '../types';
import { fetchPublicKvkEvents, API_BASE_URL } from '../api'; 
import { findColumnIndex, formatNumber, parseGermanNumber } from '../utils';
import HonorOverviewTable from './HonorOverviewTable'; 
import HonorHistoryChart from './HonorHistoryChart';
import HonorPlayerSearch from './HonorPlayerSearch';

type StatProgressRow = {
  id: string;
  name: string;
  alliance: string;
  powerDiff: number;
  t4KillsDiff: number;
  t5KillsDiff: number;
  totalKillsDiff: number;
  deadDiff: number;
};

interface PublicKvKViewProps {
  kingdomSlug: string;
}

const PublicKvKView: React.FC<PublicKvKViewProps> = ({ kingdomSlug }) => {
  const slug = kingdomSlug;

  const [events, setEvents] = useState<KvkEvent[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string>('');
  
  const [overviewFiles, setOverviewFiles] = useState<UploadedFile[]>([]);
  const [honorFiles, setHonorFiles] = useState<UploadedFile[]>([]);
  
  const [statsData, setStatsData] = useState<StatProgressRow[]>([]);
  const [honorHistory, setHonorHistory] = useState<PlayerHonorHistory[]>([]);
  
  const [viewMode, setViewMode] = useState<'stats' | 'honor'>('stats');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<HonorPlayerInfo[] | 'not_found' | null>(null);
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<string[]>([]);

  useEffect(() => { if (slug) loadEvents(); }, [slug]);
  useEffect(() => { if (slug && selectedEventId) loadFilesAndCalculate(); }, [slug, selectedEventId]);

  const loadEvents = async () => {
    try {
      const evs = await fetchPublicKvkEvents(slug!);
      setEvents(evs);
      if (evs.length > 0) setSelectedEventId(evs[0].id);
    } catch (e) {
      console.error(e);
      setError('Konnte Events nicht laden.');
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

    try {
      const event = events.find(e => e.id === selectedEventId);
      if (!event) return;

      const [ovRes, honRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/public/kingdom/${slug}/overview-files`),
        fetch(`${API_BASE_URL}/api/public/kingdom/${slug}/honor-files`)
      ]);

      if (!ovRes.ok || !honRes.ok) throw new Error('Fehler beim Laden der Daten');

      const allOverview: UploadedFile[] = await ovRes.json();
      const allHonor: UploadedFile[] = await honRes.json();

      setOverviewFiles(allOverview);
      setHonorFiles(allHonor);

      // A. Stats
      const startFile = allOverview.find(f => f.id === event.startFileId);
      const endFile = allOverview.find(f => f.id === event.endFileId);
      if (startFile && endFile) {
        setStatsData(calculateStatsProgress(startFile, endFile));
      }

      // B. Honor History
      const relevantHonorFiles = allHonor
        .filter(f => event.honorFileIds.includes(f.id))
        .sort((a, b) => {
            const dateA = a.uploadDate ? new Date(a.uploadDate).getTime() : 0;
            const dateB = b.uploadDate ? new Date(b.uploadDate).getTime() : 0;
            return dateA - dateB;
        });

      if (relevantHonorFiles.length > 0) {
        const history = processHonorHistory(relevantHonorFiles);
        setHonorHistory(history);
      }

    } catch (err) {
      console.error(err);
      setError('Fehler bei der Datenverarbeitung.');
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
        .map(p => ({
            governorId: p.id,
            name: p.name,
            honorPoint: p.history[p.history.length - 1].honorPoint 
        }));
    setSearchResults(results.length > 0 ? results : 'not_found');
  };

  const handleSelectPlayer = (player: HonorPlayerInfo) => {
      setSelectedPlayerIds(prev => prev.includes(player.governorId) ? prev.filter(id => id !== player.governorId) : [...prev, player.governorId]);
  };

  const handleClearSearch = () => { setSearchQuery(''); setSearchResults(null); };

  // --- Parsing Helpers ---
  const parseAnyNumber = (val: any): number => parseGermanNumber(val);

  const parseHonorFile = (file: UploadedFile): HonorPlayerInfo[] => {
    // 🔍 ID:
    const govIdIdx = findColumnIndex(file.headers, ['governor id', 'id', 'user id']);
    
    // 🔍 Name: Exakte Begriffe. "Governor" entfernt, da es "Governor ID" matchen würde!
    const nameIdx = findColumnIndex(file.headers, ['name', 'display name', 'spieler']);
    
    // 🔍 Honor:
    const honorIdx = findColumnIndex(file.headers, ['honor', 'points', 'score', 'ehre']);

    if (govIdIdx === undefined || honorIdx === undefined) return [];

    return file.data.map(row => {
        const val = row[honorIdx];
        const points = parseAnyNumber(val);
        // Fallback Name:
        let pName = 'Unknown';
        if (nameIdx !== undefined && row[nameIdx]) pName = String(row[nameIdx]);

        return { governorId: String(row[govIdIdx]), name: pName, honorPoint: points };
    }).filter(p => p.honorPoint > 0);
  };

  const processHonorHistory = (files: UploadedFile[]): PlayerHonorHistory[] => {
    const map = new Map<string, PlayerHonorHistory>();
    files.forEach(file => {
      const parsedRows = parseHonorFile(file);
      let label = file.name.replace(/\.(xlsx|xls|csv)$/i, '').replace(/_/g, ' ');
      if (file.uploadDate) {
           const d = new Date(file.uploadDate);
           label = d.toLocaleDateString(undefined, { day: '2-digit', month: '2-digit' }) + ` (${label.substring(0,5)})`;
      }
      parsedRows.forEach(row => {
        if (!map.has(row.governorId)) {
          map.set(row.governorId, { id: row.governorId, name: row.name, history: [] });
        }
        const entry = map.get(row.governorId)!;
        entry.name = row.name; 
        entry.history.push({ fileName: label, honorPoint: row.honorPoint });
      });
    });
    return Array.from(map.values());
  };

  const calculateStatsProgress = (start: UploadedFile, end: UploadedFile): StatProgressRow[] => {
    const parseRow = (headers: string[], row: any[]) => {
      const getIdx = (keys: string[]) => findColumnIndex(headers, keys);
      const idIdx = getIdx(['id', 'governor id', 'user id']);
      const nameIdx = getIdx(['name', 'display name', 'spieler']); 
      const allyIdx = getIdx(['alliance', 'allianz', 'tag']);
      const powerIdx = getIdx(['power', 'kraft']);
      const t4Idx = getIdx(['t4 kills', 'tier 4 kills']);
      const t5Idx = getIdx(['t5 kills', 'tier 5 kills']);
      const deadIdx = getIdx(['dead', 'deaths', 'tote']);

      if (idIdx === undefined) return null;

      return {
        id: String(row[idIdx]),
        name: nameIdx !== undefined ? String(row[nameIdx]) : 'Unknown',
        alliance: allyIdx !== undefined ? String(row[allyIdx]) : '',
        power: parseAnyNumber(row[powerIdx]),
        t4: parseAnyNumber(row[t4Idx]),
        t5: parseAnyNumber(row[t5Idx]),
        dead: parseAnyNumber(row[deadIdx]),
      };
    };

    const startMap = new Map<string, ReturnType<typeof parseRow>>();
    start.data.forEach(row => { const p = parseRow(start.headers, row); if (p) startMap.set(p.id, p); });

    const result: StatProgressRow[] = [];
    end.data.forEach(row => {
      const curr = parseRow(end.headers, row);
      if (!curr) return;
      const prev = startMap.get(curr.id);
      const prevPower = prev ? prev.power : 0;
      const prevT4 = prev ? prev.t4 : 0;
      const prevT5 = prev ? prev.t5 : 0;
      const prevDead = prev ? prev.dead : 0;
      const t4Diff = Math.max(0, curr.t4 - prevT4); 
      const t5Diff = Math.max(0, curr.t5 - prevT5);
      
      result.push({
        id: curr.id,
        name: curr.name,
        alliance: curr.alliance,
        powerDiff: curr.power - prevPower,
        t4KillsDiff: t4Diff,
        t5KillsDiff: t5Diff,
        totalKillsDiff: t4Diff + t5Diff,
        deadDiff: Math.max(0, curr.dead - prevDead)
      });
    });
    return result.sort((a, b) => b.totalKillsDiff - a.totalKillsDiff);
  };

  const currentHonorTableData = useMemo(() => {
    if (honorHistory.length === 0) return [];
    return honorHistory.map(h => {
        const lastEntry = h.history[h.history.length - 1];
        return {
            governorId: h.id,
            name: h.name,
            oldHonor: 0,
            newHonor: lastEntry.honorPoint,
            diffHonor: lastEntry.honorPoint
        };
    }).sort((a, b) => b.newHonor - a.newHonor);
  }, [honorHistory]);

  const activeEvent = events.find(e => e.id === selectedEventId);

  if (events.length === 0 && !loading) {
    return <div className="p-8 text-center text-gray-400">Keine öffentlichen KvK Events gefunden.</div>;
  }

  return (
    <div className="bg-gray-900 min-h-screen text-gray-100 font-sans pb-20">
      <div className="bg-gradient-to-r from-blue-900 to-gray-900 p-6 shadow-lg border-b border-gray-700">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white tracking-wider flex items-center">
              <span className="text-4xl mr-2">⚔️</span> {activeEvent ? activeEvent.name : 'KvK Tracker'}
            </h1>
          </div>
          {events.length > 1 && (
            <select className="bg-gray-800 border border-gray-600 text-white p-2 rounded outline-none" value={selectedEventId} onChange={e => setSelectedEventId(e.target.value)}>
              {events.map(ev => <option key={ev.id} value={ev.id}>{ev.name}</option>)}
            </select>
          )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-4 md:p-6">
        <div className="flex justify-center mb-8">
          <div className="bg-gray-800 p-1 rounded-lg inline-flex shadow-md border border-gray-700">
            <button onClick={() => setViewMode('stats')} className={`px-6 py-2 rounded-md font-bold transition-all ${viewMode === 'stats' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-700'}`}>Stats Progress</button>
            <button onClick={() => setViewMode('honor')} className={`px-6 py-2 rounded-md font-bold transition-all ${viewMode === 'honor' ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-700'}`}>Honor Dashboard</button>
          </div>
        </div>

        {error && <div className="bg-red-900/50 border border-red-500 text-red-200 p-4 rounded mb-6 text-center">{error}</div>}
        {loading && <div className="text-center py-12 text-blue-400 animate-pulse text-xl">Lade Daten...</div>}

        {!loading && !error && activeEvent && (
          <div className="animate-fade-in-up">
            {viewMode === 'stats' && (
              <div className="bg-gray-800 rounded-xl shadow-xl overflow-hidden border border-gray-700">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-gray-900 text-gray-400 text-xs uppercase tracking-wider">
                        <th className="p-3">#</th><th className="p-3">Name</th><th className="p-3">Allianz</th>
                        <th className="p-3 text-right text-yellow-500">Power $\Delta$</th>
                        <th className="p-3 text-right text-red-400">T4 $\Delta$</th><th className="p-3 text-right text-red-500">T5 $\Delta$</th>
                        <th className="p-3 text-right text-red-300 font-bold">Total $\Delta$</th><th className="p-3 text-right text-gray-400">Dead $\Delta$</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-700 text-sm">
                      {statsData.map((row, idx) => (
                        <tr key={row.id} className="hover:bg-gray-750 transition-colors">
                          <td className="p-3 text-gray-500 font-mono">{idx + 1}</td>
                          <td className="p-3 font-medium text-white">{row.name}</td>
                          <td className="p-3 text-gray-300">[{row.alliance}]</td>
                          <td className={`p-3 text-right font-mono ${row.powerDiff >= 0 ? 'text-green-400' : 'text-red-400'}`}>{row.powerDiff > 0 ? '+' : ''}{formatNumber(row.powerDiff)}</td>
                          <td className="p-3 text-right font-mono text-gray-300">+{formatNumber(row.t4KillsDiff)}</td>
                          <td className="p-3 text-right font-mono text-gray-300">+{formatNumber(row.t5KillsDiff)}</td>
                          <td className="p-3 text-right font-mono font-bold text-yellow-400">+{formatNumber(row.totalKillsDiff)}</td>
                          <td className="p-3 text-right font-mono text-gray-400">+{formatNumber(row.deadDiff)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {viewMode === 'honor' && (
              <div className="space-y-6">
                 <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-1">
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
                             <div className="mt-4 p-4 bg-gray-800 rounded-lg border border-gray-700">
                                 <h4 className="text-sm font-semibold text-gray-300 mb-2">Ausgewählt:</h4>
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
                                selectedPlayerIds={selectedPlayerIds.length > 0 ? selectedPlayerIds : undefined} 
                             />
                        ) : <div className="h-64 bg-gray-800 rounded-xl flex items-center justify-center text-gray-500 border border-gray-700">Keine Honor-Daten verfügbar.</div>}
                    </div>
                 </div>
                {currentHonorTableData.length > 0 && <HonorOverviewTable stats={{ playerHonorChanges: currentHonorTableData }} />}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default PublicKvKView;