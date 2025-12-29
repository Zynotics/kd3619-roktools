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
  const baseClasses = "rounded-xl shadow-xl border border-white/5";
  
  const paddingClasses = {
    sm: "p-4",
    md: "p-6", 
    lg: "p-8"
  };

  const gradientClasses = gradient 
    ? "bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900" 
    : "bg-slate-900/70";
    
  const hoverClasses = hover 
    ? "transition-all duration-300 hover:shadow-2xl hover:border-white/10 hover:-translate-y-0.5 cursor-pointer" 
    : "";

  return (
    <div className={`${baseClasses} ${gradientClasses} ${hoverClasses} ${paddingClasses[padding]} ${className}`}>
      {children}
    </div>
  );
};
