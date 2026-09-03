import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { ExpansionModal } from './components/ExpansionModal';
import { Toast } from './components/Toast';

// Dedicated Page Views
import { DashboardView } from './views/DashboardView';
import { AgentsView } from './views/AgentsView';
import { AnalyticsView } from './views/AnalyticsView';
import { ActiveCallsView } from './views/ActiveCallsView';
import { CallHistoryView } from './views/CallHistoryView';
import { AlertsView } from './views/AlertsView';
import { SettingsView } from './views/SettingsView';

export const App = () => {
    // Dynamic Active Tab State for Sidebar Routing
    const [activeTab, setActiveTab] = useState('dashboard');
    const [activeModalKey, setActiveModalKey] = useState(null);
    const [originRect, setOriginRect] = useState(null);
    const [toast, setToast] = useState({ visible: false, message: '', icon: 'info' });
    const toastTimerRef = useRef(null);

    // Toast Trigger
    const showToast = useCallback((message, icon = 'info') => {
        if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
        setToast({ visible: true, message, icon });
        toastTimerRef.current = setTimeout(() => {
            setToast(prev => ({ ...prev, visible: false }));
        }, 3500);
    }, []);

    // Card Click Handler with GSAP Card-to-Page Morphing Expansion
    const handleCardClick = (cardKey, e) => {
        // Prevent trigger if clicking an internal button
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

    // Render active page view component
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
            case 'settings':
                return <SettingsView onToast={showToast} />;
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
            {/* Fixed Navigation Sidebar with Dynamic View Routing */}
            <Sidebar 
                activeTab={activeTab} 
                onTabChange={setActiveTab} 
                onToast={showToast} 
            />

            {/* Main Content Area */}
            <main className="flex-1 ml-64 flex flex-col min-h-screen">
                {/* Clean Sticky Top Header */}
                <Header />

                {/* Dynamic Page View Container */}
                <div className="flex-1 p-8 space-y-6">
                    {renderActiveView()}
                </div>
            </main>

            {/* GSAP Physics-Based Expansion Modal Overlay */}
            {activeModalKey && (
                <ExpansionModal
                    activeCardKey={activeModalKey}
                    originRect={originRect}
                    onClose={closeModal}
                    onToast={showToast}
                />
            )}

            {/* Global Toast Notifications */}
            <Toast toast={toast} />
        </div>
    );
};

export default App;
