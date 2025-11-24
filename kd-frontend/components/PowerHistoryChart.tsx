import React, { useEffect, useRef } from 'react';
import Card from './Card';
import {
  abbreviateNumber,
  formatNumber
} from '../utils';

const PowerHistoryChart = ({ files }) => {
  const totalPowerChartRef = useRef(null);
  const troopsPowerChartRef = useRef(null);
  const killPointsChartRef = useRef(null);
  const deadTroopsChartRef = useRef(null);

  const totalPowerChartInstance = useRef(null);
  const troopsPowerChartInstance = useRef(null);
  const killPointsChartInstance = useRef(null);
  const deadTroopsChartInstance = useRef(null);

  // Chart rendering
  useEffect(() => {
    if (!files || !Array.isArray(files) || files.length < 2) {
      // Nichts anzeigen, kein Card, kein Text → sauberer Screen
      return;
    }

    const labels = files.map((f) => f.name);

    const totalPowerData = files.map((f) => f.totals.totalPower);
    const troopsPowerData = files.map((f) => f.totals.totalTroopsPower);
    const totalKillPointsData = files.map((f) => f.totals.totalKillPoints);
    const totalDeadTroopsData = files.map((f) => f.totals.totalDeadTroops);

    const cleanup = (ref) => {
      if (ref.current) {
        ref.current.destroy();
        ref.current = null;
      }
    };

    // Total Power Chart
    if (totalPowerChartRef.current) {
      cleanup(totalPowerChartInstance);
      const ctx = totalPowerChartRef.current.getContext('2d');
      totalPowerChartInstance.current = new Chart(ctx, {
        type: 'line',
        data: {
          labels,
          datasets: [
            {
              label: 'Total Power',
              data: totalPowerData,
              borderColor: 'rgba(59, 130, 246, 0.8)',
              backgroundColor: 'rgba(59, 130, 246, 0.2)',
              fill: true,
              tension: 0.1
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: (context) =>
                  `Power: ${formatNumber(context.parsed.y)}`
              }
            }
          },
          scales: {
            x: {
              ticks: { color: '#9ca3af' },
              grid: { color: 'rgba(255, 255, 255, 0.1)' }
            },
            y: {
              ticks: {
                color: '#9ca3af',
                callback: (v) => abbreviateNumber(v)
              },
              grid: { color: 'rgba(255, 255, 255, 0.1)' }
            }
          }
        }
      });
    }

    // Troops Power Chart
    if (troopsPowerChartRef.current) {
      cleanup(troopsPowerChartInstance);
      const ctx = troopsPowerChartRef.current.getContext('2d');
      troopsPowerChartInstance.current = new Chart(ctx, {
        type: 'line',
        data: {
          labels,
          datasets: [
            {
              label: 'Troops Power',
              data: troopsPowerData,
              borderColor: 'rgba(34, 197, 94, 0.8)',
              backgroundColor: 'rgba(34, 197, 94, 0.2)',
              fill: true,
              tension: 0.1
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: (context) =>
                  `Troops Power: ${formatNumber(context.parsed.y)}`
              }
            }
          },
          scales: {
            x: {
              ticks: { color: '#9ca3af' },
              grid: { color: 'rgba(255, 255, 255, 0.1)' }
            },
            y: {
              ticks: {
                color: '#9ca3af',
                callback: (v) => abbreviateNumber(v)
              },
              grid: { color: 'rgba(255, 255, 255, 0.1)' }
            }
          }
        }
      });
    }

    // Kill Points Chart
    if (killPointsChartRef.current) {
      cleanup(killPointsChartInstance);
      const ctx = killPointsChartRef.current.getContext('2d');
      killPointsChartInstance.current = new Chart(ctx, {
        type: 'line',
        data: {
          labels,
          datasets: [
            {
              label: 'Total Kill Points',
              data: totalKillPointsData,
              borderColor: 'rgba(245, 158, 11, 0.8)',
              backgroundColor: 'rgba(245, 158, 11, 0.2)',
              fill: true,
              tension: 0.1
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: (context) =>
                  `Kill Points: ${formatNumber(context.parsed.y)}`
              }
            }
          },
          scales: {
            x: {
              ticks: { color: '#9ca3af' },
              grid: { color: 'rgba(255, 255, 255, 0.1)' }
            },
            y: {
              ticks: {
                color: '#9ca3af',
                callback: (v) => abbreviateNumber(v)
              },
              grid: { color: 'rgba(255, 255, 255, 0.1)' }
            }
          }
        }
      });
    }

    // Dead Troops Chart
    if (deadTroopsChartRef.current) {
      cleanup(deadTroopsChartInstance);
      const ctx = deadTroopsChartRef.current.getContext('2d');
      deadTroopsChartInstance.current = new Chart(ctx, {
        type: 'line',
        data: {
          labels,
          datasets: [
            {
              label: 'Total Dead Troops',
              data: totalDeadTroopsData,
              borderColor: 'rgba(239, 68, 68, 0.8)',
              backgroundColor: 'rgba(239, 68, 68, 0.2)',
              fill: true,
              tension: 0.1
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: (context) =>
                  `Dead Troops: ${formatNumber(context.parsed.y)}`
              }
            }
          },
          scales: {
            x: {
              ticks: { color: '#9ca3af' },
              grid: { color: 'rgba(255, 255, 255, 0.1)' }
            },
            y: {
              ticks: {
                color: '#9ca3af',
                callback: (v) => abbreviateNumber(v)
              },
              grid: { color: 'rgba(255, 255, 255, 0.1)' }
            }
          }
        }
      });
    }

    return () => {
      cleanup(totalPowerChartInstance);
      cleanup(troopsPowerChartInstance);
      cleanup(killPointsChartInstance);
      cleanup(deadTroopsChartInstance);
    };
  }, [files]);

  // Wenn keine Charts angezeigt werden → einfach nichts rendern
  if (!files || !Array.isArray(files) || files.length < 2) {
    return null;
  }

  return (
    <Card gradient className="p-6">
      <h3 className="text-lg font-semibold text-gray-200 mb-4">
        CH25 Kingdom Analytics
      </h3>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card hover className="p-4">
          <h4 className="text-md font-semibold text-gray-300 mb-3 text-center">
            Total Power
          </h4>
          <div className="relative h-64">
            <canvas ref={totalPowerChartRef}></canvas>
          </div>
        </Card>

        <Card hover className="p-4">
          <h4 className="text-md font-semibold text-gray-300 mb-3 text-center">
            Troops Power
          </h4>
          <div className="relative h-64">
            <canvas ref={troopsPowerChartRef}></canvas>
          </div>
        </Card>

        <Card hover className="p-4">
          <h4 className="text-md font-semibold text-gray-300 mb-3 text-center">
            Kill Points
          </h4>
          <div className="relative h-64">
            <canvas ref={killPointsChartRef}></canvas>
          </div>
        </Card>

        <Card hover className="p-4">
          <h4 className="text-md font-semibold text-gray-300 mb-3 text-center">
            Dead Troops
          </h4>
          <div className="relative h-64">
            <canvas ref={deadTroopsChartRef}></canvas>
          </div>
        </Card>
      </div>
    </Card>
  );
};

export default PowerHistoryChart;
