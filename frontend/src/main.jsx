import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { AuthProvider } from './context/AuthContext';
import { LiveStreamProvider } from './context/LiveStreamContext';
import '../css/styles.css';

const rootElement = document.getElementById('root');
if (rootElement) {
    const root = ReactDOM.createRoot(rootElement);
    root.render(
        <React.StrictMode>
            <AuthProvider>
                <LiveStreamProvider>
                    <App />
                </LiveStreamProvider>
            </AuthProvider>
        </React.StrictMode>
    );
}
