// OverviewDashboard.tsx – NEU AUFGEBAUT mit korrekter ComparisonStats-Struktur

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

  // ---------------------------------------------------
  // Dateien laden
  // ---------------------------------------------------
  const fetchFiles = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(`${backendUrl}/overview/files-data`);
      if (!response.ok) throw new Error('Failed to fetch files from server.');
      const data: UploadedFile[] = await response.json();

      setUploadedFiles(data || []);

      if (data.length >= 2) {
        // Reihenfolge aus DB (fileOrder, uploadDate) ist schon sortiert,
        // wir suchen einfach "vorletzte" und "letzte" Datei raus.
        const last = data[data.length - 1];
        const secondLast = data[data.length - 2];
        setStartFileId(secondLast.id);
        setEndFileId(last.id);
      } else if (data.length === 1) {
        setStartFileId(data[0].id);
        setEndFileId(data[0].id);
      } else {
        setStartFileId('');
        setEndFileId('');
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
    // Frontend-Order aktualisieren
    setUploadedFiles(reorderedFiles);

    // Reihenfolge auch im Backend speichern (damit nach Reload gleich bleibt)
    try {
      const order = reorderedFiles.map((f) => f.id);
      await fetch(`${backendUrl}/overview/reorder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order }),
      });
    } catch (err) {
      console.error('Error sending reorder to server:', err);
    }
  };

  // ---------------------------------------------------
  // Hilfsfunktion: Datei -> PlayerInfo[]
  // ---------------------------------------------------
  const parseFileToPlayers = (file: UploadedFile): PlayerInfo[] => {
    if (!file || !file.headers || !file.data) return [];

    const headers = file.headers;

    const getVal = (row: any[], keywords: string[]): number => {
      const idx = findColumnIndex(headers, keywords);
      if (idx === undefined) return 0;
      return parseGermanNumber(row[idx]);
    };

    const getString = (row: any[], keywords: string[]): string => {
      const idx = findColumnIndex(headers, keywords);
      if (idx === undefined) return '';
      const v = row[idx];
      return v !== undefined && v !== null ? String(v) : '';
    };

    const players: PlayerInfo[] = [];

    file.data.forEach((row: any[]) => {
      const id = getString(row, ['governorid', 'id']);
      const name = getString(row, ['name']);
      const alliance = getString(row, ['alliance']);

      const power = getVal(row, ['power']);
      const troopsPower = getVal(row, ['troopspower']);
      const totalKillPoints = getVal(row, ['killpoints', 'kp']);
      const deadTroops = getVal(row, ['dead']);

      const t1Kills = getVal(row, ['t1', 't1kills']);
      const t2Kills = getVal(row, ['t2', 't2kills']);
      const t3Kills = getVal(row, ['t3', 't3kills']);
      const t4Kills = getVal(row, ['t4', 't4kills']);
      const t5Kills = getVal(row, ['t5', 't5kills']);

      // optionale Felder – wenn nicht vorhanden, bleiben sie 0
      const cityHall = getVal(row, ['cityhall', 'ch']);
      const techPower = getVal(row, ['techpower']);
      const buildingPower = getVal(row, ['buildingpower']);
      const commanderPower = getVal(row, ['commanderpower']);

      if (!id && !name && power === 0 && troopsPower === 0) {
        // offensichtliche Leere / Summenzeile o.Ä. -> überspringen
        return;
      }

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
        cityHall,
        techPower,
        buildingPower,
        commanderPower,
      });
    });

    return players;
  };

  // ---------------------------------------------------
  // Vergleich berechnen -> ComparisonStats
  // ---------------------------------------------------
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
      const data1 = parseFileToPlayers(startFile);
      const data2 = parseFileToPlayers(endFile);

      // Totals berechnen
      const totalPowerFile1 = data1.reduce((sum, p) => sum + (p.power || 0), 0);
      const totalPowerFile2 = data2.reduce((sum, p) => sum + (p.power || 0), 0);

      const totalTroopsPowerFile1 = data1.reduce(
        (sum, p) => sum + (p.troopsPower || 0),
        0
      );
      const totalTroopsPowerFile2 = data2.reduce(
        (sum, p) => sum + (p.troopsPower || 0),
        0
      );

      const totalKillPointsFile1 = data1.reduce(
        (sum, p) => sum + (p.totalKillPoints || 0),
        0
      );
      const totalKillPointsFile2 = data2.reduce(
        (sum, p) => sum + (p.totalKillPoints || 0),
        0
      );

      const totalDeadTroopsFile1 = data1.reduce(
        (sum, p) => sum + (p.deadTroops || 0),
        0
      );
      const totalDeadTroopsFile2 = data2.reduce(
        (sum, p) => sum + (p.deadTroops || 0),
        0
      );

      // Player-Maps für schnellen Zugriff
      const map1 = new Map<string, PlayerInfo>();
      data1.forEach((p) => {
        if (p.id) map1.set(p.id, p);
      });

      const map2 = new Map<string, PlayerInfo>();
      data2.forEach((p) => {
        if (p.id) map2.set(p.id, p);
      });

      // Stat-Changes für Spieler, die in beiden Dateien vorkommen
      const playerStatChanges: PlayerStatChange[] = [];

      data2.forEach((p2) => {
        if (!p2.id) return;
        const p1 = map1.get(p2.id);
        if (!p1) return;

        const diffPower = p2.power - p1.power;
        const diffTroopsPower = p2.troopsPower - p1.troopsPower;
        const diffKillPoints = p2.totalKillPoints - p1.totalKillPoints;
        const diffDeadTroops = p2.deadTroops - p1.deadTroops;

        playerStatChanges.push({
          id: p2.id,
          name: p2.name,
          alliance: p2.alliance,
          oldPower: p1.power,
          newPower: p2.power,
          diffPower,
          oldKillPoints: p1.totalKillPoints,
          newKillPoints: p2.totalKillPoints,
          diffKillPoints,
          oldDeadTroops: p1.deadTroops,
          newDeadTroops: p2.deadTroops,
          diffDeadTroops,
          oldTroopsPower: p1.troopsPower,
          newTroopsPower: p2.troopsPower,
          diffTroopsPower,
        });
      });

      // Neue Spieler: in File2, aber nicht in File1
      const newPlayers: PlayerInfo[] = data2.filter(
        (p2) => p2.id && !map1.has(p2.id)
      );

      // Verschwundene Spieler: in File1, aber nicht in File2
      const disappearedPlayers: PlayerInfo[] = data1.filter(
        (p1) => p1.id && !map2.has(p1.id)
      );

      const stats: ComparisonStats = {
        totalPowerFile1,
        totalPowerFile2,
        powerDifference: totalPowerFile2 - totalPowerFile1,

        totalTroopsPowerFile1,
        totalTroopsPowerFile2,
        troopsPowerDifference: totalTroopsPowerFile2 - totalTroopsPowerFile1,

        totalKillPointsFile1,
        totalKillPointsFile2,
        killPointsDifference: totalKillPointsFile2 - totalKillPointsFile1,

        totalDeadTroopsFile1,
        totalDeadTroopsFile2,
        deadTroopsDifference: totalDeadTroopsFile2 - totalDeadTroopsFile1,

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
  }, [startFileId, endFileId, uploadedFiles]);

  useEffect(() => {
    if (startFileId && endFileId && uploadedFiles.length >= 2) {
      handleCompare();
    }
  }, [startFileId, endFileId, uploadedFiles, handleCompare]);

  // ---------------------------------------------------
  // Suche nach Spielern (arbeitet direkt auf playerStatChanges)
  // ---------------------------------------------------
  const handleSearch = () => {
    if (!searchQuery.trim() || !comparisonStats?.playerStatChanges) {
      setSearchResults(null);
      setSelectedPlayer(null);
      return;
    }

    const queryLower = searchQuery.toLowerCase();
    const results = comparisonStats.playerStatChanges.filter(
      (p) =>
        p.name.toLowerCase().includes(queryLower) ||
        p.id.toLowerCase().includes(queryLower)
    );

    if (results.length === 0) {
      setSearchResults('not_found');
      setSelectedPlayer(null);
    } else {
      setSearchResults(results);
      setSelectedPlayer(results[0]);
    }
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    setSearchResults(null);
    setSelectedPlayer(null);
  };

  const handleSelectPlayer = (player: PlayerStatChange) => {
    setSelectedPlayer(player);
  };

  // ---------------------------------------------------
  // Loading / Error
  // ---------------------------------------------------
  if (isLoading) {
    return (
      <div className="p-6 text-center text-gray-300">Loading files…</div>
    );
  }

  // ---------------------------------------------------
  // BASIC USER: nur Charts
  // ---------------------------------------------------
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

  // ---------------------------------------------------
  // R4 / R5 / Admin: kompletter View
  // ---------------------------------------------------
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

      {/* Vergleichs-Steuerung */}
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

      {/* Suche + Detail-View */}
      <PlayerSearch
        query={searchQuery}
        setQuery={setSearchQuery}
        onSearch={handleSearch}
        onClear={handleClearSearch}
        results={searchResults}
        selectedPlayer={selectedPlayer}
        onSelectPlayer={handleSelectPlayer}
        isComparisonLoaded={!!comparisonStats?.playerStatChanges}
      />

      {/* ComparisonSection mit Summary + Tabellen */}
      <ComparisonSection
        stats={comparisonStats}
        error={comparisonError}
        file1Name={
          cleanFileName(
            uploadedFiles?.find((f) => f.id === startFileId)?.name ?? ''
          ) || null
        }
        file2Name={
          cleanFileName(
            uploadedFiles?.find((f) => f.id === endFileId)?.name ?? ''
          ) || null
        }
      />
    </div>
  );
};

export default OverviewDashboard;
