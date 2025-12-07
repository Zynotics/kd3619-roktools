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

    // Filtere die Daten basierend auf der Auswahl
    const chartData = useMemo(() => {
        if (!data || data.length === 0) return null;

        // Wenn keine Spieler ausgewählt sind, zeigen wir standardmäßig die Top 5 (nach aktuellem Honor)
        let playersToShow = [];
        if (selectedPlayerIds && selectedPlayerIds.length > 0) {
            playersToShow = data.filter(p => selectedPlayerIds.includes(p.id));
        } else {
            // Sortiere nach dem letzten bekannten Honor-Wert
            playersToShow = [...data]
                .sort((a, b) => {
                    const lastA = a.history[a.history.length - 1]?.honorPoint || 0;
                    const lastB = b.history[b.history.length - 1]?.honorPoint || 0;
                    return lastB - lastA;
                })
                .slice(0, 5);
        }

        if (playersToShow.length === 0) return null;

        // Alle einzigartigen Labels (Zeitpunkte/Dateinamen) sammeln
        // Wir nehmen an, dass alle Spieler ähnliche History-Einträge haben, aber sicherheitshalber sammeln wir alle.
        const allLabelsSet = new Set<string>();
        playersToShow.forEach(p => {
            p.history.forEach(h => allLabelsSet.add(h.fileName));
        });
        const labels = Array.from(allLabelsSet); 
        // Optional: Sortieren, falls die Labels Datumsinformationen enthalten, 
        // hier verlassen wir uns auf die Reihenfolge der Verarbeitung.

        const datasets = playersToShow.map((player, index) => {
            // Farben rotieren
            const colors = [
                '#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', 
                '#ec4899', '#6366f1', '#14b8a6'
            ];
            const color = colors[index % colors.length];

            // Datenpunkte mappen (falls ein Spieler zu einem Zeitpunkt keinen Eintrag hat, nutzen wir null oder den vorherigen Wert)
            const dataPoints = labels.map(label => {
                const entry = player.history.find(h => h.fileName === label);
                return entry ? entry.honorPoint : null;
            });

            return {
                label: player.name,
                data: dataPoints,
                borderColor: color,
                backgroundColor: color,
                tension: 0.1,
                pointRadius: 4,
                pointHoverRadius: 6
            };
        });

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
                                if (label) {
                                    label += ': ';
                                }
                                if (context.parsed.y !== null) {
                                    label += formatNumber(context.parsed.y);
                                }
                                return label;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        ticks: { color: '#9ca3af' },
                        grid: { color: 'rgba(255, 255, 255, 0.05)' }
                    },
                    y: {
                        ticks: { 
                            color: '#9ca3af',
                            callback: (value: any) => abbreviateNumber(value)
                        },
                        grid: { color: 'rgba(255, 255, 255, 0.05)' }
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
        return (
            <Card className="p-6 text-center text-gray-500 bg-gray-800">
                Keine Daten für den Chart verfügbar.
            </Card>
        );
    }

    return (
        <Card className="p-6 bg-gray-800 border-gray-700 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-200 mb-4">
                Honor Verlauf {selectedPlayerIds && selectedPlayerIds.length > 0 ? '(Ausgewählt)' : '(Top 5)'}
            </h3>
            <div className="relative h-80 w-full">
                <canvas ref={chartRef}></canvas>
            </div>
        </Card>
    );
};

export default HonorHistoryChart;