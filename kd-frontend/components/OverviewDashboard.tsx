import React, { useEffect, useState, useCallback, useMemo } from 'react';
import FileUpload from './FileUpload';
import FileList from './FileList';
import ComparisonSection from './ComparisonSection';
import PowerHistoryChart from './PowerHistoryChart';
import PlayerSearch from './PlayerSearch';
import { cleanFileName, parseGermanNumber, findColumnIndex } from '../utils';
import type {
  UploadedFile,
  ComparisonStats,
  PlayerInfo,
  PlayerStatChange,
} from '../types';

interface OverviewDashboardProps {
  isAdmin: boolean;
  backendUrl: string;
}

const OverviewDashboard: React.FC<OverviewDashboardProps> = ({ isAdmin, backendUrl }) => {
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [startFileId, setStartFileId] = useState<string>('');
  const [endFileId, setEndFileId] = useState<string>('');
  const [comparisonStats, setComparisonStats] = useState<ComparisonStats | null>(null);
  const [comparisonError, setComparisonError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<PlayerStatChange[] | 'not_found' | null>(null);
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerStatChange | null>(null);

  // --- Dateien vom Backend laden ---
  const fetchFiles = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`${backendUrl}/overview/files-data`);
      if (!res.ok) {
        throw new Error(`Server responded with status ${res.status}`);
      }
      const data: UploadedFile[] = await res.json();
      setUploadedFiles(data || []); // NULL CHECK HINZUGEFÜGT
    } catch (err) {
      console.error('Error loading file data:', err);
      setError(
        'Error loading file data. Please ensure the backend server is running and accessible.'
      );
    } finally {
      setIsLoading(false);
    }
  }, [backendUrl]);

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  // Beim Laden automatisch die letzten zwei Files wählen
  useEffect(() => {
    if (uploadedFiles && uploadedFiles.length >= 2) {
      setStartFileId(uploadedFiles[uploadedFiles.length - 2].id);
      setEndFileId(uploadedFiles[uploadedFiles.length - 1].id);
    } else if (uploadedFiles && uploadedFiles.length === 1) {
      setEndFileId(uploadedFiles[0].id);
    }
  }, [uploadedFiles]);

  const handleUploadComplete = () => {
    fetchFiles();
  };

  const handleDeleteFile = async (id: string) => {
    try {
      const response = await fetch(`${backendUrl}/overview/files/${id}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to delete file on server.');
      setUploadedFiles((prev) => (prev || []).filter((f) => f.id !== id));
    } catch (err) {
      console.error('Delete error:', err);
      alert('Could not delete the file.');
    }
  };

  const handleReorderFiles = async (reorderedFiles: UploadedFile[]) => {
    setUploadedFiles(reorderedFiles); // Optimistic UI
    try {
      const order = reorderedFiles.map((f) => f.id);
      const response = await fetch(`${backendUrl}/overview/files/reorder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order }),
      });
      if (!response.ok) throw new Error('Failed to save new order.');
    } catch (err) {
      console.error('Reorder error:', err);
      alert('Could not save the new file order.');
      fetchFiles(); // revert on error
    }
  };

  // --- Vergleichslogik ---
  const handleCompare = useCallback(() => {
    setComparisonError(null);
    setSearchResults(null);
    setSelectedPlayer(null);
    setSearchQuery('');

    if (!startFileId || !endFileId) {
      setComparisonError('Please select both a start and end file.');
      return;
    }

    // NULL/UNDEFINED CHECKS HINZUGEFÜGT
    if (!uploadedFiles || !Array.isArray(uploadedFiles)) {
      setComparisonError('No files available for comparison.');
      return;
    }

    const file1 = uploadedFiles.find((f) => f.id === startFileId);
    const file2 = uploadedFiles.find((f) => f.id === endFileId);

    if (!file1 || !file2) {
      setComparisonError('Selected files could not be found.');
      return;
    }

    const parseRow = (row: any[], headers: string[]): PlayerInfo => {
      const getVal = (keywords: string[]) => {
        const index = findColumnIndex(headers, keywords);
        return index !== undefined ? row[index] : 0;
      };
      const getString = (keywords: string[]) => {
        const index = findColumnIndex(headers, keywords);
        return index !== undefined ? String(row[index] ?? '') : '';
      };

      return {
        id: getString(['governorid', 'id']),
        name: getString(['name']),
        power: parseGermanNumber(getVal(['power'])),
        alliance: getString(['alliance']),
        t1Kills: parseGermanNumber(getVal(['t1', 't1kills'])),
        t2Kills: parseGermanNumber(getVal(['t2', 't2kills'])),
        t3Kills: parseGermanNumber(getVal(['t3', 't3kills'])),
        t4Kills: parseGermanNumber(getVal(['t4', 't4kills'])),
        t5Kills: parseGermanNumber(getVal(['t5', 't5kills'])),
        totalKillPoints: parseGermanNumber(getVal(['killpoints', 'kp'])),
        deadTroops: parseGermanNumber(getVal(['dead'])),
        cityHall: parseGermanNumber(getVal(['ch', 'cityhall'])),
        troopsPower: parseGermanNumber(getVal(['troopspower'])),
        techPower: parseGermanNumber(getVal(['techpower'])),
        buildingPower: parseGermanNumber(getVal(['buildingpower'])),
        commanderPower: parseGermanNumber(getVal(['commanderpower'])),
      };
    };

    // NULL/UNDEFINED CHECKS FÜR DATA HINZUGEFÜGT
    const data1 = file1.data && Array.isArray(file1.data) ? file1.data.map((row) => parseRow(row, file1.headers)) : [];
    const data2 = file2.data && Array.isArray(file2.data) ? file2.data.map((row) => parseRow(row, file2.headers)) : [];

    const map1 = new Map(data1.map((p) => [p.id, p]));
    const map2 = new Map(data2.map((p) => [p.id, p]));

    const newPlayers = data2.filter((p) => !map1.has(p.id));
    const disappearedPlayers = data1.filter((p) => !map2.has(p.id));

    const playerStatChanges: PlayerStatChange[] = [];
    data2.forEach((p2) => {
      const p1 = map1.get(p2.id);
      if (p1) {
        playerStatChanges.push({
          id: p2.id,
          name: p2.name,
          alliance: p2.alliance,
          oldPower: p1.power,
          newPower: p2.power,
          diffPower: p2.power - p1.power,
          oldKillPoints: p1.totalKillPoints,
          newKillPoints: p2.totalKillPoints,
          diffKillPoints: p2.totalKillPoints - p1.totalKillPoints,
          oldDeadTroops: p1.deadTroops,
          newDeadTroops: p2.deadTroops,
          diffDeadTroops: p2.deadTroops - p1.deadTroops,
          oldTroopsPower: p1.troopsPower,
          newTroopsPower: p2.troopsPower,
          diffTroopsPower: p2.troopsPower - p1.troopsPower,
        });
      }
    });

    const calculateTotals = (data: PlayerInfo[]) => ({
      totalPower: data.reduce((sum, p) => sum + p.power, 0),
      totalTroopsPower: data.reduce((sum, p) => sum + p.troopsPower, 0),
      totalKillPoints: data.reduce((sum, p) => sum + p.totalKillPoints, 0),
      totalDeadTroops: data.reduce((sum, p) => sum + p.deadTroops, 0),
    });

    const totals1 = calculateTotals(data1);
    const totals2 = calculateTotals(data2);

    setComparisonStats({
      totalPowerFile1: totals1.totalPower,
      totalPowerFile2: totals2.totalPower,
      powerDifference: totals2.totalPower - totals1.totalPower,
      totalTroopsPowerFile1: totals1.totalTroopsPower,
      totalTroopsPowerFile2: totals2.totalTroopsPower,
      troopsPowerDifference: totals2.totalTroopsPower - totals1.totalTroopsPower,
      totalKillPointsFile1: totals1.totalKillPoints,
      totalKillPointsFile2: totals2.totalKillPoints,
      killPointsDifference: totals2.totalKillPoints - totals1.totalKillPoints,
      totalDeadTroopsFile1: totals1.totalDeadTroops,
      totalDeadTroopsFile2: totals2.totalDeadTroops,
      deadTroopsDifference: totals2.totalDeadTroops - totals1.totalDeadTroops,
      newPlayers,
      disappearedPlayers,
      playerStatChanges,
    });
  }, [startFileId, endFileId, uploadedFiles]);

  useEffect(() => {
    if (startFileId && endFileId && startFileId !== endFileId) {
      handleCompare();
    }
  }, [startFileId, endFileId, handleCompare]);

  // --- Suche ---
  const handleSearch = () => {
    if (!searchQuery || !comparisonStats || !comparisonStats.playerStatChanges) return;
    const lowerCaseQuery = searchQuery.toLowerCase();

    const exactIdMatch = comparisonStats.playerStatChanges.find((p) => p.id === searchQuery);
    if (exactIdMatch) {
      setSelectedPlayer(exactIdMatch);
      setSearchResults(null);
      return;
    }

    const nameMatches = comparisonStats.playerStatChanges.filter((p) =>
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

  const handleClearSearch = () => {
    setSearchQuery('');
    setSearchResults(null);
    setSelectedPlayer(null);
  };

  const handleSelectPlayer = (player: PlayerStatChange) => {
    setSelectedPlayer(player);
    setSearchResults(null);
  };

  // NULL/UNDEFINED CHECK FÜR UPLOADEDFILES
  const isDataLoaded = uploadedFiles && Array.isArray(uploadedFiles) && uploadedFiles.length > 0;

  if (isLoading) {
    return <div className="text-center p-8">Loading files...</div>;
  }

  return (
    <div className="space-y-8">
      {/* Fehleranzeige */}
      {error && (
        <div className="text-center p-4 text-red-400 bg-red-900/50 rounded-lg">
          {error}
        </div>
      )}

      {/* Admin: Upload + FileList - NUR wenn Admin */}
      {isAdmin && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
          <div className="bg-gray-800 p-6 rounded-xl shadow-lg">
            <FileUpload
              uploadUrl={`${backendUrl}/overview/upload`}
              onUploadComplete={handleUploadComplete}
            />
          </div>
          <div className="bg-gray-800 p-6 rounded-xl shadow-lg">
            {/* NULL/UNDEFINED CHECK FÜR FILES */}
            <FileList
              files={uploadedFiles || []}
              onDeleteFile={handleDeleteFile}
              onReorder={handleReorderFiles}
            />
          </div>
        </div>
      )}

      {/* Power History Chart */}
      <PowerHistoryChart files={uploadedFiles || []} />

      {/* Comparison Controls */}
      <div className="bg-gray-800 p-6 rounded-xl shadow-lg">
        <h3 className="text-lg font-semibold text-gray-200 mb-4">Comparison Controls</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
          <div className="flex flex-col">
            <label
              htmlFor="start-date-select"
              className="text-sm font-medium text-gray-400 mb-1"
            >
              Start Date
            </label>
            <select
              id="start-date-select"
              value={startFileId}
              onChange={(e) => setStartFileId(e.target.value)}
              className="bg-gray-700 border border-gray-600 text-white text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5"
            >
              <option value="">Select Start Date</option>
              {/* NULL/UNDEFINED CHECK FÜR UPLOADEDFILES */}
              {uploadedFiles && uploadedFiles.map((file) => (
                <option key={file.id} value={file.id} disabled={file.id === endFileId}>
                  {cleanFileName(file.name)}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col">
            <label
              htmlFor="end-date-select"
              className="text-sm font-medium text-gray-400 mb-1"
            >
              End Date
            </label>
            <select
              id="end-date-select"
              value={endFileId}
              onChange={(e) => setEndFileId(e.target.value)}
              className="bg-gray-700 border border-gray-600 text-white text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5"
            >
              <option value="">Select End Date</option>
              {/* NULL/UNDEFINED CHECK FÜR UPLOADEDFILES */}
              {uploadedFiles && uploadedFiles.map((file) => (
                <option key={file.id} value={file.id} disabled={file.id === startFileId}>
                  {cleanFileName(file.name)}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={handleCompare}
            disabled={!startFileId || !endFileId || startFileId === endFileId}
            className="w-full px-4 py-2.5 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:bg-blue-800 disabled:cursor-not-allowed transition-colors"
          >
            Compare
          </button>
        </div>
      </div>

      {/* Suche + Spielerfokus - zwischen Comparison Controls und Summary/Tabellen */}
      <PlayerSearch
        query={searchQuery}
        setQuery={setSearchQuery}
        onSearch={handleSearch}
        onClear={handleClearSearch}
        results={searchResults}
        selectedPlayer={selectedPlayer}
        onSelectPlayer={handleSelectPlayer}
        isComparisonLoaded={!!comparisonStats}
      />

      {/* ComparisonSection mit Summary UND Tabellen */}
      <ComparisonSection
        stats={comparisonStats}
        error={comparisonError}
        file1Name={cleanFileName(
          uploadedFiles?.find((f) => f.id === startFileId)?.name ?? ''
        )}
        file2Name={cleanFileName(
          uploadedFiles?.find((f) => f.id === endFileId)?.name ?? ''
        )}
      />
    </div>
  );
};

export default OverviewDashboard;