
import React, { useEffect, useRef } from 'react';
import { PlayerHonorHistory } from '../types';
import { formatNumber, abbreviateNumber } from '../utils';

declare var Chart: any;

interface HonorPlayerSearchResultProps {
    result: PlayerHonorHistory;
}

const HonorPlayerSearchResult: React.FC<HonorPlayerSearchResultProps> = ({ result }) => {
    const chartRef = useRef<HTMLCanvasElement>(null);
    const chartInstanceRef = useRef<any>(null);

    useEffect(() => {
        if (!chartRef.current || !result) return;
        
        const chartData = {
            labels: result.history.map(h => h.fileName),
            datasets: [{
                label: 'Honor Points',
                data: result.history.map(h => h.honorPoint),
                borderColor: 'rgba(250, 204, 21, 0.8)', // yellow-400
                backgroundColor: 'rgba(250, 204, 21, 0.2)',
                fill: true,
                tension: 0.1,
            }],
        };

        if (chartInstanceRef.current) {
            chartInstanceRef.current.destroy();
        }

        const ctx = chartRef.current.getContext('2d');
        if (!ctx) return;
        
        chartInstanceRef.current = new Chart(ctx, {
            type: 'line',
            data: chartData,
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: (context: any) => `Honor: ${formatNumber(context.parsed.y)}`
                        }
                    }
                },
                scales: {
                    x: { ticks: { color: '#9ca3af' }, grid: { color: 'rgba(255, 255, 255, 0.1)' } },
                    y: { ticks: { color: '#9ca3af', callback: (v: any) => abbreviateNumber(v) }, grid: { color: 'rgba(255, 255, 255, 0.1)' } }
                }
            }
        });

        return () => {
            if (chartInstanceRef.current) {
                chartInstanceRef.current.destroy();
                chartInstanceRef.current = null;
            }
        };

    }, [result]);

    return (
        <div>
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-6 items-baseline mb-4">
                <h4 className="text-xl font-bold text-white">{result.name}</h4>
                <div className="flex gap-4 text-sm text-gray-400">
                    <span>ID: {result.id}</span>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="relative h-64">
                    <canvas ref={chartRef}></canvas>
                </div>
                <div className="overflow-x-auto relative border border-gray-700 rounded-lg max-h-64">
                    <table className="w-full text-sm text-left text-gray-400">
                        <thead className="text-xs text-gray-400 uppercase bg-gray-700 sticky top-0">
                            <tr>
                                <th className="px-4 py-3">Date</th>
                                <th className="px-4 py-3 text-right">Honor Points</th>
                            </tr>
                        </thead>
                        <tbody>
                            {result.history.map((record, index) => (
                                <tr key={index} className="border-b bg-gray-800 border-gray-700 hover:bg-gray-600">
                                    <td className="px-4 py-2 font-medium text-white">{record.fileName}</td>
                                    <td className="px-4 py-2 text-right">{formatNumber(record.honorPoint)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default HonorPlayerSearchResult;
