import React, { useEffect, useRef, useMemo } from 'react';
import type { UploadedFile } from '../types';
import { parseGermanNumber, cleanFileName, abbreviateNumber, findColumnIndex } from '../utils';
import { Card } from './Card';
import Chart from 'chart.js/auto'; // 👈 WICHTIG: Import statt globaler Variable

interface PowerHistoryChartProps {
  files: UploadedFile[];
}

const PowerHistoryChart: React.FC<PowerHistoryChartProps> = ({ files }) => {
  const totalPowerChartRef = useRef<HTMLCanvasElement | null>(null);
  const troopsPowerChartRef = useRef<HTMLCanvasElement | null>(null);
  const killPointsChartRef = useRef<HTMLCanvasElement | null>(null);
  const deadTroopsChartRef = useRef<HTMLCanvasElement | null>(null);

  const totalPowerChartInstance = useRef<Chart | null>(null);
  const troopsPowerChartInstance = useRef<Chart | null>(null);
  const killPointsChartInstance = useRef<Chart | null>(null);
  const deadTroopsChartInstance = useRef<Chart | null>(null);

  const chartData = useMemo(() => {
    if (!files || !Array.isArray(files) || files.length < 2) {
      return null;
    }

    // File list is shown newest-first; for charts we need oldest -> newest on X axis.
    const timelineFiles = [...files].reverse();
    const labels = timelineFiles.map(file => cleanFileName(file.name));

    const totalPowerData: number[] = [];
    const troopsPowerData: number[] = [];
    const totalKillPointsData: number[] = [];
    const totalDeadTroopsData: number[] = [];

    timelineFiles.forEach(file => {
      const getIdx = (candidates: string[]) => findColumnIndex(file.headers, candidates);

      const powerIdx = getIdx(['power', 'macht']);
      const troopsIdx = getIdx(['troopspower', 'troops power']);
      const kpIdx = getIdx(['total kill points', 'kill points', 'kp']);
      const deadIdx = getIdx(['deadtroops', 'dead troops', 'dead']);

      let sumPower = 0;
      let sumTroops = 0;
      let sumKP = 0;
      let sumDead = 0;

      file.data.forEach(row => {
        if (powerIdx !== undefined) sumPower += parseGermanNumber(row[powerIdx]);
        if (troopsIdx !== undefined) sumTroops += parseGermanNumber(row[troopsIdx]);
        if (kpIdx !== undefined) sumKP += parseGermanNumber(row[kpIdx]);
        if (deadIdx !== undefined) sumDead += parseGermanNumber(row[deadIdx]);
      });

      totalPowerData.push(sumPower);
      troopsPowerData.push(sumTroops);
      totalKillPointsData.push(sumKP);
      totalDeadTroopsData.push(sumDead);
    });

    return { labels, totalPowerData, troopsPowerData, totalKillPointsData, totalDeadTroopsData };
  }, [files]);

  const createChart = (ctx: CanvasRenderingContext2D, instanceRef: React.MutableRefObject<Chart | null>, label: string, data: number[], labels: string[], color: string) => {
    if (instanceRef.current) instanceRef.current.destroy();
    
    // @ts-ignore - Chart.js Typings können manchmal strikt sein bei dynamischen Daten
    return new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label,
          data,
          borderColor: color,
          backgroundColor: color.replace('1)', '0.2)').replace('0.8)', '0.2)'),
          fill: true,
          tension: 0.2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: '#9ca3af' }, grid: { display: false } },
          y: { ticks: { color: '#9ca3af', callback: (v: any) => abbreviateNumber(v) }, grid: { color: 'rgba(255, 255, 255, 0.05)' } }
        }
      }
    });
  };

  useEffect(() => {
    if (!chartData) return;

    if (totalPowerChartRef.current) {
        totalPowerChartInstance.current = createChart(
            totalPowerChartRef.current.getContext('2d')!, 
            totalPowerChartInstance, 
            'Total Power', 
            chartData.totalPowerData, 
            chartData.labels, 
            'rgba(59, 130, 246, 0.8)'
        );
    }
    if (troopsPowerChartRef.current) {
        troopsPowerChartInstance.current = createChart(
            troopsPowerChartRef.current.getContext('2d')!, 
            troopsPowerChartInstance, 
            'Troops Power', 
            chartData.troopsPowerData, 
            chartData.labels, 
            'rgba(16, 185, 129, 0.8)'
        );
    }
    if (killPointsChartRef.current) {
        killPointsChartInstance.current = createChart(
            killPointsChartRef.current.getContext('2d')!, 
            killPointsChartInstance, 
            'Kill Points', 
            chartData.totalKillPointsData, 
            chartData.labels, 
            'rgba(239, 68, 68, 0.8)'
        );
    }
    if (deadTroopsChartRef.current) {
        deadTroopsChartInstance.current = createChart(
            deadTroopsChartRef.current.getContext('2d')!, 
            deadTroopsChartInstance, 
            'Dead Troops', 
            chartData.totalDeadTroopsData, 
            chartData.labels, 
            'rgba(245, 158, 11, 0.8)'
        );
    }

    return () => {
      totalPowerChartInstance.current?.destroy();
      troopsPowerChartInstance.current?.destroy();
      killPointsChartInstance.current?.destroy();
      deadTroopsChartInstance.current?.destroy();
    };
  }, [chartData]);

  if (!chartData) return null;

  return (
    <div className="space-y-8">
      <h3 className="text-lg font-semibold text-gray-200 mb-4">Kingdom Progression</h3>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card hover className="p-4">
          <h4 className="text-md font-semibold text-gray-300 mb-3 text-center">Total Power</h4>
          <div className="relative h-64"><canvas ref={totalPowerChartRef}></canvas></div>
        </Card>
        <Card hover className="p-4">
          <h4 className="text-md font-semibold text-gray-300 mb-3 text-center">Troops Power</h4>
          <div className="relative h-64"><canvas ref={troopsPowerChartRef}></canvas></div>
        </Card>
        <Card hover className="p-4">
          <h4 className="text-md font-semibold text-gray-300 mb-3 text-center">Kill Points</h4>
          <div className="relative h-64"><canvas ref={killPointsChartRef}></canvas></div>
        </Card>
        <Card hover className="p-4">
          <h4 className="text-md font-semibold text-gray-300 mb-3 text-center">Dead Troops</h4>
          <div className="relative h-64"><canvas ref={deadTroopsChartRef}></canvas></div>
        </Card>
      </div>
    </div>
  );
};

export default PowerHistoryChart;
