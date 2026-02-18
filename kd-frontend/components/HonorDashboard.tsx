import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import FileUpload from './FileUpload';
import FileList from './FileList';
import HonorHistoryChart from './HonorHistoryChart';
import HonorOverviewTable from './HonorOverviewTable';
import HonorPlayerSearch from './HonorPlayerSearch';
import { useAuth } from '../components/AuthContext';
import { cleanFileName, findColumnIndex, parseGermanNumber, sortUploadedFilesByUploadDateAsc, mergeNewUploadsOnTop, hasSameFileOrder } from '../utils';
import type { UploadedFile, HonorPlayerInfo, PlayerHonorChange, HonorComparisonStats, PlayerHonorHistory } from '../types';

interface HonorDashboardProps { isAdmin: boolean; backendUrl: string; publicSlug: string | null; isAdminOverride: boolean; }

const HonorDashboard: React.FC<HonorDashboardProps> = ({ isAdmin, backendUrl, publicSlug, isAdminOverride }) => {
  const { user } = useAuth();
  const role = user?.role;
  
  const canManageFiles =
    isAdmin ||
    role === 'r5' ||
    (role === 'r4' && (user?.canManageAnalyticsFiles || user?.canManageHonorFiles));

  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const uploadedFilesRef = useRef<UploadedFile[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [startFileId, setStartFileId] = useState<string>('');
  const [endFileId, setEndFileId] = useState<string>('');
  const selectedRangeRef = useRef<{ start: string; end: string }>({ start: '', end: '' });
  const [comparisonStats, setComparisonStats] = useState<HonorComparisonStats | null>(null);
  const [comparisonError, setComparisonError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchResults, setSearchResults] = useState<HonorPlayerInfo[] | 'not_found' | null>(null);
  const [selectedPlayerHistory, setSelectedPlayerHistory] = useState<PlayerHonorHistory | null>(null);

  useEffect(() => {
    uploadedFilesRef.current = uploadedFiles;
  }, [uploadedFiles]);

  useEffect(() => {
    selectedRangeRef.current = { start: startFileId, end: endFileId };
  }, [startFileId, endFileId]);

  const selectionStorageKey = useMemo(() => {
    const scope = publicSlug || user?.kingdomId || user?.id || 'global';
    return `honor_dashboard_selection:${scope}`;
  }, [publicSlug, user?.kingdomId, user?.id]);

  useEffect(() => {
    if (!startFileId && !endFileId) return;
    localStorage.setItem(
      selectionStorageKey,
      JSON.stringify({ startFileId, endFileId })
    );
  }, [startFileId, endFileId, selectionStorageKey]);


  const fetchFiles = useCallback(async (options?: { placeNewUploadsOnTop?: boolean }) => {
    const shouldUsePublic = !!publicSlug;
    const adminSlugQuery = isAdminOverride && publicSlug ? `?slug=${publicSlug}` : '';

    try {
      setIsLoading(true); setError(null);
      let response: Response;
      if (shouldUsePublic) {
        response = await fetch(`${backendUrl}/api/public/kingdom/${publicSlug}/honor-files`);
      } else {
        const token = localStorage.getItem('authToken');
        if (!token) throw new Error('Authentication token not found.');
        response = await fetch(`${backendUrl}/honor/files-data${adminSlugQuery}`, { headers: { Authorization: `Bearer ${token}` } });
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        // HIER FEHLTE die 404/403 Prüfung für Public Pages, was zur Blockade führen konnte.
        if (shouldUsePublic && (response.status === 404 || response.status === 403)) { setUploadedFiles([]); return; }
        throw new Error(errorData.error || 'Fetch failed');
      }
      const data = await response.json();
      const fetchedFiles = data || [];
      const nextFiles = options?.placeNewUploadsOnTop
        ? mergeNewUploadsOnTop(uploadedFilesRef.current, fetchedFiles)
        : fetchedFiles;

      if (
        options?.placeNewUploadsOnTop &&
        canManageFiles &&
        !hasSameFileOrder(nextFiles, fetchedFiles)
      ) {
        const token = localStorage.getItem('authToken');
        if (token) {
          await fetch(`${backendUrl}/honor/files/reorder${adminSlugQuery}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ order: nextFiles.map((f: UploadedFile) => f.id) }),
          });
        }
      }

      setUploadedFiles(nextFiles);
      const defaultSelection =
        nextFiles.length >= 2
          ? { startFileId: nextFiles[1].id, endFileId: nextFiles[0].id }
          : nextFiles.length === 1
            ? { startFileId: nextFiles[0].id, endFileId: nextFiles[0].id }
            : { startFileId: '', endFileId: '' };

      const fileIds = new Set(nextFiles.map((f) => f.id));
      const currentSelection = selectedRangeRef.current;
      const hasValidCurrentSelection =
        !!currentSelection.start &&
        !!currentSelection.end &&
        fileIds.has(currentSelection.start) &&
        fileIds.has(currentSelection.end);

      let persistedSelection: { startFileId?: string; endFileId?: string } = {};
      try {
        const raw = localStorage.getItem(selectionStorageKey);
        if (raw) persistedSelection = JSON.parse(raw);
      } catch {
        persistedSelection = {};
      }

      const hasValidPersistedSelection =
        !!persistedSelection.startFileId &&
        !!persistedSelection.endFileId &&
        fileIds.has(persistedSelection.startFileId) &&
        fileIds.has(persistedSelection.endFileId);

      if (hasValidCurrentSelection) {
        setStartFileId(currentSelection.start);
        setEndFileId(currentSelection.end);
      } else if (hasValidPersistedSelection) {
        setStartFileId(persistedSelection.startFileId!);
        setEndFileId(persistedSelection.endFileId!);
      } else {
        setStartFileId(defaultSelection.startFileId);
        setEndFileId(defaultSelection.endFileId);
      }
    } catch (err: any) {
       setError(err.message);
    } finally { setIsLoading(false); }
  }, [backendUrl, publicSlug, isAdminOverride, canManageFiles, selectionStorageKey]);

  useEffect(() => { fetchFiles(); }, [fetchFiles]);

  const extractHonorPlayersFromFile = useCallback((file: UploadedFile): HonorPlayerInfo[] => {
      if (!file || !file.headers || !file.data) return [];
      const headers = file.headers.map(h => String(h));
      const idxId = findColumnIndex(headers, ['governorid', 'governor id', 'id']);
      const idxName = findColumnIndex(headers, ['name', 'playername']);
      const idxHonor = findColumnIndex(headers, ['honor', 'honour', 'points']);
      if (idxId == null || idxName == null || idxHonor == null) return [];

      const res: HonorPlayerInfo[] = [];
      file.data.forEach(row => {
          const id = String(row[idxId] || '').trim();
          const name = String(row[idxName] || '').trim();
          if (id && name) {
              res.push({ governorId: id, name, honorPoint: parseGermanNumber(String(row[idxHonor])) });
          }
      });
      return res;
  }, []);

  const handleCompare = useCallback(() => {
      if (!endFileId) return;
      const sFile = uploadedFiles.find(f => f.id === startFileId);
      const eFile = uploadedFiles.find(f => f.id === endFileId);
      if (!eFile) { setComparisonStats(null); setComparisonError('End Snapshot not found.'); return; }
      
      const sP = sFile ? extractHonorPlayersFromFile(sFile) : [];
      const eP = extractHonorPlayersFromFile(eFile);
      const mapS = new Map(sP.map(p => [p.governorId, p]));
      const mapE = new Map(eP.map(p => [p.governorId, p]));
      const changes: PlayerHonorChange[] = [];
      
      new Set([...mapS.keys(), ...mapE.keys()]).forEach(id => {
          const s = mapS.get(id);
          const e = mapE.get(id);
          changes.push({
              governorId: id, name: (e || s)?.name || '', oldHonor: s?.honorPoint || 0, newHonor: e?.honorPoint || 0, diffHonor: (e?.honorPoint || 0) - (s?.honorPoint || 0)
          });
      });
      setComparisonStats({ playerHonorChanges: changes });
      setComparisonError(null);
  }, [startFileId, endFileId, uploadedFiles, extractHonorPlayersFromFile]);

  useEffect(() => { if (endFileId) handleCompare(); }, [endFileId, uploadedFiles, handleCompare]);

  const honorHistories = useMemo(() => {
      const map = new Map<string, PlayerHonorHistory>();
      [...uploadedFiles].sort((a,b) => new Date(a.uploadDate).getTime() - new Date(b.uploadDate).getTime()).forEach(f => {
            extractHonorPlayersFromFile(f).forEach(p => {
                let h = map.get(p.governorId);
                if (!h) { h = { id: p.governorId, name: p.name, history: [] }; map.set(p.governorId, h); }
                h.name = p.name; h.history.push({ fileName: cleanFileName(f.name), honorPoint: p.honorPoint });
            });
        });
      return map;
  }, [uploadedFiles, extractHonorPlayersFromFile]);

  const handleSearch = () => {
      if (!searchQuery.trim()) { setSearchResults(null); setSelectedPlayerHistory(null); return; }
      const q = searchQuery.toLowerCase();
      const res = Array.from(honorHistories.values()).filter(h => h.name.toLowerCase().includes(q) || h.id.toLowerCase().includes(q));
      if (res.length === 0) setSearchResults('not_found');
      else if (res.length === 1) { setSelectedPlayerHistory(res[0]); setSearchResults(null); }
      else setSearchResults(res.map(h => ({ governorId: h.id, name: h.name, honorPoint: h.history[h.history.length-1].honorPoint })));
  };
  
  const handleClearSearch = () => { setSearchQuery(''); setSearchResults(null); setSelectedPlayerHistory(null); };
  const handleSelectPlayer = (player: HonorPlayerInfo) => { setSelectedPlayerHistory(honorHistories.get(player.governorId) || null); setSearchResults(null); };

  const uploadUrl = `${backendUrl}/honor/upload${isAdminOverride && publicSlug ? `?slug=${publicSlug}` : ''}`;
  const handleUploadComplete = async () => { await fetchFiles({ placeNewUploadsOnTop: true }); };
  
  const handleDeleteFile = async (id: string) => {
      if(!canManageFiles) return;
      try {
          const token = localStorage.getItem('authToken');
          await fetch(`${backendUrl}/honor/files/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
          setUploadedFiles(p => p.filter(f => f.id !== id));
      } catch(e) { console.error('Delete failed', e); }
  };

  const handleReorderFiles = async (files: UploadedFile[]) => {
      if(!canManageFiles) return;
      setUploadedFiles(files);
      try {
          const token = localStorage.getItem('authToken');
          const order = files.map(f => f.id);
          await fetch(`${backendUrl}/honor/files/reorder`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ order }) });
      } catch(e) { console.error('Reorder failed', e); }
  };


  if (isLoading) return <div>Loading...</div>;

  return (
    <div className="space-y-8">
      {error && <div className="text-center text-red-400 p-4 bg-red-900/50 rounded-lg">{error}</div>}
      
      {canManageFiles && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
          <div className="bg-gray-800 p-6 rounded-xl shadow-lg"><FileUpload uploadUrl={uploadUrl} onUploadComplete={handleUploadComplete} /></div>
          <div><FileList files={uploadedFiles} onDeleteFile={handleDeleteFile} onReorder={handleReorderFiles} /></div>
        </div>
      )}

      <div className="bg-gray-800 p-6 rounded-xl shadow-lg">
        <HonorHistoryChart files={uploadedFiles} />
      </div>

      <div className="bg-gray-800 p-6 rounded-xl shadow-lg">
         <h3 className="text-lg font-semibold text-gray-200 mb-4">Honor Comparison</h3>
         <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
             <select value={startFileId} onChange={e => setStartFileId(e.target.value)} className="bg-gray-700 border border-gray-600 text-white text-sm rounded-lg p-2.5">
                 <option value="">Start Snapshot...</option>
                 {uploadedFiles.map(f => <option key={f.id} value={f.id}>{cleanFileName(f.name)}</option>)}
             </select>
             <select value={endFileId} onChange={e => setEndFileId(e.target.value)} className="bg-gray-700 border border-gray-600 text-white text-sm rounded-lg p-2.5">
                 <option value="">End Snapshot...</option>
                 {uploadedFiles.map(f => <option key={f.id} value={f.id}>{cleanFileName(f.name)}</option>)}
             </select>
         </div>
      </div>

      <HonorPlayerSearch 
         query={searchQuery} setQuery={setSearchQuery} onSearch={handleSearch} onClear={handleClearSearch}
         results={searchResults} selectedPlayerHistory={selectedPlayerHistory} onSelectPlayer={handleSelectPlayer} isDataLoaded={uploadedFiles.length > 0}
      />

      <HonorOverviewTable stats={comparisonStats} error={comparisonError} startFileName={cleanFileName(uploadedFiles.find(f => f.id === startFileId)?.name || '')} endFileName={cleanFileName(uploadedFiles.find(f => f.id === endFileId)?.name || '')} />
    </div>
  );
};
export default HonorDashboard;
