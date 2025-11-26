import React, { useState } from 'react';
import { useAuth } from './AuthContext';
import { Card } from './Card';

type GovIdStatus = 'idle' | 'checking' | 'valid' | 'invalid';

const BACKEND_URL =
  process.env.NODE_ENV === 'production'
    ? 'https://kd3619-backend.onrender.com'
    : 'http://localhost:4000';

const LoginPrompt: React.FC = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [governorId, setGovernorId] = useState('');
  const [govIdStatus, setGovIdStatus] = useState<GovIdStatus>('idle');
  const [govIdMessage, setGovIdMessage] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const { login, register } = useAuth();

  const validateGovId = async () => {
    if (isLogin) return;

    const value = governorId.trim();
    if (!value) {
      setGovIdStatus('idle');
      setGovIdMessage(null);
      return;
    }

    setGovIdStatus('checking');
    setGovIdMessage(null);

    try {
      const res = await fetch(`${BACKEND_URL}/api/auth/check-gov-id`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ governorId: value }),
      });

      if (!res.ok) {
        setGovIdStatus('invalid');
        setGovIdMessage('Gov ID check failed.');
        return;
      }

      const data = await res.json();

      const existsInUsers = !!data.existsInUsers;
      const existsInFiles = !!data.existsInFiles;

      if (existsInUsers) {
        // Gov ID already bound to an existing account
        const msg =
          'An account already exists for this Gov ID. Please sign in instead.';
        setGovIdStatus('invalid');
        setGovIdMessage(msg);
      } else if (existsInFiles) {
        // Gov ID is present in KD data and not yet registered
        setGovIdStatus('valid');
        setGovIdMessage('Gov ID found. Registration is possible.');
      } else {
        // Gov ID not found in any uploaded KD data
        setGovIdStatus('invalid');
        setGovIdMessage(
          'Gov ID was not found in the KD data. Please check it or contact an admin.'
        );
      }
    } catch (e) {
      console.error('Gov ID check failed:', e);
      setGovIdStatus('invalid');
      setGovIdMessage(
        'Gov ID check failed. Please try again or contact an admin.'
      );
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);
    setIsLoading(true);

    try {
      if (isLogin) {
        await login(username, password);
      } else {
        if (password !== confirmPassword) {
          setError('Passwords do not match.');
          setIsLoading(false);
          return;
        }

        if (!governorId.trim()) {
          setError('Please enter your Gov ID.');
          setIsLoading(false);
          return;
        }

        if (govIdStatus !== 'valid') {
          setError(
            govIdMessage ||
              'Gov ID is not valid. Please check it or contact an admin.'
          );
          setIsLoading(false);
          return;
        }

        await register(email, username, password, governorId.trim());
        await login(username, password);

        setSuccessMessage('Account created successfully!');

        setEmail('');
        setUsername('');
        setGovernorId('');
        setGovIdStatus('idle');
        setGovIdMessage(null);
        setPassword('');
        setConfirmPassword('');
      }
    } catch (err: any) {
      const msg = err?.message || 'An error occurred.';
      const lower = msg.toLowerCase();

      if (
        lower.includes('gov id') &&
        (lower.includes('existiert bereits') || lower.includes('already'))
      ) {
        const friendly =
          'An account already exists for this Gov ID. Please sign in instead.';
        setError(friendly);
        setGovIdStatus('invalid');
        setGovIdMessage(friendly);
      } else if (lower.includes('gov id')) {
        const friendly =
          'There was a problem with this Gov ID. Please check it or contact an admin.';
        setError(friendly);
        setGovIdStatus('invalid');
        setGovIdMessage(friendly);
      } else if (lower.includes('passwort muss mindestens')) {
        setError('Password must be at least 6 characters long.');
      } else if (
        lower.includes('email oder benutzername ist bereits vergeben') ||
        lower.includes('email oder benutzername')
      ) {
        setError('Email or username is already taken.');
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
    setGovIdStatus('idle');
    setGovIdMessage(null);
    setPassword('');
    setConfirmPassword('');
  };

  const isLoginFormInvalid = !username || !password;

  const isRegisterFormInvalid =
    !email ||
    !username ||
    !governorId.trim() ||
    !password ||
    !confirmPassword ||
    password.length < 6 ||
    confirmPassword.length < 6 ||
    password !== confirmPassword ||
    govIdStatus !== 'valid';

  const isSubmitDisabled =
    isLoading || (isLogin ? isLoginFormInvalid : isRegisterFormInvalid);

  return (
    <Card className="max-w-md mx-auto p-8">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-white">
          {isLogin ? 'Sign In' : 'Register'}
        </h2>
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
            {/* Email */}
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-gray-400 mb-1"
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-gray-700 border border-gray-600 text-white text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 p-2.5 transition-colors"
                placeholder="you@example.com"
                required={!isLogin}
              />
            </div>

            {/* Gov ID */}
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
                onChange={(e) => {
                  setGovernorId(e.target.value);
                  setGovIdStatus('idle');
                  setGovIdMessage(null);
                }}
                onBlur={validateGovId}
                className="w-full bg-gray-700 border border-gray-600 text-white text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 p-2.5 transition-colors"
                placeholder="Gov ID from KD data"
                required={!isLogin}
              />

              {govIdStatus === 'checking' && (
                <p className="text-xs text-gray-400 mt-1">Checking Gov ID…</p>
              )}
              {govIdStatus === 'valid' && (
                <p className="text-xs text-green-400 mt-1">
                  {govIdMessage || 'Gov ID found. Registration is possible.'}
                </p>
              )}
              {govIdStatus === 'invalid' && (
                <p className="text-xs text-red-400 mt-1">
                  {govIdMessage ||
                    'Gov ID is not valid. Please check it or contact an admin.'}
                </p>
              )}
            </div>
          </>
        )}

        {/* Username */}
        <div>
          <label
            htmlFor="username"
            className="block text-sm font-medium text-gray-400 mb-1"
          >
            Username
          </label>
          <input
            id="username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full bg-gray-700 border border-gray-600 text-white text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 p-2.5 transition-colors"
            placeholder="Your in-game name"
            required
          />
        </div>

        {/* Password */}
        <div>
          <label
            htmlFor="password"
            className="block text-sm font-medium text-gray-400 mb-1"
          >
            Password
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-gray-700 border border-gray-600 text-white text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 p-2.5 transition-colors"
            placeholder="••••••••"
            required
            minLength={6}
          />
        </div>

        {/* Confirm Password */}
        {!isLogin && (
          <div>
            <label
              htmlFor="confirmPassword"
              className="block text-sm font-medium text-gray-400 mb-1"
            >
              Confirm Password
            </label>
            <input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full bg-gray-700 border border-gray-600 text-white text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 p-2.5 transition-colors"
              placeholder="Repeat password"
              required
              minLength={6}
            />
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={isSubmitDisabled}
          className="w-full bg-blue-600 text-white font-semibold py-2.5 px-4 rounded-lg hover:bg-blue-700 disabled:bg-blue-800 disabled:cursor-not-allowed transition-colors"
        >
          {isLoading
            ? isLogin
              ? 'Signing in...'
              : 'Creating account...'
            : isLogin
            ? 'Sign In'
            : 'Register'}
        </button>
      </form>

      <div className="mt-4 text-center">
        <button
          onClick={switchMode}
          className="text-blue-400 hover:text-blue-300 text-sm font-medium transition-colors"
        >
          {isLogin
            ? "Don't have an account? Register now"
            : 'Already registered? Sign in'}
        </button>
      </div>
    </Card>
  );
};

export default LoginPrompt;
