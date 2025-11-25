import React, { useState } from 'react';
import { useAuth } from './AuthContext';
import { Card } from './Card';

const LoginPrompt: React.FC = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [governorId, setGovernorId] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const { login, register } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);
    setIsLoading(true);

    try {
      if (isLogin) {
        // Normaler Login
        await login(username, password);
      } else {
        // Registrierung: Passwort-Abgleich
        if (password !== confirmPassword) {
          setError('Die Passwörter stimmen nicht überein.');
          setIsLoading(false);
          return;
        }

        if (!governorId.trim()) {
          setError('Bitte geben Sie Ihre Gov ID ein.');
          setIsLoading(false);
          return;
        }

        // Registrierung mit Gov ID
        await register(email, username, password, governorId.trim());

        // Direkt danach automatisch einloggen
        await login(username, password);

        // Hinweis anzeigen
        setSuccessMessage('Account erfolgreich erstellt!');

        // Felder leeren
        setEmail('');
        setUsername('');
        setGovernorId('');
        setPassword('');
        setConfirmPassword('');
      }
    } catch (err: any) {
      const msg = err?.message || 'Ein Fehler ist aufgetreten.';

      // 👉 Spezielle, klare Meldung für falsche Gov ID
      if (msg.toLowerCase().includes('gov id')) {
        setError(
          'Die angegebene Gov ID wurde in den hochgeladenen Daten nicht gefunden. ' +
          'Bitte überprüfe die Eingabe oder wende dich an einen Admin.'
        );
      } else {
        setError(msg);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const switchMode = () => {
    setIsLogin(!isLogin);
    setError(null);
    setSuccessMessage(null);
    setEmail('');
    setUsername('');
    setGovernorId('');
    setPassword('');
    setConfirmPassword('');
  };

  return (
    <Card className="max-w-md mx-auto p-8">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-white mb-2">
          {isLogin ? 'Anmelden' : 'Registrieren'}
        </h2>
        <p className="text-gray-400">
          {isLogin
            ? 'Melden Sie sich an, um auf das Overview Dashboard zuzugreifen'
            : 'Erstellen Sie einen Account für den Zugriff auf das Overview Dashboard'}
        </p>
      </div>

      {successMessage && (
        <div className="mb-4 p-4 bg-green-900/50 border border-green-700 rounded-lg text-green-400 text-sm">
          {successMessage}
        </div>
      )}

      {error && (
        <div className="mb-4 p-4 bg-red-900/50 border border-red-700 rounded-lg text-red-400 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {!isLogin && (
          <>
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-gray-400 mb-1"
              >
                E-Mail
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-gray-700 border border-gray-600 text-white text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 p-2.5 transition-colors"
                placeholder="ihre@email.de"
                required={!isLogin}
              />
            </div>

            <div>
              <label
                htmlFor="governorId"
                className="block text-sm font-medium text-gray-400 mb-1"
              >
                Gov ID
              </label>
              <input
                id="governorId"
                type="text"
                value={governorId}
                onChange={(e) => setGovernorId(e.target.value)}
                className="w-full bg-gray-700 border border-gray-600 text-white text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 p-2.5 transition-colors"
                placeholder="Gov ID aus den KD-Daten"
                required={!isLogin}
              />
            </div>
          </>
        )}

        <div>
          <label
            htmlFor="username"
            className="block text-sm font-medium text-gray-400 mb-1"
          >
            Benutzername
          </label>
          <input
            id="username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full bg-gray-700 border border-gray-600 text-white text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 p-2.5 transition-colors"
            placeholder="Benutzername"
            required
          />
        </div>

        <div>
          <label
            htmlFor="password"
            className="block text-sm font-medium text-gray-400 mb-1"
          >
            Passwort
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-gray-700 border border-gray-600 text-white text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 p-2.5 transition-colors"
            placeholder="Passwort"
            required
            minLength={6}
          />
        </div>

        {!isLogin && (
          <div>
            <label
              htmlFor="confirmPassword"
              className="block text-sm font-medium text-gray-400 mb-1"
            >
              Passwort bestätigen
            </label>
            <input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full bg-gray-700 border border-gray-600 text-white text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 p-2.5 transition-colors"
              placeholder="Passwort erneut eingeben"
              required
              minLength={6}
            />
          </div>
        )}

        <button
          type="submit"
          disabled={isLoading}
          className="w-full bg-blue-600 text-white font-semibold py-2.5 px-4 rounded-lg hover:bg-blue-700 disabled:bg-blue-800 disabled:cursor-not-allowed transition-colors"
        >
          {isLoading ? 'Bitte warten...' : isLogin ? 'Anmelden' : 'Registrieren'}
        </button>
      </form>

      <div className="mt-6 text-center">
        <button
          onClick={switchMode}
          className="text-blue-400 hover:text-blue-300 text-sm font-medium transition-colors"
        >
          {isLogin
            ? 'Noch keinen Account? Jetzt registrieren'
            : 'Bereits registriert? Jetzt anmelden'}
        </button>
      </div>
    </Card>
  );
};

export default LoginPrompt;
