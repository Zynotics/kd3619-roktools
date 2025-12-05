// ComparisonSection.tsx - FIXED (Named Export)
import React, { useState, useMemo } from 'react';
import type { ComparisonStats, PlayerInfo, PlayerStatChange } from '../types';
import { StatCard } from './StatCard'; // 🟢 Angepasst auf Named Import, falls StatCard so exportiert ist
import ColumnFilter from './ColumnFilter';
import { Card } from './Card';
import { Table, TableHeader, TableRow, TableCell } from './Table';
import { formatNumber } from '../utils';

// --- Column Definitions ---
const PLAYER_INFO_COLUMNS = [
    { key: 'id', title: 'Gov ID', align: 'left' },
    { key: 'name', title: 'Name', align: 'left' },
    { key: 'power', title: 'Power', align: 'right' },
    { key: 'alliance', title: 'Alliance', align: 'left' },
    { key: 't1Kills', title: 'T1 Kills', align: 'right' },
    { key: 't2Kills', title: 'T2 Kills', align: 'right' },
    { key: 't3Kills', title: 'T3 Kills', align: 'right' },
    { key: 't4Kills', title: 'T4 Kills', align: 'right' },
    { key: 't5Kills', title: 'T5 Kills', align: 'right' },
    { key: 'totalKillPoints', title: 'Kill Points', align: 'right' },
    { key: 'deadTroops', title: 'Dead Troops', align: 'right' },
    { key: 'cityHall', title: 'City Hall', align: 'center' },
    { key: 'troopsPower', title: 'Troops Power', align: 'right' },
    { key: 'techPower', title: 'Tech Power', align: 'right' },
    { key: 'buildingPower', title: 'Building Power', align: 'right' },
    { key: 'commanderPower', title: 'Commander Power', align: 'right' },
] as const;
type PlayerInfoKey = typeof PLAYER_INFO_COLUMNS[number]['key'];

const PLAYER_STAT_CHANGE_COLUMNS = [
    { key: 'id', title: 'Gov ID', align: 'left' },
    { key: 'name', title: 'Name', align: 'left' },
    { key: 'alliance', title: 'Alliance', align: 'left' },
    { key: 'oldPower', title: 'Old Power', align: 'right' },
    { key: 'newPower', title: 'New Power', align: 'right' },
    { key: 'diffPower', title: 'Power Δ', align: 'right' },
    { key: 'oldKillPoints', title: 'Old KP', align: 'right' },
    { key: 'newKillPoints', title: 'New KP', align: 'right' },
    { key: 'diffKillPoints', title: 'KP Δ', align: 'right' },
    { key: 'oldDeadTroops', title: 'Old Dead', align: 'right' },
    { key: 'newDeadTroops', title: 'New Dead', align: 'right' },
    { key: 'diffDeadTroops', title: 'Dead Δ', align: 'right' },
    { key: 'oldTroopsPower', title: 'Old Troops Power', align: 'right' },
    { key: 'newTroopsPower', title: 'New Troops Power', align: 'right' },
    { key: 'diffTroopsPower', title: 'Troops Power Δ', align: 'right' },
] as const;
type PlayerStatChangeKey = typeof PLAYER_STAT_CHANGE_COLUMNS[number]['key'];


// --- Sorting Hook ---
type SortDirection = 'ascending' | 'descending';
type SortConfig<T> = { key: keyof T; direction: SortDirection };

const useSortableData = <T extends {}>(items: T[] | undefined, initialConfig: SortConfig<T> | null = null) => {
    const [sortConfig, setSortConfig] = useState<SortConfig<T> | null>(initialConfig);

    const sortedItems = useMemo(() => {
        if (!items) return [];
        let sortableItems = [...items];
        if (sortConfig !== null) {
            sortableItems.sort((a, b) => {
                const aValue = a[sortConfig.key];
                const bValue = b[sortConfig.key];
                
                if (aValue == null) return 1;
                if (bValue == null) return -1;

                if (aValue < bValue) {
                    return sortConfig.direction === 'ascending' ? -1 : 1;
                }
                if (aValue > bValue) {
                    return sortConfig.direction === 'ascending' ? 1 : -1;
                }
                return 0;
            });
        }
        return sortableItems;
    }, [items, sortConfig]);

    const requestSort = (key: keyof T) => {
        let direction: SortDirection = 'ascending';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
            direction = 'descending';
        }
        setSortConfig({ key, direction });
    };

    return { items: sortedItems, requestSort, sortConfig };
};


