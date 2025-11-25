import React, { useEffect, useState, useCallback, useMemo } from 'react';
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
  const [comparisonStats, setComparisonStats] = useState<ComparisonStats | (ComparisonStats & any) | null>(null);
  const [comparisonError, setComparisonError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchResults, setSearchResults] = useState<any[] | 'not_found' | null>(null);
  const [selectedPlayer, setSelectedPlayer] = useState<any | null>(null);

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

  // CSV-Parser (alter Stand mit content; läuft bei dir ja)
  const parseCsvContent = useCallback((csvContent: string, filename: string): PlayerInfo[] => {
    if (!csvContent) return [] as any;

    const lines = csvContent.trim().split('\n');
    if (lines.length < 2) return [] as any;

    const header = lines[0].split(';').map((h) => h.trim().toLowerCase());
    const findIndex = (possibleNames: string[]) =>
      findColumnIndex(header, possibleNames);

    const idxGovernorId = findIndex(['governorid', 'id']);
    const idxName = findIndex(['name', 'playername']);
    const idxPower = findIndex(['power', 'macht']);
    const idxTroopsPower = findIndex(['troopspower', 'troops power']);
    const idxKillPoints = findIndex(['killpoints', 'kill points', 'kills']);
    const idxDeadTroops = findIndex(['deadtroops', 'dead troops']);
    const idxT4 = findIndex(['t4', 'tier4']);
    const idxT5 = findIndex(['t5', 'tier5']);

    if (idxGovernorId === undefined || idxName === undefined || idxPower === undefined) {
      console.warn(`Missing required columns in file: ${filename}`);
      return [] as any;
    }

    const players: any[] = [];
    for (let i = 1; i < lines.length; i++) {
      const row = lines[i].split(';');
      if (row.length !== header.length) continue;

      const getVal = (idx: number | undefined): string =>
        idx !== undefined && idx >= 0 && idx < row.length
          ? row[idx].trim()
          : '';

      const player = {
        governorId: getVal(idxGovernorId),
        name: getVal(idxName),
        power: parseGermanNumber(getVal(idxPower)),
        troopsPower:
          idxTroopsPower !== undefined ? parseGermanNumber(getVal(idxTroopsPower)) : 0,
        totalKillPoints:
          idxKillPoints !== undefined ? parseGermanNumber(getVal(idxKillPoints)) : 0,
        deadTroops:
          idxDeadTroops !== undefined ? parseGermanNumber(getVal(idxDeadTroops)) : 0,
        t4:
          idxT4 !== undefined ? parseGermanNumber(getVal(idxT4)) : 0,
        t5:
          idxT5 !== undefined ? parseGermanNumber(getVal(idxT5)) : 0,
      };

      if (player.governorId && player.name && player.power > 0) {
        players.push(player);
      }
    }

    return players as any;
  }, []);

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
      const data1: any[] = parseCsvContent((startFile as any).content, startFile.name);
      const data2: any[] = parseCsvContent((endFile as any).content, endFile.name);

      const map1 = new Map<string, any>();
      data1.forEach((p) => map1.set(p.governorId, p));

      const statChanges: any[] = [];
      const positive = { power: 0, troopsPower: 0, killPoints: 0, deadTroops: 0 };
      const negative = { power: 0, troopsPower: 0, killPoints: 0, deadTroops: 0 };

      data2.forEach((p2) => {
        const p1 = map1.get(p2.governorId);
        if (!p1) return;

        const diffPower = p2.power - p1.power;
        const diffTroops = p2.troopsPower - p1.troopsPower;
        const diffKills = p2.totalKillPoints - p1.totalKillPoints;
        const diffDead = p2.deadTroops - p1.deadTroops;

        statChanges.push({
          governorId: p2.governorId,
          name: p2.name,
          oldPower: p1.power,
          newPower: p2.power,
          diffPower,
          oldTroopsPower: p1.troopsPower,
          newTroopsPower: p2.troopsPower,
          diffTroopsPower: diffTroops,
          oldKillPoints: p1.totalKillPoints,
          newKillPoints: p2.totalKillPoints,
          diffKillPoints: diffKills,
          oldDeadTroops: p1.deadTroops,
          newDeadTroops: p2.deadTroops,
          diffDeadTroops: diffDead,
        });

        if (diffPower > 0) positive.power += diffPower;
        else negative.power += diffPower;

        if (diffTroops > 0) positive.troopsPower += diffTroops;
        else negative.troopsPower += diffTroops;

        if (diffKills > 0) positive.killPoints += diffKills;
        else negative.killPoints += diffKills;

        if (diffDead > 0) positive.deadTroops += diffDead;
        else negative.deadTroops += diffDead;
      });

      const calculateTotals = (data: any[]) => ({
        totalPower: data.reduce((sum, p) => sum + p.power, 0),
        totalTroopsPower: data.reduce((sum, p) => sum + p.troopsPower, 0),
        totalKillPoints: data.reduce((sum, p) => sum + p.totalKillPoints, 0),
        totalDeadTroops: data.reduce((sum, p) => sum + p.deadTroops, 0),
      });

      const totals1 = calculateTotals(data1);
      const totals2 = calculateTotals(data2);

      const totalsDiff = {
        power: totals2.totalPower - totals1.totalPower,
        troopsPower: totals2.totalTroopsPower - totals1.totalTroopsPower,
        killPoints: totals2.totalKillPoints - totals1.totalKillPoints,
        deadTroops: totals2.totalDeadTroops - totals1.totalDeadTroops,
      };

      // ✨ NEU: Objekt so aufbauen, dass es sowohl zum neuen ComparisonStats-Typ
      //         als auch zu deiner bestehenden Logik (changes, totals1/2 etc.) passt
      const stats: ComparisonStats & any = {
        // Neue Felder für ComparisonSection
        totalPowerFile1: totals1.totalPower,
        totalPowerFile2: totals2.totalPower,
        powerDifference: totalsDiff.power,

        totalTroopsPowerFile1: totals1.totalTroopsPower,
        totalTroopsPowerFile2: totals2.totalTroopsPower,
        troopsPowerDifference: totalsDiff.troopsPower,

        totalKillPointsFile1: totals1.totalKillPoints,
        totalKillPointsFile2: totals2.totalKillPoints,
        killPointsDifference: totalsDiff.killPoints,

        totalDeadTroopsFile1: totals1.totalDeadTroops,
        totalDeadTroopsFile2: totals2.totalDeadTroops,
        deadTroopsDifference: totalsDiff.deadTroops,

        // vorerst keine echte Logik für New/Disappeared
        newPlayers: [],
        disappearedPlayers: [],

        // Player-Changes für die neuen Tabellen in ComparisonSection
        playerStatChanges: statChanges as PlayerStatChange[],

        // Alte Felder, damit Search & Co weiter funktionieren
        startFileName: cleanFileName(startFile.name),
        endFileName: cleanFileName(endFile.name),
        totals1,
        totals2,
        totalsDiff,
        positive,
        negative,
        changes: statChanges,
      };

      setComparisonStats(stats);
    } catch (err) {
      console.error(err);
      setComparisonError('Error analyzing data.');
      setComparisonStats(null);
    }
  }, [startFileId, endFileId, uploadedFiles, parseCsvContent]);

  useEffect(() => {
    if (startFileId && endFileId && uploadedFiles.length >= 2) {
      handleCompare();
    }
  }, [startFileId, endFileId, uploadedFiles, handleCompare]);

  const allPlayersForSearch = useMemo<PlayerInfo[]>(() => {
    if (!comparisonStats || !(comparisonStats as any).changes) return [];
    return (comparisonStats as any).changes.map((change: any) => ({
      governorId: change.governorId,
      name: change.name,
      power: change.newPower,
      troopsPower: change.newTroopsPower,
      totalKillPoints: change.newKillPoints,
      deadTroops: change.newDeadTroops,
      t4: 0,
      t5: 0,
    })) as any;
  }, [comparisonStats]);

  const handleSearch = () => {
    if (!searchQuery.trim() || !comparisonStats || !(comparisonStats as any).changes) {
      setSearchResults(null);
      setSelectedPlayer(null);
      return;
    }

    const queryLower = searchQuery.toLowerCase();
    const results = (comparisonStats as any).changes.filter(
      (p: any) =>
        p.name.toLowerCase().includes(queryLower) ||
        p.governorId.toLowerCase().includes(queryLower)
    );

    if (!results.length) {
      setSearchResults('not_found');
      setSelectedPlayer(null);
    } else if (results.length === 1) {
      setSearchResults(null);
      setSelectedPlayer(results[0]);
    } else {
      setSearchResults(results);
      setSelectedPlayer(null);
    }
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    setSearchResults(null);
    setSelectedPlayer(null);
  };

  const handleSelectPlayer = (playerChange: any) => {
    setSelectedPlayer(playerChange);
  };

  // 👉 BASIC USER: Only charts in this view
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

  // 👉 R4, R5, Admin: full view
  return (
    <div className="space-y-8">
      {error && (
        <div className="text-center p-4 text-red-400 bg-red-900/50 rounded-lg">
          {error}
        </div>
      )}

      {/* Upload + File list – only for R4, R5 & Admin */}
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

      {/* ComparisonSection with summary AND tables */}
      <ComparisonSection
        stats={comparisonStats as any}
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
