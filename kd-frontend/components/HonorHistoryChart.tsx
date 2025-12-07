import React, { useEffect, useRef, useMemo } from 'react';
import { PlayerHonorHistory } from '../types';
import { formatNumber, abbreviateNumber } from '../utils';
import { Card } from './Card';
import Chart from 'chart.js/auto';

interface HonorHistoryChartProps {
    data: PlayerHonorHistory[];
    selectedPlayerIds?: string[];
}

const HonorHistoryChart: React.FC<HonorHistoryChartProps> = ({ data, selectedPlayerIds }) => {
    const chartRef = useRef<HTMLCanvasElement>(null);
    const chartInstanceRef = useRef<Chart | null>(null);

    const chartData = useMemo(() => {
        if (!data || data.length === 0) return null;

        // 1. Alle Zeitpunkte (Labels) sammeln (aus allen Datensätzen, um Lücken zu vermeiden)
        const allLabelsSet = new Set<string>();
        data.forEach(p => p.history.forEach(h => allLabelsSet.add(h.fileName)));
        const labels = Array.from(allLabelsSet); 
        // Hinweis: Wir gehen davon aus, dass die Reihenfolge durch die Sortierung im Parent (PublicKvKView) stimmt.

        let datasets = [];
        const hasSelection = selectedPlayerIds && selectedPlayerIds.length > 0;

        if (hasSelection) {
            // --- MODUS A: Ausgewählte Spieler vergleichen ---
            const playersToShow = data.filter(p => selectedPlayerIds!.includes(p.id));
            
            datasets = playersToShow.map((player, index) => {
                const colors = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#6366f1', '#14b8a6'];
                const color = colors[index % colors.length];

                // Datenpunkte mappen
                const dataPoints = labels.map(label => {
                    const entry = player.history.find(h => h.fileName === label);
                    return entry ? entry.honorPoint : null; // null unterbricht die Linie oder wird interpoliert
                });

                return {
                    label: player.name,
                    data: dataPoints,
                    borderColor: color,
                    backgroundColor: color,
                    tension: 0.2,
                    pointRadius: 4,
                    spanGaps: true
                };
            });
        } else {
            // --- MODUS B: Gesamtverlauf (Summe aller Spieler) ---
            const totalData = labels.map(label => {
                let sum = 0;
                // Summiere Honor aller Spieler zu diesem Zeitpunkt
                data.forEach(player => {
                    const entry = player.history.find(h => h.fileName === label);
                    if (entry) sum += entry.honorPoint;
                });
                return sum;
            });

            datasets.push({
                label: 'Gesamt Honor (Königreich)',
                data: totalData,
                borderColor: '#fbbf24', // Amber/Gold
                backgroundColor: 'rgba(251, 191, 36, 0.1)',
                fill: true,
                tension: 0.3,
                pointRadius: 4
            });
        }

        return { labels, datasets };
    }, [data, selectedPlayerIds]);

    useEffect(() => {
        if (!chartRef.current || !chartData) return;
        
        if (chartInstanceRef.current) {
            chartInstanceRef.current.destroy();
        }

        const ctx = chartRef.current.getContext('2d');
        if (!ctx) return;

        // @ts-ignore
        chartInstanceRef.current = new Chart(ctx, {
            type: 'line',
            data: chartData,
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    mode: 'index',
                    intersect: false,
                },
                plugins: {
                    legend: {
                        labels: { color: '#9ca3af' },
                        position: 'bottom'
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context: any) {
                                let label = context.dataset.label || '';
                                if (label) label += ': ';
                                if (context.parsed.y !== null) label += formatNumber(context.parsed.y);
                                return label;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        ticks: { color: '#9ca3af', maxRotation: 45, minRotation: 0 },
                        grid: { color: 'rgba(255, 255, 255, 0.05)' }
                    },
                    y: {
                        ticks: { 
                            color: '#9ca3af',
                            callback: (value: any) => abbreviateNumber(value)
                        },
                        grid: { color: 'rgba(255, 255, 255, 0.05)' },
                        beginAtZero: true
                    }
                }
            }
        });

        return () => {
            if (chartInstanceRef.current) {
                chartInstanceRef.current.destroy();
            }
        };
    }, [chartData]);

    if (!data || data.length === 0) {
        return <Card className="p-6 text-center text-gray-500 bg-gray-800">Keine Daten für den Chart verfügbar.</Card>;
    }

    return (
        <Card className="p-6 bg-gray-800 border-gray-700 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-200 mb-4">
                {selectedPlayerIds && selectedPlayerIds.length > 0 ? 'Spieler Vergleich' : 'Verlauf Gesamtpunkte'}
            </h3>
            <div className="relative h-80 w-full">
                <canvas ref={chartRef}></canvas>
            </div>
        </Card>
    );
};

export default HonorHistoryChart;