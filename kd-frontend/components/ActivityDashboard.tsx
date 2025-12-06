import React, { useEffect, useState, useCallback } from 'react';
import FileUpload from './FileUpload';
import FileList from './FileList';
import Table from './Table';
import { useAuth } from './AuthContext';
import { cleanFileName, parseGermanNumber, findColumnIndex } from '../utils';
import type { UploadedFile, ActivityPlayerInfo } from '../types';

interface ActivityDashboardProps {
  isAdmin: boolean;
  backendUrl: string;
}

const ActivityDashboard: React.FC<ActivityDashboardProps> = ({ isAdmin, backendUrl }) => {
  const { user } = useAuth();
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [selectedFileId, setSelectedFileId] = useState<string>('');
  const [activityData, setActivityData] = useState<ActivityPlayerInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // 1. Dateien laden
  const fetchFiles = useCallback(async () => {
    try {
      setIsLoading(true);
      const token = localStorage.getItem('authToken');
      // Endpunkt für Activity-Files
      const res = await fetch(`${backendUrl}/activity/files-data`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data: UploadedFile[] = await res.json();
        setFiles(data);
        // Wenn Dateien vorhanden sind und noch keine ausgewählt ist, nimm die neueste
        if (data.length > 0 && !selectedFileId) {
             setSelectedFileId(data[data.length - 1].id);
        } else if (data.length > 0 && selectedFileId) {
             // Prüfen ob die selektierte noch existiert, sonst reset auf neueste
             if (!data.find(f => f.id === selectedFileId)) {
                 setSelectedFileId(data[data.length - 1].id);
             }
        } else if (data.length === 0) {
            setActivityData([]);
            setSelectedFileId('');
        }
      }
    } catch (e) { 
        console.error('Failed to load activity files', e); 
    } finally { 
        setIsLoading(false); 
    }
  }, [backendUrl, selectedFileId]);

  useEffect(() => { fetchFiles(); }, [fetchFiles]);

  // 2. Datei Parsen (wenn eine ausgewählt ist)
  const parseFile = useCallback((fileId: string) => {
    const file = files.find(f => f.id === fileId);
    if (!file || !file.data) return;

    const headers = file.headers;
    
    // Hilfsfunktion zum sicheren Auslesen via Spaltennamen
    const getVal = (row: any[], keys: string[]) => {
        const idx = findColumnIndex(headers, keys);
        return (idx !== undefined && row[idx]) ? row[idx] : null;
    };

    const parsed: ActivityPlayerInfo[] = [];
    
    file.data.forEach(row => {
        // IDs und Namen sind Pflichtfelder für eine gültige Zeile
        const id = getVal(row, ['GovernorID', 'id', 'user id', 'gov id']);
        const name = getVal(row, ['Name', 'player', 'display name']);
        
        if (id && name) {
            parsed.push({
                id: String(id),
                name: String(name),
                alliance: String(getVal(row, ['Alliance', 'tag']) || ''),
                power: parseGermanNumber(getVal(row, ['Power', 'Macht'])),
                killPoints: parseGermanNumber(getVal(row, ['Kill Points', 'KillPoints', 'KP'])),
                helpTimes: parseGermanNumber(getVal(row, ['Help Times', 'Helps', 'Help'])),
                rssTrading: parseGermanNumber(getVal(row, ['Rss Trading', 'Resources', 'Rss assistance'])),
                buildingScore: parseGermanNumber(getVal(row, ['Building', 'Build', 'Construction'])),
                techDonation: parseGermanNumber(getVal(row, ['Tech Donation', 'Tech', 'Technology'])),
            });
        }
    });
    setActivityData(parsed);
  }, [files]);

  useEffect(() => { 
      if (selectedFileId) parseFile(selectedFileId); 
  }, [selectedFileId, parseFile]);

  // 3. Spaltenkonfiguration für die Tabelle
  const columns = [
    { header: 'Rank', accessor: (_: any, index: number) => index + 1, className: "w-16 text-center text-gray-500" },
    { header: 'Name', accessor: 'name', className: "font-medium text-white" },
    { header: 'ID', accessor: 'id', className: "text-gray-400 text-xs hidden sm:table-cell" },
    { header: 'Alliance', accessor: 'alliance', className: "text-blue-400" },
    { header: 'Helps', accessor: 'helpTimes', sortable: true, format: (v: number) => v.toLocaleString() },
    { header: 'Tech Donation', accessor: 'techDonation', sortable: true, format: (v: number) => v.toLocaleString() },
    { header: 'Construction', accessor: 'buildingScore', sortable: true, format: (v: number) => v.toLocaleString() },
    { header: 'RSS Assist', accessor: 'rssTrading', sortable: true, format: (v: number) => v.toLocaleString() },
    { header: 'Power', accessor: 'power', sortable: true, format: (v: number) => v.toLocaleString(), className: "text-gray-400" },
  ];

  return (
    <div className="space-y-8">
      {/* Header & Upload Bereich */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
          <div className="bg-gray-800 p-6 rounded-xl shadow-lg border border-gray-700">
             <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-blue-500" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
                </svg>
                Upload Weekly Activity
             </h3>
             <p className="text-sm text-gray-400 mb-4">Upload .xlsx or .csv files containing weekly activity data (Helps, Tech, etc.).</p>
             <FileUpload uploadUrl={`${backendUrl}/activity/upload`} onUploadComplete={fetchFiles} />
          </div>

          {/* Dateiliste zum Löschen/Sortieren */}
          <div>
             <FileList 
                title="Activity History"
                files={files} 
                onDeleteFile={async (id) => {
                    if(!window.confirm('Delete this file?')) return;
                    const token = localStorage.getItem('authToken');
                    await fetch(`${backendUrl}/activity/files/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` }});
                    fetchFiles();
                }} 
                onReorder={async (newFiles) => {
                    setFiles(newFiles); // Optimistic UI update
                    const token = localStorage.getItem('authToken');
                    await fetch(`${backendUrl}/activity/files/reorder`, { 
                        method: 'POST', 
                        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                        body: JSON.stringify({ order: newFiles.map(f => f.id) }) 
                    });
                }} 
            />
          </div>
      </div>

      {/* Daten-Anzeige */}
      <div className="bg-gray-800 p-6 rounded-xl shadow-lg border border-gray-700 min-h-[500px]">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
            <div>
                <h2 className="text-xl font-bold text-white">Activity Report</h2>
                <p className="text-sm text-gray-400">
                    {files.length > 0 ? 'Select a week/file to view details.' : 'No data available.'}
                </p>
            </div>
            
            {files.length > 0 && (
                <div className="flex items-center space-x-2">
                    <label className="text-sm text-gray-300">View File:</label>
                    <select 
                        className="bg-gray-700 text-white p-2 rounded border border-gray-600 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                        value={selectedFileId}
                        onChange={(e) => setSelectedFileId(e.target.value)}
                    >
                        {files.map(f => <option key={f.id} value={f.id}>{cleanFileName(f.name)}</option>)}
                    </select>
                </div>
            )}
        </div>

        {isLoading ? (
            <div className="text-center text-gray-500 py-20">Loading data...</div>
        ) : activityData.length > 0 ? (
            <Table 
                columns={columns} 
                data={activityData} 
                defaultSortColumn="techDonation" 
                defaultSortDirection="desc"
            />
        ) : (
            <div className="text-center text-gray-500 py-20 bg-gray-900/50 rounded-lg border border-gray-700 border-dashed">
                {files.length === 0 
                    ? "No activity files uploaded yet." 
                    : "No valid data found in the selected file. Check column names (GovernorID, Name, Helps, Tech, etc.)."
                }
            </div>
        )}
      </div>
    </div>
  );
};

export default ActivityDashboard;