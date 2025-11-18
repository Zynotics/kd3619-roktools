// Card.tsx
import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
  gradient?: boolean;
  padding?: 'sm' | 'md' | 'lg';
}

export const Card: React.FC<CardProps> = ({ 
  children, 
  className = '', 
  hover = false,
  gradient = false,
  padding = 'md'
}) => {
  const baseClasses = "rounded-xl shadow-lg border border-gray-700";
  
  const paddingClasses = {
    sm: "p-4",
    md: "p-6", 
    lg: "p-8"
  };

  const gradientClasses = gradient 
    ? "bg-gradient-to-br from-gray-800 to-gray-900" 
    : "bg-gray-800";
    
  const hoverClasses = hover 
    ? "transition-all duration-300 hover:shadow-xl hover:border-gray-600 hover:scale-[1.02] cursor-pointer" 
    : "";

  return (
    <div className={`${baseClasses} ${gradientClasses} ${hoverClasses} ${paddingClasses[padding]} ${className}`}>
      {children}
    </div>
  );
};