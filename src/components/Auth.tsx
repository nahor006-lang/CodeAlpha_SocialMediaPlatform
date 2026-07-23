import { useState, type FormEvent } from 'react';
import { motion } from 'motion/react';
import logoUrl from '../assets/logo.svg';
import { User } from '../types';
import { KeyRound, User as UserIcon, UserCheck, Eye, EyeOff } from 'lucide-react';
import { apiFetch } from '../lib/api';

interface AuthProps {
  onAuthSuccess: (user: User) => void;
  initialMode?: 'login' | 'register';
}

export default function Auth({ onAuthSuccess, initialMode = 'login' }: AuthProps) {
  const [mode, setMode] = useState<'login' | 'register'>(initialMode);
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const url = mode === 'login' ? '/api/auth/login' : '/api/auth/register';
    const body = mode === 'login' 
      ? { username, password } 
      : { username, password, display_name: displayName };

    try {
      const res = await apiFetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Something went wrong. Please try again.');
      }

      if (data.user) {
        onAuthSuccess(data.user);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div id="auth-container" className="flex items-center justify-center min-h-[75vh] px-4">
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="w-full max-w-md bg-white border border-ink/5 rounded-[2.5rem] p-8 shadow-md relative overflow-hidden"
      >
        {/* Aesthetic crimson thread line running through the top of the card */}
        <div className="absolute top-0 left-0 w-full h-0.75 bg-crimson" />

        <div className="text-center mb-8">
          {/* Logo */}
          <div className="flex items-center justify-center gap-2 mb-2">
            <img src={logoUrl} className="w-9 h-9 object-contain" alt="Knot Logo" />
            <span className="font-display font-bold text-3xl text-ink tracking-tight">Knot</span>
          </div>
          <p className="text-sm text-sage font-medium tracking-tight">
            {mode === 'login' ? 'Untangle your connections' : 'Join a community of genuine connections'}
          </p>
        </div>

        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="mb-4 p-3 bg-crimson/5 border border-crimson/20 rounded-xl text-xs text-crimson font-medium"
          >
            {error}
          </motion.div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-ink uppercase tracking-wider mb-1.5">
              Username
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-sage">
                <UserIcon className="w-4 h-4" />
              </span>
              <input
                id="auth-username-input"
                type="text"
                required
                placeholder="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-cream/30 border border-ink/10 rounded-2xl text-sm focus:border-crimson focus:outline-none transition-colors"
              />
            </div>
          </div>

          {mode === 'register' && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="space-y-4"
            >
              <div>
                <label className="block text-xs font-semibold text-ink uppercase tracking-wider mb-1.5">
                  Display Name
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-sage">
                    <UserCheck className="w-4 h-4" />
                  </span>
                  <input
                    id="auth-display-name-input"
                    type="text"
                    required={mode === 'register'}
                    placeholder="Jane Doe"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-cream/30 border border-ink/10 rounded-2xl text-sm focus:border-crimson focus:outline-none transition-colors"
                  />
                </div>
              </div>
            </motion.div>
          )}

          <div>
            <label className="block text-xs font-semibold text-ink uppercase tracking-wider mb-1.5">
              Password
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-sage">
                <KeyRound className="w-4 h-4" />
              </span>
              <input
                id="auth-password-input"
                type={showPassword ? 'text' : 'password'}
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-10 py-2.5 bg-cream/30 border border-ink/10 rounded-2xl text-sm focus:border-crimson focus:outline-none transition-colors"
              />
              <button
                type="button"
                id="auth-toggle-password-btn"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-sage hover:text-ink transition-colors"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            id="auth-submit-btn"
            disabled={loading}
            className="w-full py-3 bg-crimson hover:bg-crimson/95 disabled:bg-crimson/50 text-white font-medium text-sm rounded-2xl shadow-sm hover:shadow transition-all duration-150 mt-2"
          >
            {loading ? 'Processing...' : mode === 'login' ? 'Sign In' : 'Create Account'}
          </button>
        </form>

        <div className="mt-6 text-center border-t border-ink/5 pt-5">
          <p className="text-xs text-sage">
            {mode === 'login' ? "Don't have an account?" : 'Already have an account?'}
            <button
              id="auth-toggle-mode-btn"
              onClick={() => {
                setMode(mode === 'login' ? 'register' : 'login');
                setError(null);
              }}
              className="ml-1 font-semibold text-crimson hover:underline"
            >
              {mode === 'login' ? 'Sign Up' : 'Log In'}
            </button>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
