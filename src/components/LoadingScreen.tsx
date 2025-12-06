import React from 'react';

export const LoadingScreen: React.FC = () => {
    return (
        <div className="loading-container">
            <h1>THE MANSION MURDER MYSTERY</h1>
            <div className="loading-steps">
                <p className="fade-in-1">The Writer is drafting the plot...</p>
                <p className="fade-in-2">The Location Scout is finding the manor...</p>
                <p className="fade-in-3">The Casting Director is hiring 8 suspects...</p>
                <p className="fade-in-4">The Executive Director is setting the scene...</p>
            </div>
            <div className="spinner"></div>
        </div>
    );
};
