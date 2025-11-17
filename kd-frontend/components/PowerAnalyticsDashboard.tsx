import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { cleanFileName, parseGermanNumber, findColumnIndex } from '../utils';

interface PowerAnalyticsDashboardProps {
  isAdmin: boolean;
  backendUrl: string;
}

interface PlayerInfo {
  id: string;
  name: string;
  alliance: string;
  power: number;
}

const PowerAnalyticsDashboard: React.FC<PowerAnalyticsDashboardProps> = ({ isAdmin, backendUrl }) => {
  const [uploadedFiles, setUploadedFiles] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isDataLoaded, setIsDataLoaded] = useState<boolean>(false);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<PlayerInfo[] | 'not_found' | null>(null);
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerInfo | null>(null);

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

  // Suche
  const handleSearch = () => {
    if (!searchQuery) return;
    const lowerCaseQuery = searchQuery.toLowerCase();

    const exactIdMatch = allPlayersLatest.find((p) => p.id === searchQuery);
    if (exactIdMatch) {
      setSelectedPlayer(exactIdMatch);
      setSearchResults(null);
      return;
    }

    const nameMatches = allPlayersLatest.filter((p) =>
      p.name.toLowerCase().includes(lowerCaseQuery)
    );

    if (nameMatches.length === 1) {
      setSelectedPlayer(nameMatches[0]);
      setSearchResults(null);
    } else if (nameMatches.length > 1) {
      setSearchResults(nameMatches);
      setSelectedPlayer(null);
    } else {
      setSearchResults('not_found');
      setSelectedPlayer(null);
    }
  };

  const handleSelectPlayer = (player: PlayerInfo) => {
    setSelectedPlayer(player);
    setSearchResults(null);
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    setSearchResults(null);
    setSelectedPlayer(null);
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
      {/* Debug Info */}
      <div className="bg-gray-800 p-6 rounded-xl shadow-lg border border-gray-700">
        <h2 className="text-2xl font-bold text-white mb-4">Power Analytics Dashboard</h2>
        <div className="mt-4 p-4 bg-gray-700 rounded-lg">
          <h3 className="text-lg font-semibold text-gray-200 mb-2">System Info:</h3>
          <p className="text-gray-400">Files loaded: {uploadedFiles.length}</p>
          <p className="text-gray-400">Players available: {allPlayersLatest.length}</p>
          <p className="text-gray-400">Selected Player: {selectedPlayer ? selectedPlayer.name : 'None'}</p>
        </div>
      </div>

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
          {(searchResults || selectedPlayer) && (
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
                      <p className="text-sm text-gray-400">ID: {player.id} | Alliance: {player.alliance || 'N/A'} | Power: {player.power.toLocaleString()}</p>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Spieler Info */}
      {selectedPlayer && (
        <div className="bg-gray-800 p-6 rounded-xl shadow-lg border border-gray-700">
          <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 items-baseline">
            <h4 className="text-xl font-bold text-white">{selectedPlayer.name}</h4>
            <div className="flex gap-4 text-sm text-gray-400">
              <span>ID: {selectedPlayer.id}</span>
              <span>Alliance: {selectedPlayer.alliance || 'N/A'}</span>
              <span>Power: {selectedPlayer.power.toLocaleString()}</span>
            </div>
          </div>
          <p className="text-gray-300 mt-4">Player analytics charts will be displayed here in the next update.</p>
        </div>
      )}

      {!selectedPlayer && isDataLoaded && (
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