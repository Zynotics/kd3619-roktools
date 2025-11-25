import React, { useEffect, useState, useCallback } from 'react';
import FileUpload from './FileUpload';
import FileList from './FileList';
import ComparisonSection from './ComparisonSection';
import PowerHistoryChart from './PowerHistoryChart';
import PlayerSearch from './PlayerSearch';
import { useAuth } from './AuthContext';
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
  const { user } = useAuth();
  const role = user?.role;
  const isBasicUser = role === 'user';
  const canManageFiles = isAdmin || role === 'r4' || role === 'r5';

  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [startFileId, setStartFileId] = useState<string>('');
  const [endFileId, setEndFileId] = useState<string>('');
  const [comparisonStats, setComparisonStats] = useState<ComparisonStats | null>(null);
  const [comparisonError, setComparisonError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchResults, setSearchResults] = useState<PlayerStatChange[] | 'not_found' | null>(null);
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerStatChange | null>(null);

  // ---------------------------------------------------------------------------
  // Files laden
  // ---------------------------------------------------------------------------
  const fetchFiles = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await fetch(`${backendUrl}/overview/files-data`);
      if (!response.ok) throw new Error('Failed to fetch files from server.');
      const data = await response.json();
      setUploadedFiles(data);

      if (data.length >= 2) {
        const sorted = [...data].sort(
          (a, b) =>
            new Date(a.uploadDate).getTime() - new Date(b.uploadDate).getTime()
        );
        const last = sorted[sorted.length - 1];
        const secondLast = sorted[sorted.length - 2];
        setStartFileId(secondLast.id);
        setEndFileId(last.id);
      } else if (data.length === 1) {
        setStartFileId(data[0].id);
        setEndFileId(data[0].id);
      }
    } catch (err) {
      console.error(err);
      setError('Error loading files from server.');
    } finally {
      setIsLoading(false);
    }
  }, [backendUrl]);

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

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
      console.error(err);
      setError('Failed to delete file.');
    }
  };

  const handleReorderFiles = (reorderedFiles: UploadedFile[]) => {
    setUploadedFiles(reorderedFiles);
  };

  // ---------------------------------------------------------------------------
  // UploadedFile → PlayerInfo[]
  // ---------------------------------------------------------------------------
  const extractPlayersFromFile = useCallback((file: UploadedFile): PlayerInfo[] => {
    if (!file || !Array.isArray(file.headers) || !Array.isArray(file.data)) {
      return [];
    }

    const getIndex = (keywords: string[]) => findColumnIndex(file.headers, keywords);

    const idxId = getIndex(['id', 'governorid', 'gov id', 'governor id']);
    const idxName = getIndex(['name', 'playername', 'player']);
    const idxAlliance = getIndex(['alliance', 'allianz', 'guild']);
    const idxPower = getIndex(['power', 'macht']);
    const idxTroopsPower = getIndex(['troopspower', 'troops power']);
    const idxKillPoints = getIndex(['killpoints', 'kill points', 'kills', 'kp']);
    const idxDeadTroops = getIndex(['dead troops', 'dead', 'deadtroops']);
    const idxT1 = getIndex(['t1 kills', 't1', 't1kills']);
    const idxT2 = getIndex(['t2 kills', 't2', 't2kills']);
    const idxT3 = getIndex(['t3 kills', 't3', 't3kills']);
    const idxT4 = getIndex(['t4 kills', 't4', 't4kills', 'tier4']);
    const idxT5 = getIndex(['t5 kills', 't5', 't5kills', 'tier5']);
    const idxCityHall = getIndex(['city hall', 'cityhall', 'ch']);
    const idxTechPower = getIndex(['tech power', 'techpower', 'technology power']);
    const idxBuildingPower = getIndex(['building power', 'buildingpower']);
    const idxCommanderPower = getIndex(['commander power', 'commanderpower']);

    const players: PlayerInfo[] = [];

    file.data.forEach((row: any[]) => {
      const getString = (idx: number | undefined): string =>
        idx !== undefined && idx >= 0 && idx < row.length
          ? String(row[idx] ?? '').trim()
          : '';

      const getNumber = (idx: number | undefined): number =>
        idx !== undefined && idx >= 0 && idx < row.length
          ? parseGermanNumber(row[idx])
          : 0;

      const id = getString(idxId);
      const name = getString(idxName);

      if (!id && !name) return;

      const player: PlayerInfo = {
        id: id || name,
        name: name || id,
        alliance: getString(idxAlliance) || undefined,
        power: getNumber(idxPower),
        troopsPower: getNumber(idxTroopsPower),
        totalKillPoints: getNumber(idxKillPoints),
        deadTroops: getNumber(idxDeadTroops),
        t1Kills: getNumber(idxT1),
        t2Kills: getNumber(idxT2),
        t3Kills: getNumber(idxT3),
        t4Kills: getNumber(idxT4),
        t5Kills: getNumber(idxT5),
        cityHall: getNumber(idxCityHall),
        techPower: getNumber(idxTechPower),
        buildingPower: getNumber(idxBuildingPower),
        commanderPower: getNumber(idxCommanderPower),
      };

      // Minimalfilter: brauchbare ID und irgendeine Power
      if (player.id && player.name) {
        players.push(player);
      }
    });

    return players;
  }, []);

  // ---------------------------------------------------------------------------
  // Vergleich berechnen
  // ---------------------------------------------------------------------------
  const handleCompare = useCallback(() => {
    setComparisonError(null);

    if (!startFileId || !endFileId || startFileId === endFileId) {
      setComparisonStats(null);
      return;
    }

    const startFile = uploadedFiles.find((f) => f.id === startFileId);
    const endFile = uploadedFiles.find((f) => f.id === endFileId);

    if (!startFile || !endFile) {
      setComparisonError('Could not find selected files.');
      setComparisonStats(null);
      return;
    }

    try {
      const data1 = extractPlayersFromFile(startFile);
      const data2 = extractPlayersFromFile(endFile);

      const map1 = new Map<string, PlayerInfo>();
      data1.forEach((p) => {
        if (p.id) map1.set(p.id, p);
      });

      const map2 = new Map<string, PlayerInfo>();
      data2.forEach((p) => {
        if (p.id) map2.set(p.id, p);
      });

      const newPlayers: PlayerInfo[] = [];
      const disappearedPlayers: PlayerInfo[] = [];
      const playerStatChanges: PlayerStatChange[] = [];

      // Änderungen + neue Spieler
      data2.forEach((p2) => {
        if (!p2.id) return;
        const p1 = map1.get(p2.id);
        if (!p1) {
          newPlayers.push(p2);
          return;
        }

        const change: PlayerStatChange = {
          id: p2.id,
          name: p2.name,
          alliance: p2.alliance ?? p1.alliance,

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
        };

        playerStatChanges.push(change);
      });

      // Verschwundene Spieler
      data1.forEach((p1) => {
        if (p1.id && !map2.has(p1.id)) {
          disappearedPlayers.push(p1);
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

      const stats: ComparisonStats = {
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
      };

      setComparisonStats(stats);
    } catch (err) {
      console.error(err);
      setComparisonError('Error analyzing data.');
      setComparisonStats(null);
    }
  }, [startFileId, endFileId, uploadedFiles, extractPlayersFromFile]);

  useEffect(() => {
    if (startFileId && endFileId && uploadedFiles.length >= 2) {
      handleCompare();
    }
  }, [startFileId, endFileId, uploadedFiles, handleCompare]);

  // ---------------------------------------------------------------------------
  // Suche
  // ---------------------------------------------------------------------------
  const handleSearch = () => {
    if (!comparisonStats || !searchQuery.trim()) {
      setSearchResults(null);
      setSelectedPlayer(null);
      return;
    }

    const queryLower = searchQuery.trim().toLowerCase();

    const candidates = comparisonStats.playerStatChanges.filter(
      (p) =>
        p.name.toLowerCase().includes(queryLower) ||
        p.id.toLowerCase().includes(queryLower)
    );

    if (candidates.length === 0) {
      setSearchResults('not_found');
      setSelectedPlayer(null);
    } else if (candidates.length === 1) {
      setSearchResults(null);
      setSelectedPlayer(candidates[0]);
    } else {
      setSearchResults(candidates);
      setSelectedPlayer(null);
    }
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    setSearchResults(null);
    setSelectedPlayer(null);
  };

  const handleSelectPlayer = (playerChange: PlayerStatChange) => {
    setSelectedPlayer(playerChange);
    setSearchResults(null);
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div className="space-y-6">
      {/* File upload + list */}
      <div className="flex flex-col lg:flex-row gap-6">
        <div className="lg:w-1/3 space-y-4">
          {canManageFiles && (
            <FileUpload
              backendUrl={backendUrl}
              endpoint="/overview/upload"
              onUploadComplete={handleUploadComplete}
              title="Upload Overview File"
            />
          )}

          <FileList
            files={uploadedFiles}
            onDelete={canManageFiles ? handleDeleteFile : undefined}
            onReorder={canManageFiles ? handleReorderFiles : undefined}
            isLoading={isLoading}
            error={error}
            isBasicUser={isBasicUser}
          />
        </div>

        {/* Chart */}
        <div className="lg:w-2/3">
          <PowerHistoryChart files={uploadedFiles} />
        </div>
      </div>

      {/* Vergleichs-Steuerung */}
      <div className="bg-gray-800 p-4 rounded-xl shadow-lg">
        <h3 className="text-lg font-semibold text-gray-200 mb-4">Comparison Controls</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
              className="bg-gray-700 border border-gray-600 text-white text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 p-2.5"
            >
              <option value="">Select…</option>
              {uploadedFiles.map((file) => (
                <option key={file.id} value={file.id}>
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
              className="bg-gray-700 border border-gray-600 text-white text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 p-2.5"
            >
              <option value="">Select…</option>
              {uploadedFiles.map((file) => (
                <option key={file.id} value={file.id}>
                  {cleanFileName(file.name)}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col">
            <button
              onClick={handleCompare}
              disabled={!startFileId || !endFileId || startFileId === endFileId}
              className="mt-5 bg-blue-600 text-white font-semibold py-2.5 px-4 rounded-lg hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors"
            >
              Compare
            </button>
          </div>
        </div>
      </div>

      {/* Search + Player focus */}
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

      {/* ComparisonSection mit Summary + Tabellen */}
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
