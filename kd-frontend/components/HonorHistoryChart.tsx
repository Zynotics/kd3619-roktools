import React, { useEffect, useRef, useMemo } from 'react';
import type { UploadedFile } from '../types';
import { parseGermanNumber, cleanFileName, abbreviateNumber, formatNumber, findColumnIndex } from '../utils';
import { Card } from './Card';

declare var Chart: any;

interface HonorHistoryChartProps {
    files: UploadedFile[];
    kingdomName?: string; // 👑 NEU
}

const HonorHistoryChart: React.FC<HonorHistoryChartProps> = ({ files, kingdomName = 'Kingdom' }) => {
    const chartRef = useRef<HTMLCanvasElement>(null);
    const chartInstanceRef = useRef<any>(null);

    const chartData = useMemo(() => {
        if (!files || !Array.isArray(files) || files.length < 1) return null;
        
        const labels = files.map(file => cleanFileName(file.name));
        const totalHonorData: number[] = [];

        files.forEach(file => {
            const honorIdx = findColumnIndex(file.headers, ['honor', 'honour']);
            let totalHonor = 0;

            if (honorIdx !== undefined) {
                file.data.forEach(row => {
                    totalHonor += parseGermanNumber(row[honorIdx]);
                });
            }
            totalHonorData.push(totalHonor);
        });

        return {
            labels,
            datasets: [{\n                label: 'Total Honor Points',
                data: totalHonorData,
                borderColor: 'rgba(250, 204, 21, 0.8)', // yellow-400
                backgroundColor: 'rgba(250, 204, 21, 0.2)',
                fill: true,
                tension: 0.1,
            }],
        };
    }, [files]);

    useEffect(() => {
        if (!chartRef.current || !chartData) return;

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
                    legend: { labels: { color: '#e5e7eb' } },
                    tooltip: {
                        callbacks: {
                            label: (context: any) => `Total Honor: ${formatNumber(context.parsed.y)}`
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
    }, [chartData]);

    // Anzeige wenn keine Daten da sind (mit dynamischem Namen)
    if (!files || !Array.isArray(files) || files.length < 1) {
        return (
            <Card gradient className="p-6 text-center text-gray-400">
                <h3 className="text-lg font-semibold text-gray-200 mb-2">{kingdomName} Honor History</h3>
                <p>Upload at least one file to see the honor progression.</p>
            </Card>
        );
    }
    
    return (
        <Card gradient className="p-6">
            <h3 className="text-lg font-semibold text-gray-200 mb-4">{kingdomName} Honor History</h3>
            <div className="relative h-72">
                <canvas ref={chartRef}></canvas>
            </div>
        </Card>
    );
};

export default HonorHistoryChart;