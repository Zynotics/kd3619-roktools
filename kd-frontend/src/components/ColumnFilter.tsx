
import React, { useState, useRef, useEffect } from 'react';

interface ColumnFilterProps<T extends string> {
  allColumns: ReadonlyArray<{ key: T; title: string }>;
  visibleColumns: T[];
  setVisibleColumns: (cols: T[]) => void;
}

const ColumnFilter = <T extends string>({ allColumns, visibleColumns, setVisibleColumns }: ColumnFilterProps<T>) => {
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [wrapperRef]);


  const handleToggleColumn = (colKey: T) => {
    const newVisibleColumns = visibleColumns.includes(colKey)
      ? visibleColumns.filter(key => key !== colKey)
      : [...visibleColumns, colKey];
    
    // Maintain original order of allColumns
    const orderedVisibleColumns = allColumns
        .map(c => c.key)
        .filter(key => newVisibleColumns.includes(key));

    setVisibleColumns(orderedVisibleColumns);
  };

  return (
    <div className="relative" ref={wrapperRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="px-3 py-1.5 text-sm font-medium text-gray-300 bg-gray-700 rounded-md hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-blue-500"
      >
        Columns
        <svg xmlns="http://www.w3.org/2000/svg" className={`inline-block w-4 h-4 ml-1 transition-transform ${isOpen ? 'transform rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute right-0 z-20 w-56 mt-2 origin-top-right bg-gray-700 border border-gray-600 rounded-md shadow-lg ring-1 ring-black ring-opacity-5">
          <div className="p-2 grid grid-cols-1 gap-1 max-h-80 overflow-y-auto">
            {allColumns.map(({ key, title }) => (
              <label key={key} className="flex items-center px-2 py-1.5 text-sm text-gray-200 rounded-md hover:bg-gray-600 cursor-pointer">
                <input
                  type="checkbox"
                  className="w-4 h-4 text-blue-600 bg-gray-900 border-gray-500 rounded focus:ring-blue-500 focus:ring-offset-0 focus:ring-2"
                  checked={visibleColumns.includes(key)}
                  onChange={() => handleToggleColumn(key)}
                />
                <span className="ml-3">{title}</span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ColumnFilter;
