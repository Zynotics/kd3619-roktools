import React, { useState, useEffect } from 'react';
// import { useParams } from 'react-router-dom'; // ❌ ENTFERNT
import { KvkEvent, UploadedFile, HonorPlayerInfo } from '../types';
import { fetchPublicKvkEvents } from '../api';
import { findColumnIndex, formatNumber, parseGermanNumber } from '../utils';
import HonorOverviewTable from './HonorOverviewTable'; 

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

type StatProgressRow = {
  id: string;
  name: string;
  alliance: string;
  powerDiff: number;
  t4KillsDiff: number;
  t5KillsDiff: number;
  totalKillsDiff: number; // T4 + T5
  deadDiff: number;
};

// 🆕 NEU: Props Definition
interface PublicKvKViewProps {
  kingdomSlug: string;
}

const PublicKvKView: React.FC<PublicKvKViewProps> = ({ kingdomSlug }) => {
  // const { slug } = useParams<{ slug: string }>(); // ❌ ENTFERNT
  const slug = kingdomSlug; // Wir nutzen den Prop

  const [events, setEvents] = useState<KvkEvent[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string>('');
  
  // Rohdaten (alle Files des Kingdoms)
  const [overviewFiles, setOverviewFiles] = useState<UploadedFile[]>([]);
  const [honorFiles, setHonorFiles] = useState<UploadedFile[]>([]);
  
  // Berechnete Daten für die Anzeige
  const [statsData, setStatsData] = useState<StatProgressRow[]>([]);
  const [honorData, setHonorData] = useState<HonorPlayerInfo[]>([]);
  
  const [viewMode, setViewMode] = useState<'stats' | 'honor'>('stats');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // 1. Initiales Laden der Events
  useEffect(() => {
    if (slug) {
      loadEvents();
    }
  }, [slug]);

  // 2. Laden der Files, wenn ein Event ausgewählt ist (oder das erste automatisch)
  useEffect(() => {
    if (slug && selectedEventId) {
      loadFilesAndCalculate();
    }
  }, [slug, selectedEventId]);

  const loadEvents = async () => {
    try {
      const evs = await fetchPublicKvkEvents(slug!);
      setEvents(evs);
      if (evs.length > 0) {
        setSelectedEventId(evs[0].id); // Wähle das neueste Event standardmäßig
      }
    } catch (e) {
      console.error(e);
      setError('Konnte Events nicht laden.');
    }
  };

  const loadFilesAndCalculate = async () => {
    setLoading(true);
    setError('');
    try {
      const event = events.find(e => e.id === selectedEventId);
      if (!event) return;

      // Parallel Files laden (Optimierung: Könnte man auch cachen)
      const [ovRes, honRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/public/kingdom/${slug}/overview-files`),
        fetch(`${API_BASE_URL}/api/public/kingdom/${slug}/honor-files`)
      ]);

      if (!ovRes.ok || !honRes.ok) throw new Error('Fehler beim Laden der Dateidaten');

      const allOverview: UploadedFile[] = await ovRes.json();
      const allHonor: UploadedFile[] = await honRes.json();

      setOverviewFiles(allOverview);
      setHonorFiles(allHonor);

      // --- BERECHNUNG STATS PROGRESS ---
      const startFile = allOverview.find(f => f.id === event.startFileId);
      const endFile = allOverview.find(f => f.id === event.endFileId);

      if (startFile && endFile) {
        const calculated = calculateStatsProgress(startFile, endFile);
        setStatsData(calculated);
      } else {
        setStatsData([]); // Keine vollständigen Daten für Stats
      }

      // --- BERECHNUNG HONOR RANKING ---
      // Wir nehmen vereinfacht an: Die Honor-Files sind Schnappschüsse. 
      // Wir wollen das Ranking basierend auf der *neuesten* Datei im Event anzeigen.
      const relevantHonorFiles = allHonor
        .filter(f => event.honorFileIds.includes(f.id))
        .sort((a, b) => (a.name > b.name ? 1 : -1)); 

      if (relevantHonorFiles.length > 0) {
        // Nimm die letzte (aktuellste) Datei für das Ranking
        const latestHonorFile = relevantHonorFiles[relevantHonorFiles.length - 1];
        const parsedHonor = parseHonorFile(latestHonorFile);
        setHonorData(parsedHonor);
      } else {
        setHonorData([]);
      }

    } catch (err) {
      console.error(err);
      setError('Fehler bei der Datenverarbeitung.');
    } finally {
      setLoading(false);
    }
  };

  // --- Helper: Stats Berechnung ---
  const calculateStatsProgress = (start: UploadedFile, end: UploadedFile): StatProgressRow[] => {
    const parseRow = (headers: string[], row: any[]) => {
      const getIdx = (keys: string[]) => findColumnIndex(headers, keys);
      const idIdx = getIdx(['id', 'governor', 'fid']);
      const nameIdx = getIdx(['name', 'spieler', 'governor name']);
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
        power: powerIdx !== undefined ? parseGermanNumber(row[powerIdx]) : 0,
        t4: t4Idx !== undefined ? parseGermanNumber(row[t4Idx]) : 0,
        t5: t5Idx !== undefined ? parseGermanNumber(row[t5Idx]) : 0,
        dead: deadIdx !== undefined ? parseGermanNumber(row[deadIdx]) : 0,
      };
    };

    const startMap = new Map<string, ReturnType<typeof parseRow>>();
    start.data.forEach(row => {
      const p = parseRow(start.headers, row);
      if (p) startMap.set(p.id, p);
    });

    const result: StatProgressRow[] = [];

    end.data.forEach(row => {
      const curr = parseRow(end.headers, row);
      if (!curr) return;

      const prev = startMap.get(curr.id);
      
      const prevPower = prev ? prev.power : 0;
      const prevT4 = prev ? prev.t4 : 0;
      const prevT5 = prev ? prev.t5 : 0;
      const prevDead = prev ? prev.dead : 0;

      // Berechnung Delta
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

  // --- Helper: Honor Parsing ---
  const parseHonorFile = (file: UploadedFile): HonorPlayerInfo[] => {
    const govIdIdx = findColumnIndex(file.headers, ['governor id', 'id']);
    const nameIdx = findColumnIndex(file.headers, ['governor', 'name']);
    const honorIdx = findColumnIndex(file.headers, ['honor', 'points', 'score']);

    if (govIdIdx === undefined || honorIdx === undefined) return [];

    return file.data.map(row => ({
      governorId: String(row[govIdIdx]),
      name: nameIdx !== undefined ? String(row[nameIdx]) : 'Unknown',
      honorPoint: parseGermanNumber(row[honorIdx])
    })).sort((a, b) => b.honorPoint - a.honorPoint);
  };


  if (events.length === 0 && !loading) {
    return <div className="p-8 text-center text-gray-400">Keine öffentlichen KvK Events gefunden.</div>;
  }

  const activeEvent = events.find(e => e.id === selectedEventId);

  return (
    <div className="bg-gray-900 min-h-screen text-gray-100 font-sans">
      
      {/* Header Area */}
      <div className="bg-gradient-to-r from-blue-900 to-gray-900 p-6 shadow-lg border-b border-gray-700">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white tracking-wider flex items-center">
              <span className="text-4xl mr-2">⚔️</span> 
              {activeEvent ? activeEvent.name : 'KvK Tracker'}
            </h1>
            {activeEvent && (
              <p className="text-sm text-blue-300 mt-1">
                 Live Tracking & Statistics
              </p>
            )}
          </div>
          
          {events.length > 1 && (
            <select 
              className="bg-gray-800 border border-gray-600 text-white p-2 rounded focus:ring-2 focus:ring-blue-500 outline-none"
              value={selectedEventId}
              onChange={e => setSelectedEventId(e.target.value)}
            >
              {events.map(ev => <option key={ev.id} value={ev.id}>{ev.name}</option>)}
            </select>
          )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-4 md:p-6">
        
        {/* Toggle Buttons */}
        <div className="flex justify-center mb-8">
          <div className="bg-gray-800 p-1 rounded-lg inline-flex shadow-md border border-gray-700">
            <button
              onClick={() => setViewMode('stats')}
              className={`px-6 py-2 rounded-md font-bold transition-all duration-200 ${
                viewMode === 'stats' 
                  ? 'bg-blue-600 text-white shadow' 
                  : 'text-gray-400 hover:text-white hover:bg-gray-700'
              }`}
            >
              Stats Progress (Diff)
            </button>
            <button
              onClick={() => setViewMode('honor')}
              className={`px-6 py-2 rounded-md font-bold transition-all duration-200 ${
                viewMode === 'honor' 
                  ? 'bg-purple-600 text-white shadow' 
                  : 'text-gray-400 hover:text-white hover:bg-gray-700'
              }`}
            >
              Honor Ranking
            </button>
          </div>
        </div>

        {error && <div className="bg-red-900/50 border border-red-500 text-red-200 p-4 rounded mb-6 text-center">{error}</div>}
        {loading && <div className="text-center py-12 text-blue-400 animate-pulse text-xl">Lade Daten der Kämpfer...</div>}

        {!loading && !error && activeEvent && (
          <div className="animate-fade-in-up">
            
            {/* VIEW A: STATS PROGRESS */}
            {viewMode === 'stats' && (
              <div className="bg-gray-800 rounded-xl shadow-xl overflow-hidden border border-gray-700">
                <div className="p-4 bg-gray-800 border-b border-gray-700 flex justify-between items-center">
                  <h2 className="text-lg font-semibold text-blue-200">Fortschritt (Start bis Heute)</h2>
                  <span className="text-xs text-gray-500">Sortiert nach Total Kills</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-gray-900 text-gray-400 text-xs uppercase tracking-wider">
                        <th className="p-3">#</th>
                        <th className="p-3">Name</th>
                        <th className="p-3">Allianz</th>
                        <th className="p-3 text-right text-yellow-500">Power $\Delta$</th>
                        <th className="p-3 text-right text-red-400">T4 $\Delta$</th>
                        <th className="p-3 text-right text-red-500">T5 $\Delta$</th>
                        <th className="p-3 text-right text-red-300 font-bold">Total Kills $\Delta$</th>
                        <th className="p-3 text-right text-gray-400">Dead $\Delta$</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-700 text-sm">
                      {statsData.map((row, idx) => (
                        <tr key={row.id} className="hover:bg-gray-750 transition-colors">
                          <td className="p-3 text-gray-500 font-mono">{idx + 1}</td>
                          <td className="p-3 font-medium text-white">{row.name}</td>
                          <td className="p-3 text-gray-300">[{row.alliance}]</td>
                          <td className={`p-3 text-right font-mono ${row.powerDiff >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {row.powerDiff > 0 ? '+' : ''}{formatNumber(row.powerDiff)}
                          </td>
                          <td className="p-3 text-right font-mono text-gray-300">+{formatNumber(row.t4KillsDiff)}</td>
                          <td className="p-3 text-right font-mono text-gray-300">+{formatNumber(row.t5KillsDiff)}</td>
                          <td className="p-3 text-right font-mono font-bold text-yellow-400">+{formatNumber(row.totalKillsDiff)}</td>
                          <td className="p-3 text-right font-mono text-gray-400">+{formatNumber(row.deadDiff)}</td>
                        </tr>
                      ))}
                      {statsData.length === 0 && (
                        <tr><td colSpan={8} className="p-8 text-center text-gray-500">Keine Daten verfügbar. Prüfe Start/End Konfiguration.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* VIEW B: HONOR RANKING */}
            {viewMode === 'honor' && (
              <div className="space-y-4">
                <div className="bg-purple-900/20 border border-purple-500/30 p-4 rounded text-center text-purple-200 text-sm mb-4">
                  Zeigt den aktuellen Stand basierend auf dem neuesten Honor-Scan.
                </div>
                {honorData.length > 0 ? (
                  <HonorOverviewTable data={honorData} />
                ) : (
                  <div className="bg-gray-800 p-8 rounded text-center text-gray-500">Keine Honor-Daten verknüpft.</div>
                )}
              </div>
            )}
            
          </div>
        )}
      </div>
    </div>
  );
};

export default PublicKvKView;