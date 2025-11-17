

import React, { useEffect, useRef, useMemo } from 'react';
import type { UploadedFile } from '../types';
import { parseGermanNumber, cleanFileName, abbreviateNumber, formatNumber } from '../utils';

// This makes the Chart object available from the CDN script in index.html
declare var Chart: any;

interface PowerHistoryChartProps {
  files: UploadedFile[];
}

const PowerHistoryChart: React.FC<PowerHistoryChartProps> = ({ files }) => {
  const chartRef = useRef<HTMLCanvasElement>(null);
  const chartInstanceRef = useRef<any>(null); // To hold the chart instance

  const chartData = useMemo(() => {
    if (files.length < 2) {
      return null;
    }

    // The component now respects the order of the files prop.
    const filesToRender = files;

    const labels = filesToRender.map(file => cleanFileName(file.name));
    const totalPowerData: number[] = [];
    const troopsPowerData: number[] = [];
    const totalKillPointsData: number[] = [];
    const totalDeadTroopsData: number[] = [];

    filesToRender.forEach(file => {
      const headerMap = new Map<string, number>();
      file.headers.forEach((h, i) => {
        if (h) {
          headerMap.set(h.trim(), i);
        }
      });

      const pIdx = headerMap.get('Power');
      const tpIdx = headerMap.get('Troops Power');
      const kpIdx = headerMap.get('Total Kill Points');
      const dtIdx = headerMap.get('Dead Troops');

      let totalPower = 0;
      let troopsPower = 0;
      let totalKillPoints = 0;
      let totalDeadTroops = 0;

      file.data.forEach(row => {
        if (pIdx !== undefined) totalPower += parseGermanNumber(row[pIdx]);
        if (tpIdx !== undefined) troopsPower += parseGermanNumber(row[tpIdx]);
        if (kpIdx !== undefined) totalKillPoints += parseGermanNumber(row[kpIdx]);
        if (dtIdx !== undefined) totalDeadTroops += parseGermanNumber(row[dtIdx]);
      });

      totalPowerData.push(totalPower);
      troopsPowerData.push(troopsPower);
      totalKillPointsData.push(totalKillPoints);
      totalDeadTroopsData.push(totalDeadTroops);
    });

    return {
      labels,
      datasets: [
        {
          label: 'Total Power',
          data: totalPowerData,
          borderColor: 'rgba(59, 130, 246, 0.8)', // blue-500
          backgroundColor: 'rgba(59, 130, 246, 0.2)',
          fill: true,
          tension: 0.1,
        },
        {
          label: 'Troops Power',
          data: troopsPowerData,
          borderColor: 'rgba(16, 185, 129, 0.8)', // emerald-500
          backgroundColor: 'rgba(16, 185, 129, 0.2)',
          fill: true,
          tension: 0.1,
        },
        {
          label: 'Total Kill Points',
          data: totalKillPointsData,
          borderColor: 'rgba(245, 158, 11, 0.8)', // amber-500
          backgroundColor: 'rgba(245, 158, 11, 0.2)',
          fill: true,
          tension: 0.1,
        },
        {
          label: 'Total Dead Troops',
          data: totalDeadTroopsData,
          borderColor: 'rgba(239, 68, 68, 0.8)', // red-500
          backgroundColor: 'rgba(239, 68, 68, 0.2)',
          fill: true,
          tension: 0.1,
        }
      ],
    };
  }, [files]);
  
  useEffect(() => {
    if (!chartData || !chartRef.current) {
        if (chartInstanceRef.current) {
            chartInstanceRef.current.destroy();
            chartInstanceRef.current = null; // Ensure we don't try to destroy it again
        }
        return;
    }

    // Destroy previous chart instance if it exists
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
          legend: {
            position: 'top',
            labels: {
                color: '#d1d5db', // gray-300
            }
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
            ticks: {
              color: '#9ca3af', // gray-400
            },
            grid: {
              color: 'rgba(255, 255, 255, 0.1)',
            }
          },
          y: {
            ticks: {
              color: '#9ca3af', // gray-400
              callback: function(value: any, index: any, values: any) {
                return abbreviateNumber(value);
              }
            },
            grid: {
              color: 'rgba(255, 255, 255, 0.1)',
            }
          }
        }
      }
    });

    return () => {
      // Cleanup function to destroy chart instance on component unmount
      if (chartInstanceRef.current) {
        chartInstanceRef.current.destroy();
        chartInstanceRef.current = null;
      }
    };
  }, [chartData]);
  
  if (files.length < 2) {
    return (
      <div className="bg-gray-800 p-6 rounded-xl shadow-lg text-center text-gray-400">
        <h3 className="text-lg font-semibold text-gray-200 mb-2">Power History</h3>
        <p>Upload at least two files to see the power progression over time.</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 p-6 rounded-xl shadow-lg">
        <h3 className="text-lg font-semibold text-gray-200 mb-4">Power History</h3>
        <div className="relative h-72">
            <canvas ref={chartRef}></canvas>
        </div>
    </div>
  );
};

export default PowerHistoryChart;