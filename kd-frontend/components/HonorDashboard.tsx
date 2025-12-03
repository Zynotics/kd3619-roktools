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
  publicSlug: string | null;
  isAdminOverride: boolean;
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
  
  const isPublicView = !!publicSlug && !user; 
  const canManageFiles = isAdminOverride || (!isPublicView && (isAdmin || role === 'r4' || role === 'r5')); 
  // Honor Dashboard: Minimal View ist nicht nötig, da Public User alles sehen sollen (außer Uploads)

  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [kingdomName, setKingdomName] = useState<string>('Honor Ranking');

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
    
  const userLoggedIn = !!user;

  // --- Helper: Titel laden ---
  const fetchKingdomName = useCallback(async (slug: string) => {
    try {
        const res = await fetch(`${backendUrl}/api/public/kingdom/${slug}`);
        if (res.ok) {
            const data = await res.json();
            setKingdomName(data.displayName + ' Honor');
        }
    } catch (e) { setKingdomName(slug.toUpperCase() + ' HONOR'); }
  }, [backendUrl]);


  // ----------------------------------------------------
  // Dateien laden
  // ----------------------------------------------------
  const fetchFiles = useCallback(async () => {
    const isFetchPublic = !!publicSlug && !userLoggedIn;
    const isFetchOverride = isAdminOverride && !!publicSlug; 
    
    if (publicSlug) fetchKingdomName(publicSlug);
    else setKingdomName('Honor Ranking');

    if ((isFetchPublic || isFetchOverride) && !publicSlug) {
        setError('Slug missing'); setIsLoading(false); return;
    }

    try {
      setIsLoading(true); setError(null);
      let response: Response;
      
      if (isFetchPublic || isFetchOverride) {
        response = await fetch(`${backendUrl}/api/public/kingdom/${publicSlug}/honor-files`);
      } else {
        const token = localStorage.getItem('authToken');
        if (!token) throw new Error('Auth missing');
        response = await fetch(`${backendUrl}/honor/files-data`, {
          headers: { Authorization: `Bearer ${token}` },
        });
      }

      if (!response.ok) throw new Error('Fetch failed');
      const data = await response.json();
      setUploadedFiles(data || []);

      if (data.length >= 2) {
        setStartFileId(data[data.length - 2].id);
        setEndFileId(data[data.length - 1].id);
      } else if (data.length === 1) {
        setStartFileId(data[0].id);
        setEndFileId(data[0].id);
      }
    } catch (err: any) {
      const msg = err.message;
      if ((isFetchPublic || isFetchOverride) && (msg.includes('404') || msg.includes('403'))) setUploadedFiles([]);
      else setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, [backendUrl, publicSlug, userLoggedIn, isAdminOverride, fetchKingdomName]); 

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  useEffect(() => {
     if (endFileId && uploadedFiles.length > 0) handleCompare();
  }, [endFileId, uploadedFiles]); // handleCompare wird unten definiert

  // --- Upload / Delete / Reorder ---
  const uploadUrl = `${backendUrl}/honor/upload${isAdminOverride && publicSlug ? `?slug=${publicSlug}` : ''}`;
  
  const handleUploadComplete = () => fetchFiles();

  const handleDeleteFile = async (id: string) => {
    if (!canManageFiles) return;
    try {
        const token = localStorage.getItem('authToken');
        await fetch(`${backendUrl}/honor/files/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
        setUploadedFiles(p => p.filter(f => f.id !== id));
    } catch (e) { console.error(e); }
  };

  const handleReorderFiles = async (reorderedFiles: UploadedFile[]) => {
    if (!canManageFiles) return;
    setUploadedFiles(reorderedFiles);
    try {
        const token = localStorage.getItem('authToken');
        const order = reorderedFiles.map(f => f.id);
        await fetch(`${backendUrl}/honor/files/reorder`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ order }) });
    } catch (e) { console.error(e); }
  };

  // --- Parsing Helpers ---
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
      if (!eFile) return;

      const sP = sFile ? extractHonorPlayersFromFile(sFile) : [];
      const eP = extractHonorPlayersFromFile(eFile);
      const mapS = new Map(sP.map(p => [p.governorId, p]));
      const mapE = new Map(eP.map(p => [p.governorId, p]));
      const changes: PlayerHonorChange[] = [];
      
      new Set([...mapS.keys(), ...mapE.keys()]).forEach(id => {
          const s = mapS.get(id);
          const e = mapE.get(id);
          changes.push({
              governorId: id,
              name: (e || s)?.name || '',
              oldHonor: s?.honorPoint || 0,
              newHonor: e?.honorPoint || 0,
              diffHonor: (e?.honorPoint || 0) - (s?.honorPoint || 0)
          });
      });
      setComparisonStats({ playerHonorChanges: changes });
  }, [startFileId, endFileId, uploadedFiles, extractHonorPlayersFromFile]);


  // --- Search Logic ---
  const honorHistories = useMemo(() => {
      const map = new Map<string, PlayerHonorHistory>();
      [...uploadedFiles].sort((a,b) => new Date(a.uploadDate).getTime() - new Date(b.uploadDate).getTime())
        .forEach(f => {
            extractHonorPlayersFromFile(f).forEach(p => {
                let h = map.get(p.governorId);
                if (!h) { h = { id: p.governorId, name: p.name, history: [] }; map.set(p.governorId, h); }
                h.name = p.name;
                h.history.push({ fileName: cleanFileName(f.name), honorPoint: p.honorPoint });
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
  
  const handleSelectPlayer = (p: HonorPlayerInfo) => {
      setSelectedPlayerHistory(honorHistories.get(p.governorId) || null);
      setSearchResults(null);
  };

  // --- RENDER ---
  if (isLoading) return <div className="p-6 text-center text-gray-300">Loading...</div>;

  return (
    <div className="space-y-8">
      {error && <div className="text-center text-red-400 p-4 bg-red-900/50 rounded-lg">{error}</div>}
      
      {canManageFiles && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
          <div className="bg-gray-800 p-6 rounded-xl shadow-lg">
             <FileUpload uploadUrl={uploadUrl} onUploadComplete={handleUploadComplete} />
          </div>
          <div>
             <FileList files={uploadedFiles} onDeleteFile={handleDeleteFile} onReorder={handleReorderFiles} />
          </div>
        </div>
      )}

      <div className="bg-gray-800 p-6 rounded-xl shadow-lg">
        <h3 className="text-lg font-semibold text-gray-200 mb-4">{kingdomName} History</h3>
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
         query={searchQuery} setQuery={setSearchQuery} onSearch={handleSearch} onClear={() => { setSearchQuery(''); setSearchResults(null); setSelectedPlayerHistory(null); }}
         results={searchResults} selectedPlayerHistory={selectedPlayerHistory} onSelectPlayer={handleSelectPlayer} isDataLoaded={uploadedFiles.length > 0}
      />

      <HonorOverviewTable 
         stats={comparisonStats} error={comparisonError}
         startFileName={cleanFileName(uploadedFiles.find(f => f.id === startFileId)?.name || '')}
         endFileName={cleanFileName(uploadedFiles.find(f => f.id === endFileId)?.name || '')}
      />
    </div>
  );
};

export default HonorDashboard;