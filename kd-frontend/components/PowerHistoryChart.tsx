import React, { useEffect, useRef, useMemo } from 'react';
import type { UploadedFile } from '../types';
import { parseGermanNumber, cleanFileName, abbreviateNumber, formatNumber } from '../utils';

declare var Chart: any;

interface PowerHistoryChartProps {
  files: UploadedFile[];
}

const PowerHistoryChart: React.FC<PowerHistoryChartProps> = ({ files }) => {
  const totalPowerChartRef = useRef<HTMLCanvasElement>(null);
  const troopsPowerChartRef = useRef<HTMLCanvasElement>(null);
  const killPointsChartRef = useRef<HTMLCanvasElement>(null);
  const deadTroopsChartRef = useRef<HTMLCanvasElement>(null);

  const totalPowerChartInstance = useRef<any>(null);
  const troopsPowerChartInstance = useRef<any>(null);
  const killPointsChartInstance = useRef<any>(null);
  const deadTroopsChartInstance = useRef<any>(null);

  const chartData = useMemo(() => {
    if (files.length < 2) {
      return null;
    }

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
      totalPowerData,
      troopsPowerData,
      totalKillPointsData,
      totalDeadTroopsData,
    };
  }, [files]);
  
  useEffect(() => {
    if (!chartData) {
      // Alle Charts zerstören wenn keine Daten
      [totalPowerChartInstance, troopsPowerChartInstance, killPointsChartInstance, deadTroopsChartInstance].forEach(chartRef => {
        if (chartRef.current) {
          chartRef.current.destroy();
          chartRef.current = null;
        }
      });
      return;
    }

    const { labels, totalPowerData, troopsPowerData, totalKillPointsData, totalDeadTroopsData } = chartData;

    // Total Power Chart
    if (totalPowerChartRef.current) {
      if (totalPowerChartInstance.current) {
        totalPowerChartInstance.current.destroy();
      }
      const ctx = totalPowerChartRef.current.getContext('2d');
      totalPowerChartInstance.current = new Chart(ctx, {
        type: 'line',
        data: {
          labels,
          datasets: [{
            label: 'Total Power',
            data: totalPowerData,
            borderColor: 'rgba(59, 130, 246, 0.8)',
            backgroundColor: 'rgba(59, 130, 246, 0.2)',
            fill: true,
            tension: 0.1,
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              display: false
            },
            tooltip: {
              callbacks: {
                label: function(context: any) {
                  return `Total Power: ${formatNumber(context.parsed.y)}`;
                }
              }
            }
          },
          scales: {
            x: {
              ticks: {
                color: '#9ca3af',
              },
              grid: {
                color: 'rgba(255, 255, 255, 0.1)',
              }
            },
            y: {
              ticks: {
                color: '#9ca3af',
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
    }

    // Troops Power Chart
    if (troopsPowerChartRef.current) {
      if (troopsPowerChartInstance.current) {
        troopsPowerChartInstance.current.destroy();
      }
      const ctx = troopsPowerChartRef.current.getContext('2d');
      troopsPowerChartInstance.current = new Chart(ctx, {
        type: 'line',
        data: {
          labels,
          datasets: [{
            label: 'Troops Power',
            data: troopsPowerData,
            borderColor: 'rgba(16, 185, 129, 0.8)',
            backgroundColor: 'rgba(16, 185, 129, 0.2)',
            fill: true,
            tension: 0.1,
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              display: false
            },
            tooltip: {
              callbacks: {
                label: function(context: any) {
                  return `Troops Power: ${formatNumber(context.parsed.y)}`;
                }
              }
            }
          },
          scales: {
            x: {
              ticks: {
                color: '#9ca3af',
              },
              grid: {
                color: 'rgba(255, 255, 255, 0.1)',
              }
            },
            y: {
              ticks: {
                color: '#9ca3af',
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
    }

    // Kill Points Chart
    if (killPointsChartRef.current) {
      if (killPointsChartInstance.current) {
        killPointsChartInstance.current.destroy();
      }
      const ctx = killPointsChartRef.current.getContext('2d');
      killPointsChartInstance.current = new Chart(ctx, {
        type: 'line',
        data: {
          labels,
          datasets: [{
            label: 'Total Kill Points',
            data: totalKillPointsData,
            borderColor: 'rgba(245, 158, 11, 0.8)',
            backgroundColor: 'rgba(245, 158, 11, 0.2)',
            fill: true,
            tension: 0.1,
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              display: false
            },
            tooltip: {
              callbacks: {
                label: function(context: any) {
                  return `Kill Points: ${formatNumber(context.parsed.y)}`;
                }
              }
            }
          },
          scales: {
            x: {
              ticks: {
                color: '#9ca3af',
              },
              grid: {
                color: 'rgba(255, 255, 255, 0.1)',
              }
            },
            y: {
              ticks: {
                color: '#9ca3af',
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
    }

    // Dead Troops Chart
    if (deadTroopsChartRef.current) {
      if (deadTroopsChartInstance.current) {
        deadTroopsChartInstance.current.destroy();
      }
      const ctx = deadTroopsChartRef.current.getContext('2d');
      deadTroopsChartInstance.current = new Chart(ctx, {
        type: 'line',
        data: {
          labels,
          datasets: [{
            label: 'Total Dead Troops',
            data: totalDeadTroopsData,
            borderColor: 'rgba(239, 68, 68, 0.8)',
            backgroundColor: 'rgba(239, 68, 68, 0.2)',
            fill: true,
            tension: 0.1,
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              display: false
            },
            tooltip: {
              callbacks: {
                label: function(context: any) {
                  return `Dead Troops: ${formatNumber(context.parsed.y)}`;
                }
              }
            }
          },
          scales: {
            x: {
              ticks: {
                color: '#9ca3af',
              },
              grid: {
                color: 'rgba(255, 255, 255, 0.1)',
              }
            },
            y: {
              ticks: {
                color: '#9ca3af',
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
    }

    return () => {
      // Cleanup function to destroy chart instances on component unmount
      [totalPowerChartInstance, troopsPowerChartInstance, killPointsChartInstance, deadTroopsChartInstance].forEach(chartRef => {
        if (chartRef.current) {
          chartRef.current.destroy();
          chartRef.current = null;
        }
      });
    };
  }, [chartData]);
  
  if (files.length < 2) {
    return (
      <div className="bg-gray-800 p-6 rounded-xl shadow-lg text-center text-gray-400 border border-gray-700">
        <h3 className="text-lg font-semibold text-gray-200 mb-2">CH 25 Kingdom Analytics</h3>
        <p>Upload at least two files to see the power progression over time.</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 p-6 rounded-xl shadow-lg border border-gray-700">
      <h3 className="text-lg font-semibold text-gray-200 mb-4">Power History</h3>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Total Power Chart */}
        <div className="bg-gray-700/50 p-4 rounded-lg border border-gray-600">
          <h4 className="text-md font-semibold text-gray-300 mb-3 text-center">Total Power</h4>
          <div className="relative h-64">
            <canvas ref={totalPowerChartRef}></canvas>
          </div>
        </div>

        {/* Troops Power Chart */}
        <div className="bg-gray-700/50 p-4 rounded-lg border border-gray-600">
          <h4 className="text-md font-semibold text-gray-300 mb-3 text-center">Troops Power</h4>
          <div className="relative h-64">
            <canvas ref={troopsPowerChartRef}></canvas>
          </div>
        </div>

        {/* Kill Points Chart */}
        <div className="bg-gray-700/50 p-4 rounded-lg border border-gray-600">
          <h4 className="text-md font-semibold text-gray-300 mb-3 text-center">Kill Points</h4>
          <div className="relative h-64">
            <canvas ref={killPointsChartRef}></canvas>
          </div>
        </div>

        {/* Dead Troops Chart */}
        <div className="bg-gray-700/50 p-4 rounded-lg border border-gray-600">
          <h4 className="text-md font-semibold text-gray-300 mb-3 text-center">Dead Troops</h4>
          <div className="relative h-64">
            <canvas ref={deadTroopsChartRef}></canvas>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PowerHistoryChart;