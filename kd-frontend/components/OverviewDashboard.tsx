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

const OverviewDashboard: React.FC<OverviewDashboardProps> = ({
  isAdmin,
  backendUrl,
}) => {
  const { user } = useAuth();
  const role = user?.role;
  const isBasicUser = role === 'user';
  const canManageFiles = isAdmin || role === 'r4' || role === 'r5';

  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [startFileId, setStartFileId] = useState<string>('');
  const [endFileId, setEndFileId] = useState<string>('');
  const [comparisonStats, setComparisonStats] = useState<ComparisonStats | null>(
    null
  );
  const [comparisonError, setComparisonError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchResults, setSearchResults] = useState<
    PlayerStatChange[] | 'not_found' | null
  >(null);
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerStatChange | null>(
    null
  );

  // ----------------------------------------------------
  // Dateien laden
  // ----------------------------------------------------
  const fetchFiles = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await fetch(`${backendUrl}/overview/files-data`);
      if (!response.ok) throw new Error('Failed to fetch files from server.');
      const data = await response.json();
      setUploadedFiles(data || []);

      if (data && data.length >= 2) {
        const sorted = [...data].sort(
          (a, b) =>
            new Date(a.uploadDate).getTime() - new Date(b.uploadDate).getTime()
        );
        const last = sorted[sorted.length - 1];
        const secondLast = sorted[sorted.length - 2];
        setStartFileId(secondLast.id);
        setEndFileId(last.id);
      } else if (data && data.length === 1) {
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

  const handleReorderFiles = async (reorderedFiles: UploadedFile[]) => {
    setUploadedFiles(reorderedFiles);
    // Reihenfolge im Backend speichern
    try {
      const order = reorderedFiles.map((f) => f.id);
      await fetch(`${backendUrl}/overview/files/reorder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order }),
      });
    } catch (err) {
      console.error('Failed to persist file order', err);
    }
  };

  // ----------------------------------------------------
  // Helfer: UploadedFile -> PlayerInfo[]
  // (arbeitet mit headers + data, NICHT mehr mit csvContent)
  // ----------------------------------------------------
  const extractPlayersFromFile = useCallback((file: UploadedFile): PlayerInfo[] => {
    if (!file || !file.headers || !file.data) return [];

    const headers = (file.headers || []).map((h) => String(h));

    const findIdx = (names: string[]) => findColumnIndex(headers, names);

    const idxId = findIdx(['governor id', 'governorid', 'id', 'gov id']);
    const idxName = findIdx(['name', 'player name', 'playername']);
    const idxAlliance = findIdx(['alliance', 'allianz', 'alliance tag', 'allianz tag']);
    const idxPower = findIdx(['power', 'macht']);
    const idxTroopsPower = findIdx(['troops power', 'troopspower']);
    const idxKillPoints = findIdx(['kill points', 'killpoints', 'kills']);
    const idxDeadTroops = findIdx(['dead troops', 'deadtroops']);
    const idxT1 = findIdx(['t1 kills', 't1']);
    const idxT2 = findIdx(['t2 kills', 't2']);
    const idxT3 = findIdx(['t3 kills', 't3']);
    const idxT4 = findIdx(['t4 kills', 't4']);
    const idxT5 = findIdx(['t5 kills', 't5']);
    const idxCityHall = findIdx(['city hall', 'cityhall', 'ch level', 'ch']);
    const idxTechPower = findIdx(['tech power', 'technology power']);
    const idxBuildingPower = findIdx(['building power', 'build power']);
    const idxCommanderPower = findIdx(['commander power', 'cmdr power']);

    if (idxId == null || idxName == null || idxPower == null) {
      console.warn(`Missing required columns in file: ${file.name}`);
      return [];
    }

    const getVal = (row: any[], idx: number | undefined): string =>
      idx != null && idx >= 0 && idx < row.length && row[idx] != null
        ? String(row[idx]).trim()
        : '';

    const getNum = (row: any[], idx: number | undefined): number =>
      idx != null ? parseGermanNumber(getVal(row, idx)) : 0;

    const players: PlayerInfo[] = [];

    for (const row of file.data) {
      const id = getVal(row, idxId);
      const name = getVal(row, idxName);

      if (!id || !name) continue;

      const player: PlayerInfo = {
        id,
        name,
        alliance: getVal(row, idxAlliance),
        power: getNum(row, idxPower),
        troopsPower: getNum(row, idxTroopsPower),
        totalKillPoints: getNum(row, idxKillPoints),
        deadTroops: getNum(row, idxDeadTroops),
        t1Kills: getNum(row, idxT1),
        t2Kills: getNum(row, idxT2),
        t3Kills: getNum(row, idxT3),
        t4Kills: getNum(row, idxT4),
        t5Kills: getNum(row, idxT5),
        cityHallLevel: idxCityHall != null
          ? parseInt(getVal(row, idxCityHall) || '0', 10) || null
          : null,
        techPower: idxTechPower != null ? getNum(row, idxTechPower) : null,
        buildingPower: idxBuildingPower != null ? getNum(row, idxBuildingPower) : null,
        commanderPower: idxCommanderPower != null ? getNum(row, idxCommanderPower) : null,
      };

      if (player.power > 0) {
        players.push(player);
      }
    }

    return players;
  }, []);

  // ----------------------------------------------------
  // Vergleich berechnen (ComparisonStats)
  // ----------------------------------------------------
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
      const startPlayers = extractPlayersFromFile(startFile);
      const endPlayers = extractPlayersFromFile(endFile);

      const mapStart = new Map<string, PlayerInfo>();
      const mapEnd = new Map<string, PlayerInfo>();

      startPlayers.forEach((p) => mapStart.set(p.id, p));
      endPlayers.forEach((p) => mapEnd.set(p.id, p));

      const allIds = new Set<string>([
        ...mapStart.keys(),
        ...mapEnd.keys(),
      ]);

      const newPlayers: PlayerInfo[] = [];
      const disappearedPlayers: PlayerInfo[] = [];
      const playerStatChanges: PlayerStatChange[] = [];

      allIds.forEach((id) => {
        const start = mapStart.get(id);
        const end = mapEnd.get(id);

        if (!start && end) {
          newPlayers.push(end);
        } else if (start && !end) {
          disappearedPlayers.push(start);
        } else if (start && end) {
          const change: PlayerStatChange = {
            id,
            name: end.name || start.name,
            alliance: end.alliance || start.alliance,
            oldPower: start.power,
            newPower: end.power,
            powerDiff: end.power - start.power,
            oldTroopsPower: start.troopsPower,
            newTroopsPower: end.troopsPower,
            troopsDiff: end.troopsPower - start.troopsPower,
            oldKillPoints: start.totalKillPoints,
            newKillPoints: end.totalKillPoints,
            killPointsDiff: end.totalKillPoints - start.totalKillPoints,
            oldDeadTroops: start.deadTroops,
            newDeadTroops: end.deadTroops,
            deadTroopsDiff: end.deadTroops - start.deadTroops,
          };
          playerStatChanges.push(change);
        }
      });

      const sumPower = (players: PlayerInfo[]) =>
        players.reduce((sum, p) => sum + p.power, 0);
      const sumKills = (players: PlayerInfo[]) =>
        players.reduce((sum, p) => sum + p.totalKillPoints, 0);
      const sumDead = (players: PlayerInfo[]) =>
        players.reduce((sum, p) => sum + p.deadTroops, 0);
      const sumTroopsPower = (players: PlayerInfo[]) =>
        players.reduce((sum, p) => sum + p.troopsPower, 0);

      const totalPowerFile1 = sumPower(startPlayers);
      const totalPowerFile2 = sumPower(endPlayers);
      const totalKillPointsFile1 = sumKills(startPlayers);
      const totalKillPointsFile2 = sumKills(endPlayers);
      const totalDeadTroopsFile1 = sumDead(startPlayers);
      const totalDeadTroopsFile2 = sumDead(endPlayers);
      const totalTroopsPowerFile1 = sumTroopsPower(startPlayers);
      const totalTroopsPowerFile2 = sumTroopsPower(endPlayers);

      const stats: ComparisonStats = {
        totalPowerFile1,
        totalPowerFile2,
        powerDifference: totalPowerFile2 - totalPowerFile1,
        totalKillPointsFile1,
        totalKillPointsFile2,
        totalKillPointsDifference: totalKillPointsFile2 - totalKillPointsFile1,
        totalDeadTroopsFile1,
        totalDeadTroopsFile2,
        totalDeadTroopsDifference: totalDeadTroopsFile2 - totalDeadTroopsFile1,
        totalTroopsPowerFile1,
        totalTroopsPowerFile2,
        totalTroopsPowerDifference: totalTroopsPowerFile2 - totalTroopsPowerFile1,
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

  // ----------------------------------------------------
  // Spielersuche (arbeitet auf playerStatChanges)
  // ----------------------------------------------------
  const handleSearch = () => {
    if (!comparisonStats || !searchQuery.trim()) {
      setSearchResults(null);
      setSelectedPlayer(null);
      return;
    }

    const query = searchQuery.trim().toLowerCase();
    const allChanges = comparisonStats.playerStatChanges || [];

    const matches = allChanges.filter(
      (p) =>
        p.name.toLowerCase().includes(query) ||
        p.id.toLowerCase().includes(query)
    );

    if (matches.length === 0) {
      setSearchResults('not_found');
      setSelectedPlayer(null);
    } else if (matches.length === 1) {
      setSearchResults(null);
      setSelectedPlayer(matches[0]);
    } else {
      setSearchResults(matches);
      setSelectedPlayer(null);
    }
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    setSearchResults(null);
    setSelectedPlayer(null);
  };

  const handleSelectPlayer = (playerChange: PlayerStatChange | null) => {
    if (!playerChange) {
      setSelectedPlayer(null);
      return;
    }
    setSelectedPlayer(playerChange);
    setSearchResults(null);
  };

  // ----------------------------------------------------
  // BASIC USER: nur Charts
  // ----------------------------------------------------
  if (isBasicUser) {
    return (
      <div className="space-y-8">
        {error && (
          <div className="text-center p-4 text-red-400 bg-red-900/50 rounded-lg">
            {error}
          </div>
        )}
        <div className="bg-gray-800 p-6 rounded-xl shadow-lg">
          <h3 className="text-lg font-semibold text-gray-200 mb-4">
            Kingdom Power Progression
          </h3>
          <PowerHistoryChart files={uploadedFiles || []} />
        </div>
      </div>
    );
  }

  // ----------------------------------------------------
  // R4 / R5 / Admin: Vollansicht
  // ----------------------------------------------------
  return (
    <div className="space-y-8">
      {error && (
        <div className="text-center p-4 text-red-400 bg-red-900/50 rounded-lg">
          {error}
        </div>
      )}

      {/* Upload + File list – nur für R4, R5 & Admin */}
      {canManageFiles && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
          <div className="bg-gray-800 p-6 rounded-xl shadow-lg">
            <FileUpload
              uploadUrl={`${backendUrl}/overview/upload`}
              onUploadComplete={handleUploadComplete}
            />
          </div>
          <div>
            <FileList
              files={uploadedFiles || []}
              onDeleteFile={handleDeleteFile}
              onReorder={handleReorderFiles}
            />
          </div>
        </div>
      )}

      <div className="bg-gray-800 p-6 rounded-xl shadow-lg">
        <PowerHistoryChart files={uploadedFiles || []} />
      </div>

      {/* Comparison Controls */}
      <div className="bg-gray-800 p-6 rounded-xl shadow-lg">
        <h3 className="text-lg font-semibold text-gray-200 mb-4">
          Comparison Controls
        </h3>
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
