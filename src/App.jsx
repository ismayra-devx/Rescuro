import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { ExpansionModal } from './components/ExpansionModal';
import { TakeoverModal } from './components/TakeoverModal';
import { useAuth } from './context/AuthContext';

// Dedicated Page Views
import { DashboardView } from './views/DashboardView';
import { AgentsView } from './views/AgentsView';
import { AnalyticsView } from './views/AnalyticsView';
import { ActiveCallsView } from './views/ActiveCallsView';
import { CallHistoryView } from './views/CallHistoryView';
import { AlertsView } from './views/AlertsView';
import { LoginView } from './views/LoginView';

// ── Authenticated Dashboard Shell ─────────────────────────────────────────────
// Kept as a separate component so all hooks are always called at the same
// render level (React Rules of Hooks compliance).
const DashboardShell = () => {
    const [activeTab, setActiveTab] = useState('dashboard');
    const [activeModalKey, setActiveModalKey] = useState(null);
    const [originRect, setOriginRect] = useState(null);
    const showToast = useCallback(() => {}, []);

    // Card Click Handler with GSAP Card-to-Page Morphing Expansion
    const handleCardClick = (cardKey, e) => {
        if (e.target.closest('button')) return;
        const cardEl = e.currentTarget;
        const rect = cardEl.getBoundingClientRect();
        setOriginRect(rect);
        setActiveModalKey(cardKey);
    };

    const closeModal = () => {
        setActiveModalKey(null);
        setOriginRect(null);
    };

    // Live Waveform Visualizer Jitter for dashboard audio stream
    const [wfHeights, setWfHeights] = useState([40, 70, 30, 90, 50, 85, 45, 60]);
    useEffect(() => {
        const interval = setInterval(() => {
            setWfHeights(prev => prev.map(() => Math.floor(Math.random() * 75) + 20));
        }, 140);
        return () => clearInterval(interval);
    }, []);

    const renderActiveView = () => {
        switch (activeTab) {
            case 'agents':
                return <AgentsView onToast={showToast} />;
            case 'analytics':
                return <AnalyticsView onToast={showToast} />;
            case 'active-calls':
                return <ActiveCallsView onCardClick={handleCardClick} onToast={showToast} />;
            case 'call-history':
                return <CallHistoryView onToast={showToast} />;
            case 'alerts':
                return <AlertsView onToast={showToast} />;
            case 'dashboard':
            default:
                return (
                    <DashboardView
                        onCardClick={handleCardClick}
                        wfHeights={wfHeights}
                        onToast={showToast}
                    />
                );
        }
    };

    return (
        <div className="flex min-h-screen relative z-10 font-sans selection:bg-indigo-100 selection:text-indigo-900">
            <Sidebar
                activeTab={activeTab}
                onTabChange={setActiveTab}
                onToast={showToast}
            />
            <main className="flex-1 ml-64 flex flex-col min-h-screen">
                <Header />
                <div className="flex-1 p-8 space-y-6">
                    {renderActiveView()}
                </div>
            </main>
            {activeModalKey && (
                <ExpansionModal
                    activeCardKey={activeModalKey}
                    originRect={originRect}
                    onClose={closeModal}
                    onToast={showToast}
                />
            )}
            <TakeoverModal onToast={showToast} />
        </div>
    );
};

// ── Root App: Auth gate ───────────────────────────────────────────────────────
export const App = () => {
    const { user } = useAuth();

    return (
        <div className="relative min-h-screen">
            <AnimatePresence mode="wait">
                {user?.authenticated ? (
                    <motion.div
                        key="dashboard"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.45, ease: "easeOut" }}
                    >
                        <DashboardShell />
                    </motion.div>
                ) : (
                    <motion.div
                        key="login-view-wrapper"
                        initial={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.35, ease: "easeInOut" }}
                        className="fixed inset-0 z-50"
                    >
                        <LoginView />
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default App;
