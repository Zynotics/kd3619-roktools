import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { Card } from './Card';
import { Table, TableHeader, TableRow, TableCell } from './Table';
import { cleanFileName, parseGermanNumber, findColumnIndex, formatNumber, abbreviateNumber } from '../utils';
import { useAuth } from '../components/AuthContext';
import type { UploadedFile } from '../types';
import Chart from 'chart.js/auto';

interface PlayerAnalyticsRecord {
  fileName: string; power: number; troopsPower: number; totalKillPoints: number; deadTroops: number; t1Kills: number; t2Kills: number; t3Kills: number; t4Kills: number; t5Kills: number; totalKills: number;
}
interface PlayerAnalyticsHistory {
  id: string; name: string; alliance: string; history: PlayerAnalyticsRecord[];
}

// declare var Chart: any;

interface PowerAnalyticsDashboardProps {
  isAdmin: boolean;
  backendUrl: string;
  publicSlug: string | null;
  isAdminOverride: boolean;
}

// Interne Chart Komponente
const PlayerAnalyticsHistoryChart: React.FC<{ history: PlayerAnalyticsHistory }> = ({ history }) => {
    const chartRef = useRef<HTMLCanvasElement>(null);
    const chartInstanceRef = useRef<any>(null);

    useEffect(() => {
        if (!chartRef.current || !history || history.history.length === 0) return;
        
        const chartData = {
            labels: history.history.map(h => h.fileName),
            datasets: [
                {
                    label: 'Power', data: history.history.map(h => h.power),
                    borderColor: 'rgba(59, 130, 246, 0.9)', backgroundColor: 'rgba(59, 130, 246, 0.2)', fill: false, tension: 0.2, yAxisID: 'y',
                },
                {
                    label: 'Kill Points', data: history.history.map(h => h.totalKillPoints),
                    borderColor: 'rgba(16, 185, 129, 0.9)', backgroundColor: 'rgba(16, 185, 129, 0.2)', fill: false, tension: 0.2, yAxisID: 'y1',
                }
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
            <h5 className="text-md font-semibold text-gray-300 mb-3 text-center">Power & Kill Points Progression</h5>
            <div className="relative h-96"><canvas ref={chartRef}></canvas></div>
        </Card>
    );
};

// Hauptkomponente
const PowerAnalyticsDashboard: React.FC<PowerAnalyticsDashboardProps> = ({ isAdmin, backendUrl, publicSlug, isAdminOverride }) => {
  const { user } = useAuth();
  const isPublicView = !!publicSlug && !user; 
  const userLoggedIn = !!user;

  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]); 
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isDataLoaded, setIsDataLoaded] = useState<boolean>(false);
  
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchMatches, setSearchMatches] = useState<PlayerAnalyticsHistory[] | 'not_found' | null>(null);
  const [selectedPlayerHistory, setSelectedPlayerHistory] = useState<PlayerAnalyticsHistory | null>(null);

  const fetchFiles = useCallback(async () => {
    const shouldUsePublicEndpoint = !!publicSlug;
    if ((isPublicView || isAdminOverride) && !publicSlug) { setError('Slug missing'); setIsLoading(false); return; }

    try {
      setIsLoading(true); setError(null);
      let response: Response;
      
      if (shouldUsePublicEndpoint) {
        response = await fetch(`${backendUrl}/api/public/kingdom/${publicSlug}/overview-files`);
      } else {
        const token = localStorage.getItem('authToken');
        if (!token) throw new Error('Authentication token not found.');
        response = await fetch(`${backendUrl}/overview/files-data`, { headers: { Authorization: `Bearer ${token}` } });
      }

      if (!response.ok) {
          if (shouldUsePublicEndpoint && (response.status === 404 || response.status === 403)) { setUploadedFiles([]); setIsDataLoaded(true); return; }
          throw new Error('Fetch failed');
      }
      const data = await response.json();
      setUploadedFiles(data || []);
      setIsDataLoaded(true);
    } catch (err: any) { setError(err.message); } finally { setIsLoading(false); }
  }, [backendUrl, publicSlug, userLoggedIn, isAdminOverride]);

  useEffect(() => { fetchFiles(); }, [fetchFiles]);
  
  const parseFileToPlayers = (file: UploadedFile): any[] => {
      if (!file || !file.headers || !file.data) return [];
      const headers = file.headers.map(h => String(h));
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
      const idxT1 = getIdx(['t1', 't1 kills']);
      const idxT2 = getIdx(['t2', 't2 kills']);
      const idxT3 = getIdx(['t3', 't3 kills']);
      const idxT4 = getIdx(['t4', 't4 kills', 'tier4']);
      const idxT5 = getIdx(['t5', 't5 kills', 'tier5']);

      const res: any[] = [];
      file.data.forEach(row => {
          const id = getVal(row, idxId);
          const name = getVal(row, idxName);
          if (!id && !name) return;
          const t1 = getNum(row, idxT1); const t2 = getNum(row, idxT2); const t3 = getNum(row, idxT3); const t4 = getNum(row, idxT4); const t5 = getNum(row, idxT5);
          res.push({
              id, name, alliance: getVal(row, idxAlly), power: getNum(row, idxPower), troopsPower: getNum(row, idxTroops), totalKillPoints: getNum(row, idxKP), deadTroops: getNum(row, idxDead),
              t1Kills: t1, t2Kills: t2, t3Kills: t3, t4Kills: t4, t5Kills: t5, totalKills: t1+t2+t3+t4+t5
          });
      });
      return res;
  };

  const playerHistories = useMemo(() => {
      const map = new Map<string, PlayerAnalyticsHistory>();
      if (!uploadedFiles.length) return map;
      const sortedFiles = [...uploadedFiles].sort((a,b) => new Date(a.uploadDate).getTime() - new Date(b.uploadDate).getTime());
      for (const file of sortedFiles) {
          const fileName = cleanFileName(file.name);
          parseFileToPlayers(file).forEach(p => {
              const key = p.id || p.name;
              if (!key) return;
              let h = map.get(key);
              if (!h) { h = { id: p.id||'Unknown', name: p.name||'Unknown', alliance: p.alliance, history: [] }; map.set(key, h); }
              if (p.name) h.name = p.name;
              if (p.alliance) h.alliance = p.alliance;
              h.history.push({ fileName, ...p });
          });
      }
      return map;
  }, [uploadedFiles]);

  const handleSearch = () => {
      if (!isDataLoaded || !searchQuery.trim()) { setSearchMatches(null); setSelectedPlayerHistory(null); return; }
      const q = searchQuery.toLowerCase().trim();
      const all = Array.from(playerHistories.values());
      const res = all.filter(p => (p.id && p.id.toLowerCase().includes(q)) || (p.name && p.name.toLowerCase().includes(q)));
      if (res.length === 0) setSearchMatches('not_found');
      else if (res.length === 1) { setSelectedPlayerHistory(res[0]); setSearchMatches(null); }
      else setSearchMatches(res);
  };
  const handleClearSearch = () => { setSearchQuery(''); setSearchMatches(null); setSelectedPlayerHistory(null); };


  if (isLoading) return <div className="p-6 text-center text-gray-300">Loading...</div>;

  return (
    <div className="space-y-8">
      {error && <div className="text-center p-4 text-red-400 bg-red-900/50 rounded-lg">{error}</div>}
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-gray-200 mb-4">Player Analytics - Search</h3>
        <div className="flex flex-col sm:flex-row gap-4">
          <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSearch()} placeholder="Enter Name or Governor ID..." className="flex-grow bg-gray-700 border border-gray-600 text-white text-sm rounded-lg p-2.5 focus:ring-blue-500 focus:border-blue-500" />
          <button onClick={handleSearch} className="bg-blue-600 text-white font-semibold py-2.5 px-4 rounded-lg hover:bg-blue-700 transition-colors">Search</button>
          <button onClick={handleClearSearch} className="bg-gray-600 text-white font-semibold py-2.5 px-4 rounded-lg hover:bg-gray-700 transition-colors">Clear</button>
        </div>
      </Card>

      <div className="space-y-4">
        {searchMatches === 'not_found' && <div className="p-4 text-center text-amber-400 bg-amber-900/50 rounded-lg">Player not found.</div>}
        
        {Array.isArray(searchMatches) && (
            <Card className="p-4">
                <h4 className="text-md font-semibold text-gray-300 mb-3">Multiple matches found:</h4>
                <ul className="space-y-2 max-h-60 overflow-y-auto">
                    {searchMatches.map(p => (
                        <li key={p.id}>
                            <button onClick={() => { setSelectedPlayerHistory(p); setSearchMatches(null); }} className="w-full text-left p-3 rounded-lg bg-gray-700 hover:bg-gray-600 transition-colors">
                                <p className="font-semibold text-white">{p.name}</p>
                                <p className="text-sm text-gray-400">ID: {p.id} | Alliance: {p.alliance}</p>
                            </button>
                        </li>
                    ))}
                </ul>
            </Card>
        )}
      </div>

      {selectedPlayerHistory && (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row gap-4 items-baseline mb-4 p-2 bg-gray-800 rounded-lg border border-gray-700">
                <h4 className="text-xl font-bold text-white pl-4">{selectedPlayerHistory.name}</h4>
                <span className="text-sm text-gray-400">ID: {selectedPlayerHistory.id} | Alliance: {selectedPlayerHistory.alliance}</span>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <PlayerAnalyticsHistoryChart history={selectedPlayerHistory} />
                
                <Card gradient className="p-4">
                    <div className="overflow-x-auto relative border border-gray-700 rounded-lg max-h-96">
                        <Table>
                        <TableHeader>
                            <tr>
                                <TableCell header>Snapshot</TableCell>
                                <TableCell header align="right">Power</TableCell>
                                <TableCell header align="right">Kill Points</TableCell>
                                <TableCell header align="right">Dead</TableCell>
                            </tr>
                        </TableHeader>
                        <tbody>
                            {selectedPlayerHistory.history.map((r, i) => (
                                <TableRow key={i}>
                                    <TableCell>{r.fileName}</TableCell>
                                    <TableCell align="right">{formatNumber(r.power)}</TableCell>
                                    <TableCell align="right">{formatNumber(r.totalKillPoints)}</TableCell>
                                    <TableCell align="right">{formatNumber(r.deadTroops)}</TableCell>
                                </TableRow>
                            ))}
                        </tbody>
                        </Table>
                    </div>
                </Card>
            </div>
        </div>
      )}
      
      {!selectedPlayerHistory && uploadedFiles.length === 0 && isPublicView && !error && (
          <div className="text-center p-8 text-gray-500 bg-gray-800/50 rounded-xl">No data available yet.</div>
      )}
    </div>
  );
};

export default PowerAnalyticsDashboard;