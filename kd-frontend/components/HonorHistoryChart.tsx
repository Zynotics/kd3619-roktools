import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { PlayerHonorHistory } from '../types';
import { formatNumber } from '../utils';
import { TotalHonorHistory } from './PublicKvKView';

interface HonorHistoryChartProps {
  data: PlayerHonorHistory[];
  totalData?: TotalHonorHistory;
  selectedPlayerIds?: string[];
}

const HonorHistoryChart: React.FC<HonorHistoryChartProps> = ({ data, totalData, selectedPlayerIds }) => {
  // Wenn keine Spieler ausgewählt sind und keine Totaldaten da sind, zeige nichts oder Platzhalter
  if ((!selectedPlayerIds || selectedPlayerIds.length === 0) && (!totalData || totalData.length === 0)) {
    return <div className="text-center text-gray-500">No data to display.</div>;
  }

  // 1. Datenaufbereitung
  // Wir müssen alle Daten (Spieler oder Total) in ein Array mergen, das Recharts versteht.
  // Wir nehmen an, dass alle Serien die gleichen "fileName" Labels haben (diese dienen als X-Achse).
  
  // Basis sind die Total-Daten (da diese immer für alle Dateien existieren sollten)
  // Wenn totalData fehlt, nehmen wir den ersten Spieler als "Zeitbasis".
  const baseTimeline = totalData && totalData.length > 0 
      ? totalData 
      : (data[0]?.history || []);

  const chartData = baseTimeline.map((entry, idx) => {
      const point: any = {
          name: entry.fileName, // X-Achsen Label
          total: totalData ? totalData[idx]?.totalHonor : 0
      };

      // Füge ausgewählte Spieler hinzu
      if (selectedPlayerIds) {
          selectedPlayerIds.forEach(pid => {
              const player = data.find(p => p.id === pid);
              if (player) {
                  // Finde den passenden History-Eintrag (wir matchen hier einfach über den Index, 
                  // da die Dateien in der gleichen Reihenfolge verarbeitet wurden)
                  // Sicherer wäre Matching über fileId, aber Index sollte passen, da alles aus der gleichen Liste kommt.
                  const pEntry = player.history[idx];
                  if (pEntry) {
                      point[player.name] = pEntry.honorPoint;
                  }
              }
          });
      }
      return point;
  });

  // Farben für Spielerlinien
  const colors = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#6366f1"];

  return (
    <div className="bg-gray-800 p-4 rounded-xl shadow-lg border border-gray-700">
      <h3 className="text-lg font-semibold text-white mb-4">Honor Progression</h3>
      <div className="h-[400px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis 
                dataKey="name" 
                stroke="#9ca3af" 
                tick={{ fill: '#9ca3af' }}
                tickMargin={10}
            />
            
            {/* Linke Y-Achse (für Spieler) */}
            <YAxis 
                yAxisId="left"
                stroke="#9ca3af" 
                tick={{ fill: '#9ca3af' }}
                tickFormatter={(val) => formatNumber(val)}
            />

            {/* Rechte Y-Achse (für Total) - nur anzeigen wenn keine Spieler da sind oder optional */}
            <YAxis 
                yAxisId="right" 
                orientation="right" 
                stroke="#fbbf24" // Gelb für Total
                tick={{ fill: '#fbbf24' }}
                tickFormatter={(val) => formatNumber(val)}
            />

            <Tooltip 
                contentStyle={{ backgroundColor: '#1f2937', borderColor: '#374151', color: '#f3f4f6' }}
                formatter={(value: number) => formatNumber(value)}
            />
            <Legend wrapperStyle={{ paddingTop: '20px' }}/>

            {/* Linie für Total Honor (immer anzeigen, oder nur wenn keine Spieler? Hier immer.) */}
            {totalData && totalData.length > 0 && (
                <Line 
                    yAxisId="right"
                    type="monotone" 
                    dataKey="total" 
                    name="Kingdom Total Honor" 
                    stroke="#fbbf24" 
                    strokeWidth={3}
                    dot={{ r: 4 }}
                    activeDot={{ r: 6 }}
                />
            )}

            {/* Linien für ausgewählte Spieler */}
            {selectedPlayerIds && selectedPlayerIds.map((pid, index) => {
                const player = data.find(p => p.id === pid);
                if (!player) return null;
                return (
                    <Line
                        yAxisId="left"
                        key={pid}
                        type="monotone"
                        dataKey={player.name}
                        stroke={colors[index % colors.length]}
                        strokeWidth={2}
                        dot={{ r: 3 }}
                    />
                );
            })}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default HonorHistoryChart;