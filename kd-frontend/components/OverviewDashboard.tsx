// OverviewDashboard.tsx (RÜCKBAU)
import React, { useState, useEffect, useMemo } from 'react';
import Card from './Card'; // 👈 Default Import
import StatCard from './StatCard'; // 👈 Default Import
import TotalPowerDisplay from './TotalPowerDisplay'; // 👈 Default Import
import { Table, TableHeader, TableRow, TableCell } from './Table';
import ColumnFilter from './ColumnFilter'; // 👈 Default Import
import { useAuth } from './AuthContext';
import ComparisonSection from './ComparisonSection'; // 👈 Default Import
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
} from 'recharts';
import { formatNumber } from '../utils';
import { ComparisonStats, PlayerInfo, PlayerStatChange } from '../types';

// --- TYPEN FÜR LOKALE DATENVERARBEITUNG ---
interface OverviewFile {
  id: string;
  name: string;
  uploadDate: string;
  headers: string[];
  data: any[][];
}

interface RowData {
  id: string;
  [key: string]: any;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#A28DFF', '#FF6B6B', '#4ECDC4'];

// Helper: Index im Header finden (case-insensitive)
const getColIdx = (headers: string[], candidates: string[]) => {
  return headers.findIndex(h => candidates.some(c => h.toLowerCase().includes(c.toLowerCase())));
};

// Helper: Zeile in Objekt umwandeln
const parseRow = (row: any[], headers: string[]): RowData => {
    const getVal = (candidates: string[]) => {
        const idx = getColIdx(headers, candidates);
        return idx !== -1 ? row[idx] : null;
    };
    
    const id = getVal(['governor id', 'id']) || `unknown-${Math.random()}`;
    
    // Annahme: Alle benötigten Felder sind vorhanden
    return {
        id: String(id),
        'Gov ID': id,
        'Name': getVal(['name', 'governor name']) || 'Unknown',
        'Alliance': getVal(['alliance']) || 'None',
        'Power': parseInt(getVal(['power']) || '0', 10),
        'Kill Points': parseInt(getVal(['kill points', 'killpoints', 'kp']) || '0', 10),
        'Dead': parseInt(getVal(['dead', 'dead troops']) || '0', 10),
        'T4 Kills': parseInt(getVal(['t4 kills', 'tier 4 kills']) || '0', 10),
        'T5 Kills': parseInt(getVal(['t5 kills', 'tier 5 kills']) || '0', 10),
        'RSS Assistance': parseInt(getVal(['rss', 'assistance']) || '0', 10),
        'Troops Power': 0, // Fallback
    };
};


const OverviewDashboard: React.FC<{ isAdmin?: boolean, backendUrl?: string, publicSlug?: string | null, isAdminOverride?: boolean }> = ({ isAdmin, backendUrl, publicSlug, isAdminOverride }) => {
  const { user } = useAuth();
  
  // Wir nutzen window.location direkt, da wir uns aus der Router-Logik zurückziehen
  const [latestFile, setLatestFile] = useState<OverviewFile | null>(null);
  const [previousFile, setPreviousFile] = useState<OverviewFile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Search & Filter (vereinfacht)
  const [searchTerm, setSearchTerm] = useState('');
  const [visibleColumns, setVisibleColumns] = useState<string[]>(['Gov ID', 'Name', 'Alliance', 'Power', 'Kill Points', 'Dead']);

  // DUMMY COLUMN INFO FÜR ColumnFilter (da wir den echten Typ nicht haben)
  const ALL_COLUMNS_DUMMY = useMemo(() => [
      { key: 'Gov ID', title: 'Gov ID' },
      { key: 'Name', title: 'Name' },
      { key: 'Alliance', title: 'Alliance' },
      { key: 'Power', title: 'Power' },
      { key: 'Kill Points', title: 'Kill Points' },
      { key: 'Dead', title: 'Dead' },
      { key: 'T4 Kills', title: 'T4 Kills' },
      { key: 'T5 Kills', title: 'T5 Kills' },
      { key: 'RSS Assistance', title: 'RSS Assistance' },
  ], []);


  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [publicSlug, user]);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      let url = '';
      let headers = {};
      const token = localStorage.getItem('authToken');
      const baseUrl = backendUrl || (process.env.NODE_ENV === 'production' ? 'https://api.rise-of-stats.com' : 'http://localhost:4000');
      
      const slugFromUrl = new URLSearchParams(window.location.search).get('slug');
      const finalSlug = publicSlug || slugFromUrl;

      if (finalSlug) {
          url = `${baseUrl}/api/public/kingdom/${finalSlug}/overview-files`;
      } else if (token) {
          url = `${baseUrl}/overview/files-data`;
          headers = { Authorization: `Bearer ${token}` };
      } else {
          setLoading(false);
          return; 
      }

      const response = await fetch(url, { headers });
      if (!response.ok) {
         if (response.status === 404) throw new Error('No data found for this kingdom.');
         throw new Error('Failed to fetch data');
      }
      
      const files: OverviewFile[] = await response.json();
      
