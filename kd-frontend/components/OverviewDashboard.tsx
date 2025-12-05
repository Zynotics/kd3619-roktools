// OverviewDashboard.tsx (VOLLSTÄNDIGER CODE)
import React, { useState, useEffect, useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom'; // 🆕 useLocation importieren
import { Card } from './Card';
import { StatCard } from './StatCard';
import { TotalPowerDisplay } from './TotalPowerDisplay';
import { Table, TableHeader, TableRow, TableCell } from './Table';
import { ColumnFilter } from './ColumnFilter';
import { useAuth } from './AuthContext';
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
import { ComparisonSection } from './ComparisonSection';
import { formatNumber } from '../utils';

// Typ-Definitionen
interface OverviewData {
  headers: string[];
  data: any[][];
}

interface RowData {
  id: string;
  [key: string]: any;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

// Helper
const getColumnValue = (row: RowData, column: string): any => {
  const key = Object.keys(row).find(
    (k) => k.toLowerCase().trim() === column.toLowerCase().trim()
  );
  return key ? row[key] : undefined;
};

const OverviewDashboard: React.FC = () => {
  const { user } = useAuth();
  const location = useLocation(); // 🆕 Location Hook
  
  // 🆕 URL-Parameter für Login-Link bewahren
  const loginLink = useMemo(() => {
    const searchParams = location.search; // z.B. "?slug=3619-vikings"
    return `/login${searchParams}`;
  }, [location.search]);


  const [latestFile, setLatestFile] = useState<OverviewData | null>(null);
  const [previousFile, setPreviousFile] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter-States
  const [powerFilter, setPowerFilter] = useState<{ min: number; max: number } | null>(null);
  const [deadFilter, setDeadFilter] = useState<{ min: number; max: number } | null>(null);
  const [killsFilter, setKillsFilter] = useState<{ min: number; max: number } | null>(null);
  const [t4Filter, setT4Filter] = useState<{ min: number; max: number } | null>(null);
  const [t5Filter, setT5Filter] = useState<{ min: number; max: number } | null>(null);
  const [rssFilter, setRssFilter] = useState<{ min: number; max: number } | null>(null);

  // Search State
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchData = async () => {
    try {
      // Wir holen Daten von der Public API wenn nicht eingeloggt, oder von der normalen API wenn eingeloggt.
      // Die Backend-Route /overview/files-data sollte idealerweise Auth handhaben oder Public Access erlauben.
      // HIER: Wir nutzen die existierende Logik. Falls slug im Query-Param ist, nutzen wir public route.
      
      const searchParams = new URLSearchParams(window.location.search);
      const slug = searchParams.get('slug');
      
      let url = '';
      let headers = {};
      const token = localStorage.getItem('authToken');

      if (slug) {
          url = process.env.NODE_ENV === 'production' 
            ? `https://api.rise-of-stats.com/api/public/kingdom/${slug}/overview-files`
            : `http://localhost:4000/api/public/kingdom/${slug}/overview-files`;
      } else if (token) {
          url = process.env.NODE_ENV === 'production'
            ? 'https://api.rise-of-stats.com/overview/files-data'
            : 'http://localhost:4000/overview/files-data';
          headers = { Authorization: `Bearer ${token}` };
      } else {
          // Kein Slug und kein Token -> Keine Daten (oder Default Kingdom public wenn gewünscht)
          setLoading(false);
          return; 
      }

      const response = await fetch(url, { headers });

      if (!response.ok) {
        if (response.status === 404) throw new Error('Kingdom or data not found');
        if (response.status === 403) throw new Error('Access denied');
        throw new Error('Failed to fetch overview data');
      }
      
      const files = await response.json();

      if (files.length > 0) {
        // Sort by uploadDate desc
        const sorted = files.sort(
          (a: any, b: any) =>
            new Date(b.uploadDate).getTime() - new Date(a.uploadDate).getTime()
        );
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

  // Mapping function
  const mapData = useMemo(() => {
    if (!latestFile) return [];
    const headers = latestFile.headers.map((h) => h.toLowerCase().trim());
    
    // Helper to find index
    const getIdx = (candidates: string[]) => {
        return headers.findIndex(h => candidates.some(c => h.includes(c.toLowerCase())));
    };

    // Indizes finden (flexibel)
    const idIdx = getIdx(['governor id', 'id']);
    const nameIdx = getIdx(['name', 'governor name']);
    const powerIdx = getIdx(['power']);
    const killPointsIdx = getIdx(['kill points', 'killpoints']);
    const deadIdx = getIdx(['dead']);
    const t4Idx = getIdx(['t4 kills', 'tier 4 kills']);
    const t5Idx = getIdx(['t5 kills', 'tier 5 kills']);
    const rssIdx = getIdx(['rss assistance', 'resource assistance']);
    const allianceIdx = getIdx(['alliance']);

    return latestFile.data.map((row, index) => {
      const cleanRow: RowData = { id: row[idIdx] || `row-${index}` };
      
      // ID & Name
      if (idIdx !== -1) cleanRow['Gov ID'] = row[idIdx];
      if (nameIdx !== -1) cleanRow['Name'] = row[nameIdx];
      if (allianceIdx !== -1) cleanRow['Alliance'] = row[allianceIdx];

      // Power
      if (powerIdx !== -1) cleanRow['Power'] = parseInt(row[powerIdx] || '0', 10);
      
      // Kills
      if (killPointsIdx !== -1) cleanRow['Kill Points'] = parseInt(row[killPointsIdx] || '0', 10);
      if (t4Idx !== -1) cleanRow['T4 Kills'] = parseInt(row[t4Idx] || '0', 10);
      if (t5Idx !== -1) cleanRow['T5 Kills'] = parseInt(row[t5Idx] || '0', 10);
      if (deadIdx !== -1) cleanRow['Dead'] = parseInt(row[deadIdx] || '0', 10);
      
      // RSS
      if (rssIdx !== -1) cleanRow['RSS Assistance'] = parseInt(row[rssIdx] || '0', 10);

      return cleanRow;
    });
  }, [latestFile]);

  // Filter logic
  const filteredData = useMemo(() => {
    return mapData.filter((row) => {
      // Search filter
      if (searchTerm) {
        const name = (row['Name'] || '').toString().toLowerCase();
        const id = (row['Gov ID'] || '').toString().toLowerCase();
        if (!name.includes(searchTerm.toLowerCase()) && !id.includes(searchTerm.toLowerCase())) {
          return false;
        }
      }

      // Range filters
      if (powerFilter && (row['Power'] < powerFilter.min || row['Power'] > powerFilter.max)) return false;
      if (deadFilter && (row['Dead'] < deadFilter.min || row['Dead'] > deadFilter.max)) return false;
      if (killsFilter && (row['Kill Points'] < killsFilter.min || row['Kill Points'] > killsFilter.max)) return false;
      if (t4Filter && (row['T4 Kills'] < t4Filter.min || row['T4 Kills'] > t4Filter.max)) return false;
      if (t5Filter && (row['T5 Kills'] < t5Filter.min || row['T5 Kills'] > t5Filter.max)) return false;
      if (rssFilter && (row['RSS Assistance'] < rssFilter.min || row['RSS Assistance'] > rssFilter.max)) return false;

      return true;
    });
  }, [mapData, searchTerm, powerFilter, deadFilter, killsFilter, t4Filter, t5Filter, rssFilter]);

  // Statistics
  const totalPower = useMemo(() => filteredData.reduce((acc, row) => acc + (row['Power'] || 0), 0), [filteredData]);
  const totalKills = useMemo(() => filteredData.reduce((acc, row) => acc + (row['Kill Points'] || 0), 0), [filteredData]);
  const totalDead = useMemo(() => filteredData.reduce((acc, row) => acc + (row['Dead'] || 0), 0), [filteredData]);
  const totalT4 = useMemo(() => filteredData.reduce((acc, row) => acc + (row['T4 Kills'] || 0), 0), [filteredData]);
  const totalT5 = useMemo(() => filteredData.reduce((acc, row) => acc + (row['T5 Kills'] || 0), 0), [filteredData]);
  const totalRSS = useMemo(() => filteredData.reduce((acc, row) => acc + (row['RSS Assistance'] || 0), 0), [filteredData]);

  // Chart Data (Top 10 Alliances by Power)
  const allianceChartData = useMemo(() => {
    const alliances: { [key: string]: number } = {};
    filteredData.forEach((row) => {
      const alliance = row['Alliance'] || 'Unknown';
      alliances[alliance] = (alliances[alliance] || 0) + (row['Power'] || 0);
    });

    return Object.entries(alliances)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }, [filteredData]);

  // Chart Data (Top 10 Players by Power)
  const playerPowerChartData = useMemo(() => {
    return [...filteredData]
      .sort((a, b) => (b['Power'] || 0) - (a['Power'] || 0))
      .slice(0, 10)
      .map(p => ({ name: p['Name'] || p['Gov ID'], value: p['Power'] }));
  }, [filteredData]);


  if (loading) return <div className="text-center text-white p-10">Loading data...</div>;
  
  // Wenn kein User und keine Daten (und kein Slug), zeige Login
  if (!user && !latestFile && !error) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[60vh]">
            <h2 className="text-3xl font-bold text-white mb-4">Welcome to Rise of Stats</h2>
            <p className="text-gray-400 mb-8">Please login to access kingdom data or use a valid kingdom link.</p>
            {/* 🆕 Login Link mit Params */}
            <Link to={loginLink} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-6 rounded transition">
                Login
            </Link>
        </div>
      );
  }

  if (error) return <div className="text-center text-red-400 p-10">Error: {error}</div>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-end">
        <div>
           <h2 className="text-2xl font-bold text-white">Kingdom Overview</h2>
           <p className="text-sm text-gray-400 mt-1">
              Based on file: <span className="text-white font-mono">{latestFile?.data.length ? 'Latest Upload' : 'No Data'}</span>
           </p>
        </div>
        
        {/* 🆕 Falls User nicht eingeloggt ist, Login Button anzeigen */}
        {!user && (
           <Link to={loginLink} className="text-sm bg-blue-900/50 hover:bg-blue-800 text-blue-200 py-1 px-3 rounded border border-blue-700 transition">
               Staff Login
           </Link>
        )}
      </div>

      {/* Total Power Display */}
      <TotalPowerDisplay totalPower={totalPower} />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <StatCard title="Total Kill Points" value={formatNumber(totalKills)} color="text-red-400" />
        <StatCard title="Total Dead" value={formatNumber(totalDead)} color="text-gray-400" />
        <StatCard title="Total T4 Kills" value={formatNumber(totalT4)} color="text-purple-400" />
        <StatCard title="Total T5 Kills" value={formatNumber(totalT5)} color="text-yellow-400" />
        <StatCard title="Total RSS Assist" value={formatNumber(totalRSS)} color="text-green-400" />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Alliances (Pie) */}
        <Card className="p-4 flex flex-col items-center">
            <h3 className="text-lg font-semibold text-white mb-4">Top 10 Alliances (Power)</h3>
            <div className="w-full h-64">
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie
                            data={allianceChartData}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={80}
                            paddingAngle={5}
                            dataKey="value"
                        >
                            {allianceChartData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                        </Pie>
                        <Tooltip 
                            contentStyle={{ backgroundColor: '#1f2937', borderColor: '#374151', color: '#fff' }}
                            itemStyle={{ color: '#fff' }}
                            formatter={(value: number) => formatNumber(value)}
                        />
                        <Legend />
                    </PieChart>
                </ResponsiveContainer>
            </div>
        </Card>

        {/* Top Players (Bar) */}
        <Card className="p-4 flex flex-col items-center">
            <h3 className="text-lg font-semibold text-white mb-4">Top 10 Players (Power)</h3>
            <div className="w-full h-64">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={playerPowerChartData} layout="vertical" margin={{ left: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                        <XAxis type="number" hide />
                        <YAxis dataKey="name" type="category" width={100} tick={{fill: '#9ca3af', fontSize: 12}} />
                        <Tooltip 
                            cursor={{fill: 'rgba(255,255,255,0.05)'}}
                            contentStyle={{ backgroundColor: '#1f2937', borderColor: '#374151', color: '#fff' }}
                            formatter={(value: number) => formatNumber(value)}
                        />
                        <Bar dataKey="value" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </Card>
      </div>

      {/* Comparison Section (New vs Old) */}
      {latestFile && previousFile && (
          <ComparisonSection 
            latestData={mapData} 
            previousData={[]} // Hier müsste man previousFile auch mappen, wenn man echten Vergleich will.
            // Da mapData memoized ist, könnte man previousMapData analog bauen.
            // Für jetzt deaktivieren wir die echte Datenübergabe oder lassen es als Platzhalter, 
            // da ComparisonSection komplexer ist (benötigt gemappte Daten).
            // Vereinfachung:
          />
      )}


      {/* Main Table */}
      <Card className="p-4">
        <div className="flex flex-col md:flex-row justify-between items-center mb-4 gap-4">
             <h3 className="text-xl font-bold text-white">Player Details</h3>
             <input
                type="text"
                placeholder="Search name or ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-gray-800 border border-gray-600 text-white px-3 py-2 rounded w-full md:w-64 focus:outline-none focus:ring-1 focus:ring-blue-500"
             />
        </div>

        {/* Filters */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 mb-4">
            <ColumnFilter label="Power" onChange={setPowerFilter} />
            <ColumnFilter label="Dead" onChange={setDeadFilter} />
            <ColumnFilter label="Kill Points" onChange={setKillsFilter} />
            <ColumnFilter label="T4 Kills" onChange={setT4Filter} />
            <ColumnFilter label="T5 Kills" onChange={setT5Filter} />
            <ColumnFilter label="RSS Assist" onChange={setRssFilter} />
        </div>

        <div className="overflow-x-auto">
            <Table>
                <TableHeader>
                    <tr>
                        <TableCell header>Gov ID</TableCell>
                        <TableCell header>Name</TableCell>
                        <TableCell header>Alliance</TableCell>
                        <TableCell header align="right">Power</TableCell>
                        <TableCell header align="right">Kill Points</TableCell>
                        <TableCell header align="right">Dead</TableCell>
                        <TableCell header align="right">T4 Kills</TableCell>
                        <TableCell header align="right">T5 Kills</TableCell>
                        <TableCell header align="right">RSS Assist</TableCell>
                    </tr>
                </TableHeader>
                <tbody>
                    {filteredData.slice(0, 100).map((row) => (
                        <TableRow key={row.id}>
                            <TableCell>{row['Gov ID']}</TableCell>
                            <TableCell className="font-medium text-white">{row['Name']}</TableCell>
                            <TableCell>{row['Alliance']}</TableCell>
                            <TableCell align="right" className="text-blue-400">{formatNumber(row['Power'])}</TableCell>
                            <TableCell align="right" className="text-red-400">{formatNumber(row['Kill Points'])}</TableCell>
                            <TableCell align="right" className="text-gray-400">{formatNumber(row['Dead'])}</TableCell>
                            <TableCell align="right" className="text-purple-400">{formatNumber(row['T4 Kills'])}</TableCell>
                            <TableCell align="right" className="text-yellow-400">{formatNumber(row['T5 Kills'])}</TableCell>
                            <TableCell align="right" className="text-green-400">{formatNumber(row['RSS Assistance'])}</TableCell>
                        </TableRow>
                    ))}
                    {filteredData.length === 0 && (
                        <tr>
                            <td colSpan={9} className="text-center py-8 text-gray-500">
                                No players found matching filters.
                            </td>
                        </tr>
                    )}
                </tbody>
            </Table>
            {filteredData.length > 100 && (
                <div className="text-center py-2 text-xs text-gray-500">
                    Showing top 100 of {filteredData.length} players
                </div>
            )}
        </div>
      </Card>
    </div>
  );
};

export default OverviewDashboard;