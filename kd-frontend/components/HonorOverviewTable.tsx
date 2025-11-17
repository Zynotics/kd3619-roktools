

import React, { useState, useMemo } from 'react';
import type { HonorComparisonStats, PlayerHonorChange } from '../types';
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
}

const HonorRankingTable: React.FC<{ changes: PlayerHonorChange[] }> = ({ changes }) => {
    const { items: sortedChanges, requestSort, sortConfig } = useSortableData(changes, { key: 'diffHonor', direction: 'descending' });

    return (
        <div className="bg-gray-800 p-6 rounded-xl shadow-lg">
            <h3 className="text-lg font-semibold text-gray-200 mb-4">Honor Ranking ({changes.length})</h3>
            <div className="overflow-x-auto relative border border-gray-700 rounded-lg max-h-[75vh]">
                <table className="w-full text-sm text-left text-gray-400">
                    <thead className="text-xs text-gray-400 uppercase bg-gray-700 sticky top-0">
                        <tr>
                            <th className="px-4 py-3">#</th>
                            <th className="px-4 py-3 cursor-pointer select-none" onClick={() => requestSort('governorId')}>
                                Gov ID {sortConfig?.key === 'governorId' && <SortIndicator direction={sortConfig.direction} />}
                            </th>
                            <th className="px-4 py-3 cursor-pointer select-none" onClick={() => requestSort('name')}>
                                Name {sortConfig?.key === 'name' && <SortIndicator direction={sortConfig.direction} />}
                            </th>
                            <th className="px-4 py-3 text-right cursor-pointer select-none" onClick={() => requestSort('oldHonor')}>
                                Old Honor {sortConfig?.key === 'oldHonor' && <SortIndicator direction={sortConfig.direction} />}
                            </th>
                            <th className="px-4 py-3 text-right cursor-pointer select-none" onClick={() => requestSort('newHonor')}>
                                New Honor {sortConfig?.key === 'newHonor' && <SortIndicator direction={sortConfig.direction} />}
                            </th>
                            <th className="px-4 py-3 text-right cursor-pointer select-none" onClick={() => requestSort('diffHonor')}>
                                Change {sortConfig?.key === 'diffHonor' && <SortIndicator direction={sortConfig.direction} />}
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {sortedChanges.map((p, index) => (
                            <tr key={p.governorId} className="border-b bg-gray-800 border-gray-700 hover:bg-gray-600">
                                <td className="px-4 py-2 font-medium text-gray-300">{index + 1}</td>
                                <td className="px-4 py-2">{p.governorId}</td>
                                <td className="px-4 py-2 font-medium text-white">{p.name}</td>
                                <td className="px-4 py-2 text-right">{formatNumber(p.oldHonor)}</td>
                                <td className="px-4 py-2 text-right">{formatNumber(p.newHonor)}</td>
                                <td className={`px-4 py-2 text-right font-semibold ${p.diffHonor > 0 ? 'text-green-400' : p.diffHonor < 0 ? 'text-red-400' : 'text-gray-400'}`}>
                                    {p.diffHonor > 0 ? '+' : ''}{formatNumber(p.diffHonor)}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

const HonorComparison: React.FC<HonorOverviewTableProps> = ({ stats }) => {
    if (!stats || !stats.playerHonorChanges) {
        return (
            <div className="bg-gray-800 p-6 rounded-xl shadow-lg text-center text-gray-400">
                <p>Select a start and end date to see the honor comparison.</p>
            </div>
        );
    }
    
    return (
        <div className="space-y-8">
            <HonorRankingTable changes={stats.playerHonorChanges} />
        </div>
    );
};

export default HonorComparison;