      if (files.length > 0) {
        const sorted = files.sort((a, b) => new Date(b.uploadDate).getTime() - new Date(a.uploadDate).getTime());
        setLatestFile(sorted[0]);
        if (sorted.length > 1) {
            setPreviousFile(sorted[1]);
        }
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // --- DATA MAPPING ---
  const currentData = useMemo(() => {
    if (!latestFile) return [];
    return latestFile.data.map(r => parseRow(r, latestFile.headers));
  }, [latestFile]);

  const previousData = useMemo(() => {
    if (!previousFile) return [];
    return previousFile.data.map(r => parseRow(r, previousFile.headers));
  }, [previousFile]);


  // --- COMPARISON LOGIC ---
  const comparisonStats = useMemo((): ComparisonStats | null => {
    if (!latestFile || !previousFile) return null;

    const oldMap = new Map(previousData.map(p => [String(p['Gov ID']), p]));
    const newMap = new Map(currentData.map(p => [String(p['Gov ID']), p]));

    const changes: PlayerStatChange[] = [];
    const newPlayers: PlayerInfo[] = [];
    const disappearedPlayers: PlayerInfo[] = [];

    currentData.forEach(curr => {
        const old = oldMap.get(String(curr['Gov ID']));
        if (old) {
            changes.push({
                id: curr['Gov ID'],
                name: curr['Name'],
                alliance: curr['Alliance'],
                oldPower: old['Power'],
                newPower: curr['Power'],
                diffPower: curr['Power'] - old['Power'],
                oldKillPoints: old['Kill Points'],
                newKillPoints: curr['Kill Points'],
                diffKillPoints: curr['Kill Points'] - old['Kill Points'],
                oldDeadTroops: old['Dead'],
                newDeadTroops: curr['Dead'],
                diffDeadTroops: curr['Dead'] - old['Dead'],
                oldTroopsPower: 0, newTroopsPower: 0, diffTroopsPower: 0,
                // Füge alle Schlüssel hinzu, die PlayerStatChange erwartet
                cityHall: 0, techPower: 0, buildingPower: 0, commanderPower: 0,
                oldCityHall: 0, newCityHall: 0, diffCityHall: 0,
            });
        } else {
            newPlayers.push({
                id: curr['Gov ID'],
                name: curr['Name'],
                alliance: curr['Alliance'],
                power: curr['Power'],
                totalKillPoints: curr['Kill Points'],
                deadTroops: curr['Dead'],
                t1Kills: 0, t2Kills: 0, t3Kills: 0, t4Kills: curr['T4 Kills'], t5Kills: curr['T5 Kills'],
                rssAssistance: curr['RSS Assistance']
            });
        }
    });

    previousData.forEach(old => {
        if (!newMap.has(String(old['Gov ID']))) {
             disappearedPlayers.push({
                id: old['Gov ID'],
                name: old['Name'],
                alliance: old['Alliance'],
                power: old['Power'],
                totalKillPoints: old['Kill Points'],
                deadTroops: old['Dead'],
                t1Kills: 0, t2Kills: 0, t3Kills: 0, t4Kills: old['T4 Kills'], t5Kills: old['T5 Kills'],
                rssAssistance: old['RSS Assistance']
            });
        }
    });

    const sum = (arr: any[], key: string) => arr.reduce((a, b) => a + (b[key] || 0), 0);
    const totalPower1 = sum(previousData, 'Power');
    const totalPower2 = sum(currentData, 'Power');
    const totalKills1 = sum(previousData, 'Kill Points');
    const totalKills2 = sum(currentData, 'Kill Points');
    const totalDead1 = sum(previousData, 'Dead');
    const totalDead2 = sum(currentData, 'Dead');

    return {
        totalPowerFile1: totalPower1,
        totalPowerFile2: totalPower2,
        powerDifference: totalPower2 - totalPower1,
        
        totalKillPointsFile1: totalKills1,
        totalKillPointsFile2: totalKills2,
        killPointsDifference: totalKills2 - totalKills1,

        totalDeadTroopsFile1: totalDead1,
        totalDeadTroopsFile2: totalDead2,
        deadTroopsDifference: totalDead2 - totalDead1,

        totalTroopsPowerFile1: 0,
        totalTroopsPowerFile2: 0,
        troopsPowerDifference: 0,

        playerStatChanges: changes,
        newPlayers: newPlayers,
        disappearedPlayers: disappearedPlayers
    } as ComparisonStats;

  }, [currentData, previousData, latestFile, previousFile]);


  // --- FILTERED DISPLAY DATA ---
  const filteredData = useMemo(() => {
      if (!searchTerm) return currentData;
      const lower = searchTerm.toLowerCase();
      return currentData.filter(p => 
          String(p['Name']).toLowerCase().includes(lower) || 
          String(p['Gov ID']).includes(lower)
      );
  }, [currentData, searchTerm]);

  // --- CHARTS ---
  const allianceData = useMemo(() => {
      const map: {[k:string]: number} = {};
      currentData.forEach(p => {
          const ally = p['Alliance'] || 'Unknown';
          map[ally] = (map[ally] || 0) + p['Power'];
      });
      return Object.entries(map)
        .map(([name, value]) => ({ name, value }))
        .sort((a,b) => b.value - a.value)
        .slice(0, 10);
  }, [currentData]);


  if (loading) return <div className="p-10 text-center text-white">Loading Dashboard...</div>;
  if (error) return <div className="p-10 text-center text-red-400 bg-gray-800 rounded-xl">Error: {error}</div>;
  if (!latestFile) return <div className="p-10 text-center text-gray-400">No data available yet.</div>;

  const totalPower = currentData.reduce((a, b) => a + b['Power'], 0);
  
  // DUMMY DATA FOR FILTER DEMO (Since real filter state logic is complex)
  const dummyVisibleColumns = ['Gov ID', 'Name', 'Power', 'Kill Points', 'Dead'];
  const dummySetVisibleColumns = (cols: string[]) => { /* Does nothing for now */ };

  return (
    <div className="space-y-8 animate-fade-in">
       
       {/* HEADLINE */}
       <div className="flex flex-col md:flex-row justify-between items-end border-b border-gray-700 pb-4">
           <div>
               <h2 className="text-2xl font-bold text-white">Overview</h2>
               <p className="text-sm text-gray-400">Data from: {latestFile.name} ({new Date(latestFile.uploadDate).toLocaleDateString()})</p>
           </div>
       </div>

       {/* KPI & POWER */}
       <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
           <div className="lg:col-span-1">
               <TotalPowerDisplay totalPower={totalPower} />
           </div>
           <div className="lg:col-span-3 grid grid-cols-1 sm:grid-cols-3 gap-4">
                <StatCard title="Total Kill Points" value={formatNumber(comparisonStats?.totalKillPointsFile2 || 0)} color="text-red-400" variant="gradient" />
                <StatCard title="Total Dead" value={formatNumber(comparisonStats?.totalDeadTroopsFile2 || 0)} color="text-gray-400" variant="gradient" />
                <StatCard title="Active Players" value={formatNumber(currentData.length)} color="text-blue-400" variant="gradient" />
           </div>
       </div>

       {/* CHARTS */}
       <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
           <Card className="p-6" gradient>
               <h3 className="text-lg font-semibold text-white mb-4">Top 10 Alliances (Power)</h3>
               <div className="h-64">
                   <ResponsiveContainer width="100%" height="100%">
                       <PieChart>
                           <Pie data={allianceData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                               {allianceData.map((entry, index) => (
                                   <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                               ))}
                           </Pie>
                           <Tooltip contentStyle={{backgroundColor: '#1f2937', borderColor: '#374151', color: '#fff'}} />
                           <Legend />
                       </PieChart>
                   </ResponsiveContainer>
               </div>
           </Card>
           
           {/* COMPARISON SECTION */}
           {comparisonStats && previousFile ? (
                <ComparisonSection 
                    stats={comparisonStats}
                    error={null}
                    file1Name={previousFile.name}
                    file2Name={latestFile.name}
                />
           ) : (
               <Card className="p-6 flex items-center justify-center text-gray-500">
                   No comparison data available (need at least 2 uploads).
               </Card>
           )}
       </div>

       {/* MAIN TABLE */}
       <Card className="p-6">
           <div className="flex justify-between items-center mb-4">
               <h3 className="text-xl font-bold text-white">All Players</h3>
               <div className='flex gap-3'>
                   <input 
                      type="text" 
                      placeholder="Search..." 
                      className="bg-gray-700 text-white px-3 py-2 rounded border border-gray-600 focus:outline-none focus:border-blue-500"
                      onChange={(e) => setSearchTerm(e.target.value)}
                   />
                   <ColumnFilter 
                       allColumns={ALL_COLUMNS_DUMMY}
                       visibleColumns={dummyVisibleColumns}
                       setVisibleColumns={dummySetVisibleColumns}
                   />
               </div>
           </div>
           <Table maxHeight="96">
               <TableHeader>
                   <tr>
                       {dummyVisibleColumns.map(key => (
                           <TableCell key={key} header align="left">
                               {key}
                           </TableCell>
                       ))}
                   </tr>
               </TableHeader>
               <tbody>
                   {filteredData.slice(0, 100).map(row => (
                       <TableRow key={row.id}>
                           {dummyVisibleColumns.map(key => (
                               <TableCell key={key} align={key === 'Power' || key === 'Kill Points' || key === 'Dead' ? 'right' : 'left'} className={key === 'Name' ? 'font-medium text-white' : ''}>
                                   {formatNumber(row[key]) || row[key]}
                               </TableCell>
                           ))}
                       </TableRow>
                   ))}
               </tbody>
           </Table>
           {filteredData.length > 100 && (
               <div className="text-center text-xs text-gray-500 mt-2">Showing top 100 of {filteredData.length}</div>
           )}
       </Card>
    </div>
  );
};

export default OverviewDashboard;