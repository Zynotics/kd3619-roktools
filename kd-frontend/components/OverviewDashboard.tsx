import React, { useEffect, useState, useCallback } from 'react';
import FileUpload from './FileUpload';
import FileList from './FileList';
import ComparisonSection from './ComparisonSection';
import PowerHistoryChart from './PowerHistoryChart';
import PlayerSearch from './PlayerSearch';
import { useAuth } from '../components/AuthContext';
import { cleanFileName, parseGermanNumber, findColumnIndex } from '../utils';
import type { UploadedFile, ComparisonStats, PlayerInfo, PlayerStatChange } from '../types';

interface OverviewDashboardProps {
  isAdmin: boolean;
  backendUrl: string;
  publicSlug: string | null;
  isAdminOverride: boolean;
}

const OverviewDashboard: React.FC<OverviewDashboardProps> = ({
  isAdmin,
  backendUrl,
  publicSlug,
  isAdminOverride,
}) => {
  const { user } = useAuth();
  const role = user?.role;
  const isBasicUser = role === 'user';
  
  const isPublicView = !!publicSlug && !user; 
  const userLoggedIn = !!user;

  const canManageFiles =
    isAdmin ||
    role === 'r5' ||
    (role === 'r4' && (user?.canManageAnalyticsFiles || user?.canManageOverviewFiles));
  
  const isMinimalView = (isPublicView || isBasicUser) && !isAdminOverride && !canManageFiles;

  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [startFileId, setStartFileId] = useState<string>('');
  const [endFileId, setEndFileId] = useState<string>('');
  const [comparisonStats, setComparisonStats] = useState<ComparisonStats | null>(
    null
  );
  const [showDownloadSection, setShowDownloadSection] = useState(false);
  const [comparisonError, setComparisonError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchResults, setSearchResults] = useState<
    PlayerStatChange[] | 'not_found' | null
  >(null);
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerStatChange | null>(
    null
  );

  // ---------------------------------------------------
  // FETCH FILES LOGIK
  // ---------------------------------------------------
  const fetchFiles = useCallback(async () => {
    const shouldUsePublicEndpoint = !!publicSlug;
    const adminSlugQuery = isAdminOverride && publicSlug ? `?slug=${publicSlug}` : '';

    try {
      setIsLoading(true);
      setError(null);
      let response: Response;
      
      if (shouldUsePublicEndpoint) {
        response = await fetch(`${backendUrl}/api/public/kingdom/${publicSlug}/overview-files`);
      } else {
        const token = localStorage.getItem('authToken');
        if (!token) throw new Error('Authentication token not found.');

        response = await fetch(`${backendUrl}/overview/files-data${adminSlugQuery}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        if (shouldUsePublicEndpoint && (response.status === 404 || response.status === 403)) { setUploadedFiles([]); return; }
        throw new Error(errorData.error || `Failed to fetch files`);
      }
      
      const data: UploadedFile[] = await response.json();
      setUploadedFiles(data || []);

      if (data.length >= 2) {
        setStartFileId(data[data.length - 2].id);
        setEndFileId(data[data.length - 1].id);
      } else if (data.length === 1) {
        setStartFileId(data[0].id);
        setEndFileId(data[0].id);
      } else {
        setStartFileId('');
        setEndFileId('');
      }
    } catch (err: any) {
      console.error(err);
      const msg = err.message || 'Error loading files.';
      if (shouldUsePublicEndpoint && (msg.includes('403') || msg.includes('404'))) {
          setUploadedFiles([]);
      } else {
          setError(msg);
      }
    } finally {
      setIsLoading(false);
    }
  }, [backendUrl, publicSlug, userLoggedIn, isAdminOverride]);

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  // ---------------------------------------------------
  // ACTIONS
  // ---------------------------------------------------
  const handleUploadComplete = () => { fetchFiles(); };
  const uploadUrl = `${backendUrl}/overview/upload${isAdminOverride && publicSlug ? `?slug=${publicSlug}` : ''}`;

  const handleDeleteFile = async (id: string) => {
    if (!canManageFiles) return;
    try {
      const token = localStorage.getItem('authToken');
      if (!token) throw new Error('Auth token missing');
      
      await fetch(`${backendUrl}/overview/files/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
      setUploadedFiles((prev) => (prev || []).filter((f) => f.id !== id));
    } catch (err) { alert('Failed to delete file.'); }
  };

  const handleReorderFiles = async (reorderedFiles: UploadedFile[]) => {
    if (!canManageFiles) return;
    setUploadedFiles(reorderedFiles);
    try {
      const token = localStorage.getItem('authToken');
      const order = reorderedFiles.map((f) => f.id);
      await fetch(`${backendUrl}/overview/files/reorder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ order }),
      });
    } catch (err) { console.error('Reorder error:', err); }
  };

  // ---------------------------------------------------
  // PARSING & COMPARISON LOGIC
  // ---------------------------------------------------
  const parseFileToPlayers = (file: UploadedFile): PlayerInfo[] => {
    if (!file || !file.headers || !file.data) return [];
    const headers = file.headers;
    const getNumber = (row: any[], keywords: string[]) => {
      const idx = findColumnIndex(headers, keywords);
      return (idx !== undefined && idx >= 0 && idx < row.length) ? parseGermanNumber(String(row[idx])) : 0;
    };
    const getString = (row: any[], keywords: string[]) => {
      const idx = findColumnIndex(headers, keywords);
      return (idx !== undefined && idx >= 0 && idx < row.length) ? String(row[idx] || '') : '';
    };
    const players: PlayerInfo[] = [];
    file.data.forEach((row: any[]) => {
      const id = getString(row, ['governorid', 'governor id', 'id']);
      const name = getString(row, ['name', 'player name']);
      if (!id && !name) return;
      players.push({
        id, name, alliance: getString(row, ['alliance', 'tag']),
        power: getNumber(row, ['power', 'macht']),
        troopsPower: getNumber(row, ['troopspower']),
        totalKillPoints: getNumber(row, ['total kill points', 'kp']),
        deadTroops: getNumber(row, ['dead']),
        t1Kills: getNumber(row, ['t1']), t2Kills: getNumber(row, ['t2']), t3Kills: getNumber(row, ['t3']), t4Kills: getNumber(row, ['t4']), t5Kills: getNumber(row, ['t5']),
        cityHall: getNumber(row, ['cityhall']), techPower: getNumber(row, ['techpower']), buildingPower: getNumber(row, ['building']), commanderPower: getNumber(row, ['commander']),
      });
    });
    return players;
  };

  const handleCompare = useCallback(() => {
    setComparisonError(null);
    if (!startFileId || !endFileId || startFileId === endFileId) { setComparisonStats(null); return; }
    const startFile = uploadedFiles.find(f => f.id === startFileId);
    const endFile = uploadedFiles.find(f => f.id === endFileId);
    if (!startFile || !endFile) { setComparisonError('Files not found.'); return; }

    try {
      const data1 = parseFileToPlayers(startFile);
      const data2 = parseFileToPlayers(endFile);
      const sum = (d: PlayerInfo[], k: keyof PlayerInfo) => d.reduce((s, p) => s + (Number(p[k]) || 0), 0);
      
      const stats: ComparisonStats = {
        totalPowerFile1: sum(data1, 'power'), totalPowerFile2: sum(data2, 'power'), powerDifference: sum(data2, 'power') - sum(data1, 'power'),
        totalTroopsPowerFile1: sum(data1, 'troopsPower'), totalTroopsPowerFile2: sum(data2, 'troopsPower'), troopsPowerDifference: sum(data2, 'troopsPower') - sum(data1, 'troopsPower'),
        totalKillPointsFile1: sum(data1, 'totalKillPoints'), totalKillPointsFile2: sum(data2, 'totalKillPoints'), killPointsDifference: sum(data2, 'totalKillPoints') - sum(data1, 'totalKillPoints'),
        totalDeadTroopsFile1: sum(data1, 'deadTroops'), totalDeadTroopsFile2: sum(data2, 'deadTroops'), deadTroopsDifference: sum(data2, 'deadTroops') - sum(data1, 'deadTroops'),
        newPlayers: [], disappearedPlayers: [], playerStatChanges: []
      };

      const map1 = new Map(data1.map(p => [p.id, p]));
      stats.newPlayers = data2.filter(p => p.id && !map1.has(p.id));
      stats.disappearedPlayers = data1.filter(p => p.id && !new Map(data2.map(x=>[x.id,x])).has(p.id));

      data2.forEach(p2 => {
          const p1 = map1.get(p2.id);
          if (p1) {
              stats.playerStatChanges.push({
                  id: p2.id, name: p2.name, alliance: p2.alliance,
                  oldPower: p1.power, newPower: p2.power, diffPower: p2.power - p1.power,
                  oldKillPoints: p1.totalKillPoints, newKillPoints: p2.totalKillPoints, diffKillPoints: p2.totalKillPoints - p1.totalKillPoints,
                  oldDeadTroops: p1.deadTroops, newDeadTroops: p2.deadTroops, diffDeadTroops: p2.deadTroops - p1.deadTroops,
                  oldTroopsPower: p1.troopsPower, newTroopsPower: p2.troopsPower, diffTroopsPower: p2.troopsPower - p1.troopsPower,
              });
          }
      });
      setComparisonStats(stats);
    } catch (err) { console.error(err); setComparisonError('Error analyzing data.'); }
  }, [startFileId, endFileId, uploadedFiles]);

  useEffect(() => { if (startFileId && endFileId) handleCompare(); }, [startFileId, endFileId, uploadedFiles, handleCompare]);

  const handleSearch = () => {
    if (!searchQuery.trim() || !comparisonStats) { setSearchResults(null); setSelectedPlayer(null); return; }
    const q = searchQuery.toLowerCase();
    const results = comparisonStats.playerStatChanges.filter(p => p.name.toLowerCase().includes(q) || p.id.toLowerCase().includes(q));
    setSearchResults(results.length ? results : 'not_found');
    if (results.length === 1) setSelectedPlayer(results[0]);
  };
  const handleClearSearch = () => { setSearchQuery(''); setSearchResults(null); setSelectedPlayer(null); };
  const handleSelectPlayer = (p: PlayerStatChange) => { setSelectedPlayer(p); };
  
  if (isLoading) return <div className="p-6 text-center text-gray-300">Loading files...</div>;

  if (isMinimalView) {
    return (
      <div className="space-y-8">
        {error && <div className="text-center p-4 text-red-400 bg-red-900/50 rounded-lg">{error}</div>}
        <div className="bg-gray-800 p-6 rounded-xl shadow-lg">
          <PowerHistoryChart files={uploadedFiles || []} />
        </div>
        {!error && uploadedFiles.length === 0 && (<div className="text-center p-8 text-yellow-400 bg-gray-800 rounded-xl"><h3 className="text-xl font-bold mb-2">No Data Available</h3><p>The selected Kingdom has not uploaded any files yet.</p></div>)}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {error && <div className="text-center p-4 text-red-400 bg-red-900/50 rounded-lg">{error}</div>}

      {canManageFiles && (
        <div className="space-y-4">
          <button
            className="bg-blue-700 hover:bg-blue-600 text-white px-4 py-2 rounded shadow-md font-medium flex items-center transition-colors"
            onClick={() => setShowDownloadSection(prev => !prev)}
          >
            <span className="mr-2">⬇️</span>
            {showDownloadSection ? 'Hide Uploads' : 'Show Uploads'}
          </button>

          {showDownloadSection && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
              <div className="bg-gray-800 p-6 rounded-xl shadow-lg"><FileUpload uploadUrl={uploadUrl} onUploadComplete={handleUploadComplete} /></div>
              <div><FileList files={uploadedFiles} onDeleteFile={handleDeleteFile} onReorder={handleReorderFiles} /></div>
            </div>
          )}
        </div>
      )}

      <div className="bg-gray-800 p-6 rounded-xl shadow-lg">
         <PowerHistoryChart files={uploadedFiles} />
      </div>

      <PlayerSearch 
          query={searchQuery} setQuery={setSearchQuery} onSearch={handleSearch} onClear={handleClearSearch} 
          results={searchResults} selectedPlayer={selectedPlayer} onSelectPlayer={handleSelectPlayer} 
          isComparisonLoaded={!!comparisonStats}
      />

      <ComparisonSection 
          stats={comparisonStats} error={comparisonError} 
          file1Name={cleanFileName(uploadedFiles.find(f => f.id === startFileId)?.name || '')}
          file2Name={cleanFileName(uploadedFiles.find(f => f.id === endFileId)?.name || '')}
          fileOptions={uploadedFiles.map(f => ({ id: f.id, label: cleanFileName(f.name) }))}
          startFileId={startFileId}
          endFileId={endFileId}
          onStartChange={setStartFileId}
          onEndChange={setEndFileId}
          onCompare={handleCompare}
      />
    </div>
  );
};

export default OverviewDashboard;
