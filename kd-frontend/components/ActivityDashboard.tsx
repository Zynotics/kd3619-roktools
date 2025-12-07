import React, { useEffect, useState, useCallback, useMemo } from 'react';
import FileUpload from './FileUpload';
import FileList from './FileList';
import { Table, TableHeader, TableRow, TableCell } from './Table';
import { useAuth } from './AuthContext';
import { cleanFileName, parseGermanNumber, findColumnIndex } from '../utils';
import type { UploadedFile, ActivityPlayerInfo } from '../types';

interface ActivityDashboardProps {
  isAdmin: boolean;
  backendUrl: string;
}

// Erweitertes Interface für die Anzeige inkl. Score
interface ScoredPlayerInfo extends ActivityPlayerInfo {
    score: number;
}

const ActivityDashboard: React.FC<ActivityDashboardProps> = ({ isAdmin, backendUrl }) => {
  const { user } = useAuth();
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [selectedFileId, setSelectedFileId] = useState<string>('');
  const [activityData, setActivityData] = useState<ActivityPlayerInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // ⚖️ NEU: State für die Gewichtung (Multiplikatoren)
  const [weights, setWeights] = useState({
      helps: 2,      // Standard: Helps zählen doppelt (Beispiel)
      tech: 1,       // Standard: Tech zählt einfach
      building: 1    // Standard: Building zählt einfach
  });

  // Sortierung
  const [sortColumn, setSortColumn] = useState<keyof ScoredPlayerInfo | 'rank'>('score');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // 1. Dateien laden
  const fetchFiles = useCallback(async () => {
    try {
      setIsLoading(true);
      const token = localStorage.getItem('authToken');
      const res = await fetch(`${backendUrl}/activity/files-data`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data: UploadedFile[] = await res.json();
        setFiles(data);
        if (data.length > 0 && !selectedFileId) {
             setSelectedFileId(data[data.length - 1].id);
        } else if (data.length > 0 && selectedFileId) {
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

  // 2. Datei Parsen
  const parseFile = useCallback((fileId: string) => {
    const file = files.find(f => f.id === fileId);
    if (!file || !file.data) return;

    const headers = file.headers;
    const getVal = (row: any[], keys: string[]) => {
        const idx = findColumnIndex(headers, keys);
        return (idx !== undefined && row[idx]) ? row[idx] : null;
    };

    const parsed: ActivityPlayerInfo[] = [];
    file.data.forEach(row => {
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

  // 🔢 NEU: Daten mit Score berechnen und sortieren
  const processedData = useMemo(() => {
      // 1. Score berechnen
      const scored: ScoredPlayerInfo[] = activityData.map(p => ({
          ...p,
          score: (p.helpTimes * weights.helps) + (p.buildingScore * weights.building) + (p.techDonation * weights.tech)
      }));

      // 2. Sortieren
      return scored.sort((a, b) => {
          if (sortColumn === 'rank') {
              // Wenn nach Rank sortiert wird, ist das eigentlich implizit nach Score sortiert
              // (höchster Score = Rank 1)
              return sortDirection === 'asc' ? a.score - b.score : b.score - a.score;
          }

          // @ts-ignore
          const valA = a[sortColumn]; 
          // @ts-ignore
          const valB = b[sortColumn];

          if (typeof valA === 'number' && typeof valB === 'number') {
              return sortDirection === 'asc' ? valA - valB : valB - valA;
          }
          if (typeof valA === 'string' && typeof valB === 'string') {
               return sortDirection === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
          }
          return 0; 
      });
  }, [activityData, weights, sortColumn, sortDirection]);


  const handleSort = (column: keyof ScoredPlayerInfo | 'rank') => {
      if (sortColumn === column) {
          setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
      } else {
          setSortColumn(column);
          setSortDirection('desc'); // Bei Wechsel Default desc (meistens sinnvoller für Zahlen)
      }
  };

  // 3. Spalten Definition
  const columns = [
    { header: 'Rank', accessor: 'rank', className: "w-16 text-center text-gray-500", sortable: false }, // Rank ist dynamisch
    { header: 'Name', accessor: 'name', className: "font-medium text-white", sortable: false },
    { header: 'ID', accessor: 'id', className: "text-gray-400 text-xs hidden sm:table-cell", sortable: false },
    { header: 'Alliance', accessor: 'alliance', className: "text-blue-400", sortable: false },
    // Score Spalte
    { 
        header: 'Total Score', 
        accessor: 'score', 
        sortable: true, 
        className: "font-bold text-yellow-400 bg-yellow-900/10",
        format: (v: number) => Math.round(v).toLocaleString() 
    },
    { header: 'Helps', accessor: 'helpTimes', sortable: true, format: (v: number) => v.toLocaleString() },
    { header: 'Tech', accessor: 'techDonation', sortable: true, format: (v: number) => v.toLocaleString() },
    { header: 'Build', accessor: 'buildingScore', sortable: true, format: (v: number) => v.toLocaleString() },
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
             <p className="text-sm text-gray-400 mb-4">Upload .xlsx or .csv files containing weekly activity data.</p>
             <FileUpload uploadUrl={`${backendUrl}/activity/upload`} onUploadComplete={fetchFiles} />
          </div>

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
                    setFiles(newFiles); 
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
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-6 gap-6">
            
            {/* Linke Seite: Titel & File Select */}
            <div>
                <h2 className="text-xl font-bold text-white mb-2">Activity Ranking</h2>
                <div className="flex items-center space-x-2">
                    <label className="text-sm text-gray-400">Week:</label>
                    <select 
                        className="bg-gray-700 text-white p-1.5 rounded border border-gray-600 text-xs focus:ring-2 focus:ring-blue-500 outline-none max-w-[200px]"
                        value={selectedFileId}
                        onChange={(e) => setSelectedFileId(e.target.value)}
                        disabled={files.length === 0}
                    >
                        {files.length === 0 && <option>No files</option>}
                        {files.map(f => <option key={f.id} value={f.id}>{cleanFileName(f.name)}</option>)}
                    </select>
                </div>
            </div>
            
            {/* Rechte Seite: Score Settings (nur sichtbar, wenn Daten da sind) */}
            {activityData.length > 0 && (
                <div className="flex flex-col sm:flex-row items-center gap-4 bg-gray-900/50 p-3 rounded-lg border border-gray-700">
                    <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 sm:mb-0">Score Weights:</span>
                    
                    <div className="flex items-center gap-2">
                        <label className="text-xs text-blue-300">Helps ×</label>
                        <input 
                            type="number" min="0" step="0.1"
                            value={weights.helps}
                            onChange={(e) => setWeights(p => ({ ...p, helps: parseFloat(e.target.value) || 0 }))}
                            className="w-12 bg-gray-800 border border-gray-600 rounded text-center text-xs text-white p-1 focus:border-blue-500 outline-none"
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        <label className="text-xs text-green-300">Build ×</label>
                        <input 
                            type="number" min="0" step="0.1"
                            value={weights.building}
                            onChange={(e) => setWeights(p => ({ ...p, building: parseFloat(e.target.value) || 0 }))}
                            className="w-12 bg-gray-800 border border-gray-600 rounded text-center text-xs text-white p-1 focus:border-green-500 outline-none"
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        <label className="text-xs text-purple-300">Tech ×</label>
                        <input 
                            type="number" min="0" step="0.1"
                            value={weights.tech}
                            onChange={(e) => setWeights(p => ({ ...p, tech: parseFloat(e.target.value) || 0 }))}
                            className="w-12 bg-gray-800 border border-gray-600 rounded text-center text-xs text-white p-1 focus:border-purple-500 outline-none"
                        />
                    </div>
                </div>
            )}
        </div>

        {isLoading ? (
            <div className="text-center text-gray-500 py-20">Loading data...</div>
        ) : activityData.length > 0 ? (
            <Table>
                <TableHeader>
                    <TableRow hover={false}>
                        {columns.map((col, idx) => (
                            <TableCell 
                                key={idx} 
                                header 
                                className={`cursor-pointer select-none ${col.className || ''}`}
                                onClick={() => col.sortable ? handleSort(col.accessor as keyof ScoredPlayerInfo) : undefined}
                            >
                                <div className={`flex items-center gap-1 ${col.accessor === 'score' ? 'justify-end' : ''}`}>
                                    {col.header}
                                    {col.sortable && sortColumn === col.accessor && (
                                        <span className='text-blue-400 text-xs'>{sortDirection === 'asc' ? '▲' : '▼'}</span>
                                    )}
                                </div>
                            </TableCell>
                        ))}
                    </TableRow>
                </TableHeader>
                <tbody>
                    {processedData.map((row, rowIdx) => (
                        <TableRow key={row.id || rowIdx}>
                            {columns.map((col, colIdx) => {
                                let content;
                                if (col.accessor === 'rank') {
                                    // Rank ist einfach die Zeilennummer im sortierten Array + 1
                                    // (ggf. noch mit Pagination verrechnen, wenn Pagination eingebaut wird)
                                    content = rowIdx + 1;
                                } else {
                                    // @ts-ignore
                                    const val = row[col.accessor];
                                    content = col.format ? col.format(val) : val;
                                }
                                return (
                                    <TableCell key={colIdx} className={col.className} align={col.accessor === 'score' ? 'right' : 'left'}>
                                        {content}
                                    </TableCell>
                                );
                            })}
                        </TableRow>
                    ))}
                </tbody>
            </Table>
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