// --- Component Props ---
interface ComparisonSectionProps {
  stats: ComparisonStats | null;
  error: string | null;
  file1Name: string | null;
  file2Name: string | null;
}

interface SortableTableProps<T> {
  requestSort: (key: keyof T) => void;
  sortConfig: SortConfig<T> | null;
}

// --- Filter Component ---
interface AllianceFilterProps {
  alliances: string[];
  selectedAlliance: string;
  onAllianceChange: (alliance: string) => void;
}

const AllianceFilter: React.FC<AllianceFilterProps> = ({ alliances, selectedAlliance, onAllianceChange }) => (
  <div className="relative">
    <select
      value={selectedAlliance}
      onChange={(e) => onAllianceChange(e.target.value)}
      className="pl-3 pr-8 py-1.5 text-sm font-medium text-gray-300 bg-gray-700 rounded-md hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-blue-500 appearance-none"
      aria-label="Filter by alliance"
    >
      <option value="all">All Alliances</option>
      {alliances.map(alliance => (
        <option key={alliance} value={alliance}>{alliance || '(No Alliance)'}</option>
      ))}
    </select>
  </div>
);


// --- Table Components with Sorting ---

const SortIndicator: React.FC<{ direction?: SortDirection }> = ({ direction }) => {
    if (!direction) return null;
    return <span className="ml-1">{direction === 'ascending' ? '▲' : '▼'}</span>;
};

// -- Generic Cell Renderers
const renderPlayerInfoCell = (player: PlayerInfo, key: PlayerInfoKey) => {
    const value = player[key];
    switch (key) {
        case 'id':
        case 'name':
        case 'alliance':
            return value || '-';
        case 'cityHall':
             return typeof value === 'number' ? value : '-';
        default:
            return formatNumber(value as number);
    }
};

const renderPlayerStatChangeCell = (change: PlayerStatChange, key: PlayerStatChangeKey) => {
    const value = change[key];
    if (typeof value === 'string' || value === undefined) {
        return value || '-';
    }
    
    if (key.startsWith('diff')) {
        const diff = value as number;
        return (
            <span className={`font-semibold ${
                diff > 0 ? 'text-green-400' : diff < 0 ? 'text-red-400' : 'text-gray-400'
            }`}>
                {diff > 0 ? '+' : ''}{formatNumber(diff)}
            </span>
        );
    }

    return formatNumber(value as number);
};


interface PlayerTableProps extends SortableTableProps<PlayerInfo> {
    title: string;
    players: PlayerInfo[];
    count: number;
    isExpanded: boolean;
    onToggleExpand: () => void;
    visibleColumns: PlayerInfoKey[];
    setVisibleColumns: (cols: PlayerInfoKey[]) => void;
    alliances: string[];
    selectedAlliance: string;
    onAllianceChange: (alliance: string) => void;
}

