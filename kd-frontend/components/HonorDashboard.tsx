import React, { useEffect, useState, useCallback, useMemo } from 'react';
import FileUpload from './FileUpload';
import FileList from './FileList';
import HonorHistoryChart from './HonorHistoryChart';
import HonorOverviewTable from './HonorOverviewTable';
import HonorPlayerSearch from './HonorPlayerSearch';
import { useAuth } from './AuthContext';
import { cleanFileName, findColumnIndex, parseGermanNumber } from '../utils';
import type { UploadedFile, HonorPlayerInfo, PlayerHonorChange, HonorComparisonStats, PlayerHonorHistory } from '../types';

interface HonorDashboardProps { isAdmin: boolean; backendUrl: string; publicSlug: string | null; isAdminOverride: boolean; }

const HonorDashboard: React.FC<HonorDashboardProps> = ({ isAdmin, backendUrl, publicSlug, isAdminOverride }) => {
  const { user } = useAuth();
  const role = user?.role;
  
  const canManageFiles = isAdmin || role === 'r4' || role === 'r5';

  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [kingdomName, setKingdomName] = useState<string>('Honor Ranking');

  const [startFileId, setStartFileId] = useState<string>('');
  const [endFileId, setEndFileId] = useState<string>('');
  const [comparisonStats, setComparisonStats] = useState<HonorComparisonStats | null>(null);
  
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchResults, setSearchResults] = useState<HonorPlayerInfo[] | 'not_found' | null>(null);
  const [selectedPlayerHistory, setSelectedPlayerHistory] = useState<PlayerHonorHistory | null>(null);

  const fetchKingdomName = useCallback(async (slug: string) => {
    try {
        const res = await fetch(`${backendUrl}/api/public/kingdom/${slug}`);
        if (res.ok) { const data = await res.json(); setKingdomName(data.displayName); } // 👑 Nur Name, "Honor" macht Chart selbst
    } catch (e) {}
  }, [backendUrl]);

  const fetchFiles = useCallback(async () => {
    const shouldUsePublic = !!publicSlug;
    if (publicSlug) fetchKingdomName(publicSlug);

    try {
      setIsLoading(true); setError(null);
      let response: Response;
      
      if (shouldUsePublic) {
        response = await fetch(`${backendUrl}/api/public/kingdom/${publicSlug}/honor-files`);
      } else {
        const token = localStorage.getItem('authToken');
        response = await fetch(`${backendUrl}/honor/files-data`, { headers: { Authorization: `Bearer ${token}` } });
      }

      if (!response.ok) throw new Error('Fetch failed');
      const data = await response.json();
      setUploadedFiles(data || []);

      if (data.length >= 2) { setStartFileId(data[data.length-2].id); setEndFileId(data[data.length-1].id); }
      else if (data.length === 1) { setStartFileId(data[0].id); setEndFileId(data[0].id); }
    } catch (err: any) {
       if (shouldUsePublic && (err.message.includes('404') || err.message.includes('403'))) setUploadedFiles([]);
       else setError(err.message);
    } finally { setIsLoading(false); }
  }, [backendUrl, publicSlug, fetchKingdomName]);

  useEffect(() => { fetchFiles(); }, [fetchFiles]);

  // --- Logic Dummies (Bitte die Originalfunktionen beibehalten!) ---
  const handleCompare = () => { /* Logik hier einfügen */ }; 
  const uploadUrl = `${backendUrl}/honor/upload${isAdminOverride && publicSlug ? `?slug=${publicSlug}` : ''}`;
  const handleUploadComplete = () => fetchFiles();
  
  const handleDeleteFile = async (id: string) => {
      if(!canManageFiles) return;
      try {
          const token = localStorage.getItem('authToken');
          await fetch(`${backendUrl}/honor/files/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
          setUploadedFiles(p => p.filter(f => f.id !== id));
      } catch(e) {}
  };
  const handleReorderFiles = async (files: UploadedFile[]) => {
      if(!canManageFiles) return;
      setUploadedFiles(files);
      try {
          const token = localStorage.getItem('authToken');
          const order = files.map(f => f.id);
          await fetch(`${backendUrl}/honor/files/reorder`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ order }) });
      } catch(e) {}
  };
  const handleSearch = () => {}; 
  const handleClearSearch = () => {};
  const handleSelectPlayer = () => {};

  if (isLoading) return <div>Loading...</div>;

  return (
    <div className="space-y-8">
      {canManageFiles && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
          <div className="bg-gray-800 p-6 rounded-xl shadow-lg"><FileUpload uploadUrl={uploadUrl} onUploadComplete={handleUploadComplete} /></div>
          <div><FileList files={uploadedFiles} onDeleteFile={handleDeleteFile} onReorder={handleReorderFiles} /></div>
        </div>
      )}

      <div className="bg-gray-800 p-6 rounded-xl shadow-lg">
        {/* 👑 Übergabe von kingdomName */}
        <HonorHistoryChart files={uploadedFiles} kingdomName={kingdomName} />
      </div>
      {/* Rest der UI... */}
    </div>
  );
};

export default HonorDashboard;