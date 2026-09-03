import React from 'react';
import { PrimaryCards } from '../components/PrimaryCards';
import { DataTables } from '../components/DataTables';

export const DashboardView = ({ onCardClick, wfHeights, onToast }) => {
    return (
        <div className="space-y-6">
            {/* Primary Telemetry Metrics & Core Workspace Cards */}
            <PrimaryCards 
                onCardClick={onCardClick} 
                wfHeights={wfHeights} 
                onToast={onToast} 
            />

            {/* Bottom Analytical Data Tables & Map */}
            <DataTables onCardClick={onCardClick} onToast={onToast} />
        </div>
    );
};

export default DashboardView;
