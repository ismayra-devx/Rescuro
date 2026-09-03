import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { PrimaryCards } from './components/PrimaryCards';
import { DataTables } from './components/DataTables';
import { ExpansionModal } from './components/ExpansionModal';
import { Toast } from './components/Toast';

export const App = () => {
    const [activeModalKey, setActiveModalKey] = useState(null);
    const [originRect, setOriginRect] = useState(null);
    const [toast, setToast] = useState({ visible: false, message: '', icon: '⚡' });
    const toastTimerRef = useRef(null);

    // Toast Trigger
    const showToast = useCallback((message, icon = '⚡') => {
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

    // Live Waveform Visualizer Jitter
    const [wfHeights, setWfHeights] = useState([40, 70, 30, 90, 50, 85, 45, 60]);
    useEffect(() => {
        const interval = setInterval(() => {
            setWfHeights(prev => prev.map(() => Math.floor(Math.random() * 75) + 20));
        }, 140);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="flex min-h-screen relative z-10 font-sans">
            {/* Fixed Navigation Sidebar with RBAC Role Switcher */}
            <Sidebar onToast={showToast} />

            {/* Main Content Area */}
            <main className="flex-1 ml-64 flex flex-col min-h-screen">
                {/* Sticky Top Header with Live Latency Pipeline & WebSocket Status */}
                <Header />

                {/* Dashboard Content Grid */}
                <div className="flex-1 p-8 space-y-6">
                    {/* Primary Telemetry & Workspace Cards */}
                    <PrimaryCards 
                        onCardClick={handleCardClick} 
                        wfHeights={wfHeights} 
                        onToast={showToast} 
                    />

                    {/* Bottom Analytical Data Tables & Map */}
                    <DataTables onToast={showToast} />
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
