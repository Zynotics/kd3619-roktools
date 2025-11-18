// PlayerSearchResult.tsx - AKTUALISIERT
import React from 'react';
import { Card } from './Card';
import { Table, TableHeader, TableRow, TableCell } from './Table';
import { PlayerStatChange } from '../types';
import { formatNumber } from '../utils';

interface PlayerSearchResultProps {
    result: PlayerStatChange;
}

const PlayerSearchResult: React.FC<PlayerSearchResultProps> = ({ result }) => {
    return (
        <Card className="p-6">
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-6 items-baseline mb-4">
                <h4 className="text-xl font-bold text-white">{result.name}</h4>
                <div className="flex gap-4 text-sm text-gray-400">
                    <span>ID: {result.id}</span>
                    <span>Alliance: {result.alliance || 'N/A'}</span>
                </div>
            </div>
            
            <Table>
                <TableHeader>
                    <tr>
                        <TableCell align="left" header>Metric</TableCell>
                        <TableCell align="right" header>Old Value</TableCell>
                        <TableCell align="right" header>New Value</TableCell>
                        <TableCell align="right" header>Change</TableCell>
                    </tr>
                </TableHeader>
                <tbody>
                    <TableRow>
                        <TableCell align="left" className="font-medium text-white whitespace-nowrap">Power</TableCell>
                        <TableCell align="right">{formatNumber(result.oldPower)}</TableCell>
                        <TableCell align="right">{formatNumber(result.newPower)}</TableCell>
                        <TableCell align="right" className={`font-semibold ${result.diffPower > 0 ? 'text-green-400' : result.diffPower < 0 ? 'text-red-400' : 'text-gray-400'}`}>
                            {result.diffPower > 0 ? '+' : ''}{formatNumber(result.diffPower)}
                        </TableCell>
                    </TableRow>
                    <TableRow>
                        <TableCell align="left" className="font-medium text-white whitespace-nowrap">Kill Points</TableCell>
                        <TableCell align="right">{formatNumber(result.oldKillPoints)}</TableCell>
                        <TableCell align="right">{formatNumber(result.newKillPoints)}</TableCell>
                        <TableCell align="right" className={`font-semibold ${result.diffKillPoints > 0 ? 'text-green-400' : result.diffKillPoints < 0 ? 'text-red-400' : 'text-gray-400'}`}>
                            {result.diffKillPoints > 0 ? '+' : ''}{formatNumber(result.diffKillPoints)}
                        </TableCell>
                    </TableRow>
                    <TableRow>
                        <TableCell align="left" className="font-medium text-white whitespace-nowrap">Troops Power</TableCell>
                        <TableCell align="right">{formatNumber(result.oldTroopsPower)}</TableCell>
                        <TableCell align="right">{formatNumber(result.newTroopsPower)}</TableCell>
                        <TableCell align="right" className={`font-semibold ${result.diffTroopsPower > 0 ? 'text-green-400' : result.diffTroopsPower < 0 ? 'text-red-400' : 'text-gray-400'}`}>
                            {result.diffTroopsPower > 0 ? '+' : ''}{formatNumber(result.diffTroopsPower)}
                        </TableCell>
                    </TableRow>
                    <TableRow>
                        <TableCell align="left" className="font-medium text-white whitespace-nowrap">Dead Troops</TableCell>
                        <TableCell align="right">{formatNumber(result.oldDeadTroops)}</TableCell>
                        <TableCell align="right">{formatNumber(result.newDeadTroops)}</TableCell>
                        <TableCell align="right" className={`font-semibold ${result.diffDeadTroops > 0 ? 'text-green-400' : result.diffDeadTroops < 0 ? 'text-red-400' : 'text-gray-400'}`}>
                            {result.diffDeadTroops > 0 ? '+' : ''}{formatNumber(result.diffDeadTroops)}
                        </TableCell>
                    </TableRow>
                </tbody>
            </Table>
        </Card>
    );
};

export default PlayerSearchResult;