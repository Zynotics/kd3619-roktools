import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { Card } from './Card';
import { Table, TableHeader, TableRow, TableCell } from './Table';
import { cleanFileName, parseGermanNumber, findColumnIndex, formatNumber, abbreviateNumber } from '../utils';
import { useAuth } from './AuthContext';
import type { UploadedFile } from '../types';

interface PlayerAnalyticsRecord {
  fileName: string; power: number; troopsPower: number; totalKillPoints: number; deadTroops: number; t1Kills: number; t2Kills: number; t3Kills: number; t4Kills: number; t5Kills: number; totalKills: number; 
}
interface PlayerAnalyticsHistory {
  id: string; name: string; alliance: string; history: PlayerAnalyticsRecord[];
}

declare var Chart: any;

interface PowerAnalyticsDashboardProps {
  isAdmin: boolean;
  backendUrl: string;
  publicSlug: string | null;
  isAdminOverride: boolean;
}

// --- CHART COMPONENT (Unverändert) ---
const PlayerAnalyticsHistoryChart: React.FC<{ history: PlayerAnalyticsHistory }> = ({ history }) => {
    const chartRef = useRef<HTMLCanvasElement>(null);
    const chartInstanceRef = useRef<any>(null);

    useEffect(() => {
        if (!chartRef.current || !history || history.history.length === 0) return;
        
        const chartData = {
            labels: history.history.map(h => h.fileName),
            datasets: [
                { label: 'Power', data: history.history.map(h => h.power), borderColor: 'rgba(59, 130, 246, 0.9)', backgroundColor: 'rgba(59, 130, 246, 0.2)', fill: false, tension: 0.2, yAxisID: 'y' },
                { label: 'Kill Points', data: history.history.map(h => h.totalKillPoints), borderColor: 'rgba(16, 185, 129, 0.9)', backgroundColor: 'rgba(16, 185, 129, 0.2)', fill: false, tension: 0.2, yAxisID: 'y1' }
            ],
        };

        if (chartInstanceRef.current) chartInstanceRef.current.destroy();
        const ctx = chartRef.current.getContext('2d');
        if (!ctx) return;
        
        chartInstanceRef.current = new Chart(ctx, {
            type: 'line', data: chartData,
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { labels: { color: '#e5e7eb' } } },
                scales: {
                    x: { ticks: { color: '#9ca3af' }, grid: { color: 'rgba(255, 255, 255, 0.1)' } },
                    y: { type: 'linear', display: true, position: 'left', ticks: { color: 'rgba(59, 130, 246, 1)', callback: (v: any) => abbreviateNumber(v) }, grid: { color: 'rgba(59, 130, 246, 0.2)' } },
                    y1: { type: 'linear', display: true, position: 'right', grid: { drawOnChartArea: false }, ticks: { color: 'rgba(16, 185, 129, 1)', callback: (v: any) => abbreviateNumber(v) } }
                }
            }
        });
        return () => { if (chartInstanceRef.current) chartInstanceRef.current.destroy(); };
    }, [history]);

    return (
        <Card hover className="p-4" gradient>
            <h5 className="text-md font-semibold text-gray-300 mb-3 text-center">Power & Kill Points</h5>
            <div className="relative h-96"><canvas ref={chartRef}></canvas></div>
        </Card>
    );
};

