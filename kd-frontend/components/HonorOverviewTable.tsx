// HonorOverviewTable.tsx - AKTUALISIERT
import React, { useState, useMemo } from 'react';
import type { HonorComparisonStats, PlayerHonorChange } from '../types';
import { Card } from './Card';
import { Table, TableHeader, TableRow, TableCell } from './Table';
import { formatNumber } from '../utils';

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

                if (aValue < bValue) return sortConfig.direction === 'ascending' ? -1 : 1;
                if (aValue > bValue) return sortConfig.direction === 'ascending' ? 1 : -1;
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

const SortIndicator: React.FC<{ direction?: SortDirection }> = ({ direction }) => {
    if (!direction) return null;
    return <span className="ml-1">{direction === 'ascending' ? '▲' : '▼'}</span>;
};

interface HonorOverviewTableProps {
    stats: HonorComparisonStats | null;
    error?: string | null;
    startFileName?: string;
    endFileName?: string;
}

const HonorRankingTable: React.FC<{ changes: PlayerHonorChange[] }> = ({ changes }) => {
    const { items: sortedChanges, requestSort, sortConfig } = useSortableData(changes, { key: 'diffHonor', direction: 'descending' });

    return (
        <Card className="p-6">
            <h3 className="text-lg font-semibold text-gray-200 mb-4">Honor Ranking ({changes.length})</h3>
            <Table maxHeight="75vh">
                <TableHeader>
                    <tr>
                        <TableCell align="left" header className="px-4 py-3">#</TableCell>
                        <TableCell 
                            align="left" 
                            header 
                            className="px-4 py-3 cursor-pointer select-none" 
                            onClick={() => requestSort('governorId')}
                        >
                            Gov ID {sortConfig?.key === 'governorId' && <SortIndicator direction={sortConfig.direction} />}
                        </TableCell>
                        <TableCell 
                            align="left" 
                            header 
                            className="px-4 py-3 cursor-pointer select-none" 
                            onClick={() => requestSort('name')}
                        >
                            Name {sortConfig?.key === 'name' && <SortIndicator direction={sortConfig.direction} />}
                        </TableCell>
                        <TableCell 
                            align="right" 
                            header 
                            className="px-4 py-3 cursor-pointer select-none" 
                            onClick={() => requestSort('oldHonor')}
                        >
                            Old Honor {sortConfig?.key === 'oldHonor' && <SortIndicator direction={sortConfig.direction} />}
                        </TableCell>
                        <TableCell 
                            align="right" 
                            header 
                            className="px-4 py-3 cursor-pointer select-none" 
                            onClick={() => requestSort('newHonor')}
                        >
                            New Honor {sortConfig?.key === 'newHonor' && <SortIndicator direction={sortConfig.direction} />}
                        </TableCell>
                        <TableCell 
                            align="right" 
                            header 
                            className="px-4 py-3 cursor-pointer select-none" 
                            onClick={() => requestSort('diffHonor')}
                        >
                            Change {sortConfig?.key === 'diffHonor' && <SortIndicator direction={sortConfig.direction} />}
                        </TableCell>
                    </tr>
                </TableHeader>
                <tbody>
                    {sortedChanges.map((p, index) => (
                        <TableRow key={p.governorId}>
                            <TableCell align="left" className="px-4 py-2 font-medium text-gray-300">{index + 1}</TableCell>
                            <TableCell align="left" className="px-4 py-2">{p.governorId}</TableCell>
                            <TableCell align="left" className="px-4 py-2 font-medium text-white">{p.name}</TableCell>
                            <TableCell align="right" className="px-4 py-2">{formatNumber(p.oldHonor)}</TableCell>
                            <TableCell align="right" className="px-4 py-2">{formatNumber(p.newHonor)}</TableCell>
                            <TableCell align="right" className={`px-4 py-2 font-semibold ${p.diffHonor > 0 ? 'text-green-400' : p.diffHonor < 0 ? 'text-red-400' : 'text-gray-400'}`}>
                                {p.diffHonor > 0 ? '+' : ''}{formatNumber(p.diffHonor)}
                            </TableCell>
                        </TableRow>
                    ))}
                </tbody>
            </Table>
        </Card>
    );
};

const HonorComparison: React.FC<HonorOverviewTableProps> = ({ stats, error, startFileName, endFileName }) => {
    if (error) {
        return (
            <Card className="p-4 text-center text-red-400 bg-red-900/50">
                {error}
            </Card>
        );
    }

    if (!stats || !stats.playerHonorChanges) {
        return (
            <Card gradient className="p-6 rounded-xl shadow-lg text-center text-gray-400">
                <p>Select a start and end date to see the honor comparison.</p>
                {startFileName && endFileName && (
                    <p className="text-sm text-gray-500 mt-2">
                        Comparing: {startFileName} → {endFileName}
                    </p>
                )}
            </Card>
        );
    }
    
    return (
        <div className="space-y-8">
            <HonorRankingTable changes={stats.playerHonorChanges} />
        </div>
    );
};

export default HonorComparison;