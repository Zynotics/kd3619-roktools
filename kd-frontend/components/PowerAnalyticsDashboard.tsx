// PowerAnalyticsDashboard.tsx - AKTUALISIERT

import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { Card } from './Card';
import { Table, TableHeader, TableRow, TableCell } from './Table';
import { cleanFileName, parseGermanNumber, findColumnIndex, formatNumber, abbreviateNumber } from '../utils';
import { useAuth } from './AuthContext'; // Import useAuth
import type { UploadedFile } from '../types'; // Import UploadedFile type

// Interfaces kopiert aus types.ts/snippet
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
}

const PowerAnalyticsDashboard: React.FC<PowerAnalyticsDashboardProps> = ({ isAdmin, backendUrl }) => {
  const { user } = useAuth(); // Get user for governorId/etc.
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]); 
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isDataLoaded, setIsDataLoaded] = useState<boolean>(false);
  
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchMatches, setSearchMatches] = useState<PlayerAnalyticsHistory[] | 'not_found' | null>(null);
  const [selectedPlayerHistory, setSelectedPlayerHistory] = useState<PlayerAnalyticsHistory | null>(null);


  // ----------------------------------------------------
  // Dateien laden (KORRIGIERT: Fügt Token-Header hinzu)
  // ----------------------------------------------------

  // Hinzugefügte Token-Logik in dieser Komponente, da diese den 401-Fehler verursacht hat.
  const fetchFiles = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const token = localStorage.getItem('authToken'); 
      if (!token) {
        throw new Error('Authentication token not found. Please log in.');
      }

      // Analytics verwendet die gleichen Dateien wie Overview
      const response = await fetch(`${backendUrl}/overview/files-data`, { 
        headers: {
          Authorization: `Bearer ${token}`, // <<< Authorization Header hinzugefügt
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Server responded with status ${response.status}`);
      }
      
      const data: UploadedFile[] = await response.json();
      setUploadedFiles(data || []);
      setIsDataLoaded(true);
      
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Error loading files for analytics.');
    } finally {
      setIsLoading(false);
    }
  }, [backendUrl]);


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
  // Spielersuche (unverändert)
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
  // Render-Teil (unverändert)
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
          <Card gradient className="p-6">
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-6 items-baseline mb-4">
                <h4 className="text-xl font-bold text-white">{selectedPlayerHistory.name}</h4>
                <div className="flex gap-4 text-sm text-gray-400">
                    <span>ID: {selectedPlayerHistory.id}</span>
                    <span>Alliance: {selectedPlayerHistory.alliance || 'N/A'}</span>
                </div>
            </div>
          
            {/* History Table */}
            <div className="overflow-x-auto relative border border-gray-700 rounded-lg max-h-96">
                <Table>
                <TableHeader>
                    <tr>
                    <TableCell align="left" header>Snapshot</TableCell>
                    <TableCell align="right" header>Power</TableCell>
                    <TableCell align="right" header>Troops Power</TableCell>
                    <TableCell align="right" header>Kill Points</TableCell>
                    <TableCell align="right" header>Dead Troops</TableCell>
                    <TableCell align="right" header>T5 Kills</TableCell>
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
                        <TableCell align="right">{formatNumber(record.t5Kills)}</TableCell>
                        <TableCell align="right">{formatNumber(record.totalKills)}</TableCell>
                    </TableRow>
                    ))}
                </tbody>
                </Table>
            </div>
          </Card>
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