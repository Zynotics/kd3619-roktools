
import React from 'react';
import PlayerSearchResult from './PlayerSearchResult';
import { PlayerStatChange } from '../types';

interface PlayerSearchProps {
    query: string;
    setQuery: (q: string) => void;
    onSearch: () => void;
    onClear: () => void;
    results: PlayerStatChange[] | 'not_found' | null;
    selectedPlayer: PlayerStatChange | null;
    onSelectPlayer: (player: PlayerStatChange) => void;
    isComparisonLoaded: boolean;
}

const PlayerSearch: React.FC<PlayerSearchProps> = ({ 
    query, 
    setQuery, 
    onSearch, 
    onClear, 
    results, 
    selectedPlayer, 
    onSelectPlayer, 
    isComparisonLoaded 
}) => {
    
    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            onSearch();
        }
    };
    
    return (
        <div className="bg-gray-800 p-6 rounded-xl shadow-lg">
            <h3 className="text-lg font-semibold text-gray-200 mb-4">Find Player</h3>
            <div className="flex flex-col sm:flex-row gap-4">
                <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Enter Player Name or Governor ID..."
                    className="flex-grow bg-gray-700 border border-gray-600 text-white text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 p-2.5 placeholder-gray-400 disabled:opacity-50"
                    disabled={!isComparisonLoaded}
                    aria-label="Search for a player by name or ID"
                />
                <button
                    onClick={onSearch}
                    disabled={!isComparisonLoaded || !query}
                    className="px-6 py-2.5 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:bg-blue-800 disabled:cursor-not-allowed transition-colors"
                >
                    Search
                </button>
                 {(results || selectedPlayer) && (
                     <button
                        onClick={onClear}
                        className="px-6 py-2.5 bg-gray-600 text-white font-semibold rounded-lg hover:bg-gray-500 transition-colors"
                    >
                        Clear
                    </button>
                 )}
            </div>
            {!isComparisonLoaded && <p className="text-sm text-gray-400 mt-2">Please run a comparison to enable search.</p>}

            <div className="mt-6">
                {results === 'not_found' && (
                    <div className="p-4 text-center text-amber-400 bg-amber-900/50 rounded-lg">
                        Player not found in the current comparison.
                    </div>
                )}
                 {Array.isArray(results) && (
                    <div>
                        <h4 className="text-md font-semibold text-gray-300 mb-3">Multiple players found. Please select one:</h4>
                        <ul className="space-y-2">
                            {results.map(player => (
                                <li key={player.id}>
                                    <button 
                                        onClick={() => onSelectPlayer(player)}
                                        className="w-full text-left p-3 rounded-lg bg-gray-700 hover:bg-gray-600 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    >
                                        <p className="font-semibold text-white">{player.name}</p>
                                        <p className="text-sm text-gray-400">ID: {player.id} | Alliance: {player.alliance || 'N/A'}</p>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
                {selectedPlayer && (
                    <PlayerSearchResult result={selectedPlayer} />
                )}
            </div>
        </div>
    );
};

export default PlayerSearch;