const PowerAnalyticsDashboard: React.FC<PowerAnalyticsDashboardProps> = ({ isAdmin, backendUrl, publicSlug, isAdminOverride }) => {
  const { user } = useAuth();
  const role = user?.role;
  
  const isPublicView = !!publicSlug && !user;
  const userLoggedIn = !!user;

  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]); 
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isDataLoaded, setIsDataLoaded] = useState<boolean>(false);
  const [kingdomName, setKingdomName] = useState<string>('Player Analytics');

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchMatches, setSearchMatches] = useState<PlayerAnalyticsHistory[] | 'not_found' | null>(null);
  const [selectedPlayerHistory, setSelectedPlayerHistory] = useState<PlayerAnalyticsHistory | null>(null);

  // --- FETCHING ---
  const fetchKingdomName = useCallback(async (slug: string) => {
    try {
        const res = await fetch(`${backendUrl}/api/public/kingdom/${slug}`);
        if (res.ok) {
            const data = await res.json();
            setKingdomName(data.displayName);
        }
    } catch (e) { setKingdomName('Kingdom Analytics'); }
  }, [backendUrl]);

  const fetchFiles = useCallback(async () => {
    const isFetchPublic = !!publicSlug && !userLoggedIn;
    const isFetchOverride = isAdminOverride && !!publicSlug; 
    
    if (publicSlug) fetchKingdomName(publicSlug);
    else setKingdomName('Player Analytics');

    if ((isFetchPublic || isFetchOverride) && !publicSlug) {
        setError('Slug missing'); setIsLoading(false); return;
    }

    try {
      setIsLoading(true); setError(null);
      let response: Response;
      if (isFetchPublic || isFetchOverride) {
        response = await fetch(`${backendUrl}/api/public/kingdom/${publicSlug}/overview-files`); // Analytics nutzt Overview Files!
      } else {
        const token = localStorage.getItem('authToken');
        if (!token) throw new Error('Auth missing');
        response = await fetch(`${backendUrl}/overview/files-data`, { headers: { Authorization: `Bearer ${token}` } });
      }

      if (!response.ok) throw new Error('Fetch failed');
      const data = await response.json();
      setUploadedFiles(data || []);
      setIsDataLoaded(true);
    } catch (err: any) {
      const msg = err.message;
      if ((isFetchPublic || isFetchOverride) && (msg.includes('404') || msg.includes('403'))) setUploadedFiles([]);
      else setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, [backendUrl, publicSlug, userLoggedIn, isAdminOverride, fetchKingdomName]);

  useEffect(() => { fetchFiles(); }, [fetchFiles]);

  // --- PARSING (ROBUST) ---
  const parseFileToPlayers = (file: UploadedFile): any[] => {
      if (!file || !file.headers || !file.data) return [];
      const headers = file.headers.map(h => String(h)); // Sicherstellen, dass Header Strings sind
      
      // Erweiterte Keywords für bessere Erkennung
      const getIdx = (keys: string[]) => findColumnIndex(headers, keys);
      const getVal = (row: any[], idx: number | undefined) => (idx !== undefined && row[idx] != null) ? String(row[idx]).trim() : '';
      const getNum = (row: any[], idx: number | undefined) => parseGermanNumber(getVal(row, idx));

      const idxId = getIdx(['governorid', 'governor id', 'id', 'gov id']);
      const idxName = getIdx(['name', 'playername', 'player name']);
      const idxAlly = getIdx(['alliance', 'allianz', 'tag']);
      const idxPower = getIdx(['power', 'macht']);
      const idxTroops = getIdx(['troopspower', 'troops power']);
      const idxKP = getIdx(['total kill points', 'kill points', 'kp']);
      const idxDead = getIdx(['deadtroops', 'dead troops', 'dead']);
      
      // Kills T1-T5
      const idxT1 = getIdx(['t1', 'tier 1', 't1 kills']);
      const idxT2 = getIdx(['t2', 'tier 2', 't2 kills']);
      const idxT3 = getIdx(['t3', 'tier 3', 't3 kills']);
      const idxT4 = getIdx(['t4', 'tier 4', 't4 kills']);
      const idxT5 = getIdx(['t5', 'tier 5', 't5 kills']);

      const res: any[] = [];
      file.data.forEach(row => {
          const id = getVal(row, idxId);
          const name = getVal(row, idxName);
          
          // WICHTIG: Nur gültige Zeilen (ID oder Name muss da sein)
          if (!id && !name) return;

          const t1 = getNum(row, idxT1);
          const t2 = getNum(row, idxT2);
          const t3 = getNum(row, idxT3);
          const t4 = getNum(row, idxT4);
          const t5 = getNum(row, idxT5);

          res.push({
              id, name, alliance: getVal(row, idxAlly),
              power: getNum(row, idxPower),
              troopsPower: getNum(row, idxTroops),
              totalKillPoints: getNum(row, idxKP),
              deadTroops: getNum(row, idxDead),
              t1Kills: t1, t2Kills: t2, t3Kills: t3, t4Kills: t4, t5Kills: t5,
              totalKills: t1 + t2 + t3 + t4 + t5
          });
      });
      return res;
  };

  // --- SEARCH & HISTORY LOGIC ---
  const playerHistories = useMemo(() => {
      const map = new Map<string, PlayerAnalyticsHistory>();
      if (!uploadedFiles || uploadedFiles.length === 0) return map;

      const sortedFiles = [...uploadedFiles].sort((a,b) => new Date(a.uploadDate).getTime() - new Date(b.uploadDate).getTime());

      for (const file of sortedFiles) {
          const fileName = cleanFileName(file.name);
          const players = parseFileToPlayers(file);

          for (const p of players) {
              // Nutze ID als Key, wenn vorhanden, sonst Name (Fallback)
              const key = p.id || p.name;
              if (!key) continue;

              let h = map.get(key);
              if (!h) { 
                  h = { id: p.id || 'Unknown', name: p.name || 'Unknown', alliance: p.alliance, history: [] }; 
                  map.set(key, h); 
              }
              // Update Name/Alliance mit neuesten Daten
              if (p.name) h.name = p.name;
              if (p.alliance) h.alliance = p.alliance;
              
              h.history.push({ 
                  fileName, 
                  power: p.power, troopsPower: p.troopsPower, totalKillPoints: p.totalKillPoints, 
                  deadTroops: p.deadTroops, t1Kills: p.t1Kills, t2Kills: p.t2Kills, 
                  t3Kills: p.t3Kills, t4Kills: p.t4Kills, t5Kills: p.t5Kills, totalKills: p.totalKills 
              });
          }
      }
      return map;
  }, [uploadedFiles]);

  const handleSearch = () => {
      if (!isDataLoaded || !searchQuery.trim()) { setSearchMatches(null); setSelectedPlayerHistory(null); return; }
      const q = searchQuery.toLowerCase().trim();
      const all = Array.from(playerHistories.values());
      
      // Suche: ID match (exakt) oder Name match (contains)
      const res = all.filter(p => 
          (p.id && p.id.toLowerCase().includes(q)) || 
          (p.name && p.name.toLowerCase().includes(q))
      );

      if (res.length === 0) setSearchMatches('not_found');
      else if (res.length === 1) { setSelectedPlayerHistory(res[0]); setSearchMatches(null); }
      else setSearchMatches(res);
  };

  if (isLoading) return <div className="p-6 text-center text-gray-300">Loading...</div>;

  return (
    <div className="space-y-8">
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-gray-200 mb-4">{kingdomName} Search</h3>
        <div className="flex flex-col sm:flex-row gap-4">
          <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSearch()} placeholder="Name or ID..." className="flex-grow bg-gray-700 border border-gray-600 text-white text-sm rounded-lg p-2.5" />
          <button onClick={handleSearch} className="bg-blue-600 text-white font-semibold py-2.5 px-4 rounded-lg hover:bg-blue-700">Search</button>
          <button onClick={() => { setSearchQuery(''); setSearchMatches(null); setSelectedPlayerHistory(null); }} className="bg-gray-600 text-white font-semibold py-2.5 px-4 rounded-lg hover:bg-gray-700">Clear</button>
        </div>
      </Card>

      <div className="space-y-4">
        {searchMatches === 'not_found' && <div className="p-4 text-center text-amber-400 bg-amber-900/50 rounded-lg">Player not found.</div>}
        {Array.isArray(searchMatches) && (
            <Card className="p-4">
                <h4 className="text-md font-semibold text-gray-300 mb-3">Select Player:</h4>
                <ul className="space-y-2">{searchMatches.map(p => <li key={p.id}><button onClick={() => { setSelectedPlayerHistory(p); setSearchMatches(null); }} className="w-full text-left p-3 rounded-lg bg-gray-700 hover:bg-gray-600"><p className="font-semibold text-white">{p.name}</p><p className="text-sm text-gray-400">ID: {p.id}</p></button></li>)}</ul>
            </Card>
        )}
      </div>

      {selectedPlayerHistory && (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row gap-4 items-baseline mb-4 p-2">
                <h4 className="text-xl font-bold text-white">{selectedPlayerHistory.name}</h4>
                <span className="text-sm text-gray-400">ID: {selectedPlayerHistory.id} | Alliance: {selectedPlayerHistory.alliance}</span>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <PlayerAnalyticsHistoryChart history={selectedPlayerHistory} />
                <Card gradient className="p-4">
                    <div className="overflow-x-auto relative border border-gray-700 rounded-lg max-h-96">
                        <Table>
                        <TableHeader><tr><TableCell header>Snapshot</TableCell><TableCell header align="right">Power</TableCell><TableCell header align="right">Kill Points</TableCell><TableCell header align="right">Dead</TableCell></tr></TableHeader>
                        <tbody>{selectedPlayerHistory.history.map((r, i) => (<TableRow key={i}><TableCell>{r.fileName}</TableCell><TableCell align="right">{formatNumber(r.power)}</TableCell><TableCell align="right">{formatNumber(r.totalKillPoints)}</TableCell><TableCell align="right">{formatNumber(r.deadTroops)}</TableCell></TableRow>))}</tbody>
                        </Table>
                    </div>
                </Card>
            </div>
        </div>
      )}
      
      {!selectedPlayerHistory && uploadedFiles.length === 0 && isPublicView && (
          <div className="text-center p-8 text-yellow-400 bg-gray-800 rounded-xl">No Data Available</div>
      )}
    </div>
  );
};

export default PowerAnalyticsDashboard;