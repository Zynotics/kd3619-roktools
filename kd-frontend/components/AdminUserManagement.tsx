import React, { useState, useEffect } from 'react';
import { Card } from './Card';
import { Table, TableHeader, TableRow, TableCell } from './Table';
import { useAuth } from './AuthContext';

interface User {
  id: string;
  email: string;
  username: string;
  isApproved: boolean;
  role: 'user' | 'admin';
  createdAt: string;
}

const AdminUserManagement: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user: currentUser } = useAuth();

  // Backend URL
  const BACKEND_URL = process.env.NODE_ENV === 'production' 
    ? 'https://kd3619-backend.onrender.com'
    : 'http://localhost:4000';

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      console.log('🔄 Fetching users...');
      const token = localStorage.getItem('authToken');
      if (!token) {
        setError('Nicht angemeldet');
        return;
      }

      const response = await fetch(`${BACKEND_URL}/api/admin/users`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log('📡 Users response status:', response.status);
      
      if (response.ok) {
        const userData = await response.json();
        console.log('✅ Users fetched successfully:', userData);
        setUsers(userData);
      } else if (response.status === 403) {
        setError('Keine Admin-Berechtigung');
      } else {
        const errorText = await response.text();
        console.log('❌ Users fetch failed:', errorText);
        throw new Error('Fehler beim Laden der Benutzer');
      }
    } catch (error) {
      console.error('💥 Error loading users:', error);
      setError('Konnte Benutzer nicht laden');
    } finally {
      setIsLoading(false);
    }
  };

  // VOLLSTÄNDIG REPARIERTE toggleApproval Funktion
  const toggleApproval = async (userId: string, approved: boolean) => {
    console.log('🔄 Frontend: Toggle approval', { userId, approved });
    
    try {
      const token = localStorage.getItem('authToken');
      console.log('🔐 Token:', token ? 'Present' : 'Missing');
      
      if (!token) {
        throw new Error('Nicht angemeldet');
      }

      const response = await fetch(`${BACKEND_URL}/api/admin/users/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ 
          userId, 
          approved 
        })
      });

      console.log('📡 Approve response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.log('❌ Server Error:', errorText);
        throw new Error(`Server responded with ${response.status}: ${errorText}`);
      }

      const result = await response.json();
      console.log('✅ Server Response:', result);
      
      // UI aktualisieren
      setUsers(users.map(user => 
        user.id === userId ? { ...user, isApproved: approved } : user
      ));
      
    } catch (error) {
      console.error('💥 Frontend Error in toggleApproval:', error);
      alert('Aktion konnte nicht durchgeführt werden: ' + error.message);
    }
  };

  if (isLoading) {
    return (
      <Card className="p-6 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
        <p className="mt-2 text-gray-400">Lade Benutzer...</p>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="p-6 text-center text-red-400 bg-red-900/50">
        {error}
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <h2 className="text-2xl font-bold text-white mb-6">Benutzerverwaltung</h2>
      
      <Table>
        <TableHeader>
          <tr>
            <TableCell align="left" header>Benutzername</TableCell>
            <TableCell align="left" header>E-Mail</TableCell>
            <TableCell align="center" header>Registriert am</TableCell>
            <TableCell align="center" header>Rolle</TableCell>
            <TableCell align="center" header>Freigabe</TableCell>
            <TableCell align="center" header>Aktionen</TableCell>
          </tr>
        </TableHeader>
        <tbody>
          {users.map(user => (
            <TableRow key={user.id}>
              <TableCell align="left" className="font-medium text-white">
                {user.username}
                {user.id === currentUser?.id && (
                  <span className="ml-2 text-xs text-blue-400">(Aktuell)</span>
                )}
              </TableCell>
              <TableCell align="left">{user.email}</TableCell>
              <TableCell align="center">
                {new Date(user.createdAt).toLocaleDateString('de-DE')}
              </TableCell>
              <TableCell align="center">
                <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                  user.role === 'admin' 
                    ? 'bg-purple-500 text-white' 
                    : 'bg-gray-500 text-white'
                }`}>
                  {user.role === 'admin' ? 'Admin' : 'User'}
                </span>
              </TableCell>
              <TableCell align="center">
                <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                  user.isApproved 
                    ? 'bg-green-500 text-white' 
                    : 'bg-yellow-500 text-black'
                }`}>
                  {user.isApproved ? 'Freigegeben' : 'Ausstehend'}
                </span>
              </TableCell>
              <TableCell align="center">
                {user.id !== currentUser?.id && user.role !== 'admin' && (
                  <div className="flex gap-2 justify-center">
                    {!user.isApproved ? (
                      <button
                        onClick={() => toggleApproval(user.id, true)}
                        className="bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700 transition-colors text-sm"
                      >
                        Freigeben
                      </button>
                    ) : (
                      <button
                        onClick={() => toggleApproval(user.id, false)}
                        className="bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700 transition-colors text-sm"
                      >
                        Sperren
                      </button>
                    )}
                  </div>
                )}
                {user.id === currentUser?.id && (
                  <span className="text-gray-500 text-sm">Eigenes Konto</span>
                )}
                {user.role === 'admin' && user.id !== currentUser?.id && (
                  <span className="text-gray-500 text-sm">Admin</span>
                )}
              </TableCell>
            </TableRow>
          ))}
        </tbody>
      </Table>
      
      {users.length === 0 && (
        <div className="text-center text-gray-400 py-8">
          Keine Benutzer gefunden
        </div>
      )}
    </Card>
  );
};

export default AdminUserManagement;