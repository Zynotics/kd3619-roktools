import React from 'react';
import { formatNumber } from '../utils';

interface StatCardProps {
  title: string;
  value: string;
  change?: number;
  changePercent?: number;
  changeColor?: string;
}

const StatCard: React.FC<StatCardProps> = ({ title, value, change, changePercent, changeColor }) => (
  <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg text-center">
    <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">{title}</h4>
    <p className="text-2xl font-bold text-gray-800 dark:text-gray-200">{value}</p>
    {(change !== undefined && changePercent !== undefined && changeColor) && (
      <p className={`text-sm font-semibold ${changeColor}`}>
        {change >= 0 ? '+' : ''}{formatNumber(change)} ({changePercent.toFixed(2)}%)
      </p>
    )}
  </div>
);

export default StatCard;
