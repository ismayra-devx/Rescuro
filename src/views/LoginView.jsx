import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { Blob } from '../components/Blob';
import { User, Lock, Eye, EyeOff, AlertCircle, ShieldCheck } from 'lucide-react';

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

    // Show the fast loading blob for ~1.8s, then smoothly transition to dashboard
    const transitionTimer = setTimeout(() => {
      onStartTransition?.();
    }, 1800);

    const loginTimer = setTimeout(() => {
      login(username, password);
    }, 2200);

    return () => {
      clearTimeout(transitionTimer);
      clearTimeout(loginTimer);
    };
  }, [isAuthorizing, onStartTransition, login, username, password]);

  return (
    <div className="fixed inset-0 flex items-center justify-center px-4 select-none">
      {/* Almost-white canvas with a very subtle blue-slate ambient tint */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          backgroundColor: '#F8FAFC',
          backgroundImage: [
            'radial-gradient(circle at 50% 0%, rgba(224, 242, 254, 0.45) 0%, transparent 60%)',
            'radial-gradient(circle at 85% 90%, rgba(219, 234, 254, 0.35) 0%, transparent 50%)',
            'radial-gradient(circle at 15% 85%, rgba(241, 245, 249, 0.50) 0%, transparent 50%)',
          ].join(','),
        }}
      />

      <AnimatePresence mode="wait">
        {!isAuthorizing ? (
          /* Standard Login Card with Modern Enterprise Security Aesthetic */
          <motion.div
            key="login-card"
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="relative z-10 w-full max-w-sm flex flex-col items-center"
          >
            {/* Reduced 3D R Monogram Logo (~56px width) */}
            <div
              className="relative w-14 h-[70px] select-none flex items-center justify-center mb-3"
              style={{ filter: 'drop-shadow(0 8px 20px rgba(0, 132, 216, 0.28))' }}
            >
              <img
                src="/assets/logo-ir-transparent.png"
                alt="RESCURO"
                className="w-full h-full object-contain block pointer-events-none"
                draggable={false}
              />
            </div>

            {/* Wordmark Header: Inter 800 with tighter spacing & refined monospace subtitle */}
            <div className="text-center mb-6">
              <h1 className="text-2xl font-[800] text-slate-900 tracking-[-0.035em] font-sans">
                RESCURO
              </h1>
              <p className="text-[10.5px] font-mono tracking-[0.14em] uppercase text-slate-400 font-medium mt-1">
                SUPERVISOR COMMAND PORTAL
              </p>
            </div>

            {/* Premium Translucent Form Card with 18px radius and soft shadow */}
            <form
              onSubmit={handleSubmit}
              className="w-full space-y-4 bg-white/90 backdrop-blur-md p-6 rounded-[18px] border border-slate-200/90 shadow-[0_12px_32px_-4px_rgba(0,0,0,0.06),0_4px_12px_-2px_rgba(0,0,0,0.03)]"
            >
              {/* Username Field */}
              <div>
                <label className="block text-[11px] font-semibold tracking-wide uppercase text-slate-600 mb-1.5 font-sans">
                  Username
                </label>
                <div
                  className={`flex items-center bg-white rounded-xl border transition-all ${
                    focusedField === 'username'
                      ? 'border-blue-600 ring-2 ring-blue-600/15 shadow-2xs'
                      : 'border-slate-300 hover:border-slate-400'
                  }`}
                >
                  <span className="pl-3.5 text-slate-500">
                    <User className="w-4 h-4" />
                  </span>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    onFocus={() => setFocusedField('username')}
                    onBlur={() => setFocusedField(null)}
                    placeholder="Enter supervisor username"
                    autoComplete="username"
                    required
                    className="w-full bg-transparent px-3 py-2.5 text-sm font-medium text-slate-900 outline-none placeholder-slate-400 font-sans"
                  />
                </div>
              </div>

              {/* Password Field */}
              <div>
                <label className="block text-[11px] font-semibold tracking-wide uppercase text-slate-600 mb-1.5 font-sans">
                  Password
                </label>
                <div
                  className={`flex items-center bg-white rounded-xl border transition-all ${
                    focusedField === 'password'
                      ? 'border-blue-600 ring-2 ring-blue-600/15 shadow-2xs'
                      : 'border-slate-300 hover:border-slate-400'
                  }`}
                >
                  <span className="pl-3.5 text-slate-500">
                    <Lock className="w-4 h-4" />
                  </span>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onFocus={() => setFocusedField('password')}
                    onBlur={() => setFocusedField(null)}
                    placeholder="Enter supervisor password"
                    autoComplete="current-password"
                    required
                    className="w-full bg-transparent px-3 py-2.5 text-sm font-medium text-slate-900 outline-none placeholder-slate-400 font-sans"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="pr-3.5 text-slate-500 hover:text-slate-700 transition-colors cursor-pointer"
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
                    className="flex items-center gap-2 p-2.5 rounded-lg bg-rose-50 border border-rose-200/90 text-rose-600 text-xs font-medium font-sans"
                  >
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    <span>{error}</span>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Solid Primary Blue Action Button */}
              <motion.button
                type="submit"
                disabled={isSubmitting}
                whileHover={{ scale: isSubmitting ? 1 : 1.012 }}
                whileTap={{ scale: isSubmitting ? 1 : 0.988 }}
                className="relative w-full py-3 px-4 rounded-xl font-semibold text-sm text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 shadow-[0_2px_8px_rgba(37,99,235,0.25)] hover:shadow-[0_4px_12px_rgba(37,99,235,0.35)] flex items-center justify-center gap-2 transition-all cursor-pointer font-sans"
              >
                <ShieldCheck className="w-4 h-4 text-white" />
                <span>{isSubmitting ? 'Authenticating...' : 'Authorize Access'}</span>
              </motion.button>
            </form>

            {/* Subtle Technical Security Status Below Card */}
            <div className="flex items-center justify-center gap-2 mt-5 text-[10px] font-mono tracking-widest text-slate-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block animate-pulse"></span>
              <span>SECURE CONNECTION ESTABLISHED</span>
            </div>
          </motion.div>
        ) : (
          /* Authenticating Transition: Fast Organic Loading Blob */
          <motion.div
            key="loading-blob-stage"
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.04 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="relative z-10 flex items-center justify-center"
            style={{ width: 320, height: 320 }}
          >
            {/* Ambient Background Glow matching the clean almost-white background */}
            <motion.div
              animate={{
                scale: [1, 1.15, 1],
                opacity: [0.35, 0.55, 0.35],
              }}
              transition={{
                duration: 1.8,
                repeat: Infinity,
                repeatType: 'reverse',
              }}
              className="absolute inset-0 rounded-full pointer-events-none"
              style={{
                background: 'radial-gradient(circle, rgba(186, 230, 253, 0.55) 0%, rgba(147, 197, 253, 0.15) 50%, transparent 75%)',
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
