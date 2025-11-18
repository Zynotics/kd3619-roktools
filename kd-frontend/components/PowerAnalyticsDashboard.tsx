import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { cleanFileName, parseGermanNumber, findColumnIndex, formatNumber, abbreviateNumber } from '../utils';

interface PowerAnalyticsDashboardProps {
  isAdmin: boolean;
  backendUrl: string;
}

interface PlayerAnalyticsHistory {
  id: string;
  name: string;
  alliance: string;
  history: PlayerAnalyticsRecord[];
}

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
}

declare var Chart: any;

const PowerAnalyticsDashboard: React.FC<PowerAnalyticsDashboardProps> = ({ isAdmin, backendUrl }) => {
  const [uploadedFiles, setUploadedFiles] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isDataLoaded, setIsDataLoaded] = useState<boolean>(false);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[] | 'not_found' | null>(null);
  const [selectedPlayerHistory, setSelectedPlayerHistory] = useState<PlayerAnalyticsHistory | null>(null);
  const [showDetailedKills, setShowDetailedKills] = useState<boolean>(false);

  const powerChartRef = useRef<HTMLCanvasElement>(null);
  const troopsChartRef = useRef<HTMLCanvasElement>(null);
  const killsChartRef = useRef<HTMLCanvasElement>(null);
  const deadChartRef = useRef<HTMLCanvasElement>(null);

  const powerChartInstance = useRef<any>(null);
  const troopsChartInstance = useRef<any>(null);
  const killsChartInstance = useRef<any>(null);
  const deadChartInstance = useRef<any>(null);

  // Dateien laden
  const fetchFiles = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`${backendUrl}/overview/files-data`);
      
      if (!res.ok) {
        throw new Error(`Server responded with status ${res.status}`);
      }
      
      const data = await res.json();
      setUploadedFiles(data);
      setIsDataLoaded(data.length > 0);
    } catch (err) {
      console.error('Error loading file data:', err);
      setError('Error loading file data. Please ensure the backend server is running and accessible.');
    } finally {
      setIsLoading(false);
    }
  }, [backendUrl]);

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  // Player Analytics History berechnen
  const playerAnalyticsHistories = useMemo(() => {
    const histories = new Map<string, PlayerAnalyticsHistory>();
    
    uploadedFiles.forEach((file) => {
      const players = file.data.map((row: any[]) => {
        const getVal = (keywords: string[]) => {
          const index = findColumnIndex(file.headers, keywords);
          return index !== undefined ? row[index] : 0;
        };
        const getString = (keywords: string[]) => {
          const index = findColumnIndex(file.headers, keywords);
          return index !== undefined ? String(row[index] ?? '') : '';
        };

        return {
          id: getString(['governorid', 'id']),
          name: getString(['name']),
          alliance: getString(['alliance']),
          power: parseGermanNumber(getVal(['power'])),
          troopsPower: parseGermanNumber(getVal(['troopspower'])),
          totalKillPoints: parseGermanNumber(getVal(['killpoints', 'kp'])),
          deadTroops: parseGermanNumber(getVal(['dead'])),
          t1Kills: parseGermanNumber(getVal(['t1', 't1kills'])),
          t2Kills: parseGermanNumber(getVal(['t2', 't2kills'])),
          t3Kills: parseGermanNumber(getVal(['t3', 't3kills'])),
          t4Kills: parseGermanNumber(getVal(['t4', 't4kills'])),
          t5Kills: parseGermanNumber(getVal(['t5', 't5kills'])),
        };
      });

      players.forEach((player) => {
        if (!histories.has(player.id)) {
          histories.set(player.id, {
            id: player.id,
            name: player.name,
            alliance: player.alliance,
            history: [],
          });
        }
        const historyEntry = histories.get(player.id)!;
        historyEntry.name = player.name;
        historyEntry.alliance = player.alliance;
        
        historyEntry.history.push({
          fileName: cleanFileName(file.name),
          power: player.power,
          troopsPower: player.troopsPower,
          totalKillPoints: player.totalKillPoints,
          deadTroops: player.deadTroops,
          t1Kills: player.t1Kills,
          t2Kills: player.t2Kills,
          t3Kills: player.t3Kills,
          t4Kills: player.t4Kills,
          t5Kills: player.t5Kills,
        });
      });
    });
    
    return Array.from(histories.values());
  }, [uploadedFiles]);

  // Alle aktuellen Spieler für die Suche
  const allPlayersLatest = useMemo(() => {
    if (uploadedFiles.length === 0) return [];

    const latestFile = uploadedFiles[uploadedFiles.length - 1];
    const players = latestFile.data.map((row: any[]) => {
      const getVal = (keywords: string[]) => {
        const index = findColumnIndex(latestFile.headers, keywords);
        return index !== undefined ? row[index] : 0;
      };
      const getString = (keywords: string[]) => {
        const index = findColumnIndex(latestFile.headers, keywords);
        return index !== undefined ? String(row[index] ?? '') : '';
      };

      return {
        id: getString(['governorid', 'id']),
        name: getString(['name']),
        alliance: getString(['alliance']),
        power: parseGermanNumber(getVal(['power'])),
      };
    });
    
    return players;
  }, [uploadedFiles]);

  // Charts erstellen/aktualisieren
  useEffect(() => {
    if (!selectedPlayerHistory) {
      // Charts zerstören wenn kein Spieler ausgewählt
      [powerChartInstance, troopsChartInstance, killsChartInstance, deadChartInstance].forEach(chartRef => {
        if (chartRef.current) {
          chartRef.current.destroy();
          chartRef.current = null;
        }
      });
      return;
    }

    const history = selectedPlayerHistory.history;
    const labels = history.map(h => h.fileName);

    // Power Chart
    if (powerChartRef.current) {
      if (powerChartInstance.current) {
        powerChartInstance.current.destroy();
      }
      const ctx = powerChartRef.current.getContext('2d');
      powerChartInstance.current = new Chart(ctx, {
        type: 'line',
        data: {
          labels,
          datasets: [{
            label: 'Power',
            data: history.map(h => h.power),
            borderColor: 'rgba(59, 130, 246, 0.8)',
            backgroundColor: 'rgba(59, 130, 246, 0.2)',
            fill: true,
            tension: 0.4,
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: (context: any) => `Power: ${formatNumber(context.parsed.y)}`
              }
            }
          },
          scales: {
            x: { ticks: { color: '#9ca3af' }, grid: { color: 'rgba(255, 255, 255, 0.1)' } },
            y: { ticks: { color: '#9ca3af', callback: (v: any) => abbreviateNumber(v) }, grid: { color: 'rgba(255, 255, 255, 0.1)' } }
          }
        }
      });
    }

    // Troops Power Chart
    if (troopsChartRef.current) {
      if (troopsChartInstance.current) {
        troopsChartInstance.current.destroy();
      }
      const ctx = troopsChartRef.current.getContext('2d');
      troopsChartInstance.current = new Chart(ctx, {
        type: 'line',
        data: {
          labels,
          datasets: [{
            label: 'Troops Power',
            data: history.map(h => h.troopsPower),
            borderColor: 'rgba(16, 185, 129, 0.8)',
            backgroundColor: 'rgba(16, 185, 129, 0.2)',
            fill: true,
            tension: 0.4,
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: (context: any) => `Troops Power: ${formatNumber(context.parsed.y)}`
              }
            }
          },
          scales: {
            x: { ticks: { color: '#9ca3af' }, grid: { color: 'rgba(255, 255, 255, 0.1)' } },
            y: { ticks: { color: '#9ca3af', callback: (v: any) => abbreviateNumber(v) }, grid: { color: 'rgba(255, 255, 255, 0.1)' } }
          }
        }
      });
    }

    // Kill Points Chart (nur Kill Points)
    if (killsChartRef.current) {
      if (killsChartInstance.current) {
        killsChartInstance.current.destroy();
      }
      const ctx = killsChartRef.current.getContext('2d');
      killsChartInstance.current = new Chart(ctx, {
        type: 'line',
        data: {
          labels,
          datasets: [{
            label: 'Kill Points',
            data: history.map(h => h.totalKillPoints),
            borderColor: 'rgba(245, 158, 11, 0.8)',
            backgroundColor: 'rgba(245, 158, 11, 0.2)',
            fill: true,
            tension: 0.4,
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: (context: any) => `Kill Points: ${formatNumber(context.parsed.y)}`
              }
            }
          },
          scales: {
            x: { ticks: { color: '#9ca3af' }, grid: { color: 'rgba(255, 255, 255, 0.1)' } },
            y: { ticks: { color: '#9ca3af', callback: (v: any) => abbreviateNumber(v) }, grid: { color: 'rgba(255, 255, 255, 0.1)' } }
          }
        }
      });
    }

    // Dead Troops Chart
    if (deadChartRef.current) {
      if (deadChartInstance.current) {
        deadChartInstance.current.destroy();
      }
      const ctx = deadChartRef.current.getContext('2d');
      deadChartInstance.current = new Chart(ctx, {
        type: 'line',
        data: {
          labels,
          datasets: [{
            label: 'Dead Troops',
            data: history.map(h => h.deadTroops),
            borderColor: 'rgba(239, 68, 68, 0.8)',
            backgroundColor: 'rgba(239, 68, 68, 0.2)',
            fill: true,
            tension: 0.4,
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: (context: any) => `Dead Troops: ${formatNumber(context.parsed.y)}`
              }
            }
          },
          scales: {
            x: { ticks: { color: '#9ca3af' }, grid: { color: 'rgba(255, 255, 255, 0.1)' } },
            y: { ticks: { color: '#9ca3af', callback: (v: any) => abbreviateNumber(v) }, grid: { color: 'rgba(255, 255, 255, 0.1)' } }
          }
        }
      });
    }
  }, [selectedPlayerHistory]);

  // Suche
  const handleSearch = () => {
    if (!searchQuery) return;
    const lowerCaseQuery = searchQuery.toLowerCase();

    const exactIdMatch = playerAnalyticsHistories.find((p) => p.id === searchQuery);
    if (exactIdMatch) {
      setSelectedPlayerHistory(exactIdMatch);
      setSearchResults(null);
      return;
    }

    const nameMatches = allPlayersLatest.filter((p) =>
      p.name.toLowerCase().includes(lowerCaseQuery)
    );

    if (nameMatches.length === 1) {
      const history = playerAnalyticsHistories.find((p) => p.id === nameMatches[0].id);
      if (history) {
        setSelectedPlayerHistory(history);
        setSearchResults(null);
      } else {
        setSearchResults('not_found');
        setSelectedPlayerHistory(null);
      }
    } else if (nameMatches.length > 1) {
      setSearchResults(nameMatches);
      setSelectedPlayerHistory(null);
    } else {
      setSearchResults('not_found');
      setSelectedPlayerHistory(null);
    }
  };

  const handleSelectPlayer = (player: any) => {
    const history = playerAnalyticsHistories.find((p) => p.id === player.id);
    if (history) {
      setSelectedPlayerHistory(history);
      setSearchResults(null);
    }
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    setSearchResults(null);
    setSelectedPlayerHistory(null);
    setShowDetailedKills(false);
  };

  const toggleDetailedKills = () => {
    setShowDetailedKills(!showDetailedKills);
  };

  if (isLoading) {
    return (
      <div className="text-center p-8 text-gray-400">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
        Loading analytics data...
      </div>
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
      {/* Spieler Suche */}
      <div className="bg-gray-800 p-6 rounded-xl shadow-lg border border-gray-700">
        <h3 className="text-lg font-semibold text-gray-200 mb-4">Player Analytics Search</h3>
        <div className="flex flex-col sm:flex-row gap-4">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="Enter Player Name or Governor ID..."
            className="flex-grow bg-gray-700 border border-gray-600 text-white text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 p-2.5 placeholder-gray-400 disabled:opacity-50 transition-colors"
            disabled={!isDataLoaded}
          />
          <button
            onClick={handleSearch}
            disabled={!isDataLoaded || !searchQuery}
            className="px-6 py-2.5 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:bg-blue-800 disabled:cursor-not-allowed transition-colors"
          >
            Search
          </button>
          {(searchResults || selectedPlayerHistory) && (
            <button
              onClick={handleClearSearch}
              className="px-6 py-2.5 bg-gray-600 text-white font-semibold rounded-lg hover:bg-gray-500 transition-colors"
            >
              Clear
            </button>
          )}
        </div>
        {!isDataLoaded && <p className="text-sm text-gray-400 mt-2">Please upload data to enable search.</p>}

        {/* Suchergebnisse */}
        <div className="mt-6">
          {searchResults === 'not_found' && (
            <div className="p-4 text-center text-amber-400 bg-amber-900/50 rounded-lg">
              Player not found in analytics data.
            </div>
          )}
          {Array.isArray(searchResults) && (
            <div>
              <h4 className="text-md font-semibold text-gray-300 mb-3">Multiple players found. Please select one:</h4>
              <ul className="space-y-2">
                {searchResults.map(player => (
                  <li key={player.id}>
                    <button 
                      onClick={() => handleSelectPlayer(player)}
                      className="w-full text-left p-3 rounded-lg bg-gray-700 hover:bg-gray-600 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <p className="font-semibold text-white">{player.name}</p>
                      <p className="text-sm text-gray-400">ID: {player.id} | Alliance: {player.alliance || 'N/A'} | Power: {formatNumber(player.power)}</p>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Analytics Charts */}
      {selectedPlayerHistory && (
        <div className="space-y-6">
          {/* Spieler Info */}
          <div className="bg-gray-800 p-6 rounded-xl shadow-lg border border-gray-700">
            <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 items-baseline">
              <h4 className="text-xl font-bold text-white">{selectedPlayerHistory.name}</h4>
              <div className="flex gap-4 text-sm text-gray-400">
                <span>ID: {selectedPlayerHistory.id}</span>
                <span>Alliance: {selectedPlayerHistory.alliance || 'N/A'}</span>
                <span>Records: {selectedPlayerHistory.history.length}</span>
              </div>
            </div>
          </div>

          {/* Charts Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Power Chart */}
            <div className="bg-gray-800 p-6 rounded-xl shadow-lg border border-gray-700">
              <h5 className="text-lg font-semibold text-gray-200 mb-4">Power Progression</h5>
              <div className="relative h-64">
                <canvas ref={powerChartRef}></canvas>
              </div>
            </div>

            {/* Troops Power Chart */}
            <div className="bg-gray-800 p-6 rounded-xl shadow-lg border border-gray-700">
              <h5 className="text-lg font-semibold text-gray-200 mb-4">Troops Power Progression</h5>
              <div className="relative h-64">
                <canvas ref={troopsChartRef}></canvas>
              </div>
            </div>

            {/* Kill Points Chart */}
            <div className="bg-gray-800 p-6 rounded-xl shadow-lg border border-gray-700">
              <h5 className="text-lg font-semibold text-gray-200 mb-4">Kill Points</h5>
              <div className="relative h-64">
                <canvas ref={killsChartRef}></canvas>
              </div>
            </div>

            {/* Dead Troops Chart */}
            <div className="bg-gray-800 p-6 rounded-xl shadow-lg border border-gray-700">
              <h5 className="text-lg font-semibold text-gray-200 mb-4">Dead Troops</h5>
              <div className="relative h-64">
                <canvas ref={deadChartRef}></canvas>
              </div>
            </div>
          </div>

          {/* Daten Tabelle */}
          <div className="bg-gray-800 p-6 rounded-xl shadow-lg border border-gray-700">
            <div className="flex justify-between items-center mb-4">
              <h5 className="text-lg font-semibold text-gray-200">Historical Data</h5>
              <button
                onClick={toggleDetailedKills}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                  showDetailedKills 
                    ? 'bg-blue-600 text-white hover:bg-blue-700' 
                    : 'bg-gray-600 text-gray-300 hover:bg-gray-500'
                }`}
              >
                {showDetailedKills ? (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                    Hide Kill Details
                  </>
                ) : (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clipRule="evenodd" />
                    </svg>
                    Show Kill Details
                  </>
                )}
              </button>
            </div>
            
            <div className="overflow-x-auto relative border border-gray-700 rounded-lg max-h-96">
              <table className="w-full text-sm text-left text-gray-400">
                <thead className="text-xs text-gray-400 uppercase bg-gray-700 sticky top-0">
                  <tr>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3 text-right">Power</th>
                    <th className="px-4 py-3 text-right">Troops Power</th>
                    <th className="px-4 py-3 text-right">Kill Points</th>
                    <th className="px-4 py-3 text-right">Dead Troops</th>
                    {showDetailedKills && (
                      <>
                        <th className="px-4 py-3 text-right">T1 Kills</th>
                        <th className="px-4 py-3 text-right">T2 Kills</th>
                        <th className="px-4 py-3 text-right">T3 Kills</th>
                        <th className="px-4 py-3 text-right">T4 Kills</th>
                        <th className="px-4 py-3 text-right">T5 Kills</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {selectedPlayerHistory.history.map((record, index) => (
                    <tr key={index} className="border-b bg-gray-800 border-gray-700 hover:bg-gray-600">
                      <td className="px-4 py-2 font-medium text-white">{record.fileName}</td>
                      <td className="px-4 py-2 text-right">{formatNumber(record.power)}</td>
                      <td className="px-4 py-2 text-right">{formatNumber(record.troopsPower)}</td>
                      <td className="px-4 py-2 text-right">{formatNumber(record.totalKillPoints)}</td>
                      <td className="px-4 py-2 text-right">{formatNumber(record.deadTroops)}</td>
                      {showDetailedKills && (
                        <>
                          <td className="px-4 py-2 text-right">{formatNumber(record.t1Kills)}</td>
                          <td className="px-4 py-2 text-right">{formatNumber(record.t2Kills)}</td>
                          <td className="px-4 py-2 text-right">{formatNumber(record.t3Kills)}</td>
                          <td className="px-4 py-2 text-right">{formatNumber(record.t4Kills)}</td>
                          <td className="px-4 py-2 text-right">{formatNumber(record.t5Kills)}</td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {!selectedPlayerHistory && isDataLoaded && (
        <div className="text-center p-12 text-gray-400 bg-gray-800 rounded-xl border border-gray-700">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mx-auto mb-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <h3 className="text-xl font-semibold text-gray-300 mb-2">Player Analytics</h3>
          <p>Search for a player to view their power progression and statistics over time.</p>
        </div>
      )}
    </div>
  );
};

export default PowerAnalyticsDashboard;