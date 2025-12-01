import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { Card } from './Card';
import { Table, TableHeader, TableRow, TableCell } from './Table';
import { cleanFileName, parseGermanNumber, findColumnIndex, formatNumber, abbreviateNumber } from '../utils';
import { useAuth } from './AuthContext'; // Import useAuth
import type { UploadedFile } from '../types'; // Import UploadedFile type

// Interfaces kopiert aus types.ts
interface PlayerAnalyticsRecord {
  fileName: string;
  power: number;
  troopsPower: number;
  totalKillPoints: number;
  deadTroops: number;
  t1Kills: number;
  t2Kills: number;
  t3Kills: number;
  t4Kills: number;
  t5Kills: number;
  totalKills: number; 
}
interface PlayerAnalyticsHistory {
  id: string;
  name: string;
  alliance: string;
  history: PlayerAnalyticsRecord[];
}


declare var Chart: any;

interface PowerAnalyticsDashboardProps {
  isAdmin: boolean;
  backendUrl: string;
  publicSlug: string | null; // <<< NEU: FÜR ÖFFENTLICHEN ZUGRIFF
}

// ----------------------------------------------------
// NEUE KOMPONENTE: Chart-Anzeige für die Spielerhistorie
// ----------------------------------------------------
interface PlayerAnalyticsHistoryChartProps {
    history: PlayerAnalyticsHistory;
}

const PlayerAnalyticsHistoryChart: React.FC<PlayerAnalyticsHistoryChartProps> = ({ history }) => {
    const chartRef = useRef<HTMLCanvasElement>(null);
    const chartInstanceRef = useRef<any>(null);

    useEffect(() => {
        if (!chartRef.current || !history || history.history.length === 0) return;
        
        const chartData = {
            labels: history.history.map(h => h.fileName),
            datasets: [
                {
                    label: 'Power (Macht)',
                    data: history.history.map(h => h.power),
                    borderColor: 'rgba(59, 130, 246, 0.9)', // blue-500
                    backgroundColor: 'rgba(59, 130, 246, 0.2)',
                    fill: false,
                    tension: 0.2,
                    yAxisID: 'y',
                },
                {
                    label: 'Kill Points',
                    data: history.history.map(h => h.totalKillPoints),
                    borderColor: 'rgba(16, 185, 129, 0.9)', // emerald-500
                    backgroundColor: 'rgba(16, 185, 129, 0.2)',
                    fill: false,
                    tension: 0.2,
                    yAxisID: 'y1',
                }
            ],
        };

        if (chartInstanceRef.current) {
            chartInstanceRef.current.destroy();
        }

        const ctx = chartRef.current.getContext('2d');
        if (!ctx) return;
        
        chartInstanceRef.current = new Chart(ctx, {
            type: 'line',
            data: chartData,
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        labels: { color: '#e5e7eb' } // gray-200
                    },
                    tooltip: {
                        callbacks: {
                            label: (context: any) => {
                                let label = context.dataset.label || '';
                                if (label) label += ': ';
                                return label + formatNumber(context.parsed.y);
                            }
                        }
                    }
                },
                scales: {
                    x: { ticks: { color: '#9ca3af' }, grid: { color: 'rgba(255, 255, 255, 0.1)' } },
                    y: { 
                        type: 'linear',
                        display: true,
                        position: 'left',
                        ticks: { color: 'rgba(59, 130, 246, 1)', callback: (v: any) => abbreviateNumber(v) },
                        grid: { color: 'rgba(59, 130, 246, 0.2)' },
                        title: { display: true, text: 'Power', color: 'rgba(59, 130, 246, 1)'}
                    },
                    y1: {
                        type: 'linear',
                        display: true,
                        position: 'right',
                        grid: { drawOnChartArea: false, color: 'rgba(16, 185, 129, 0.2)' }, // do not draw grid lines on chart area
                        ticks: { color: 'rgba(16, 185, 129, 1)', callback: (v: any) => abbreviateNumber(v) },
                        title: { display: true, text: 'Kill Points', color: 'rgba(16, 185, 129, 1)'}
                    }
                }
            }
        });

        return () => {
            if (chartInstanceRef.current) {
                chartInstanceRef.current.destroy();
                chartInstanceRef.current = null;
            }
        };
    }, [history]);

    return (
        <Card hover className="p-4" gradient>
            <h5 className="text-md font-semibold text-gray-300 mb-3 text-center">Power & Kill Points Progression</h5>
            <div className="relative h-96">
                <canvas ref={chartRef}></canvas>
            </div>
        </Card>
    );
};


