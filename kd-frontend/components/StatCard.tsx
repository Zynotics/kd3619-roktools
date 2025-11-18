// StatCard.tsx - ERWEITERTE Version
import React from 'react';
import { formatNumber } from '../utils';

interface StatCardProps {
  title: string;
  value: string;
  change?: number;
  changePercent?: number;
  changeColor?: string;
  icon?: React.ReactNode;
  variant?: 'default' | 'gradient' | 'hover';
  className?: string;
}

const StatCard: React.FC<StatCardProps> = ({ 
  title, 
  value, 
  change, 
  changePercent, 
  changeColor,
  icon,
  variant = 'default',
  className = ''
}) => {
  
  const variantClasses = {
    default: "bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg",
    gradient: "bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700 p-6 rounded-xl shadow-lg",
    hover: "bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700 p-6 rounded-xl shadow-lg transition-all duration-300 hover:shadow-xl hover:border-gray-600 hover:scale-[1.02]"
  };

  const cardClasses = `${variantClasses[variant]} text-center ${className}`;

  // Fallback für changeColor wenn nicht provided
  const calculatedChangeColor = changeColor || (change && change >= 0 ? 'text-green-400' : 'text-red-400');

  return (
    <div className={cardClasses}>
      {icon && <div className="flex justify-center mb-3">{icon}</div>}
      <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate mb-2">{title}</h4>
      <p className="text-2xl font-bold text-gray-800 dark:text-gray-200 mb-2">{value}</p>
      {(change !== undefined && changePercent !== undefined) && (
        <div className={`text-sm font-semibold ${calculatedChangeColor}`}>
          <span>
            {change >= 0 ? '+' : ''}{formatNumber(change)} 
          </span>
          <span className="text-gray-400 dark:text-gray-500 ml-2">
            ({changePercent >= 0 ? '+' : ''}{changePercent.toFixed(2)}%)
          </span>
        </div>
      )}
      {/* Fallback für alte changeColor Prop */}
      {(change !== undefined && changePercent !== undefined && changeColor) && (
        <p className={`text-sm font-semibold ${changeColor}`}>
          {change >= 0 ? '+' : ''}{formatNumber(change)} ({changePercent.toFixed(2)}%)
        </p>
      )}
    </div>
  );
};

export default StatCard;