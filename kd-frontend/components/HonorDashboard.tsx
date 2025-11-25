import React, { useEffect, useState, useCallback, useMemo } from 'react';
import FileUpload from './FileUpload';
import FileList from './FileList';
import HonorHistoryChart from './HonorHistoryChart';
import HonorOverviewTable from './HonorOverviewTable';
import HonorPlayerSearch from './HonorPlayerSearch';
import { useAuth } from './AuthContext';
import { cleanFileName, parseGermanNumber, findColumnIndex } from '../utils';
import type {
  UploadedFile,
  HonorPlayerInfo,
  PlayerHonorChange,
  HonorComparisonStats,
  PlayerHonorHistory,
} from '../types';

interface HonorDashboardProps {
  isAdmin: boolean;
  backendUrl: string;
}

const HonorDashboard: React.FC<HonorDashboardProps> = ({ isAdmin, backendUrl }) => {
  const { user } = useAuth();
  const role = user?.role;
  const canManageFiles = isAdmin || role === 'r4' || role === 'r5';

  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [startFileId, setStartFileId] = useState<string>('');
  const [endFileId, setEndFileId] = useState<string>('');
  const [comparisonStats, setComparisonStats] = useState<HonorComparisonStats | null>(null);
  const [comparisonError, setComparisonError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchResults, setSearchResults] = useState<HonorPlayerInfo[] | 'not_found' | null>(null);
  const [selectedPlayerHistory, setSelectedPlayerHistory] = useState<PlayerHonorHistory | null>(null);

  // ---------------------------------------------------------------------------
  // Files laden
  // ---------------------------------------------------------------------------
  const fetchFiles = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await fetch(`${backendUrl}/honor/files-data`);
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
      const response = await fetch(`${backendUrl}/honor/files/${id}`, {
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
  // UploadedFile → HonorPlayerInfo[]
  // ---------------------------------------------------------------------------
  const parseHonorFromFile = useCallback((file: UploadedFile): HonorPlayerInfo[] => {
    if (!file || !Array.isArray(file.headers) || !Array.isArray(file.data)) {
      return [];
    }

    const idxGovernorId = findColumnIndex(file.headers, ['governorid', 'id', 'gov id', 'governor id']);
    const idxName = findColumnIndex(file.headers, ['name', 'playername', 'player']);
    const idxHonor = findColumnIndex(file.headers, ['honor', 'honour', 'points', 'honor points']);

    if (idxGovernorId === undefined || idxName === undefined || idxHonor === undefined) {
      console.warn(`Missing required columns in honor file: ${file.name}`);
      return [];
    }

    const players: HonorPlayerInfo[] = [];

    file.data.forEach((row: any[]) => {
      const getVal = (idx: number | undefined): string =>
        idx !== undefined && idx >= 0 && idx < row.length
          ? String(row[idx] ?? '').trim()
          : '';

      const governorId = getVal(idxGovernorId);
      const name = getVal(idxName);
      const honorPoint = parseGermanNumber(getVal(idxHonor));

      if (governorId && name) {
        players.push({ governorId, name, honorPoint });
      }
    });

    return players;
  }, []);

  // ---------------------------------------------------------------------------
  // Honor-Vergleich (Start/Ende)
  // ---------------------------------------------------------------------------
  const handleCompare = useCallback(() => {
    setComparisonError(null);

    if (!startFileId || !endFileId) {
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
      const startPlayers = parseHonorFromFile(startFile);
      const endPlayers = parseHonorFromFile(endFile);

      const mapStart = new Map<string, HonorPlayerInfo>();
      startPlayers.forEach((p) => mapStart.set(p.governorId, p));

      const changes: PlayerHonorChange[] = [];

      endPlayers.forEach((p2) => {
        const base = mapStart.get(p2.governorId);
        const oldHonor = base ? base.honorPoint : 0;
        const newHonor = p2.honorPoint;
        const diffHonor = newHonor - oldHonor;

        changes.push({
          governorId: p2.governorId,
          name: p2.name,
          oldHonor,
          newHonor,
          diffHonor,
        });
      });

      const stats: HonorComparisonStats = {
        playerHonorChanges: changes,
      };

      setComparisonStats(stats);
    } catch (err) {
      console.error(err);
      setComparisonError('Error analyzing honor data.');
      setComparisonStats(null);
    }
  }, [startFileId, endFileId, uploadedFiles, parseHonorFromFile]);

  useEffect(() => {
    if (startFileId && endFileId && uploadedFiles.length >= 1) {
      handleCompare();
    }
  }, [startFileId, endFileId, uploadedFiles, handleCompare]);

  // ---------------------------------------------------------------------------
  // Honor-Historien über alle Files (für Suche / Chart)
  // ---------------------------------------------------------------------------
  const honorHistories = useMemo(() => {
    const histories = new Map<string, PlayerHonorHistory>();

    if (!uploadedFiles || uploadedFiles.length === 0) return histories;

    const sorted = [...uploadedFiles].sort(
      (a, b) =>
        new Date(a.uploadDate).getTime() - new Date(b.uploadDate).getTime()
    );

    sorted.forEach((file) => {
      const players = parseHonorFromFile(file);
      const label = cleanFileName(file.name);

      players.forEach((p) => {
        if (!histories.has(p.governorId)) {
          histories.set(p.governorId, {
            id: p.governorId,
            name: p.name,
            history: [],
          });
        }
        const entry = histories.get(p.governorId)!;
        entry.name = p.name;
        entry.history.push({
          fileName: label,
          honorPoint: p.honorPoint,
        });
      });
    });

    return histories;
  }, [uploadedFiles, parseHonorFromFile]);

  // aktueller Stand (letztes File) für Suche
  const latestSnapshotPlayers: HonorPlayerInfo[] = useMemo(() => {
    if (!uploadedFiles || uploadedFiles.length === 0) return [];
    const latestFile = [...uploadedFiles].sort(
      (a, b) =>
        new Date(a.uploadDate).getTime() - new Date(b.uploadDate).getTime()
    )[uploadedFiles.length - 1];

    return parseHonorFromFile(latestFile);
  }, [uploadedFiles, parseHonorFromFile]);

  // ---------------------------------------------------------------------------
  // Suche nach Spieler (Honor-Historie)
  // ---------------------------------------------------------------------------
  const isDataLoaded = uploadedFiles.length > 0;

  const handleSearch = () => {
    if (!isDataLoaded || !searchQuery.trim()) {
      setSearchResults(null);
      setSelectedPlayerHistory(null);
      return;
    }

    const queryLower = searchQuery.trim().toLowerCase();

    const matches = latestSnapshotPlayers.filter(
      (p) =>
        p.name.toLowerCase().includes(queryLower) ||
        p.governorId.toLowerCase().includes(queryLower)
    );

    if (matches.length === 0) {
      setSearchResults('not_found');
      setSelectedPlayerHistory(null);
    } else if (matches.length === 1) {
      setSearchResults(null);
      const m = matches[0];
      const history = honorHistories.get(m.governorId) || null;
      setSelectedPlayerHistory(history);
    } else {
      setSearchResults(matches);
      setSelectedPlayerHistory(null);
    }
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    setSearchResults(null);
    setSelectedPlayerHistory(null);
  };

  const handleSelectPlayer = (player: HonorPlayerInfo) => {
    const history = honorHistories.get(player.governorId) || null;
    setSelectedPlayerHistory(history);
    setSearchResults(null);
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div className="space-y-6">
      {/* Upload + Liste */}
      <div className="flex flex-col lg:flex-row gap-6">
        <div className="lg:w-1/3 space-y-4">
          {canManageFiles && (
            <FileUpload
              backendUrl={backendUrl}
              endpoint="/honor/upload"
              onUploadComplete={handleUploadComplete}
              title="Upload Honor File"
            />
          )}

          <FileList
            files={uploadedFiles}
            onDelete={canManageFiles ? handleDeleteFile : undefined}
            onReorder={canManageFiles ? handleReorderFiles : undefined}
            isLoading={isLoading}
            error={error}
            isBasicUser={false}
          />
        </div>

        {/* Honor-Gesamtverlauf */}
        <div className="lg:w-2/3">
          <HonorHistoryChart files={uploadedFiles} />
        </div>
      </div>

      {/* Vergleichs-Steuerung */}
      <div className="bg-gray-800 p-4 rounded-xl shadow-lg">
        <h3 className="text-lg font-semibold text-gray-200 mb-4">Honor Comparison Controls</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex flex-col">
            <label
              htmlFor="honor-start-date-select"
              className="text-sm font-medium text-gray-400 mb-1"
            >
              Start Date
            </label>
            <select
              id="honor-start-date-select"
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
              htmlFor="honor-end-date-select"
              className="text-sm font-medium text-gray-400 mb-1"
            >
              End Date
            </label>
            <select
              id="honor-end-date-select"
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
              disabled={!startFileId || !endFileId}
              className="mt-5 bg-blue-600 text-white font-semibold py-2.5 px-4 rounded-lg hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors"
            >
              Compare
            </button>
          </div>
        </div>
      </div>

      {/* Suche nach Honor-Historie */}
      <HonorPlayerSearch
        query={searchQuery}
        setQuery={setSearchQuery}
        onSearch={handleSearch}
        onClear={handleClearSearch}
        results={searchResults}
        selectedPlayerHistory={selectedPlayerHistory}
        onSelectPlayer={handleSelectPlayer}
        isDataLoaded={isDataLoaded}
      />

      {/* Vergleichstabelle */}
      <HonorOverviewTable
        stats={comparisonStats}
        error={comparisonError}
        startFileName={cleanFileName(
          uploadedFiles?.find((f) => f.id === startFileId)?.name ?? ''
        )}
        endFileName={cleanFileName(
          uploadedFiles?.find((f) => f.id === endFileId)?.name ?? ''
        )}
      />
    </div>
  );
};

export default HonorDashboard;
