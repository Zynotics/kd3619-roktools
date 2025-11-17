
import React from 'react';
import { PlayerStatChange } from '../types';
import { formatNumber } from '../utils';

interface PlayerSearchResultProps {
    result: PlayerStatChange;
}

const StatRow: React.FC<{ label: string, oldVal: number, newVal: number, diff: number }> = ({ label, oldVal, newVal, diff }) => {
    const diffColor = diff > 0 ? 'text-green-400' : diff < 0 ? 'text-red-400' : 'text-gray-400';
    return (
        <tr className="border-b bg-gray-800 border-gray-700">
            <td className="px-4 py-3 font-medium text-white whitespace-nowrap">{label}</td>
            <td className="px-4 py-3 text-right">{formatNumber(oldVal)}</td>
            <td className="px-4 py-3 text-right">{formatNumber(newVal)}</td>
            <td className={`px-4 py-3 text-right font-semibold ${diffColor}`}>
                {diff > 0 ? '+' : ''}{formatNumber(diff)}
            </td>
        </tr>
    );
};


const PlayerSearchResult: React.FC<PlayerSearchResultProps> = ({ result }) => {
    return (
        <div>
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-6 items-baseline mb-4">
                <h4 className="text-xl font-bold text-white">{result.name}</h4>
                <div className="flex gap-4 text-sm text-gray-400">
                    <span>ID: {result.id}</span>
                    <span>Alliance: {result.alliance || 'N/A'}</span>
                </div>
            </div>
            
            <div className="overflow-x-auto relative border border-gray-700 rounded-lg">
                <table className="w-full text-sm text-left text-gray-400">
                    <thead className="text-xs text-gray-400 uppercase bg-gray-700">
                        <tr>
                            <th className="px-4 py-3">Metric</th>
                            <th className="px-4 py-3 text-right">Old Value</th>
                            <th className="px-4 py-3 text-right">New Value</th>
                            <th className="px-4 py-3 text-right">Change</th>
                        </tr>
                    </thead>
                    <tbody>
                        <StatRow label="Power" oldVal={result.oldPower} newVal={result.newPower} diff={result.diffPower} />
                        <StatRow label="Kill Points" oldVal={result.oldKillPoints} newVal={result.newKillPoints} diff={result.diffKillPoints} />
                        <StatRow label="Troops Power" oldVal={result.oldTroopsPower} newVal={result.newTroopsPower} diff={result.diffTroopsPower} />
                        <StatRow label="Dead Troops" oldVal={result.oldDeadTroops} newVal={result.newDeadTroops} diff={result.diffDeadTroops} />
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default PlayerSearchResult;
