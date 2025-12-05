import React from 'react';
import { formatNumber } from '../utils';

interface TotalPowerDisplayProps {
  totalPower: number;
}

export const TotalPowerDisplay: React.FC<TotalPowerDisplayProps> = ({ totalPower }) => {
  return (
    <div className="grid grid-cols-1 mb-6">
      <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 shadow-lg text-center flex flex-col justify-center items-center">
        <h3 className="text-gray-400 font-medium text-sm uppercase tracking-wider mb-2">
          Total Kingdom Power
        </h3>
        <div className="text-4xl font-bold text-white">
          {formatNumber(totalPower)}
        </div>
      </div>
    </div>
  );
};

// Fallback, falls andere Komponenten noch den Default-Import nutzen (optional, aber sicher)
export default TotalPowerDisplay;