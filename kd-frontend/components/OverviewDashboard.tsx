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
  publicSlug: string | null; // <<< FÜR ÖFFENTLICHEN ZUGRIFF
}

const OverviewDashboard: React.FC<OverviewDashboardProps> = ({
  isAdmin,
  backendUrl,
  publicSlug,
}) => {
  const { user } = useAuth();
  const role = user?.role;
  const isBasicUser = role === 'user';
  
  // Logik: isPublicView ist true, wenn Slug da und kein User eingeloggt ist
  const isPublicView = !!publicSlug && !user; 
  // Logik: canManageFiles nur für eingeloggte Admin/R5/R4
  const canManageFiles = !isPublicView && (isAdmin || role === 'r4' || role === 'r5'); 
  const isMinimalView = isPublicView || isBasicUser; // Zeigt nur Chart/kein Management

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
  // Dateien laden (KORRIGIERT: Logik für Public/Private)
  // ---------------------------------------------------
  const fetchFiles = useCallback(async () => {
    // Wenn öffentlicher View und kein Slug vorhanden, breche ab
    if (isPublicView && !publicSlug) {
        setError('Public access requires a Kingdom slug.');
        setIsLoading(false);
        return;
    }

    try {
      setIsLoading(true);
      setError(null);
      let response: Response;
      
      if (isPublicView && publicSlug) {
        // 1. Öffentlicher Modus: Nutze public API mit Slug
        const publicUrl = `${backendUrl}/api/public/kingdom/${publicSlug}/overview-files`;
        response = await fetch(publicUrl);
        
      } else {
        // 2. Privater Modus (eingeloggter User): Nutze geschützten Token-Endpunkt
        const token = localStorage.getItem('authToken');
        
        if (!token) {
          // Im Private Mode muss ein Token da sein (wird durch ProtectedRoute verhindert)
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
        throw new Error(errorData.error || `Failed to fetch files from server (${response.status}).`);
      }
      
      const data: UploadedFile[] = await response.json();

      setUploadedFiles(data || []);

      if (data.length >= 2) {
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
    } catch (err: any) {
      console.error(err);
      // Wenn 403/404 im Public Mode, zeige es als "No data"
      const message = err.message || 'Error loading files from server.';
      if (isPublicView && (message.includes('403') || message.includes('404') || message.includes('No data found'))) {
          setError('No data found for this Kingdom slug.');
      } else {
          setError(message);
      }
    } finally {
      setIsLoading(false);
    }
  }, [backendUrl, isPublicView, publicSlug, user]);

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);
  
  const handleUploadComplete = () => {
    fetchFiles();
  };

  const handleDeleteFile = async (id: string) => {
    try {
      const token = localStorage.getItem('authToken');
      if (!token) throw new Error('Authentication token missing.');

      const response = await fetch(`${backendUrl}/overview/files/${id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!response.ok) throw new Error('Failed to delete file on server.');
      setUploadedFiles((prev) => (prev || []).filter((f) => f.id !== id));
    } catch (err) {
      console.error(err);
      setError('Failed to delete file.');
    }
  };

  const handleReorderFiles = async (reorderedFiles: UploadedFile[]) => {
    // Frontend-Order sofort aktualisieren
    setUploadedFiles(reorderedFiles);

    // Reihenfolge auch im Backend persistent speichern
    try {
      const token = localStorage.getItem('authToken');
      if (!token) throw new Error('Authentication token missing.');

      const order = reorderedFiles.map((f) => f.id);
      await fetch(`${backendUrl}/overview/files/reorder`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ order }),
      });
    } catch (err) {
      console.error('Error sending reorder to server:', err);
    }
  };

  // ---------------------------------------------------
  // Hilfsfunktion: Datei -> PlayerInfo[] (arbeitet mit headers + data)
  // ---------------------------------------------------
  const parseFileToPlayers = (file: UploadedFile): PlayerInfo[] => {
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

    const players: PlayerInfo[] = [];

    file.data.forEach((row: any[]) => {
      const id = getString(row, ['governorid', 'governor id', 'id', 'gov id']);
      const name = getString(row, ['name', 'player name', 'playername']);
      const alliance = getString(row, ['alliance', 'allianz', 'alliance tag']);

      const power = getNumber(row, ['power', 'macht']);
      const troopsPower = getNumber(row, ['troopspower', 'troops power']);

      // ❗ FIX: Kill Points nur aus der Spalte "Total Kill Points" lesen
      const totalKillPoints = getNumber(row, ['total kill points']);

      const deadTroops = getNumber(row, ['deadtroops', 'dead troops', 'dead']);

      const t1Kills = getNumber(row, ['t1', 't1 kills']);
      const t2Kills = getNumber(row, ['t2', 't2 kills']);
      const t3Kills = getNumber(row, ['t3', 't3 kills']);
      const t4Kills = getNumber(row, ['t4', 't4 kills', 'tier4']);
      const t5Kills = getNumber(row, ['t5', 't5 kills', 'tier5']);

      const cityHall = getNumber(row, ['cityhall', 'city hall', 'ch']);
      const techPower = getNumber(row, ['techpower', 'tech power']);
      const buildingPower = getNumber(row, ['buildingpower', 'building power']);
      const commanderPower = getNumber(row, [
        'commanderpower',
        'commander power',
      ]);

      // offensichtliche leere/summen Zeilen überspringen
      if (!id && !name && power === 0 && troopsPower === 0) {
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

      const map1 = new Map<string, PlayerInfo>();
      data1.forEach((p) => {
        if (p.id) map1.set(p.id, p);
      });

      const map2 = new Map<string, PlayerInfo>();
      data2.forEach((p) => {
        if (p.id) map2.set(p.id, p);
      });

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

      const newPlayers: PlayerInfo[] = data2.filter(
        (p2) => p2.id && !map1.has(p2.id)
      );
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
  // Suche nach Spielern (arbeitet auf playerStatChanges)
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
  // RENDER LOGIK
  // ---------------------------------------------------
  
  if (isLoading) {
    return (
      <div className="p-6 text-center text-gray-300">Loading files…</div>
    );
  }

  // ---------------------------------------------------
  // RENDER: MINIMAL VIEW (Public User / Basic User)
  // ---------------------------------------------------
  if (isMinimalView) {
    return (
      <div className="space-y-8">
        {error && (
          <div className="text-center p-4 text-red-400 bg-red-900/50 rounded-lg">
            {error}
          </div>
        )}
        
        {/* Kingdom Power Progression Chart (immer) */}
        <div className="bg-gray-800 p-6 rounded-xl shadow-lg">
          <h3 className="text-lg font-semibold text-gray-200 mb-4">
            Kingdom Power Progression
          </h3>
          <PowerHistoryChart files={uploadedFiles || []} />
        </div>
        
        {/* HINWEIS, falls keine Daten vorhanden sind */}
        {!error && uploadedFiles.length === 0 && (
            <div className="text-center p-8 text-yellow-400 bg-gray-800 rounded-xl">
                <h3 className="text-xl font-bold mb-2">No Data Available</h3>
                <p>The selected Kingdom has not uploaded any files yet.</p>
            </div>
        )}
      </div>
    );
  }


  // ---------------------------------------------------
  // RENDER: FULL VIEW (R4 / R5 / Admin)
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

      {/* Comparison controls */}
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

      {/* Search + Detail view */}
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

      {/* ComparisonSection with summary + tables */}
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