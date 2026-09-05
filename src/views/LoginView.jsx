import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { Blob } from '../components/Blob';
import { User, Lock, Eye, EyeOff, ArrowRight, AlertCircle, ShieldCheck } from 'lucide-react';

export const LoginView = ({ onStartTransition }) => {
  const { login } = useAuth();
  const [username, setUsername] = useState('jack harrison');
  const [password, setPassword] = useState('123@098');
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [focusedField, setFocusedField] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAuthorizing, setIsAuthorizing] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (isSubmitting || isAuthorizing) return;
    setError('');

    // Verify credentials first
    const isValid = username.trim().toLowerCase() === 'jack harrison' && password === '123@098';
    if (!isValid) {
      setError('Invalid credentials. Access denied.');
      return;
    }

    // Enter authenticating loading blob state
    setIsSubmitting(true);
    setIsAuthorizing(true);
  };

  useEffect(() => {
    if (!isAuthorizing) return;

    // Show the fast loading blob for ~1.8s, then smoothly transition to the dashboard
    const transitionTimer = setTimeout(() => {
      onStartTransition?.();
    }, 1600);

    const loginTimer = setTimeout(() => {
      login(username, password);
    }, 1900);

    return () => {
      clearTimeout(transitionTimer);
      clearTimeout(loginTimer);
    };
  }, [isAuthorizing, onStartTransition, login, username, password]);

  return (
    <div className="fixed inset-0 flex items-center justify-center px-4 select-none">
      {/* Background canvas matching Dashboard Background with subtle radial glow */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          backgroundColor: '#EEF4FA',
          backgroundImage: [
            'radial-gradient(circle at 12% 10%, rgba(186,230,253,0.85) 0%, transparent 45%)',
            'radial-gradient(circle at 88% 12%, rgba(199,210,254,0.75) 0%, transparent 45%)',
            'radial-gradient(circle at 50% 0%,  rgba(224,242,254,0.90) 0%, transparent 55%)',
            'radial-gradient(circle at 85% 85%, rgba(186,230,253,0.80) 0%, transparent 45%)',
            'radial-gradient(circle at 15% 90%, rgba(219,234,254,0.85) 0%, transparent 50%)',
          ].join(','),
        }}
      />

      <AnimatePresence mode="wait">
        {!isAuthorizing ? (
          /* Standard Login Card with New 3D R Monogram Logo */
          <motion.div
            key="login-card"
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.94 }}
            transition={{ duration: 0.38, ease: [0.16, 1, 0.3, 1] }}
            className="relative z-10 w-full max-w-sm flex flex-col items-center"
          >
            {/* New 3D R Monogram Brand Logo */}
            <div
              className="relative w-20 h-24 select-none flex items-center justify-center mb-3"
              style={{ filter: 'drop-shadow(0 10px 24px rgba(0,132,216,0.30))' }}
            >
              <img
                src="/assets/logo-ir-transparent.png"
                alt="RESCURO R"
                className="w-full h-full object-contain block"
                draggable={false}
              />
            </div>

            {/* Wordmark Header */}
            <div className="text-center mb-6">
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                RESCURO
              </h1>
              <p className="text-[11px] font-mono tracking-widest uppercase text-slate-500 font-semibold mt-0.5">
                Supervisor Command Portal
              </p>
            </div>

            {/* Glassmorphic Form Card */}
            <form
              onSubmit={handleSubmit}
              className="w-full space-y-4 bg-white/60 backdrop-blur-xl p-6 rounded-2xl border border-white/80 shadow-[0_8px_32px_rgba(0,0,0,0.04)]"
            >
              {/* Username Field */}
              <div>
                <label className="block text-[11px] font-bold tracking-wider uppercase text-slate-500 mb-1.5">
                  Username
                </label>
                <div
                  className={`flex items-center bg-white/80 backdrop-blur-md rounded-xl border transition-all ${
                    focusedField === 'username'
                      ? 'border-blue-500 ring-2 ring-blue-500/15 shadow-sm'
                      : 'border-slate-200/80 hover:border-slate-300'
                  }`}
                >
                  <span className="pl-3 text-slate-400">
                    <User className="w-4 h-4" />
                  </span>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    onFocus={() => setFocusedField('username')}
                    onBlur={() => setFocusedField(null)}
                    placeholder="Enter username"
                    autoComplete="username"
                    required
                    className="w-full bg-transparent px-3 py-2.5 text-sm font-medium text-slate-800 outline-none placeholder-slate-400"
                  />
                </div>
              </div>

              {/* Password Field */}
              <div>
                <label className="block text-[11px] font-bold tracking-wider uppercase text-slate-500 mb-1.5">
                  Password
                </label>
                <div
                  className={`flex items-center bg-white/80 backdrop-blur-md rounded-xl border transition-all ${
                    focusedField === 'password'
                      ? 'border-blue-500 ring-2 ring-blue-500/15 shadow-sm'
                      : 'border-slate-200/80 hover:border-slate-300'
                  }`}
                >
                  <span className="pl-3 text-slate-400">
                    <Lock className="w-4 h-4" />
                  </span>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onFocus={() => setFocusedField('password')}
                    onBlur={() => setFocusedField(null)}
                    placeholder="Enter password"
                    autoComplete="current-password"
                    required
                    className="w-full bg-transparent px-3 py-2.5 text-sm font-medium text-slate-800 outline-none placeholder-slate-400"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="pr-3 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                    title={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Error Message */}
              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, height: 0, y: -6 }}
                    animate={{ opacity: 1, height: 'auto', y: 0 }}
                    exit={{ opacity: 0, height: 0, y: -6 }}
                    className="flex items-center gap-2 p-2.5 rounded-lg bg-rose-50 border border-rose-200/80 text-rose-600 text-xs font-medium"
                  >
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    <span>{error}</span>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Authorize Access Button */}
              <motion.button
                type="submit"
                disabled={isSubmitting}
                whileHover={{ scale: 1.015 }}
                whileTap={{ scale: 0.985 }}
                className="relative w-full py-3 px-4 rounded-xl font-bold text-sm text-blue-600 flex items-center justify-center gap-2 transition-all cursor-pointer overflow-hidden border border-blue-400/60 bg-blue-50/70 hover:bg-blue-100/80 backdrop-blur-md shadow-[0_4px_16px_rgba(59,130,246,0.12)] hover:shadow-[0_6px_20px_rgba(59,130,246,0.20)] hover:border-blue-500"
              >
                <ShieldCheck className="w-4 h-4 text-blue-600" />
                <span>Authorize Access</span>
                <ArrowRight className="w-4 h-4 text-blue-600" />
              </motion.button>
            </form>
          </motion.div>
        ) : (
          /* Authenticating Transition: Fast Organic Loading Blob (No text below) */
          <motion.div
            key="loading-blob-stage"
            initial={{ opacity: 0, scale: 0.88 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.05 }}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
            className="relative z-10 flex items-center justify-center"
            style={{ width: 320, height: 320 }}
          >
            {/* Ambient Background Glow */}
            <motion.div
              animate={{
                scale: [1, 1.15, 1],
                opacity: [0.45, 0.65, 0.45],
              }}
              transition={{
                duration: 1.8,
                repeat: Infinity,
                repeatType: 'reverse',
              }}
              className="absolute inset-0 rounded-full pointer-events-none"
              style={{
                background: 'radial-gradient(circle, rgba(186, 230, 253, 0.65) 0%, rgba(147, 197, 253, 0.25) 50%, transparent 75%)',
                filter: 'blur(26px)',
              }}
            />

            {/* Fast Wobbling Organic Loading Blob */}
            <Blob size={260} speed={10.5} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default LoginView;
