// HonorPlayerSearchResult.tsx
import React, { useEffect, useRef } from 'react';
import { Card } from './Card';
import { Table, TableHeader, TableRow, TableCell } from './Table';
import { PlayerHonorHistory } from '../types';
import { formatNumber, abbreviateNumber } from '../utils';
import Chart from 'chart.js/auto'; // 👈 NEU: Import statt globaler Variable

// ENTFERNT: declare var Chart: any; 

interface HonorPlayerSearchResultProps {
    result: PlayerHonorHistory;
}

const HonorPlayerSearchResult: React.FC<HonorPlayerSearchResultProps> = ({ result }) => {
    const chartRef = useRef<HTMLCanvasElement>(null);
    const chartInstanceRef = useRef<Chart | null>(null); // Typisierung verbessert

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
        
        // @ts-ignore - Ignoriere TS-Fehler für Chart-Initialisierung, falls Typen strikt sind
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
        <Card className="p-6">
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-6 items-baseline mb-4">
                <h4 className="text-xl font-bold text-white">{result.name}</h4>
                <div className="flex gap-4 text-sm text-gray-400">
                    <span>ID: {result.id}</span>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card hover className="p-4">
                    <h5 className="text-md font-semibold text-gray-300 mb-3 text-center">Honor Progression</h5>
                    <div className="relative h-64">
                        <canvas ref={chartRef}></canvas>
                    </div>
                </Card>
                
                <div className="overflow-x-auto relative border border-gray-700 rounded-lg max-h-64">
                    <Table>
                        <TableHeader>
                            <tr>
                                <TableCell align="left" header>Date</TableCell>
                                <TableCell align="right" header>Honor Points</TableCell>
                            </tr>
                        </TableHeader>
                        <tbody>
                            {result.history.map((record, index) => (
                                <TableRow key={index}>
                                    <TableCell align="left" className="font-medium text-white">{record.fileName}</TableCell>
                                    <TableCell align="right">{formatNumber(record.honorPoint)}</TableCell>
                                </TableRow>
                            ))}
                        </tbody>
                    </Table>
                </div>
            </div>
        </Card>
    );
};

export default HonorPlayerSearchResult;