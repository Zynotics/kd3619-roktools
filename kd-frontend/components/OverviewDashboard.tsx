import React, { useEffect, useState, useCallback } from 'react';
import FileUpload from './FileUpload';
import FileList from './FileList';
import ComparisonSection from './ComparisonSection';
import PowerHistoryChart from './PowerHistoryChart';
import PlayerSearch from './PlayerSearch';
import { useAuth } from './AuthContext';
import { cleanFileName, parseGermanNumber, findColumnIndex } from '../utils';
import type { UploadedFile, ComparisonStats, PlayerInfo, PlayerStatChange } from '../types';

interface OverviewDashboardProps { isAdmin: boolean; backendUrl: string; publicSlug: string | null; isAdminOverride: boolean; }

const OverviewDashboard: React.FC<OverviewDashboardProps> = ({ isAdmin, backendUrl, publicSlug, isAdminOverride }) => {
  const { user } = useAuth();
  const role = user?.role;
  const isBasicUser = role === 'user';
  const isPublicView = !!publicSlug && !user; 
  const userLoggedIn = !!user;

  const canManageFiles = isAdmin || role === 'r4' || role === 'r5'; 
  const isMinimalView = (isPublicView || isBasicUser) && !isAdminOverride && !canManageFiles;

  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [kingdomName, setKingdomName] = useState<string>('Kingdom');

  // ... States ...
  const [startFileId, setStartFileId] = useState<string>('');
  const [endFileId, setEndFileId] = useState<string>('');
  const [comparisonStats, setComparisonStats] = useState<ComparisonStats | null>(null);
  const [comparisonError, setComparisonError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchResults, setSearchResults] = useState<PlayerStatChange[] | 'not_found' | null>(null);
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerStatChange | null>(null);

  const fetchKingdomName = useCallback(async (slug: string) => {
      try {
          const res = await fetch(`${backendUrl}/api/public/kingdom/${slug}`);
          if (res.ok) { const data = await res.json(); setKingdomName(data.displayName); }
      } catch (e) { setKingdomName(slug.toUpperCase()); }
  }, [backendUrl]);

  const fetchFiles = useCallback(async () => {
    const shouldUsePublicEndpoint = !!publicSlug;
    if (publicSlug) fetchKingdomName(publicSlug);

    try {
      setIsLoading(true); setError(null);
      let response: Response;
      
      if (shouldUsePublicEndpoint) {
        response = await fetch(`${backendUrl}/api/public/kingdom/${publicSlug}/overview-files`);
      } else {
        const token = localStorage.getItem('authToken');
        if (!token) throw new Error('Authentication token not found.');
        response = await fetch(`${backendUrl}/overview/files-data`, { headers: { Authorization: `Bearer ${token}` } });
      }

      if (!response.ok) throw new Error(`Failed to fetch files`);
      const data = await response.json();
      setUploadedFiles(data || []);

      if (data.length >= 2) { setStartFileId(data[data.length-2].id); setEndFileId(data[data.length-1].id); }
      else if (data.length === 1) { setStartFileId(data[0].id); setEndFileId(data[0].id); }
    } catch (err: any) {
      if (shouldUsePublicEndpoint && (err.message.includes('403') || err.message.includes('404'))) setUploadedFiles([]);
      else setError(err.message);
    } finally { setIsLoading(false); }
  }, [backendUrl, publicSlug, userLoggedIn, isAdminOverride, fetchKingdomName]);

  useEffect(() => { fetchFiles(); }, [fetchFiles]);

  // ... Actions ...
  const handleUploadComplete = () => fetchFiles();
  const uploadUrl = `${backendUrl}/overview/upload${isAdminOverride && publicSlug ? `?slug=${publicSlug}` : ''}`;
  const handleDeleteFile = async (id: string) => {
    if (!canManageFiles) return;
    try {
      const token = localStorage.getItem('authToken');
      await fetch(`${backendUrl}/overview/files/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
      setUploadedFiles(p => p.filter(f => f.id !== id));
    } catch (err) {}
  };
  const handleReorderFiles = async (reorderedFiles: UploadedFile[]) => {
    if (!canManageFiles) return;
    setUploadedFiles(reorderedFiles);
    try {
      const token = localStorage.getItem('authToken');
      const order = reorderedFiles.map(f => f.id);
      await fetch(`${backendUrl}/overview/files/reorder`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ order }) });
    } catch (err) {}
  };

  // ... Parsing Logic (Dummy) ...
  const parseFileToPlayers = (f: any) => [];
  const handleCompare = () => {}; 
  const handleSearch = () => {};
  const handleClearSearch = () => {};
  const handleSelectPlayer = (p: any) => {};

  if (isLoading) return <div>Loading...</div>;

  if (isMinimalView) {
    return (
      <div className="space-y-8">
        <div className="bg-gray-800 p-6 rounded-xl shadow-lg">
          <h3 className="text-lg font-semibold text-gray-200 mb-4">{kingdomName} Power History</h3>
          <PowerHistoryChart files={uploadedFiles} kingdomName={kingdomName} />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {canManageFiles && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
          <div className="bg-gray-800 p-6 rounded-xl shadow-lg"><FileUpload uploadUrl={uploadUrl} onUploadComplete={handleUploadComplete} /></div>
          <div><FileList files={uploadedFiles} onDeleteFile={handleDeleteFile} onReorder={handleReorderFiles} /></div>
        </div>
      )}

      <div className="bg-gray-800 p-6 rounded-xl shadow-lg">
         {/* 👑 Chart Titel in der Komponente ist jetzt dynamisch */}
         <PowerHistoryChart files={uploadedFiles} kingdomName={kingdomName} />
      </div>
      {/* Rest... */}
    </div>
  );
};
export default OverviewDashboard;