const PlayerTable: React.FC<PlayerTableProps> = ({ title, players, count, requestSort, sortConfig, isExpanded, onToggleExpand, visibleColumns, setVisibleColumns, alliances, selectedAlliance, onAllianceChange }) => (
    <Card className="p-6">
        <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-gray-200">
                {title} ({count})
            </h3>
            <div className="flex items-center gap-4">
                <AllianceFilter 
                    alliances={alliances}
                    selectedAlliance={selectedAlliance}
                    onAllianceChange={onAllianceChange}
                />
                <ColumnFilter 
                    allColumns={PLAYER_INFO_COLUMNS}
                    visibleColumns={visibleColumns}
                    setVisibleColumns={setVisibleColumns}
                />
                <button 
                    onClick={onToggleExpand} 
                    className="text-gray-400 hover:text-white transition-colors p-1 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500"
                    aria-label={isExpanded ? 'Collapse table' : 'Expand table'}
                >
                    {isExpanded ? (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    )}
                </button>
            </div>
        </div>
        <Table maxHeight={isExpanded ? '75vh' : '72'}>
            <TableHeader>
                <tr>
                    {visibleColumns.map(key => {
                        const col = PLAYER_INFO_COLUMNS.find(c => c.key === key);
                        if (!col) return null;
                        return (
                            <TableCell key={key} align={col.align as 'left' | 'center' | 'right'} header className="cursor-pointer select-none whitespace-nowrap" onClick={() => requestSort(key)}>
                                {col.title}
                                {sortConfig?.key === key && <SortIndicator direction={sortConfig.direction} />}
                            </TableCell>
                        )
                    })}
                </tr>
            </TableHeader>
            <tbody>
                {players.map(p => (
                    <TableRow key={p.id}>
                        {visibleColumns.map(key => {
                            const col = PLAYER_INFO_COLUMNS.find(c => c.key === key);
                            if (!col) return null;
                            return (
                                <TableCell key={key} align={col.align as 'left' | 'center' | 'right'} className={key === 'name' ? 'font-medium text-white' : ''}>
                                    {renderPlayerInfoCell(p, key)}
                                </TableCell>
                            )
                        })}
                    </TableRow>
                ))}
            </tbody>
        </Table>
    </Card>
);

interface PlayerStatChangesTableProps extends SortableTableProps<PlayerStatChange> {
    changes: PlayerStatChange[];
    count: number;
    isExpanded: boolean;
    onToggleExpand: () => void;
    visibleColumns: PlayerStatChangeKey[];
    setVisibleColumns: (cols: PlayerStatChangeKey[]) => void;
    alliances: string[];
    selectedAlliance: string;
    onAllianceChange: (alliance: string) => void;
}

const PlayerStatChangesTable: React.FC<PlayerStatChangesTableProps> = ({ changes, count, requestSort, sortConfig, isExpanded, onToggleExpand, visibleColumns, setVisibleColumns, alliances, selectedAlliance, onAllianceChange }) => {

    return (
        <Card className="p-6">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-200">
                    CH25 Player Stat Changes ({count})
                </h3>
                <div className="flex items-center gap-4">
                     <AllianceFilter 
                        alliances={alliances}
                        selectedAlliance={selectedAlliance}
                        onAllianceChange={onAllianceChange}
                     />
                     <ColumnFilter 
                        allColumns={PLAYER_STAT_CHANGE_COLUMNS}
                        visibleColumns={visibleColumns}
                        setVisibleColumns={setVisibleColumns}
                    />
                    <button 
                        onClick={onToggleExpand} 
                        className="text-gray-400 hover:text-white transition-colors p-1 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500"
                        aria-label={isExpanded ? 'Collapse table' : 'Expand table'}
                    >
                        {isExpanded ? (
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        )}
                    </button>
                </div>
            </div>
            <Table maxHeight={isExpanded ? '75vh' : '96'}>
                <TableHeader>
                    <tr>
                        {visibleColumns.map(key => {
                            const col = PLAYER_STAT_CHANGE_COLUMNS.find(c => c.key === key);
                            if (!col) return null;
                            return (
                                 <TableCell key={key} align={col.align as 'left' | 'center' | 'right'} header className="cursor-pointer select-none whitespace-nowrap" onClick={() => requestSort(key)}>
                                    {col.title}
                                    {sortConfig?.key === key && <SortIndicator direction={sortConfig.direction} />}
                                </TableCell>
                            );
                        })}
                    </tr>
                </TableHeader>
                <tbody>
                    {changes.map(c => (
                        <TableRow key={c.id}>
                            {visibleColumns.map(key => {
                                const col = PLAYER_STAT_CHANGE_COLUMNS.find(c => c.key === key);
                                if (!col) return null;
                                return (
                                    <TableCell key={key} align={col.align as 'left' | 'center' | 'right'} className={key === 'name' ? 'font-medium text-white' : ''}>
                                        {renderPlayerStatChangeCell(c, key)}
                                    </TableCell>
                                );
                            })}
                        </TableRow>
                    ))}
                </tbody>
            </Table>
        </Card>
    );
};


