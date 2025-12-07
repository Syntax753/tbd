import React from 'react';

interface LoadingScreenProps {
    message?: string;
}

export const LoadingScreen: React.FC<LoadingScreenProps> = ({ message = "Loading..." }) => {
    return (
        <div className="loading-container">
            <h1>THE MANSION MURDER MYSTERY</h1>
            <div className="loading-steps">
                <p className="loading-message">{message}</p>
            </div>
            <div className="spinner"></div>
        </div>
    );
};
