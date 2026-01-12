// Table.tsx
import React from 'react';

interface TableProps {
  children: React.ReactNode;
  className?: string;
  maxHeight?: string;
  frame?: boolean;
}

export const Table: React.FC<TableProps> = ({
  children,
  className = '',
  maxHeight = 'auto',
  frame = true
}) => {
  const frameClasses = frame ? 'border border-white/5 rounded-lg' : '';
  return (
    <div
      className={`overflow-x-auto relative ${frameClasses} ${
        maxHeight !== 'auto' ? `max-h-${maxHeight}` : ''
      }`}
    >
      <table className={`w-full text-sm text-left text-slate-300 ${className}`}>
        {children}
      </table>
    </div>
  );
};

interface TableHeaderProps {
  children: React.ReactNode;
  sticky?: boolean;
}

export const TableHeader: React.FC<TableHeaderProps> = ({ children, sticky = true }) => {
  return (
    <thead
      className={`text-xs text-slate-400 uppercase bg-slate-900/80 ${
        sticky ? 'sticky top-0' : ''
      }`}
    >
      {children}
    </thead>
  );
};

interface TableRowProps {
  children: React.ReactNode;
  hover?: boolean;
  className?: string;
}

export const TableRow: React.FC<TableRowProps> = ({
  children,
  hover = true,
  className = '',
}) => {
  const hoverClass = hover ? 'hover:bg-white/5 transition-colors duration-200' : '';
  const baseClass = className.includes('bg-') ? '' : 'bg-slate-900/70';
  return (
    <tr className={`border-b border-white/5 ${baseClass} ${hoverClass} ${className}`}>
      {children}
    </tr>
  );
};

interface TableCellProps {
  children: React.ReactNode;
  align?: 'left' | 'center' | 'right';
  className?: string;
  header?: boolean;
  onClick?: React.MouseEventHandler<HTMLTableCellElement>;
}

export const TableCell: React.FC<TableCellProps> = ({
  children,
  align = 'left',
  className = '',
  header = false,
  onClick,
}) => {
  const alignClass =
    {
      left: 'text-left',
      center: 'text-center',
      right: 'text-right',
    }[align] || 'text-left';

  const textClass = header ? 'font-semibold text-white' : '';

  return (
    <td
      className={`px-4 py-3 whitespace-nowrap ${alignClass} ${textClass} ${className}`}
      onClick={onClick}
    >
      {children}
    </td>
  );
};
