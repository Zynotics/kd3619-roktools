import React, { useEffect, useState, useCallback, useMemo } from 'react';
import FileUpload from './FileUpload';
import FileList from './FileList';
import HonorHistoryChart from './HonorHistoryChart';
import HonorOverviewTable from './HonorOverviewTable';
import HonorPlayerSearch from './HonorPlayerSearch';
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
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [startFileId, setStartFileId] = useState<string>('zero');
  const [endFileId, setEndFileId] = useState<string>('');
  const [comparisonStats, setComparisonStats] = useState<HonorComparisonStats | null>(
    null
  );
  const [comparisonError, setComparisonError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<HonorPlayerInfo[] | 'not_found' | null>(
    null
  );
  const [selectedPlayerHistory, setSelectedPlayerHistory] =
    useState<PlayerHonorHistory | null>(null);

  // Daten sind geladen wenn Dateien vorhanden sind
  const isDataLoaded = uploadedFiles.length > 0;

  const fetchFiles = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`${backendUrl}/honor/files-data`);
      if (!res.ok) throw new Error(`Server responded with status ${res.status}`);
      const data: UploadedFile[] = await res.json();
      setUploadedFiles(data);
    } catch (err) {
      console.error('Error loading honor file data:', err);
      setError(
        'Error loading honor file data. Please ensure the backend server is running and accessible.'
      );
    } finally {
      setIsLoading(false);
    }
  }, [backendUrl]);

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  const handleUploadComplete = () => fetchFiles();

  const handleDeleteFile = async (id: string) => {
    try {
      const response = await fetch(`${backendUrl}/honor/files/${id}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to delete file on server.');
      setUploadedFiles((prev) => prev.filter((f) => f.id !== id));
    } catch (err) {
      console.error('Delete error:', err);
      alert('Could not delete the file.');
    }
  };

  const handleReorderFiles = async (reorderedFiles: UploadedFile[]) => {
    setUploadedFiles(reorderedFiles); // Optimistic update
    try {
      const order = reorderedFiles.map((f) => f.id);
      await fetch(`${backendUrl}/honor/files/reorder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order }),
      });
    } catch (err) {
      console.error('Reorder error:', err);
      alert('Could not save the new file order.');
      fetchFiles(); // Revert on error
    }
  };

  const parseRow = useCallback((row: any[], headers: string[]): HonorPlayerInfo => {
    const getVal = (keywords: string[]) => {
      const index = findColumnIndex(headers, keywords);
      return index !== undefined ? row[index] : 0;
    };
    const getString = (keywords: string[]) => {
      const index = findColumnIndex(headers, keywords);
      return index !== undefined ? String(row[index] ?? '') : '';
    };
    return {
      governorId: getString(['governorid', 'id']),
      name: getString(['name']),
      honorPoint: parseGermanNumber(getVal(['honor', 'honour', 'points'])),
    };
  }, []);

  const handleCompare = useCallback(() => {
    setComparisonError(null);

    if (!endFileId) {
      setComparisonStats(null);
      return;
    }

    const endFile = uploadedFiles.find((f) => f.id === endFileId);
    if (!endFile) {
      setComparisonError('End file not found.');
      return;
    }
    const endData = endFile.data.map((row) => parseRow(row, endFile.headers));

    let startDataMap = new Map<string, HonorPlayerInfo>();
    if (startFileId !== 'zero') {
      const startFile = uploadedFiles.find((f) => f.id === startFileId);
      if (startFile) {
        const startData = startFile.data.map((row) => parseRow(row, startFile.headers));
        startDataMap = new Map(startData.map((p) => [p.governorId, p]));
      } else {
        setComparisonError('Start file not found, but "Start from Zero" was not selected.');
        return;
      }
    }

    const playerHonorChanges: PlayerHonorChange[] = [];
    endData.forEach((p_end) => {
      const p_start = startDataMap.get(p_end.governorId);
      const oldHonor = p_start ? p_start.honorPoint : 0;
      playerHonorChanges.push({
        governorId: p_end.governorId,
        name: p_end.name,
        oldHonor: oldHonor,
        newHonor: p_end.honorPoint,
        diffHonor: p_end.honorPoint - oldHonor,
      });
    });

    setComparisonStats({ playerHonorChanges });
  }, [startFileId, endFileId, uploadedFiles, parseRow]);

  useEffect(() => {
    handleCompare();
  }, [handleCompare]);

  const playerHistories = useMemo(() => {
    const histories = new Map<string, PlayerHonorHistory>();
    uploadedFiles.forEach((file) => {
      const players = file.data.map((row) => parseRow(row, file.headers));
      players.forEach((player) => {
        if (!histories.has(player.governorId)) {
          histories.set(player.governorId, {
            id: player.governorId,
            name: player.name,
            history: [],
          });
        }
        const historyEntry = histories.get(player.governorId)!;
        historyEntry.name = player.name;
        historyEntry.history.push({
          fileName: cleanFileName(file.name),
          honorPoint: player.honorPoint,
        });
      });
    });
    return Array.from(histories.values());
  }, [uploadedFiles, parseRow]);

  const allPlayersLatest = useMemo(() => {
    const latestPlayers = new Map<string, HonorPlayerInfo>();
    uploadedFiles.forEach((file) => {
      const players = file.data.map((row) => parseRow(row, file.headers));
      players.forEach((player) => {
        latestPlayers.set(player.governorId, player);
      });
    });
    return Array.from(latestPlayers.values());
  }, [uploadedFiles, parseRow]);

  const handleSearch = () => {
    if (!searchQuery) return;
    const lowerCaseQuery = searchQuery.toLowerCase();

    const exactIdMatch = playerHistories.find((p) => p.id === searchQuery);
    if (exactIdMatch) {
      setSelectedPlayerHistory(exactIdMatch);
      setSearchResults(null);
      return;
    }

    const nameMatches = allPlayersLatest.filter((p) =>
      p.name.toLowerCase().includes(lowerCaseQuery)
    );

    if (nameMatches.length === 1) {
      const history = playerHistories.find((p) => p.id === nameMatches[0].governorId);
      if (history) {
        setSelectedPlayerHistory(history);
        setSearchResults(null);
      } else {
        setSearchResults('not_found');
        setSelectedPlayerHistory(null);
      }
    } else if (nameMatches.length > 1) {
      setSearchResults(nameMatches);
      setSelectedPlayerHistory(null);
    } else {
      setSearchResults('not_found');
      setSelectedPlayerHistory(null);
    }
  };

  const handleSelectPlayer = (player: HonorPlayerInfo) => {
    const history = playerHistories.find((p) => p.id === player.governorId);
    if (history) {
      setSelectedPlayerHistory(history);
      setSearchResults(null);
    }
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    setSearchResults(null);
    setSelectedPlayerHistory(null);
  };

  if (isLoading) return <div className="text-center p-8">Loading files...</div>;
  if (error) {
    return (
      <div className="text-center p-4 text-red-400 bg-red-900/50 rounded-lg">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {isAdmin && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
          <div className="bg-gray-800 p-6 rounded-xl shadow-lg">
            <FileUpload
              uploadUrl={`${backendUrl}/honor/upload`}
              onUploadComplete={handleUploadComplete}
            />
          </div>
          <div className="bg-gray-800 p-6 rounded-xl shadow-lg">
            <FileList
              files={uploadedFiles}
              onDeleteFile={handleDeleteFile}
              onReorder={handleReorderFiles}
            />
          </div>
        </div>
      )}

      {/* NEUE REIHENFOLGE: 1. KD 3619 Honor History */}
      <HonorHistoryChart files={uploadedFiles} />

      {/* 2. Comparison Controls */}
      <div className="bg-gray-800 p-6 rounded-xl shadow-lg">
        <h3 className="text-lg font-semibold text-gray-200 mb-4">Comparison Controls</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
          <div className="flex flex-col">
            <label
              htmlFor="start-date-select-honor"
              className="text-sm font-medium text-gray-400 mb-1"
            >
              Start Date
            </label>
            <select
              id="start-date-select-honor"
              value={startFileId}
              onChange={(e) => setStartFileId(e.target.value)}
              className="bg-gray-700 border border-gray-600 text-white text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5"
            >
              <option value="zero">-- Start from Zero --</option>
              {uploadedFiles.map((file) => (
                <option key={file.id} value={file.id} disabled={file.id === endFileId}>
                  {cleanFileName(file.name)}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col">
            <label
              htmlFor="end-date-select-honor"
              className="text-sm font-medium text-gray-400 mb-1"
            >
              End Date
            </label>
            <select
              id="end-date-select-honor"
              value={endFileId}
              onChange={(e) => setEndFileId(e.target.value)}
              className="bg-gray-700 border border-gray-600 text-white text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5"
            >
              <option value="">Select End File</option>
              {uploadedFiles.map((file) => (
                <option key={file.id} value={file.id} disabled={file.id === startFileId}>
                  {cleanFileName(file.name)}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* 3. Find Player */}
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

      {/* 4. Honor Ranking */}
      <HonorOverviewTable
        stats={comparisonStats}
        error={comparisonError}
        startFileName={
          startFileId === 'zero'
            ? 'Start from Zero'
            : cleanFileName(uploadedFiles.find((f) => f.id === startFileId)?.name ?? '')
        }
        endFileName={cleanFileName(
          uploadedFiles.find((f) => f.id === endFileId)?.name ?? ''
        )}
      />
    </div>
  );
};

export default HonorDashboard;