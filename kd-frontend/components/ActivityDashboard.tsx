import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import FileUpload from './FileUpload';
import FileList from './FileList';
import { Table, TableHeader, TableRow, TableCell } from './Table';
import { useAuth } from './AuthContext';
import { cleanFileName, parseGermanNumber, findColumnIndex } from '../utils';
import type { UploadedFile, ActivityPlayerInfo } from '../types';

interface ActivityDashboardProps {
  isAdmin: boolean;
  backendUrl: string;
  publicSlug: string | null;
  isAdminOverride: boolean;
}

interface ScoredPlayerInfo extends ActivityPlayerInfo {
    score: number;
}

// Helper für Click-Outside Logik beim Dropdown
function useOutsideAlerter(ref: React.RefObject<HTMLElement>, onOutside: () => void) {
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (ref.current && !ref.current.contains(event.target as Node)) {
                onOutside();
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [ref, onOutside]);
}

const ActivityDashboard: React.FC<ActivityDashboardProps> = ({ isAdmin, backendUrl, publicSlug, isAdminOverride }) => {
  const { user } = useAuth();
  const role = user?.role;
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [selectedFileId, setSelectedFileId] = useState<string>('');
  const [activityData, setActivityData] = useState<ActivityPlayerInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showDownloadSection, setShowDownloadSection] = useState(false);

  const canManageFiles =
    isAdmin ||
    role === 'r5' ||
    (role === 'r4' && !!user?.canManageActivityFiles);

  const adminSlugQuery = useMemo(
    () => (isAdminOverride && publicSlug ? `?slug=${publicSlug}` : ''),
    [isAdminOverride, publicSlug]
  );

  // ⚖️ Score Gewichtung (mit LocalStorage Persistence)
  const [weights, setWeights] = useState(() => {
      const saved = localStorage.getItem('activity_weights');
      if (saved) {
          try {
              return JSON.parse(saved);
          } catch (e) {
              console.error("Failed to parse saved weights", e);
          }
      }
      // Default Werte
      return { helps: 2, tech: 1, building: 1 };
  });

  // Speichern der Weights bei Änderung
  useEffect(() => {
      localStorage.setItem('activity_weights', JSON.stringify(weights));
  }, [weights]);


  // 🔍 Allianz Filter State
  const [selectedAlliances, setSelectedAlliances] = useState<string[]>([]);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  
  const filterRef = useRef<HTMLDivElement>(null);
  
  useOutsideAlerter(filterRef, () => setIsFilterOpen(false));


  // Sortierung
  const [sortColumn, setSortColumn] = useState<keyof ScoredPlayerInfo | 'rank'>('score');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // 1. Dateien laden
  const fetchFiles = useCallback(async () => {
    try {
      setIsLoading(true);
      const token = localStorage.getItem('authToken');
      const res = await fetch(`${backendUrl}/activity/files-data${adminSlugQuery}`, {
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
  }, [backendUrl, selectedFileId, adminSlugQuery]);

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
    const foundAlliances = new Set<string>();

    file.data.forEach(row => {
        const id = getVal(row, ['GovernorID', 'id', 'user id', 'gov id']);
        const name = getVal(row, ['Name', 'player', 'display name']);
        
        if (id && name) {
            const alliance = String(getVal(row, ['Alliance', 'tag']) || '').trim();
            foundAlliances.add(alliance);

            parsed.push({
                id: String(id),
                name: String(name),
                alliance: alliance,
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
    // Standardmäßig alle gefundenen Allianzen auswählen
    setSelectedAlliances(Array.from(foundAlliances).sort());
  }, [files]);

  useEffect(() => { 
      if (selectedFileId) parseFile(selectedFileId); 
  }, [selectedFileId, parseFile]);


  // 🧮 Liste aller verfügbaren Allianzen (für das Filter-Menü)
  const allAlliances = useMemo(() => {
      const set = new Set(activityData.map(p => p.alliance));
      return Array.from(set).sort();
  }, [activityData]);


  // 🔢 Daten verarbeiten: Filtern -> Score berechnen -> Sortieren
  const processedData = useMemo(() => {
      // 1. Filtern nach Allianz
      let filtered = activityData.filter(p => selectedAlliances.includes(p.alliance));

      // 2. Score berechnen
      const scored: ScoredPlayerInfo[] = filtered.map(p => ({
          ...p,
          score: (p.helpTimes * weights.helps) + (p.buildingScore * weights.building) + (p.techDonation * weights.tech)
      }));

      // 3. Sortieren
      return scored.sort((a, b) => {
          if (sortColumn === 'rank') {
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
  }, [activityData, selectedAlliances, weights, sortColumn, sortDirection]);


  const handleSort = (column: keyof ScoredPlayerInfo | 'rank') => {
      if (sortColumn === column) {
          setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
      } else {
          setSortColumn(column);
          setSortDirection('desc'); 
      }
  };

  // Filter Handler
  const toggleAlliance = (alliance: string) => {
      setSelectedAlliances(prev => 
          prev.includes(alliance) 
            ? prev.filter(a => a !== alliance)
            : [...prev, alliance]
      );
  };

  const toggleAllAlliances = () => {
      if (selectedAlliances.length === allAlliances.length) {
          setSelectedAlliances([]); // Alle abwählen
      } else {
          setSelectedAlliances(allAlliances); // Alle auswählen
      }
  };

  // 3. Spalten Definition
  const columns = [
    { header: 'Rank', accessor: 'rank', className: "w-16 text-center text-gray-500", sortable: false }, 
    { header: 'Name', accessor: 'name', className: "font-medium text-white", sortable: false },
    { header: 'ID', accessor: 'id', className: "text-gray-400 text-xs hidden sm:table-cell", sortable: false },
    { header: 'Alliance', accessor: 'alliance', className: "text-blue-400", sortable: false },
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
      {/* Header & Upload Bereich (nur mit Berechtigung) */}
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
                <div className="bg-gray-800 p-6 rounded-xl shadow-lg border border-gray-700">
                   <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-blue-500" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
                      </svg>
                      Upload Weekly Activity
                   </h3>
                   <p className="text-sm text-gray-400 mb-4">Upload .xlsx or .csv files containing weekly activity data.</p>
                   <FileUpload uploadUrl={`${backendUrl}/activity/upload${adminSlugQuery}`} onUploadComplete={fetchFiles} />
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
          )}
        </div>
      )}

      {/* Daten-View */}
      <div className="bg-gray-800 p-6 rounded-xl shadow-lg border border-gray-700 min-h-[500px]">
        
        {/* Controls Toolbar */}
        <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center mb-6 gap-6">
            
            {/* Linke Seite: Titel & File Select */}
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center w-full xl:w-auto">
                <div>
                    <h2 className="text-xl font-bold text-white">Weekly Activity Ranking</h2>
                </div>
                <div className="flex items-center space-x-2">
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
            
            {/* Rechte Seite: Settings & Filter */}
            {activityData.length > 0 && (
                <div className="flex flex-col sm:flex-row flex-wrap gap-4 w-full xl:w-auto justify-end">
                    
                    {/* Score Weights */}
                    <div className="flex flex-wrap items-center gap-2 bg-gray-900/50 p-2 rounded-lg border border-gray-700">
                        <span className="text-xs font-semibold text-gray-500 uppercase mr-1">Weights:</span>
                        <div className="flex items-center gap-1" title="Multiplier for Help Times">
                            <span className="text-xs text-blue-300">Helps</span>
                            <input type="number" min="0" step="0.1" value={weights.helps}
                                onChange={(e) => setWeights(p => ({ ...p, helps: parseFloat(e.target.value) || 0 }))}
                                className="w-10 bg-gray-800 border border-gray-600 rounded text-center text-xs text-white p-0.5 focus:border-blue-500 outline-none"
                            />
                        </div>
                        <div className="flex items-center gap-1" title="Multiplier for Building Score">
                            <span className="text-xs text-green-300">Build</span>
                            <input type="number" min="0" step="0.1" value={weights.building}
                                onChange={(e) => setWeights(p => ({ ...p, building: parseFloat(e.target.value) || 0 }))}
                                className="w-10 bg-gray-800 border border-gray-600 rounded text-center text-xs text-white p-0.5 focus:border-green-500 outline-none"
                            />
                        </div>
                        <div className="flex items-center gap-1" title="Multiplier for Tech Donation">
                            <span className="text-xs text-purple-300">Tech</span>
                            <input type="number" min="0" step="0.1" value={weights.tech}
                                onChange={(e) => setWeights(p => ({ ...p, tech: parseFloat(e.target.value) || 0 }))}
                                className="w-10 bg-gray-800 border border-gray-600 rounded text-center text-xs text-white p-0.5 focus:border-purple-500 outline-none"
                            />
                        </div>
                    </div>

                    {/* Alliance Filter Dropdown */}
                    <div className="relative" ref={filterRef}>
                        <button 
                            onClick={() => setIsFilterOpen(!isFilterOpen)}
                            className="flex items-center justify-between w-40 px-3 py-2 text-xs font-medium text-white bg-gray-700 border border-gray-600 rounded-lg hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            <span>
                                {selectedAlliances.length === allAlliances.length 
                                    ? "All Alliances" 
                                    : `${selectedAlliances.length} Selected`}
                            </span>
                            <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                        </button>

                        {isFilterOpen && (
                            <div className="absolute right-0 z-10 w-56 mt-2 origin-top-right bg-gray-800 border border-gray-600 rounded-md shadow-lg ring-1 ring-black ring-opacity-5">
                                <div className="p-2 border-b border-gray-700">
                                    <button 
                                        onClick={toggleAllAlliances}
                                        className="w-full text-left px-2 py-1 text-xs text-blue-400 hover:text-blue-300 font-semibold"
                                    >
                                        {selectedAlliances.length === allAlliances.length ? "Deselect All" : "Select All"}
                                    </button>
                                </div>
                                <div className="py-1 max-h-60 overflow-y-auto">
                                    {allAlliances.map(alliance => (
                                        <label key={alliance} className="flex items-center px-4 py-2 text-xs text-gray-200 hover:bg-gray-700 cursor-pointer">
                                            <input 
                                                type="checkbox" 
                                                className="form-checkbox h-3 w-3 text-blue-500 bg-gray-900 border-gray-600 rounded focus:ring-blue-500 focus:ring-offset-gray-800"
                                                checked={selectedAlliances.includes(alliance)}
                                                onChange={() => toggleAlliance(alliance)}
                                            />
                                            <span className="ml-2 truncate">{alliance || "(No Alliance)"}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                </div>
            )}
        </div>

        {/* Table Content */}
        {isLoading ? (
            <div className="text-center text-gray-500 py-20">Loading data...</div>
        ) : activityData.length > 0 ? (
            <>
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
                        {processedData.length > 0 ? (
                            processedData.map((row, rowIdx) => (
                                <TableRow key={row.id || rowIdx}>
                                    {columns.map((col, colIdx) => {
                                        let content;
                                        if (col.accessor === 'rank') {
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
                            ))
                        ) : (
                            <TableRow>
                                <TableCell className="text-center py-8 text-gray-500" header={false} align="center">
                                    No players found for the selected alliances.
                                </TableCell>
                            </TableRow>
                        )}
                    </tbody>
                </Table>
                <div className="mt-4 text-xs text-gray-500 text-right">
                    Showing {processedData.length} of {activityData.length} players
                </div>
            </>
        ) : (
            <div className="text-center text-gray-500 py-20 bg-gray-900/50 rounded-lg border border-gray-700 border-dashed">
                {files.length === 0 
                    ? "No activity files uploaded yet." 
                    : "No valid data found in the selected file."
                }
            </div>
        )}
      </div>
    </div>
  );
};

export default ActivityDashboard;
