
import React from 'react';
import { formatNumber } from '../utils';

interface TotalPowerDisplayProps {
  power: number | null;
  fileName: string | null;
}

const TotalPowerDisplay: React.FC<TotalPowerDisplayProps> = ({ power, fileName }) => {
  if (power === null || fileName === null) {
    return null; // Don't render if no end date is selected
  }

  return (
    <div className="bg-gray-800 p-6 rounded-xl shadow-lg text-center">
      <h3 className="text-lg font-medium text-gray-400">
        Total Power at End Date ({fileName})
      </h3>
      <p className="text-4xl font-bold text-white mt-2">
        {formatNumber(power)}
      </p>
    </div>
  );
};

export default TotalPowerDisplay;