const PowerAnalyticsDashboard: React.FC<PowerAnalyticsDashboardProps> = ({ isAdmin, backendUrl, publicSlug }) => {
  const { user } = useAuth();
  const role = user?.role;
  
  // 🚩 Logik: isPublicView ist true, wenn Slug da und kein User eingeloggt ist
  const isPublicView = !!publicSlug && !user; 
  // Da Analytics keine Management-Funktionen hat, ist hier die Vollansicht (Suche + Charts) erforderlich.
  const isMinimalView = isPublicView || role === 'user'; 

  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]); 
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isDataLoaded, setIsDataLoaded] = useState<boolean>(false);
  
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchMatches, setSearchMatches] = useState<PlayerAnalyticsHistory[] | 'not_found' | null>(null);
  const [selectedPlayerHistory, setSelectedPlayerHistory] = useState<PlayerAnalyticsHistory | null>(null);

  // 🔑 NEU: Verwende atomare Werte aus dem user-Objekt für die Abhängigkeiten
  const userLoggedIn = !!user;

  // ----------------------------------------------------
  // Dateien laden (KORRIGIERT: Fügt Public Fetching hinzu)
  // ----------------------------------------------------
  const fetchFiles = useCallback(async () => {
    const isFetchPublic = !!publicSlug && !userLoggedIn;
    
    if (isFetchPublic && !publicSlug) {
        setError('Public access requires a Kingdom slug.');
        setIsLoading(false);
        return;
    }

    try {
      setIsLoading(true);
      setError(null);
      let response: Response;
      
      if (isFetchPublic && publicSlug) {
        // 1. Öffentlicher Modus: Nutze public API mit Slug
        const publicUrl = `${backendUrl}/api/public/kingdom/${publicSlug}/overview-files`; // Analytics nutzt Overview-Dateien
        response = await fetch(publicUrl);
        
      } else {
        // 2. Privater Modus (eingeloggter User): Nutze geschützten Token-Endpunkt
        const token = localStorage.getItem('authToken');
        
        if (!token) {
          throw new Error('Authentication token not found. Please log in.');
        }
        
        response = await fetch(`${backendUrl}/overview/files-data`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
      }


      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Server responded with status ${response.status}`);
      }
      
      const data: UploadedFile[] = await response.json();
      setUploadedFiles(data || []);
      setIsDataLoaded(true);
      
    } catch (err: any) {
      console.error(err);
      const message = err.message || 'Error loading files for analytics.';
      if (isFetchPublic && (message.includes('403') || message.includes('404') || message.includes('No data found'))) {
          setError('No data found for this Kingdom slug.');
      } else {
          setError(message);
      }
    } finally {
      setIsLoading(false);
    }
  }, [backendUrl, publicSlug, userLoggedIn]); // <<< Reduziert auf die stabilsten IDs/Booleans


  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);
  
  // ----------------------------------------------------
  // Dateiparser und Analyse-Logik (unverändert)
  // ----------------------------------------------------

  const parseFileToPlayers = (file: UploadedFile): any[] => {
    if (!file || !file.headers || !file.data) return [];
    
    const headers = file.headers;

    const getNumber = (row: any[], keywords: string[]): number => {
      const idx = findColumnIndex(headers, keywords);
      if (idx === undefined || idx < 0 || idx >= row.length) return 0;
      const raw = row[idx];
      if (raw === null || raw === undefined) return 0;
      return parseGermanNumber(String(raw));
    };

    const getString = (row: any[], keywords: string[]): string => {
      const idx = findColumnIndex(headers, keywords);
      if (idx === undefined || idx < 0 || idx >= row.length) return '';
      const v = row[idx];
      return v === null || v === undefined ? '' : String(v);
    };

    const players: any[] = [];
    
    file.data.forEach((row: any[]) => {
      const id = getString(row, ['governorid', 'governor id', 'id', 'gov id']);
      const name = getString(row, ['name', 'player name', 'playername']);
      const alliance = getString(row, ['alliance', 'allianz', 'alliance tag']);
      
      // Nur Zeilen mit Governor ID oder Name/Power > 0 verarbeiten
      if (!id && !name) return;

      const power = getNumber(row, ['power', 'macht']);
      const troopsPower = getNumber(row, ['troopspower', 'troops power']);
      const totalKillPoints = getNumber(row, ['total kill points']);
      const deadTroops = getNumber(row, ['deadtroops', 'dead troops', 'dead']);
      const t1Kills = getNumber(row, ['t1', 't1 kills']);
      const t2Kills = getNumber(row, ['t2', 't2 kills']);
      const t3Kills = getNumber(row, ['t3', 't3 kills']);
      const t4Kills = getNumber(row, ['t4', 't4 kills', 'tier4']);
      const t5Kills = getNumber(row, ['t5', 't5 kills', 'tier5']);
      const totalKills = t1Kills + t2Kills + t3Kills + t4Kills + t5Kills;


      players.push({
        id,
        name,
        alliance,
        power,
        troopsPower,
        totalKillPoints,
        deadTroops,
        t1Kills,
        t2Kills,
        t3Kills,
        t4Kills,
        t5Kills,
        totalKills,
      });
    });

    return players;
  };


  const playerHistories = useMemo(() => {
    const map = new Map<string, PlayerAnalyticsHistory>();
    if (!uploadedFiles || uploadedFiles.length === 0) return map;

    const sortedFiles = [...uploadedFiles].sort(
      (a, b) => new Date(a.uploadDate).getTime() - new Date(b.uploadDate).getTime()
    );

    for (const file of sortedFiles) {
      const fileName = cleanFileName(file.name);
      const players = parseFileToPlayers(file);

      for (const p of players) {
        if (!p.id) continue;
        let hist = map.get(p.id);
        if (!hist) {
          hist = {
            id: p.id,
            name: p.name,
            alliance: p.alliance,
            history: [],
          };
          map.set(p.id, hist);
        }
        hist.name = p.name; 
        hist.alliance = p.alliance;
        
        hist.history.push({
          fileName,
          power: p.power,
          troopsPower: p.troopsPower,
          totalKillPoints: p.totalKillPoints,
          deadTroops: p.deadTroops,
          t1Kills: p.t1Kills,
          t2Kills: p.t2Kills,
          t3Kills: p.t3Kills,
          t4Kills: p.t4Kills,
          t5Kills: p.t5Kills,
          totalKills: p.totalKills,
        });
      }
    }

    return map;
  }, [uploadedFiles]);


  // ----------------------------------------------------
  // Spielersuche
  // ----------------------------------------------------

  const handleSearch = () => {
    if (!isDataLoaded || !searchQuery.trim()) {
      setSearchMatches(null);
      setSelectedPlayerHistory(null);
      return;
    }

    const query = searchQuery.trim().toLowerCase();
    const allHistories = Array.from(playerHistories.values());

    const matches = allHistories.filter(
      (p) =>
        p.name.toLowerCase().includes(query) ||
        p.id.toLowerCase().includes(query)
    );

    if (matches.length === 0) {
      setSearchMatches('not_found');
      setSelectedPlayerHistory(null);
    } else if (matches.length === 1) {
      setSelectedPlayerHistory(matches[0]);
      setSearchMatches(null);
    } else {
      setSearchMatches(matches);
      setSelectedPlayerHistory(null);
    }
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    setSearchMatches(null);
    setSelectedPlayerHistory(null);
  };

  const handleSelectPlayer = (player: PlayerAnalyticsHistory | null) => {
    setSelectedPlayerHistory(player);
    setSearchMatches(null);
  };


  // ----------------------------------------------------
  // Render-Teil
  // ----------------------------------------------------

  if (isLoading) {
    return (
      <div className="p-6 text-center text-gray-300">Loading files for analytics…</div>
    );
  }

  if (error) {
    return (
      <div className="text-center p-4 text-red-400 bg-red-900/50 rounded-lg">
        {error}
      </div>
    );
  }


  return (
    <div className="space-y-8">
      
      {/* Player Search Section */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-gray-200 mb-4">Player Analytics Search</h3>
        <div className="flex flex-col sm:flex-row gap-4">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="Enter Player Name or Governor ID..."
            className="flex-grow bg-gray-700 border border-gray-600 text-white text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 p-2.5"
            disabled={!isDataLoaded}
          />
          <button
            onClick={handleSearch}
            disabled={!searchQuery.trim() || !isDataLoaded}
            className="bg-blue-600 text-white font-semibold py-2.5 px-4 rounded-lg hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors"
          >
            Search
          </button>
          <button
            onClick={handleClearSearch}
            className="bg-gray-600 text-white font-semibold py-2.5 px-4 rounded-lg hover:bg-gray-700 disabled:opacity-50 transition-colors"
          >
            Clear
          </button>
        </div>
      </Card>

      {/* Search Results / Not Found */}
      <div className="space-y-4">
        {searchMatches === 'not_found' && (
            <div className="p-4 text-center text-amber-400 bg-amber-900/50 rounded-lg">
                Player not found in the uploaded data.
            </div>
        )}
        {Array.isArray(searchMatches) && searchMatches.length > 0 && (
            <Card className="p-4">
                <h4 className="text-md font-semibold text-gray-300 mb-3">Multiple players found. Please select one:</h4>
                <ul className="space-y-2">
                    {searchMatches.map(player => (
                        <li key={player.id}>
                            <button 
                                onClick={() => handleSelectPlayer(player)}
                                className="w-full text-left p-3 rounded-lg bg-gray-700 hover:bg-gray-600 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                <p className="font-semibold text-white">{player.name}</p>
                                <p className="text-sm text-gray-400">ID: {player.id} | Alliance: {player.alliance || 'N/A'} | Snapshots: {player.history.length}</p>
                            </button>
                        </li>
                    ))}
                </ul>
            </Card>
        )}
      </div>

      {/* Selected Player History / Charts */}
      {selectedPlayerHistory && (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-6 items-baseline mb-4 p-2">
                <h4 className="text-xl font-bold text-white">{selectedPlayerHistory.name}</h4>
                <div className="flex gap-4 text-sm text-gray-400">
                    <span>ID: {selectedPlayerHistory.id}</span>
                    <span>Alliance: {selectedPlayerHistory.alliance || 'N/A'}</span>
                </div>
            </div>
          
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* CHART HIER EINFÜGEN */}
                <PlayerAnalyticsHistoryChart history={selectedPlayerHistory} />

                {/* History Table */}
                <Card gradient className="p-4">
                    <h5 className="text-md font-semibold text-gray-300 mb-3 text-center">History Table</h5>
                    <div className="overflow-x-auto relative border border-gray-700 rounded-lg max-h-96">
                        <Table>
                        <TableHeader>
                            <tr>
                            <TableCell align="left" header>Snapshot</TableCell>
                            <TableCell align="right" header>Power</TableCell>
                            <TableCell align="right" header>Troops Power</TableCell>
                            <TableCell align="right" header>Kill Points</TableCell>
                            <TableCell align="right" header>Dead Troops</TableCell>
                            <TableCell align="right" header>Total Kills</TableCell>
                            </tr>
                        </TableHeader>
                        <tbody>
                            {selectedPlayerHistory.history.map((record, index) => (
                            <TableRow key={index} hover={false}>
                                <TableCell align="left" className="font-medium text-white">{record.fileName}</TableCell>
                                <TableCell align="right">{formatNumber(record.power)}</TableCell>
                                <TableCell align="right">{formatNumber(record.troopsPower)}</TableCell>
                                <TableCell align="right">{formatNumber(record.totalKillPoints)}</TableCell>
                                <TableCell align="right">{formatNumber(record.deadTroops)}</TableCell>
                                <TableCell align="right">{formatNumber(record.totalKills)}</TableCell>
                            </TableRow>
                            ))}
                        </tbody>
                        </Table>
                    </div>
                </Card>
            </div>
        </div>
      )}
      
      {/* HINWEIS, falls im Public Mode keine Daten vorhanden sind */}
      {!error && uploadedFiles.length === 0 && isPublicView && (
          <div className="text-center p-8 text-yellow-400 bg-gray-800 rounded-xl">
              <h3 className="text-xl font-bold mb-2">No Data Available</h3>
              <p>The selected Kingdom has not uploaded any files yet.</p>
          </div>
      )}


      {!selectedPlayerHistory && isDataLoaded && (
        <Card gradient className="text-center p-12 text-gray-400">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mx-auto mb-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0h6m-3-2a2 2 0 00-2 2v2M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
          <p className="text-lg font-semibold text-white mb-2">Detailed Player History</p>
          <p>Search for a player to display their history across all uploaded snapshots.</p>
        </Card>
      )}
    </div>
  );
};

export default PowerAnalyticsDashboard;