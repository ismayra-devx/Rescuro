import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { Blob } from '../components/Blob';
import { User, Lock, Eye, EyeOff, AlertCircle, ShieldCheck } from 'lucide-react';

export const LoginView = () => {
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

    // Display fast wobbling blob during authorization, then cleanly authenticate
    const loginTimer = setTimeout(() => {
      login(username, password);
    }, 1500);

    return () => {
      clearTimeout(loginTimer);
    };
  }, [isAuthorizing, login, username, password]);

  return (
    <div className="fixed inset-0 flex items-center justify-center px-4 select-none">
      {/* Dynamic Blue Moving Gradient Canvas with 50% Transparency */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden bg-[#F8FAFC]">
        {/* 50% Opacity Moving Gradient Container */}
        <div className="absolute inset-0 opacity-50 login-gradient-bg">
          {/* Animated Moving Gradient Orb 1 (Top Left / Center) */}
          <motion.div
            animate={{
              x: [-90, 100, -50, -90],
              y: [-60, 80, -30, -60],
              scale: [1, 1.25, 0.9, 1],
            }}
            transition={{
              duration: 7,
              repeat: Infinity,
              repeatType: 'reverse',
              ease: 'easeInOut',
            }}
            className="absolute -top-24 -left-24 w-[560px] h-[560px] rounded-full"
            style={{
              background: 'radial-gradient(circle, rgba(56, 189, 248, 0.7) 0%, rgba(59, 130, 246, 0.45) 45%, transparent 70%)',
              filter: 'blur(60px)',
            }}
          />

          {/* Animated Moving Gradient Orb 2 (Bottom Right / Center) */}
          <motion.div
            animate={{
              x: [100, -90, 60, 100],
              y: [70, -80, 40, 70],
              scale: [0.9, 1.25, 0.95, 0.9],
            }}
            transition={{
              duration: 8,
              repeat: Infinity,
              repeatType: 'reverse',
              ease: 'easeInOut',
            }}
            className="absolute -bottom-28 -right-28 w-[620px] h-[620px] rounded-full"
            style={{
              background: 'radial-gradient(circle, rgba(37, 99, 235, 0.6) 0%, rgba(96, 165, 250, 0.4) 50%, transparent 70%)',
              filter: 'blur(65px)',
            }}
          />

          {/* Animated Moving Gradient Orb 3 (Center / Dynamic Flow) */}
          <motion.div
            animate={{
              x: [-70, 80, -80, -70],
              y: [60, -60, 50, 60],
              scale: [1.18, 0.88, 1.15, 1.18],
            }}
            transition={{
              duration: 6.5,
              repeat: Infinity,
              repeatType: 'reverse',
              ease: 'easeInOut',
            }}
            className="absolute top-1/4 left-1/3 w-[500px] h-[500px] rounded-full"
            style={{
              background: 'radial-gradient(circle, rgba(14, 165, 233, 0.55) 0%, rgba(147, 197, 253, 0.35) 50%, transparent 72%)',
              filter: 'blur(55px)',
            }}
          />

          {/* Animated Moving Gradient Orb 4 (Bottom Left Accent) */}
          <motion.div
            animate={{
              x: [80, -70, 50, 80],
              y: [-50, 70, -50, -50],
              scale: [0.95, 1.2, 0.95, 0.95],
            }}
            transition={{
              duration: 7.5,
              repeat: Infinity,
              repeatType: 'reverse',
              ease: 'easeInOut',
            }}
            className="absolute bottom-10 left-10 w-[440px] h-[440px] rounded-full"
            style={{
              background: 'radial-gradient(circle, rgba(2, 132, 199, 0.5) 0%, rgba(186, 230, 253, 0.3) 50%, transparent 70%)',
              filter: 'blur(50px)',
            }}
          />
        </div>
      </div>

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
              className="w-full space-y-4 bg-white/88 backdrop-blur-xl p-6 rounded-[18px] border border-white/90 shadow-[0_16px_40px_-6px_rgba(37,99,235,0.12),0_4px_16px_-2px_rgba(0,0,0,0.03)]"
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
