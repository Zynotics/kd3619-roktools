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
  const [comparisonStats, setComparisonStats] = useState<HonorComparisonStats | null>(
    null
  );
  const [comparisonError, setComparisonError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchResults, setSearchResults] = useState<PlayerHonorChange[]>([]);
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerHonorHistory | null>(
    null
  );

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

  const handleReorderFiles = async (reorderedFiles: UploadedFile[]) => {
    setUploadedFiles(reorderedFiles);

    try {
      const order = reorderedFiles.map((f) => f.id);
      await fetch(`${backendUrl}/honor/files/reorder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order }),
      });
    } catch (err) {
      console.error('Failed to persist honor file order:', err);
    }
  };

  const parseCsvContent = useCallback((csvContent: string, filename: string): HonorPlayerInfo[] => {
    const lines = csvContent.trim().split('\n');
    if (lines.length < 2) return [];

    const header = lines[0].split(';').map((h) => h.trim().toLowerCase());
    const findIndex = (possibleNames: string[]) =>
      findColumnIndex(header, possibleNames);

    const idxGovernorId = findIndex(['governorid', 'id']);
    const idxName = findIndex(['name', 'playername']);
    const idxHonor = findIndex(['honor', 'honour', 'points']);

    if (idxGovernorId === -1 || idxName === -1 || idxHonor === -1) {
      console.warn(`Missing required columns in file: ${filename}`);
      return [];
    }

    const players: HonorPlayerInfo[] = [];
    for (let i = 1; i < lines.length; i++) {
      const row = lines[i].split(';');
      if (row.length !== header.length) continue;

      const getVal = (idx: number | null | undefined): string =>
        idx !== undefined && idx !== null && idx >= 0 && idx < row.length
          ? row[idx].trim()
          : '';

      const player: HonorPlayerInfo = {
        governorId: getVal(idxGovernorId),
        name: getVal(idxName),
        honorPoint: parseGermanNumber(getVal(idxHonor)),
      };

      if (player.governorId && player.name && player.honorPoint >= 0) {
        players.push(player);
      }
    }

    return players;
  }, []);

  const handleCompare = useCallback(() => {
    setComparisonError(null);

    if (!endFileId) {
      setComparisonStats(null);
      return;
    }

    const endFile = uploadedFiles.find((f) => f.id === endFileId);
    if (!endFile) {
      setComparisonError('Could not find selected file.');
      setComparisonStats(null);
      return;
    }

    try {
      const data = parseCsvContent((endFile as any).content, endFile.name);

      const changes: any[] = (data as any).map((p: any) => ({
        governorId: p.governorId,
        name: p.name,
        oldHonor: 0,
        newHonor: p.honorPoint,
        diffHonor: p.honorPoint,
      }));

      const stats: any = {
        playerHonorChanges: changes,
      };

      setComparisonStats(stats);
    } catch (err) {
      console.error(err);
      setComparisonError('Error analyzing data.');
      setComparisonStats(null);
    }
  }, [endFileId, uploadedFiles, parseCsvContent]);

  useEffect(() => {
    if (endFileId && uploadedFiles.length >= 1) {
      handleCompare();
    }
  }, [endFileId, uploadedFiles, handleCompare]);

  const allPlayersForSearch = useMemo<HonorPlayerInfo[]>(() => {
    if (!comparisonStats) return [];
    return (comparisonStats.playerHonorChanges || []).map((change: any) => ({
      governorId: change.governorId,
      name: change.name,
      honorPoint: change.newHonor,
    }));
  }, [comparisonStats]);

  const handleSearch = () => {
    if (!searchQuery.trim() || !comparisonStats) {
      setSearchResults([]);
      setSelectedPlayer(null);
      return;
    }

    const queryLower = searchQuery.toLowerCase();
    const changes = comparisonStats.playerHonorChanges || [];

    const results = changes.filter(
      (p: any) =>
        p.name.toLowerCase().includes(queryLower) ||
        p.governorId.toLowerCase().includes(queryLower)
    );

    setSearchResults(results);
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    setSearchResults([]);
    setSelectedPlayer(null);
  };

  const handleSelectPlayer = (playerChange: PlayerHonorChange | null) => {
    if (!playerChange) {
      setSelectedPlayer(null);
      return;
    }

    setSelectedPlayer({
      id: playerChange.governorId,
      name: playerChange.name,
      history: [
        {
          fileName: cleanFileName(
            uploadedFiles.find((f) => f.id === endFileId)?.name || ''
          ),
          honorPoint: playerChange.newHonor,
        },
      ],
    });
  };

  if (isLoading) {
    return (
      <div className="p-6 text-center text-gray-300">Loading files…</div>
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
      {/* Upload + File list – nur R4, R5 & Admin */}
      {canManageFiles && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
          <div className="bg-gray-800 p-6 rounded-xl shadow-lg">
            <FileUpload
              uploadUrl={`${backendUrl}/honor/upload`}
              onUploadComplete={handleUploadComplete}
            />
          </div>
          <div>
            <FileList
              files={uploadedFiles || []}
              canManageFiles={canManageFiles}
              onDeleteFile={handleDeleteFile}
              onReorder={handleReorderFiles}
            />
          </div>
        </div>
      )}

      <div className="bg-gray-800 p-6 rounded-xl shadow-lg">
        <HonorHistoryChart files={uploadedFiles || []} />
      </div>

      <div className="bg-gray-800 p-6 rounded-xl shadow-lg">
        <h3 className="text-lg font-semibold text-gray-200 mb-4">Comparison Controls</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
          <div className="flex flex-col">
            <label
              htmlFor="end-date-select-honor"
              className="text-sm font-medium text-gray-400 mb-1"
            >
              Snapshot
            </label>
            <select
              id="end-date-select-honor"
              value={endFileId}
              onChange={(e) => setEndFileId(e.target.value)}
              className="bg-gray-700 border border-gray-600 text-white text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 p-2.5"
            >
              <option value="">Select…</option>
              {uploadedFiles.map((file: any) => (
                <option key={file.id} value={file.id}>
                  {cleanFileName(file.name)}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <HonorPlayerSearch
        query={searchQuery}
        setQuery={setSearchQuery}
        onSearch={handleSearch}
        onClear={handleClearSearch}
        results={searchResults}
        selectedPlayer={selectedPlayer}
        onSelectPlayer={(p) =>
          handleSelectPlayer(
            p
              ? (comparisonStats?.playerHonorChanges || []).find(
                  (c: any) => c.governorId === p.id
                ) || null
              : null
          )
        }
        allPlayers={allPlayersForSearch}
      />

      <HonorOverviewTable
        stats={comparisonStats}
        error={comparisonError}
      />
    </div>
  );
};

export default HonorDashboard;
