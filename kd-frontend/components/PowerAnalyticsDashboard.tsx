import React from 'react';

interface PowerAnalyticsDashboardProps {
  isAdmin: boolean;
  backendUrl: string;
}

const PowerAnalyticsDashboard: React.FC<PowerAnalyticsDashboardProps> = ({ isAdmin, backendUrl }) => {
  return (
    <div className="space-y-8">
      <div className="bg-gray-800 p-6 rounded-xl shadow-lg border border-gray-700">
        <h2 className="text-2xl font-bold text-white mb-4">Power Analytics Dashboard</h2>
        <p className="text-gray-300">This is the new Power Analytics page!</p>
        <p className="text-gray-400 mt-2">Backend URL: {backendUrl}</p>
        <p className="text-gray-400">Admin Mode: {isAdmin ? 'Yes' : 'No'}</p>
      </div>
      
      <div className="bg-gray-800 p-6 rounded-xl shadow-lg border border-gray-700">
        <h3 className="text-lg font-semibold text-gray-200 mb-4">Player Search will be here</h3>
        <p className="text-gray-400">Search functionality coming soon...</p>
      </div>
    </div>
  );
};

export default PowerAnalyticsDashboard;