// 🟢 WICHTIG: "export const" für Named Import
export const ComparisonSection: React.FC<ComparisonSectionProps> = ({
  stats,
  error,
  file1Name,
  file2Name
}) => {
  // State for column visibility
  const [visibleStatChangeCols, setVisibleStatChangeCols] = useState<PlayerStatChangeKey[]>([
    'id',
    'name',
    'alliance',
    'diffKillPoints',
    'oldTroopsPower',
    'newTroopsPower',
    'diffTroopsPower',
  ]);
  const [visibleNewPlayerCols, setVisibleNewPlayerCols] = useState<PlayerInfoKey[]>([
    'id',
    'name',
    'power',
    'alliance',
    'totalKillPoints',
    'deadTroops',
    'troopsPower',
  ]);
  const [visibleDisappearedPlayerCols, setVisibleDisappearedPlayerCols] = useState<PlayerInfoKey[]>([
    'id',
    'name',
    'power',
    'alliance',
    'totalKillPoints',
    'deadTroops',
    'troopsPower',
  ]);
  
  // State for alliance filters
  const [statChangeAlliance, setStatChangeAlliance] = useState('all');
  const [newPlayerAlliance, setNewPlayerAlliance] = useState('all');
  const [disappearedPlayerAlliance, setDisappearedPlayerAlliance] = useState('all');

  // Memoize unique alliance lists for filters
  const statChangeAlliances = useMemo(() => {
    if (!stats?.playerStatChanges) return [];
    const alliances = new Set(stats.playerStatChanges.map(p => p.alliance || ''));
    return Array.from(alliances).sort();
  }, [stats?.playerStatChanges]);
  
  const newPlayerAlliances = useMemo(() => {
    if (!stats?.newPlayers) return [];
    const alliances = new Set(stats.newPlayers.map(p => p.alliance || ''));
    return Array.from(alliances).sort();
  }, [stats?.newPlayers]);

  const disappearedPlayerAlliances = useMemo(() => {
    if (!stats?.disappearedPlayers) return [];
    const alliances = new Set(stats.disappearedPlayers.map(p => p.alliance || ''));
    return Array.from(alliances).sort();
  }, [stats?.disappearedPlayers]);
  
  // Memoize filtered data
  const filteredStatChanges = useMemo(() => {
    if (!stats?.playerStatChanges) return [];
    if (statChangeAlliance === 'all') return stats.playerStatChanges;
    return stats.playerStatChanges.filter(p => (p.alliance || '') === statChangeAlliance);
  }, [stats?.playerStatChanges, statChangeAlliance]);

  const filteredNewPlayers = useMemo(() => {
    if (!stats?.newPlayers) return [];
    if (newPlayerAlliance === 'all') return stats.newPlayers;
    return stats.newPlayers.filter(p => (p.alliance || '') === newPlayerAlliance);
  }, [stats?.newPlayers, newPlayerAlliance]);
  
  const filteredDisappearedPlayers = useMemo(() => {
    if (!stats?.disappearedPlayers) return [];
    if (disappearedPlayerAlliance === 'all') return stats.disappearedPlayers;
    return stats.disappearedPlayers.filter(p => (p.alliance || '') === disappearedPlayerAlliance);
  }, [stats?.disappearedPlayers, disappearedPlayerAlliance]);

  // Use filtered data for sorting
  const { items: sortedPlayerStatChanges, requestSort: requestPlayerStatChangesSort, sortConfig: playerStatChangesSortConfig } = useSortableData<PlayerStatChange>(
    filteredStatChanges,
    { key: 'diffPower', direction: 'descending' }
  );
  const { items: sortedNewPlayers, requestSort: requestNewPlayersSort, sortConfig: newPlayersSortConfig } = useSortableData<PlayerInfo>(filteredNewPlayers, { key: 'power', direction: 'descending' });
  const { items: sortedDisappearedPlayers, requestSort: requestDisappearedPlayersSort, sortConfig: disappearedPlayersSortConfig } = useSortableData<PlayerInfo>(filteredDisappearedPlayers, { key: 'power', direction: 'descending' });

  const [expandedTables, setExpandedTables] = useState({
    playerChanges: false,
    newPlayers: false,
    disappearedPlayers: false,
  });

  const handleToggleExpand = (table: keyof typeof expandedTables) => {
    setExpandedTables(prev => ({ ...prev, [table]: !prev[table] }));
  };

  const getChangePercent = (diff: number, total1: number) => {
      if (total1 === 0) {
          return diff > 0 ? 100 : 0;
      }
      return (diff / total1) * 100;
  }

  if (error) {
     return (
        <Card className="p-4 text-center text-red-400 bg-red-900/50">
            {error}
        </Card>
     );
  }

  if (!stats) {
    return (
        <Card gradient className="flex flex-col items-center justify-center text-center text-gray-400 py-20">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V7a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <h2 className="text-2xl font-semibold text-white">Ready for Analysis</h2>
            <p className="mt-2">Please select a start and end date from the controls above, then click "Compare" to view the statistics.</p>
        </Card>
    );
  }

  return (
    <div className="space-y-8">
      <Card gradient className="p-6">
          <h3 className="text-lg font-semibold text-gray-200 mb-3">Summary</h3>
          <p className="mb-4 text-sm text-gray-400">
            Start: {file1Name ?? '–'} | End: {file2Name ?? '–'}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
             <StatCard
              title="Total Power"
              value={formatNumber(stats.totalPowerFile2)}
              change={stats.powerDifference}
              changePercent={getChangePercent(stats.powerDifference, stats.totalPowerFile1)}
              variant="gradient"
            />
            <StatCard
              title="Total Troops Power"
              value={formatNumber(stats.totalTroopsPowerFile2)}
              change={stats.troopsPowerDifference}
              changePercent={getChangePercent(stats.troopsPowerDifference, stats.totalTroopsPowerFile1)}
              variant="gradient"
            />
            <StatCard
              title="Total Kill Points"
              value={formatNumber(stats.totalKillPointsFile2)}
              change={stats.killPointsDifference}
              changePercent={getChangePercent(stats.killPointsDifference, stats.totalKillPointsFile1)}
              variant="gradient"
              color="text-red-400"
            />
            <StatCard
              title="Total Dead Troops"
              value={formatNumber(stats.totalDeadTroopsFile2)}
              change={stats.deadTroopsDifference}
              changePercent={getChangePercent(stats.deadTroopsDifference, stats.totalDeadTroopsFile1)}
              variant="gradient"
              color="text-gray-400"
            />
          </div>
      </Card>

      <PlayerStatChangesTable
          changes={sortedPlayerStatChanges}
          count={filteredStatChanges.length}
          requestSort={requestPlayerStatChangesSort}
          sortConfig={playerStatChangesSortConfig}
          isExpanded={expandedTables.playerChanges}
          onToggleExpand={() => handleToggleExpand('playerChanges')}
          visibleColumns={visibleStatChangeCols}
          setVisibleColumns={setVisibleStatChangeCols}
          alliances={statChangeAlliances}
          selectedAlliance={statChangeAlliance}
          onAllianceChange={setStatChangeAlliance}
      />

      <PlayerTable
          title="New CH25 Players"
          players={sortedNewPlayers}
          count={filteredNewPlayers.length}
          requestSort={requestNewPlayersSort}
          sortConfig={newPlayersSortConfig}
          isExpanded={expandedTables.newPlayers}
          onToggleExpand={() => handleToggleExpand('newPlayers')}
          visibleColumns={visibleNewPlayerCols}
          setVisibleColumns={setVisibleNewPlayerCols}
          alliances={newPlayerAlliances}
          selectedAlliance={newPlayerAlliance}
          onAllianceChange={setNewPlayerAlliance}
      />
      
      <PlayerTable
          title="Disappeared CH25 Players"
          players={sortedDisappearedPlayers}
          count={filteredDisappearedPlayers.length}
          requestSort={requestDisappearedPlayersSort}
          sortConfig={disappearedPlayersSortConfig}
          isExpanded={expandedTables.disappearedPlayers}
          onToggleExpand={() => handleToggleExpand('disappearedPlayers')}
          visibleColumns={visibleDisappearedPlayerCols}
          setVisibleColumns={setVisibleDisappearedPlayerCols}
          alliances={disappearedPlayerAlliances}
          selectedAlliance={disappearedPlayerAlliance}
          onAllianceChange={setDisappearedPlayerAlliance}
      />
    </div>
  );
};

// 🟢 Default Export ebenfalls beibehalten, für Files die es so importieren
export default ComparisonSection;