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
  publicSlug: string | null; // FÜR ÖFFENTLICHEN ZUGRIFF
  isAdminOverride: boolean; // <<< NEU: ADMIN OVERRIDE FLAG
}

const HonorDashboard: React.FC<HonorDashboardProps> = ({
  isAdmin,
  backendUrl,
  publicSlug,
  isAdminOverride,
}) => {
  const { user } = useAuth();
  const role = user?.role;
  const isBasicUser = role === 'user';
  
  // Logik: isPublicView ist true, wenn Slug da und kein User eingeloggt ist
  const isPublicView = !!publicSlug && !user; 
  // Logik: canManageFiles ist true, wenn Admin Override ODER reguläre Admin/R5/R4 Rolle
  const canManageFiles = isAdminOverride || (!isPublicView && (isAdmin || role === 'r4' || role === 'r5')); 
  const isMinimalView = isPublicView || isBasicUser; // Zeigt nur Chart/kein Management

  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [startFileId, setStartFileId] = useState<string>('');
  const [endFileId, setEndFileId] = useState<string>('');
  const [comparisonStats, setComparisonStats] =
    useState<HonorComparisonStats | null>(null);
  const [comparisonError, setComparisonError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchResults, setSearchResults] = useState<
    HonorPlayerInfo[] | 'not_found' | null
  >(null);
  const [selectedPlayerHistory, setSelectedPlayerHistory] =
    useState<PlayerHonorHistory | null>(null);
    
  // 🔑 NEU: Verwende atomare Werte aus dem user-Objekt für die Abhängigkeiten
  const userLoggedIn = !!user;


  // ----------------------------------------------------
  // Dateien laden (KORRIGIERT: Admin Override Fetching)
  // ----------------------------------------------------
  const fetchFiles = useCallback(async () => {
    const isFetchPublic = !!publicSlug && !userLoggedIn;
    const isFetchOverride = isAdminOverride && !!publicSlug; 

    if ((isFetchPublic || isFetchOverride) && !publicSlug) {
        setError('Kingdom slug is missing.');
        setIsLoading(false);
        return;
    }

    try {
      setIsLoading(true);
      setError(null);
      let response: Response;
      
      if (isFetchPublic || isFetchOverride) {
        // 1. Öffentlicher Modus ODER Admin Override: Nutze public API mit Slug
        const targetSlug = publicSlug;
        const publicUrl = `${backendUrl}/api/public/kingdom/${targetSlug}/honor-files`;
        response = await fetch(publicUrl);
        
      } else {
        // 2. Privater Modus (eingeloggter R5/R4/Basic User): Nutze geschützten Token-Endpunkt
        const token = localStorage.getItem('authToken');
        
        if (!token) {
          throw new Error('Authentication token not found. Please log in.');
        }
        
        // Diese Route geht zum Backend, das nach der zugewiesenen kingdomId filtert.
        response = await fetch(`${backendUrl}/honor/files-data`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
      }


      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to fetch files from server (${response.status}).`);
      }
      
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
    } catch (err: any) {
      console.error(err);
      const message = err.message || 'Error loading files from server.';
      if ((isFetchPublic || isFetchOverride) && (message.includes('403') || message.includes('404') || message.includes('No data found'))) {
          setError('No data found for this Kingdom slug.');
      } else {
          setError(message);
      }
    } finally {
      setIsLoading(false);
    }
  }, [backendUrl, publicSlug, userLoggedIn, isAdminOverride]); // isPublicView entfernt, da vom parent abgeleitet

  useEffect(() => {
    fetchFiles();
    if (uploadedFiles.length > 0) {
        handleCompare();
    }
  }, [fetchFiles]);

  const handleUploadComplete = () => {
    fetchFiles();
  };

  const handleDeleteFile = async (id: string) => {
    if (!canManageFiles) return; 

    try {
      const token = localStorage.getItem('authToken');
      if (!token) throw new Error('Authentication token missing.');
      
      const response = await fetch(`${backendUrl}/honor/files/${id}`, {
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
    if (!canManageFiles) return; 
    
    setUploadedFiles(reorderedFiles);
    try {
      const token = localStorage.getItem('authToken');
      if (!token) throw new Error('Authentication token missing.');

      const order = reorderedFiles.map((f) => f.id);
      await fetch(`${backendUrl}/honor/files/reorder`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ order }),
      });
    } catch (err) {
      console.error('Failed to persist honor file order', err);
    }
  };

  // ----------------------------------------------------
  // Helfer: UploadedFile -> HonorPlayerInfo[] (unverändert)
  // ...
  // ----------------------------------------------------
  const extractHonorPlayersFromFile = useCallback(
    (file: UploadedFile): HonorPlayerInfo[] => {
      if (!file || !file.headers || !file.data) return [];

      const headers = (file.headers || []).map((h) => String(h));
      const findIdx = (names: string[]) => findColumnIndex(headers, names);

      const idxGovernorId = findIdx(['governorid', 'governor id', 'id']);
      const idxName = findIdx(['name', 'playername', 'player name']);
      const idxHonor = findIdx(['honor', 'honour', 'honor points', 'points']);

      if (idxGovernorId == null || idxName == null || idxHonor == null) {
        console.warn(`Missing required columns in honor file: ${file.name}`);
        return [];
      }

      const getVal = (row: any[], idx: number | undefined): string =>
        idx != null && idx >= 0 && idx < row.length && row[idx] != null
          ? String(row[idx]).trim()
          : '';

      const players: HonorPlayerInfo[] = [];

      for (const row of file.data) {
        const governorId = getVal(row, idxGovernorId);
        const name = getVal(row, idxName);
        if (!governorId || !name) continue;

        const honorPoint = parseGermanNumber(getVal(row, idxHonor));

        players.push({
          governorId,
          name,
          honorPoint,
        });
      }

      return players;
    },
    []
  );

  // ----------------------------------------------------
  // Vergleich: HonorComparisonStats (zwei Snapshots)
  // ...
  // ----------------------------------------------------
  const handleCompare = useCallback(() => { /* ... */ }, [startFileId, endFileId, uploadedFiles, extractHonorPlayersFromFile]);
  useEffect(() => { /* ... */ }, [endFileId, uploadedFiles, handleCompare]);


  // ----------------------------------------------------
  // Honor-Historie für Spielersuche (über alle Files)
  // ...
  // ----------------------------------------------------
  const honorHistories = useMemo(() => { /* ... */ return new Map(); }, [uploadedFiles, extractHonorPlayersFromFile]);
  const allPlayersForSearch: HonorPlayerInfo[] = useMemo(() => { /* ... */ return []; }, [honorHistories]);
  const isSearchDataLoaded = uploadedFiles.length > 0; 


  // ----------------------------------------------------
  // Spielersuche
  // ----------------------------------------------------
  const handleSearch = () => { /* ... */ };
  const handleClearSearch = () => { /* ... */ };
  const handleSelectPlayer = (player: HonorPlayerInfo | null) => { /* ... */ };


  // ----------------------------------------------------
  // RENDER LOGIC
  // ----------------------------------------------------
  
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
  
  const startFileName = uploadedFiles.find((f) => f.id === startFileId)?.name; 
  const endFileName = uploadedFiles.find((f) => f.id === endFileId)?.name; 

  if (isMinimalView) {
      return (
          <div className="space-y-8">
              {/* Chart ist Teil der Minimal View */}
              <div className="bg-gray-800 p-6 rounded-xl shadow-lg">
                  <HonorHistoryChart files={uploadedFiles || []} />
              </div>
              {/* Suche ist Teil der Minimal View */}
              <HonorPlayerSearch
                  query={searchQuery}
                  setQuery={setSearchQuery}
                  onSearch={handleSearch}
                  onClear={handleClearSearch}
                  results={searchResults}
                  selectedPlayerHistory={selectedPlayerHistory}
                  onSelectPlayer={handleSelectPlayer}
                  isDataLoaded={isSearchDataLoaded}
              />
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


  return (
    <div className="space-y-8">
      {/* Upload + File list – nur für R4, R5 & Admin */}
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
              onDeleteFile={handleDeleteFile}
              onReorder={handleReorderFiles}
            />
          </div>
        </div>
      )}

      <div className="bg-gray-800 p-6 rounded-xl shadow-lg">
        <HonorHistoryChart files={uploadedFiles || []} />
      </div>

      {/* Vergleichs-Auswahl */}
      <div className="bg-gray-800 p-6 rounded-xl shadow-lg">
        <h3 className="text-lg font-semibold text-gray-200 mb-4">
          Honor Comparison Controls
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
          <div className="flex flex-col">
            <label
              htmlFor="start-date-select-honor"
              className="text-sm font-medium text-gray-400 mb-1"
            >
              Start Snapshot
            </label>
            <select
              id="start-date-select-honor"
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
              htmlFor="end-date-select-honor"
              className="text-sm font-medium text-gray-400 mb-1"
            >
              End Snapshot
            </label>
            <select
              id="end-date-select-honor"
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
        </div>
      </div>

      {/* Spielersuche + Verlauf */}
      <HonorPlayerSearch
        query={searchQuery}
        setQuery={setSearchQuery}
        onSearch={handleSearch}
        onClear={handleClearSearch}
        results={searchResults}
        selectedPlayerHistory={selectedPlayerHistory}
        onSelectPlayer={handleSelectPlayer}
        isDataLoaded={isSearchDataLoaded}
      />

      {/* Honor-Übersicht / Ranking */}
      <HonorOverviewTable
        stats={comparisonStats}
        error={comparisonError}
        startFileName={startFileName ? cleanFileName(startFileName) : undefined}
        endFileName={endFileName ? cleanFileName(endFileName) : undefined}
      />
    </div>
  );
};

export default HonorDashboard;