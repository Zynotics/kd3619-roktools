import React from 'react';
import { Card } from './Card';

const ApprovalPending: React.FC = () => {
  return (
    <Card className="max-w-md mx-auto p-8 text-center">
      <div className="text-yellow-400 mb-4">
        <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
      
      <h2 className="text-2xl font-bold text-white mb-4">Freigabe ausstehend</h2>
      
      <p className="text-gray-300 mb-4">
        Dein Account wurde erfolgreich registriert, benötigt aber noch die Freigabe durch einen Administrator.
      </p>
      
      <p className="text-gray-400 text-sm">
        Du wirst automatisch freigeschaltet, sobald ein Administrator deinen Account überprüft hat.
        Bitte versuche es später erneut.
      </p>
    </Card>
  );
};

export default ApprovalPending;
