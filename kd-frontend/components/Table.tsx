import React from 'react';

interface TableProps {
  children: React.ReactNode;
  className?: string;
  maxHeight?: string;
}

// 🟢 Named Exports für alle Unterkomponenten
export const Table: React.FC<TableProps> = ({ children, className = '', maxHeight = 'auto' }) => {
  return (
    <div
      className={`overflow-x-auto relative border border-gray-700 rounded-lg ${
        maxHeight !== 'auto' ? `max-h-${maxHeight}` : ''
      }`}
    >
      <table className={`w-full text-sm text-left text-gray-400 ${className}`}>
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
      className={`text-xs text-gray-400 uppercase bg-gray-700 ${
        sticky ? 'sticky top-0 z-10' : ''
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
  const hoverClass = hover ? 'hover:bg-gray-700/50 transition-colors duration-150' : '';
  return (
    <tr className={`border-b border-gray-700 last:border-0 ${hoverClass} ${className}`}>
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

  const textClass = header ? 'font-semibold text-gray-200 px-6 py-3' : 'px-6 py-4';
  const cursorClass = onClick ? 'cursor-pointer' : '';

  return (
    <td
      className={`${alignClass} ${textClass} ${cursorClass} ${className}`}
      onClick={onClick}
    >
      {children}
    </td>
  );
};