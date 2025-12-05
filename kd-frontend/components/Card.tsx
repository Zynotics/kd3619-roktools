import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  gradient?: boolean;
  onClick?: () => void;
}

// 🟢 Named Export für import { Card } from './Card'
export const Card: React.FC<CardProps> = ({ 
  children, 
  className = '', 
  gradient = false,
  onClick
}) => {
  const baseClasses = "rounded-xl border shadow-lg transition-all duration-200";
  
  const styleClasses = gradient
    ? "bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700 text-white"
    : "bg-gray-800 border-gray-700 text-gray-100";

  const hoverClasses = onClick 
    ? "cursor-pointer hover:shadow-xl hover:scale-[1.01] hover:border-gray-600" 
    : "";

  return (
    <div 
      className={`${baseClasses} ${styleClasses} ${hoverClasses} ${className}`}
      onClick={onClick}
    >
      {children}
    </div>
  );
};

// Default Export für Kompatibilität
export default Card;